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
      currentData.pushSent = true; // Mark as sent/pending to acquire lock
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
        res.status(404).json({ error: 'Group not found' });
        return;
      }
      groupData = groupSnap.data() || null;
      allParticipants = groupData?.memberIds || [];
      title = `Nova mensagem em ${groupData?.name || 'Grupo'}`;
    }

    // Validate sender belongs to conversation
    if (!allParticipants.includes(user.uid)) {
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

    const tokens: string[] = [];
    for (const rid of recipientIds) {
      const devicesSnap = await adminFirestore.collection(`users/${rid}/devices`).where('enabled', '==', true).get();
      devicesSnap.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        const t = doc.data().token as string;
        if (t) tokens.push(t);
      });
    }

    if (tokens.length === 0) {
      await messageRef.update({ pushSent: true });
      res.status(200).json({ success: true, reason: 'No valid device tokens found' });
      return;
    }

    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title,
      body: bodyText,
      data: { conversationId, conversationType: messageData.conversationType },
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
    
    const invalidTokens: string[] = [];

    // Check immediate ticket errors (like DeviceNotRegistered)
    result.data?.forEach((ticket: ExpoTicket, index: number) => {
      if (ticket.status === 'error' && (ticket.details?.error === 'DeviceNotRegistered' || ticket.details?.error === 'InvalidCredentials')) {
        invalidTokens.push(tokens[index]);
      }
    });

    if (invalidTokens.length > 0) {
      for (const rid of recipientIds) {
        const devicesSnap = await adminFirestore.collection(`users/${rid}/devices`).where('token', 'in', invalidTokens).get();
        devicesSnap.forEach(doc => {
          doc.ref.delete();
        });
      }
    }

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

export default router;
