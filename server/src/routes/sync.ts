import { Response, Router } from 'express';
import {
  isDocumentId,
  isJsonObject,
  isNonEmptyString,
  parseDirectConversation,
  parseGroupRecord,
  parseStringArray,
} from '../domain/contracts';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';
import { adminFirestore } from '../services/firebaseAdmin';
import { syncConversationMembers } from '../services/membershipSync';

const router = Router();

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  birthDate: string;
  photoUrl: string;
  createdAt: number;
}

function readOptionalString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toUserProfile(uid: string, value: unknown): UserProfile | null {
  if (!isJsonObject(value) || !isNonEmptyString(value.name, 80)) {
    return null;
  }
  return {
    uid,
    name: value.name,
    email: readOptionalString(value.email),
    phoneNumber: readOptionalString(value.phoneNumber),
    birthDate: readOptionalString(value.birthDate),
    photoUrl: readOptionalString(value.photoUrl),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
  };
}

router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const body: unknown = req.body;
  if (!user) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  if (
    !isJsonObject(body)
    || !isDocumentId(body.conversationId)
    || (body.type !== 'direct' && body.type !== 'group')
  ) {
    res.status(400).json({ error: 'Conversa ou tipo inválido.' });
    return;
  }

  try {
    let memberIds: string[];
    let membershipVersion: number;

    if (body.type === 'direct') {
      const snapshot = await adminFirestore.doc(`directConversations/${body.conversationId}`).get();
      const conversation = parseDirectConversation(snapshot.data());
      if (!snapshot.exists || !conversation || conversation.participantIds.join('_') !== body.conversationId) {
        res.status(404).json({ error: 'Conversa individual não encontrada ou inválida.' });
        return;
      }
      memberIds = conversation.participantIds;
      membershipVersion = conversation.updatedAt ?? conversation.createdAt;
    } else {
      const snapshot = await adminFirestore.doc(`groups/${body.conversationId}`).get();
      const group = parseGroupRecord(snapshot.data());
      if (!snapshot.exists || !group || group.id !== body.conversationId) {
        res.status(404).json({ error: 'Grupo não encontrado ou inválido.' });
        return;
      }
      memberIds = group.memberIds;
      membershipVersion = group.membershipVersion;
    }

    if (!memberIds.includes(user.uid)) {
      res.status(403).json({ error: 'O usuário não participa desta conversa.' });
      return;
    }

    await syncConversationMembers(body.conversationId, memberIds, membershipVersion);
    res.status(200).json({ success: true, memberCount: memberIds.length });
  } catch (error: unknown) {
    console.error('Falha ao sincronizar integrantes:', error);
    res.status(500).json({ error: 'Não foi possível sincronizar os integrantes.' });
  }
});

router.get('/users', authenticate, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const snapshot = await adminFirestore.collection('users').get();
    const users = snapshot.docs.flatMap((document) => {
      const data: unknown = document.data();
      if (!isJsonObject(data) || !isNonEmptyString(data.name, 80)) {
        return [];
      }
      return [{
        uid: document.id,
        name: data.name,
        photoUrl: readOptionalString(data.photoUrl),
      }];
    });
    res.status(200).json(users);
  } catch (error: unknown) {
    console.error('Falha ao buscar usuários:', error);
    res.status(500).json({ error: 'Não foi possível carregar os usuários.' });
  }
});

router.post('/users/profiles', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const body: unknown = req.body;
  if (!user) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  if (!isJsonObject(body)) {
    res.status(400).json({ error: 'Lista de usuários inválida.' });
    return;
  }

  const userIds = parseStringArray(body.userIds);
  if (!userIds || userIds.length > 100) {
    res.status(400).json({ error: 'Informe até 100 IDs de usuários válidos e únicos.' });
    return;
  }

  try {
    const [directsSnapshot, groupsSnapshot] = await Promise.all([
      adminFirestore
        .collection('directConversations')
        .where('participantIds', 'array-contains', user.uid)
        .get(),
      adminFirestore
        .collection('groups')
        .where('memberIds', 'array-contains', user.uid)
        .get(),
    ]);

    const allowedUserIds = new Set([user.uid]);
    directsSnapshot.docs.forEach((document) => {
      const conversation = parseDirectConversation(document.data());
      conversation?.participantIds.forEach((participantId) => allowedUserIds.add(participantId));
    });
    groupsSnapshot.docs.forEach((document) => {
      const group = parseGroupRecord(document.data());
      group?.memberIds.forEach((memberId) => allowedUserIds.add(memberId));
    });

    const allowedRequestedIds = userIds.filter((userId) => allowedUserIds.has(userId));
    const profileSnapshots = await Promise.all(
      allowedRequestedIds.map((userId) => adminFirestore.collection('users').doc(userId).get()),
    );
    const profiles = profileSnapshots.flatMap((snapshot) => {
      const profile = toUserProfile(snapshot.id, snapshot.data());
      return profile ? [profile] : [];
    });
    res.status(200).json(profiles);
  } catch (error: unknown) {
    console.error('Falha ao buscar perfis permitidos:', error);
    res.status(500).json({ error: 'Não foi possível carregar os perfis.' });
  }
});

export default router;
