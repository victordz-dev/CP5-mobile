import { timingSafeEqual } from 'node:crypto';
import { Request, Response, Router } from 'express';
import { DocumentReference } from 'firebase-admin/firestore';
import {
  isDocumentId,
  isJsonObject,
  isNonEmptyString,
  parseDirectConversation,
  parseGroupRecord,
  parseStoredMessage,
} from '../domain/contracts';
import { selectDirectRecipients, selectGroupRecipients } from '../domain/recipients';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';
import { adminDatabase, adminFirestore } from '../services/firebaseAdmin';
import {
  ExpoPushMessage,
  getExpoPushReceipts,
  isExpoPushToken,
  sendExpoPushMessages,
} from '../services/expoPush';

const router = Router();

interface DeviceToken {
  token: string;
  userId: string;
  devicePath: string;
}

interface PushTicketRecord extends DeviceToken {
  id: string;
  createdAt: number;
}

async function deleteDocumentReferences(references: readonly DocumentReference[]): Promise<void> {
  const uniqueReferences = [...new Map(references.map((reference) => [reference.path, reference])).values()];
  for (let offset = 0; offset < uniqueReferences.length; offset += 400) {
    const batch = adminFirestore.batch();
    uniqueReferences.slice(offset, offset + 400).forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
}

async function loadEnabledDeviceTokens(userIds: readonly string[]): Promise<DeviceToken[]> {
  const snapshots = await Promise.all(
    userIds.map(async (userId) => ({
      userId,
      snapshot: await adminFirestore
        .collection(`users/${userId}/devices`)
        .where('enabled', '==', true)
        .get(),
    })),
  );

  const validTokens = new Map<string, DeviceToken>();
  const invalidReferences: DocumentReference[] = [];
  snapshots.forEach(({ userId, snapshot }) => {
    snapshot.docs.forEach((document) => {
      const tokenValue: unknown = document.data().token;
      if (typeof tokenValue !== 'string' || !isExpoPushToken(tokenValue)) {
        invalidReferences.push(document.ref);
        return;
      }
      if (!validTokens.has(tokenValue)) {
        validTokens.set(tokenValue, {
          token: tokenValue,
          userId,
          devicePath: document.ref.path,
        });
      }
    });
  });

  await deleteDocumentReferences(invalidReferences);
  return [...validTokens.values()];
}

async function claimMessageForPush(messagePath: string): Promise<{ acquired: boolean; state: unknown }> {
  const pushStateRef = adminDatabase.ref(`${messagePath}/pushSent`);
  const result = await pushStateRef.transaction((currentState: unknown) => {
    if (currentState === null || currentState === false) {
      return 'pending';
    }
    return;
  }, undefined, false);

  return { acquired: result.committed, state: result.snapshot.val() as unknown };
}

async function setPushState(messagePath: string, state: 'sent' | 'skipped' | 'rejected' | 'failed') {
  await adminDatabase.ref(`${messagePath}/pushSent`).set(state);
}

function isAuthorizedCronRequest(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const provided = req.headers['x-cron-secret'];
  if (!expected || typeof provided !== 'string') {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

router.post('/messages', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const body: unknown = req.body;
  if (!user) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  if (
    !isJsonObject(body)
    || !isDocumentId(body.conversationId)
    || !isDocumentId(body.messageId)
    || Object.keys(body).some((key) => key !== 'conversationId' && key !== 'messageId')
  ) {
    res.status(400).json({ error: 'Informe somente conversationId e messageId válidos.' });
    return;
  }

  const { conversationId, messageId } = body;
  const messagePath = `messages/${conversationId}/${messageId}`;
  let claimAcquired = false;

  try {
    const messageSnapshot = await adminDatabase.ref(messagePath).once('value');
    if (!messageSnapshot.exists()) {
      res.status(404).json({ error: 'Mensagem não encontrada.' });
      return;
    }

    const message = parseStoredMessage(messageSnapshot.val() as unknown);
    if (!message || message.id !== messageId || message.conversationId !== conversationId) {
      res.status(422).json({ error: 'A mensagem persistida possui dados inválidos.' });
      return;
    }
    if (message.senderId !== user.uid) {
      res.status(403).json({ error: 'Somente o remetente pode solicitar o push desta mensagem.' });
      return;
    }

    const claim = await claimMessageForPush(messagePath);
    if (!claim.acquired) {
      res.status(200).json({ success: true, duplicate: true, state: claim.state });
      return;
    }
    claimAcquired = true;

    let recipientIds: string[];
    let title: string;
    let notificationName: string;

    const senderSnapshot = await adminFirestore.doc(`users/${user.uid}`).get();
    const senderData: unknown = senderSnapshot.data();
    const senderName = isJsonObject(senderData) && isNonEmptyString(senderData.name, 80)
      ? senderData.name
      : 'Usuário';

    if (message.conversationType === 'direct') {
      const conversationSnapshot = await adminFirestore
        .doc(`directConversations/${conversationId}`)
        .get();
      const conversation = parseDirectConversation(conversationSnapshot.data());
      const expectedId = conversation?.participantIds.join('_');
      if (!conversationSnapshot.exists || !conversation || expectedId !== conversationId) {
        await setPushState(messagePath, 'rejected');
        res.status(404).json({ error: 'Conversa individual não encontrada ou inválida.' });
        return;
      }
      if (!conversation.participantIds.includes(user.uid)) {
        await setPushState(messagePath, 'rejected');
        res.status(403).json({ error: 'O remetente não participa desta conversa.' });
        return;
      }

      recipientIds = selectDirectRecipients(
        conversation.participantIds,
        user.uid,
        conversation.notificationPolicy === 'disabled',
      );
      title = senderName;
      notificationName = senderName;
    } else {
      const groupSnapshot = await adminFirestore.doc(`groups/${conversationId}`).get();
      const group = parseGroupRecord(groupSnapshot.data());
      if (!groupSnapshot.exists || !group || group.id !== conversationId) {
        await setPushState(messagePath, 'rejected');
        res.status(404).json({ error: 'Grupo não encontrado ou inválido.' });
        return;
      }
      if (!group.memberIds.includes(user.uid)) {
        await setPushState(messagePath, 'rejected');
        res.status(403).json({ error: 'O remetente não é integrante ativo do grupo.' });
        return;
      }

      recipientIds = selectGroupRecipients(group, message);
      title = group.name;
      notificationName = group.name;
    }

    if (recipientIds.length === 0) {
      await setPushState(messagePath, 'skipped');
      res.status(200).json({ success: true, notifiedDevices: 0 });
      return;
    }

    const deviceTokens = await loadEnabledDeviceTokens(recipientIds);
    if (deviceTokens.length === 0) {
      await setPushState(messagePath, 'skipped');
      res.status(200).json({ success: true, notifiedDevices: 0 });
      return;
    }

    const notificationBody = message.conversationType === 'group'
      ? `${senderName} enviou uma mensagem.`
      : 'Você recebeu uma nova mensagem.';
    const notifications: ExpoPushMessage[] = deviceTokens.map(({ token }) => ({
      to: token,
      sound: 'default',
      title,
      body: notificationBody,
      data: {
        conversationId,
        conversationType: message.conversationType,
        name: notificationName,
      },
    }));

    const tickets = await sendExpoPushMessages(notifications);
    const invalidDeviceReferences: DocumentReference[] = [];
    const validTickets: PushTicketRecord[] = [];
    tickets.forEach((ticket, index) => {
      const device = deviceTokens[index];
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        invalidDeviceReferences.push(adminFirestore.doc(device.devicePath));
      } else if (ticket.status === 'ok' && ticket.id) {
        validTickets.push({ ...device, id: ticket.id, createdAt: Date.now() });
      }
    });

    await deleteDocumentReferences(invalidDeviceReferences);
    for (let offset = 0; offset < validTickets.length; offset += 400) {
      const batch = adminFirestore.batch();
      validTickets.slice(offset, offset + 400).forEach((ticket) => {
        batch.set(adminFirestore.collection('pushTickets').doc(ticket.id), {
          token: ticket.token,
          userId: ticket.userId,
          devicePath: ticket.devicePath,
          conversationId,
          messageId,
          createdAt: ticket.createdAt,
        });
      });
      await batch.commit();
    }

    await setPushState(messagePath, 'sent');
    res.status(200).json({ success: true, notifiedDevices: deviceTokens.length });
  } catch (error: unknown) {
    console.error('Falha ao processar push:', error);
    if (claimAcquired) {
      try {
        await setPushState(messagePath, 'failed');
      } catch (stateError) {
        console.error('Falha ao registrar estado do push:', stateError);
      }
    }
    res.status(500).json({ error: 'Não foi possível processar a notificação.' });
  }
});

router.post('/receipts', async (req: Request, res: Response) => {
  if (!isAuthorizedCronRequest(req)) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  try {
    const snapshot = await adminFirestore
      .collection('pushTickets')
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();
    const tickets: PushTicketRecord[] = snapshot.docs.flatMap((document) => {
      const data: unknown = document.data();
      if (
        !isJsonObject(data)
        || typeof data.token !== 'string'
        || !isNonEmptyString(data.userId, 128)
        || typeof data.createdAt !== 'number'
      ) {
        return [];
      }
      return [{
        id: document.id,
        token: data.token,
        userId: data.userId,
        devicePath: typeof data.devicePath === 'string' ? data.devicePath : '',
        createdAt: data.createdAt,
      }];
    });

    if (tickets.length === 0) {
      res.status(200).json({ success: true, processedCount: 0, removedTokens: 0 });
      return;
    }

    const receipts = await getExpoPushReceipts(tickets.map((ticket) => ticket.id));
    const processedTicketReferences: DocumentReference[] = [];
    const invalidDeviceReferences: DocumentReference[] = [];

    for (const ticket of tickets) {
      const receipt = receipts[ticket.id];
      if (!receipt) {
        continue;
      }
      processedTicketReferences.push(adminFirestore.collection('pushTickets').doc(ticket.id));
      if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
        if (ticket.devicePath) {
          invalidDeviceReferences.push(adminFirestore.doc(ticket.devicePath));
        } else {
          const devices = await adminFirestore
            .collection(`users/${ticket.userId}/devices`)
            .where('token', '==', ticket.token)
            .get();
          invalidDeviceReferences.push(...devices.docs.map((document) => document.ref));
        }
      }
    }

    await deleteDocumentReferences([...processedTicketReferences, ...invalidDeviceReferences]);
    res.status(200).json({
      success: true,
      processedCount: processedTicketReferences.length,
      removedTokens: invalidDeviceReferences.length,
    });
  } catch (error: unknown) {
    console.error('Falha ao processar recibos de push:', error);
    res.status(500).json({ error: 'Não foi possível processar os recibos.' });
  }
});

export default router;
