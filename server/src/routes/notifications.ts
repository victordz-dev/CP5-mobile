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

    if (messageData.pushSent) {
      res.status(200).json({ success: true, reason: 'Push already sent or message deleted' });
      return;
    }

    let allParticipants: string[] = [];
    let title = 'Nova mensagem';
    let bodyText = messageData.text;
    let groupData: any = null;

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
      groupData = groupSnap.data();
      allParticipants = groupData?.memberIds || [];
      title = `Nova mensagem em ${groupData?.name}`;
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
    } else if (messageData.conversationType === 'group') {
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
    
    // Check receipts (Ticket errors)
    const invalidTokens: string[] = [];
    result.data?.forEach((ticket: any, index: number) => {
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

    // Marcar como enviada SOMENTE após o sucesso do envio da requisição (Idempotência)
    if (expoRes.ok) {
      await messageRef.update({ pushSent: true });
    }

    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('Error sending push', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
