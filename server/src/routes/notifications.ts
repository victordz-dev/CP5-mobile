import { Router, Request, Response } from 'express';
import { adminDatabase, adminFirestore, adminMessaging } from '../services/firebaseAdmin';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';

const router = Router();

router.post('/messages', authenticate, async (req: Request, res: Response) => {
  const { conversationId, messageId } = req.body;
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!conversationId || !messageId) {
    res.status(400).json({ error: 'Missing conversationId or messageId' });
    return;
  }

  try {
    const messageRef = adminDatabase.ref(`messages/${conversationId}/${messageId}`);
    const messageSnap = await messageRef.once('value');
    if (!messageSnap.exists()) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }
    const messageData = messageSnap.val();
    
    if (messageData.senderId !== user.uid) {
      res.status(403).json({ error: 'You are not the sender of this message' });
      return;
    }

    // Atomic transaction for idempotency
    const txResult = await messageRef.transaction((currentData) => {
      if (currentData === null) return null;
      if (currentData.pushSent) {
        return; // Abort transaction if already sent or pending
      }
      currentData.pushSent = 'pending'; // Mark as sent/pending to acquire lock
      return currentData;
    });

    if (!txResult.committed) {
      res.status(200).json({ success: true, reason: 'Push already sent or message deleted' });
      return;
    }

    let allParticipants: string[] = [];
    let title = 'Nova mensagem';
    let bodyText = messageData.text;
    let groupData: FirebaseFirestore.DocumentData | null = null;

    if (messageData.conversationType === 'direct') {
      const convSnap = await adminFirestore.doc(`directConversations/${conversationId}`).get();
      if (convSnap.exists) {
        allParticipants = convSnap.data()?.participantIds || [];
      }
    } else if (messageData.conversationType === 'group') {
      const groupSnap = await adminFirestore.doc(`groups/${conversationId}`).get();
      if (!groupSnap.exists) {
        await messageRef.update({ pushSent: false });
        res.status(404).json({ error: 'Group not found' });
        return;
      }
      groupData = groupSnap.data() || null;
      allParticipants = groupData?.memberIds || [];
      title = `Nova mensagem em ${groupData?.name || 'Grupo'}`;
    }

    // Validate sender belongs to conversation
    if (!allParticipants.includes(user.uid)) {
      await messageRef.update({ pushSent: false });
      res.status(403).json({ error: 'Sender does not belong to the conversation' });
      return;
    }

    // Filter recipients and mentions
    let recipientIds: string[] = [];

    if (messageData.conversationType === 'direct') {
      recipientIds = allParticipants.filter((id: string) => id !== user.uid);
    } else if (messageData.conversationType === 'group' && groupData) {
      const policy = groupData.notificationPolicy || 'all_group_messages';

      if (policy === 'disabled' || policy === 'direct_messages_only') {
        // Mark as sent even if disabled to avoid retrying
        await messageRef.update({ pushSent: true });
        res.status(200).json({ success: true, reason: 'Notifications disabled by policy' });
        return;
      }

      if (policy === 'all_group_messages') {
        recipientIds = allParticipants.filter((id: string) => id !== user.uid);
      } else if (policy === 'mentioned_members') {
        const mentionedIds = messageData.mentionedUserIds || [];
        // Validate mentioned users belong to conversation
        recipientIds = mentionedIds.filter((id: string) => id !== user.uid && allParticipants.includes(id));
      }
    }

    if (recipientIds.length === 0) {
      await messageRef.update({ pushSent: true });
      res.status(200).json({ success: true, reason: 'No valid recipients to notify' });
      return;
    }

    const tokensMap: { token: string; userId: string }[] = [];
    for (const rid of recipientIds) {
      const devicesSnap = await adminFirestore.collection(`users/${rid}/devices`).where('enabled', '==', true).get();
      devicesSnap.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        const t = doc.data().token as string;
        if (t) tokensMap.push({ token: t, userId: rid });
      });
    }

    if (tokensMap.length === 0) {
      await messageRef.update({ pushSent: true });
      res.status(200).json({ success: true, reason: 'No valid device tokens found' });
      return;
    }

    const messages = tokensMap.map(t => ({
      to: t.token,
      sound: 'default',
      title,
      body: 'Você recebeu uma nova mensagem',
      data: { 
        conversationId, 
        conversationType: messageData.conversationType,
        name: messageData.conversationType === 'group' ? (groupData?.name || 'Grupo') : 'Usuário' 
      },
    }));

    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await expoRes.json();
    if (!expoRes.ok) {
      await messageRef.update({ pushSent: false });
      res.status(502).json({ error: 'Expo Push API failed' });
      return;
    }
    
    const invalidTokensMap: { token: string; userId: string }[] = [];
    const validTickets: { id: string; token: string; userId: string }[] = [];

    interface ExpoTicket {
      status: 'ok' | 'error';
      id?: string;
      details?: { error?: string };
    }

    // Check immediate ticket errors (like DeviceNotRegistered)
    result.data?.forEach((ticket: ExpoTicket, index: number) => {
      const tMap = tokensMap[index];
      if (ticket.status === 'error' && (ticket.details?.error === 'DeviceNotRegistered' || ticket.details?.error === 'InvalidCredentials')) {
        invalidTokensMap.push(tMap);
      } else if (ticket.status === 'ok' && ticket.id) {
        validTickets.push({ id: ticket.id, token: tMap.token, userId: tMap.userId });
      }
    });

    if (invalidTokensMap.length > 0) {
      for (const tMap of invalidTokensMap) {
        const devicesSnap = await adminFirestore.collection(`users/${tMap.userId}/devices`).where('token', '==', tMap.token).get();
        devicesSnap.forEach(doc => {
          doc.ref.delete();
        });
      }
    }

    // Save valid tickets for receipt processing
    if (validTickets.length > 0) {
      const batch = adminFirestore.batch();
      for (const t of validTickets) {
        const ref = adminFirestore.collection('pushTickets').doc(t.id);
        batch.set(ref, { token: t.token, userId: t.userId, createdAt: Date.now() });
      }
      await batch.commit();
    }

    await messageRef.update({ pushSent: true });
    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('Error sending push', error);
    // If a hard error happens before marking sent, we should revert pushSent so it can be retried.
    if (req.body.messageId && req.body.conversationId) {
      try {
         await adminDatabase.ref(`messages/${req.body.conversationId}/${req.body.messageId}`).update({ pushSent: false });
      } catch (e) {}
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/receipts', async (req: Request, res: Response) => {
  const secret = req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized CRON request' });
    return;
  }
  
  try {
    const snap = await adminFirestore.collection('pushTickets').orderBy('createdAt', 'asc').limit(100).get();
    if (snap.empty) {
      res.status(200).json({ success: true, reason: 'No tickets to process' });
      return;
    }
    
    const tickets = snap.docs.map(d => ({ id: d.id, ...(d.data() as { token: string, userId: string }) }));
    const ids = tickets.map(t => t.id);

    const expoRes = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ ids }),
    });

    if (!expoRes.ok) {
      res.status(502).json({ error: 'Expo API error' });
      return;
    }

    const { data, errors } = await expoRes.json();
    if (errors) {
      res.status(502).json({ error: 'Expo returned errors', details: errors });
      return;
    }

    const batch = adminFirestore.batch();
    const invalidTokens: { token: string; userId: string }[] = [];

    interface ExpoReceipt {
      status: 'ok' | 'error';
      message?: string;
      details?: { error?: string };
    }
    for (const [id, receiptData] of Object.entries(data)) {
      const receipt = receiptData as ExpoReceipt;
      if (receipt.status === 'error' && (receipt.details?.error === 'DeviceNotRegistered' || receipt.details?.error === 'InvalidCredentials')) {
        const t = tickets.find(x => x.id === id);
        if (t) invalidTokens.push({ token: t.token, userId: t.userId });
      }
      batch.delete(adminFirestore.collection('pushTickets').doc(id));
    }

    // Delete invalid tokens
    for (const tMap of invalidTokens) {
      const devicesSnap = await adminFirestore.collection(`users/${tMap.userId}/devices`).where('token', '==', tMap.token).get();
      devicesSnap.forEach(doc => batch.delete(doc.ref));
    }

    await batch.commit();
    res.status(200).json({ success: true, processedCount: ids.length, deletedCount: invalidTokens.length });
  } catch (error) {
    console.error('Receipt processing error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
