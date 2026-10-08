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
    // 1. Check if message exists and user is sender
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

    if (messageData.senderId !== user.uid) {
      res.status(403).json({ error: 'You are not the sender of this message' });
      return;
    }

    // Atomic transaction for idempotency
    const txResult = await messageRef.transaction((currentData) => {
      if (currentData === null) return null;
      if (currentData.pushSent) {
        return; // Abort transaction
      }
      currentData.pushSent = true;
      return currentData;
    });

    if (!txResult.committed) {
      res.status(200).json({ success: true, reason: 'Push already sent or message deleted' });
      return;
    }

    // 2. Fetch recipients and group/conversation data
    let recipientIds: string[] = [];
    let title = 'Nova mensagem';
    let bodyText = messageData.text;

    if (messageData.conversationType === 'direct') {
      const convSnap = await adminFirestore.doc(`directConversations/${conversationId}`).get();
      if (convSnap.exists) {
        const data = convSnap.data();
        recipientIds = data?.participantIds?.filter((id: string) => id !== user.uid) || [];
      }
    } else if (messageData.conversationType === 'group') {
      const groupSnap = await adminFirestore.doc(`groups/${conversationId}`).get();
      if (!groupSnap.exists) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }
      const groupData = groupSnap.data() as { name: string; notificationPolicy: string; memberIds: string[] };
      const policy = groupData.notificationPolicy || 'all_group_messages';
      title = `Nova mensagem em ${groupData.name}`;

      if (policy === 'disabled' || policy === 'direct_messages_only') {
        res.status(200).json({ success: true, reason: 'Notifications disabled by policy' });
        return;
      }

      if (policy === 'all_group_messages') {
        recipientIds = groupData.memberIds.filter((id: string) => id !== user.uid);
      } else if (policy === 'mentioned_members') {
        const mentionedIds = messageData.mentionedUserIds || [];
        recipientIds = mentionedIds.filter((id: string) => id !== user.uid);
      }
    }

    if (recipientIds.length === 0) {
      res.status(200).json({ success: true, reason: 'No recipients to notify' });
      return;
    }

    // 3. Fetch device tokens for recipients
    const tokens: string[] = [];
    for (const rid of recipientIds) {
      const devicesSnap = await adminFirestore.collection(`users/${rid}/devices`).where('enabled', '==', true).get();
      devicesSnap.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        const t = doc.data().token as string;
        if (t) tokens.push(t);
      });
    }

    if (tokens.length === 0) {
      res.status(200).json({ success: true, reason: 'No valid device tokens found' });
      return;
    }

    // 4. Send Push using FCM or Expo (We use FCM Admin SDK, wait, Expo SDK pushes require expo's server unless we format it specially. The instruction says FCM or Expo Push. We can use Expo's chunk pushing, but since we have `expo-notifications`, we can send a standard FCM message if we use FCM tokens. If we use Expo tokens, we need to call Expo Push API. Let's use Expo Push API directly as it's easier and standard for Expo apps.)
    // But the requirement says "enviar notificações pelo FCM ou pelo Expo Push Service." Let's use Expo Push service.
    
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
    
    
    // Remove invalid tokens (Process receipts)
    const invalidTokens: string[] = [];
    result.data.forEach((ticket: any, index: number) => {
      if (ticket.status === 'error' && (ticket.details?.error === 'DeviceNotRegistered' || ticket.details?.error === 'InvalidCredentials')) {
        invalidTokens.push(tokens[index]);
      }
    });

    if (invalidTokens.length > 0) {
      // Clean up invalid tokens from Firestore
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
