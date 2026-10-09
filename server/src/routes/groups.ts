import { Response, Router } from 'express';
import { DocumentReference } from 'firebase-admin/firestore';
import {
  GroupRecord,
  isDocumentId,
  isJsonObject,
  isNonEmptyString,
  isNotificationPolicy,
  isUid,
  parseGroupRecord,
  parseStringArray,
} from '../domain/contracts';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';
import { adminFirestore } from '../services/firebaseAdmin';
import { syncConversationMembers } from '../services/membershipSync';

const router = Router();

class RouteError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface MembershipChange {
  group: GroupRecord;
  changed: boolean;
}

function sendRouteError(res: Response, error: unknown): void {
  if (error instanceof RouteError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error('Erro inesperado na rota de grupos:', error);
  res.status(500).json({ error: 'Não foi possível concluir a operação do grupo.' });
}

function readGroup(documentId: string, value: unknown): GroupRecord {
  const group = parseGroupRecord(value);
  if (!group || group.id !== documentId) {
    throw new RouteError(500, 'Os dados do grupo estão inválidos.');
  }
  return group;
}

function isHttpsPhotoUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2_048) {
    return false;
  }
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

async function assertUsersExist(memberIds: readonly string[]): Promise<void> {
  const snapshots = await Promise.all(
    memberIds.map((memberId) => adminFirestore.collection('users').doc(memberId).get()),
  );

  if (snapshots.some((snapshot) => !snapshot.exists)) {
    throw new RouteError(400, 'Um ou mais usuários informados não existem no sistema.');
  }
}

async function compensateMembershipChange(
  groupRef: DocumentReference,
  changedUserId: string,
  failedChange: MembershipChange,
  memberWasAdded: boolean,
): Promise<void> {
  let stateToSync: GroupRecord | null = null;

  await adminFirestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(groupRef);
    if (!snapshot.exists) {
      return;
    }

    const current = readGroup(groupRef.id, snapshot.data());
    if (current.membershipVersion !== failedChange.group.membershipVersion) {
      stateToSync = current;
      return;
    }

    const restoredMembers = memberWasAdded
      ? current.memberIds.filter((memberId) => memberId !== changedUserId)
      : [...new Set([...current.memberIds, changedUserId])];
    const restored: GroupRecord = {
      ...current,
      memberIds: restoredMembers,
      membershipVersion: current.membershipVersion + 1,
      updatedAt: Date.now(),
    };
    transaction.update(groupRef, {
      memberIds: restored.memberIds,
      membershipVersion: restored.membershipVersion,
      updatedAt: restored.updatedAt,
    });
    stateToSync = restored;
  });

  const latestState = stateToSync as GroupRecord | null;
  if (latestState) {
    await syncConversationMembers(
      latestState.id,
      latestState.memberIds,
      latestState.membershipVersion,
    );
  }
}

async function syncMembershipChange(
  groupRef: DocumentReference,
  changedUserId: string,
  change: MembershipChange,
  memberWasAdded: boolean,
): Promise<void> {
  try {
    await syncConversationMembers(
      change.group.id,
      change.group.memberIds,
      change.group.membershipVersion,
    );
  } catch (syncError) {
    if (change.changed) {
      try {
        await compensateMembershipChange(groupRef, changedUserId, change, memberWasAdded);
      } catch (compensationError) {
        console.error('Falha ao compensar sincronização de integrantes:', compensationError);
      }
    }
    console.error('Falha ao sincronizar integrantes com o Realtime Database:', syncError);
    throw new RouteError(503, 'Não foi possível sincronizar os integrantes. Tente novamente.');
  }
}

router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const body: unknown = req.body;
    if (!user) {
      throw new RouteError(401, 'Não autorizado.');
    }
    if (!isJsonObject(body)) {
      throw new RouteError(400, 'Dados do grupo inválidos.');
    }

    const memberIds = parseStringArray(body.memberIds);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const photoUrl = body.photoUrl;
    if (!isNonEmptyString(name, 80)) {
      throw new RouteError(400, 'O nome do grupo é obrigatório e deve ter até 80 caracteres.');
    }
    if (!isHttpsPhotoUrl(photoUrl)) {
      throw new RouteError(400, 'A foto do grupo deve ser uma URL HTTPS válida.');
    }
    if (
      typeof body.memberLimit !== 'number'
      || !Number.isInteger(body.memberLimit)
      || body.memberLimit < 2
    ) {
      throw new RouteError(400, 'O limite deve ser um número inteiro maior ou igual a 2.');
    }
    if (!isNotificationPolicy(body.notificationPolicy)) {
      throw new RouteError(400, 'A política de notificação é inválida.');
    }
    if (
      !memberIds
      || memberIds.length !== (Array.isArray(body.memberIds) ? body.memberIds.length : 0)
      || memberIds.length < 2
      || memberIds.length > body.memberLimit
    ) {
      throw new RouteError(
        400,
        `Os integrantes devem ter IDs únicos, com mínimo de 2 e máximo de ${body.memberLimit}.`,
      );
    }
    if (!memberIds.includes(user.uid)) {
      throw new RouteError(400, 'O proprietário deve estar entre os integrantes do grupo.');
    }

    await assertUsersExist(memberIds);

    const groupRef = adminFirestore.collection('groups').doc();
    const now = Date.now();
    const group: GroupRecord = {
      id: groupRef.id,
      name,
      photoUrl,
      ownerId: user.uid,
      memberLimit: body.memberLimit,
      notificationPolicy: body.notificationPolicy,
      memberIds,
      membershipVersion: 1,
      createdAt: now,
      updatedAt: now,
    };

    await groupRef.create(group);
    try {
      await syncConversationMembers(group.id, group.memberIds, group.membershipVersion);
    } catch (error) {
      await groupRef.delete();
      throw error;
    }

    res.status(201).json({ success: true, groupId: group.id });
  } catch (error: unknown) {
    sendRouteError(res, error);
  }
});

router.post('/:id/join', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const groupId: unknown = req.params.id;
    const body: unknown = req.body;
    if (!user) {
      throw new RouteError(401, 'Não autorizado.');
    }
    if (!isDocumentId(groupId) || !isJsonObject(body) || !isUid(body.userId)) {
      throw new RouteError(400, 'Grupo ou usuário inválido.');
    }

    const targetUserId = body.userId;
    await assertUsersExist([targetUserId]);
    const groupRef = adminFirestore.collection('groups').doc(groupId);
    let change: MembershipChange | null = null;

    await adminFirestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(groupRef);
      if (!snapshot.exists) {
        throw new RouteError(404, 'Grupo não encontrado.');
      }

      const current = readGroup(groupId, snapshot.data());
      if (current.ownerId !== user.uid) {
        throw new RouteError(403, 'Somente o proprietário pode adicionar integrantes.');
      }
      if (current.memberIds.includes(targetUserId)) {
        change = { group: current, changed: false };
        return;
      }
      if (current.memberIds.length >= current.memberLimit) {
        throw new RouteError(409, 'O grupo atingiu o limite de integrantes.');
      }

      const updated: GroupRecord = {
        ...current,
        memberIds: [...current.memberIds, targetUserId],
        membershipVersion: current.membershipVersion + 1,
        updatedAt: Date.now(),
      };
      transaction.update(groupRef, {
        memberIds: updated.memberIds,
        membershipVersion: updated.membershipVersion,
        updatedAt: updated.updatedAt,
      });
      change = { group: updated, changed: true };
    });

    const completedChange = change as MembershipChange | null;
    if (!completedChange) {
      throw new RouteError(500, 'Não foi possível atualizar o grupo.');
    }
    await syncMembershipChange(groupRef, targetUserId, completedChange, true);
    res.status(200).json({ success: true, memberCount: completedChange.group.memberIds.length });
  } catch (error: unknown) {
    sendRouteError(res, error);
  }
});

router.post('/:id/leave', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const groupId: unknown = req.params.id;
    const body: unknown = req.body;
    if (!user) {
      throw new RouteError(401, 'Não autorizado.');
    }
    if (!isDocumentId(groupId) || !isJsonObject(body) || !isUid(body.userId)) {
      throw new RouteError(400, 'Grupo ou usuário inválido.');
    }

    const targetUserId = body.userId;
    const groupRef = adminFirestore.collection('groups').doc(groupId);
    let change: MembershipChange | null = null;

    await adminFirestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(groupRef);
      if (!snapshot.exists) {
        throw new RouteError(404, 'Grupo não encontrado.');
      }

      const current = readGroup(groupId, snapshot.data());
      if (current.ownerId !== user.uid && targetUserId !== user.uid) {
        throw new RouteError(403, 'Somente o proprietário pode remover outros integrantes.');
      }
      if (current.ownerId === targetUserId) {
        throw new RouteError(400, 'O proprietário não pode sair sem transferir o grupo.');
      }
      if (!current.memberIds.includes(targetUserId)) {
        change = { group: current, changed: false };
        return;
      }
      if (current.memberIds.length <= 2) {
        throw new RouteError(409, 'Um grupo deve manter pelo menos dois integrantes.');
      }

      const updated: GroupRecord = {
        ...current,
        memberIds: current.memberIds.filter((memberId) => memberId !== targetUserId),
        membershipVersion: current.membershipVersion + 1,
        updatedAt: Date.now(),
      };
      transaction.update(groupRef, {
        memberIds: updated.memberIds,
        membershipVersion: updated.membershipVersion,
        updatedAt: updated.updatedAt,
      });
      change = { group: updated, changed: true };
    });

    const completedChange = change as MembershipChange | null;
    if (!completedChange) {
      throw new RouteError(500, 'Não foi possível atualizar o grupo.');
    }
    await syncMembershipChange(groupRef, targetUserId, completedChange, false);
    res.status(200).json({ success: true, memberCount: completedChange.group.memberIds.length });
  } catch (error: unknown) {
    sendRouteError(res, error);
  }
});

router.put('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const groupId: unknown = req.params.id;
    const body: unknown = req.body;
    if (!user) {
      throw new RouteError(401, 'Não autorizado.');
    }
    if (!isDocumentId(groupId) || !isJsonObject(body)) {
      throw new RouteError(400, 'Dados de atualização inválidos.');
    }

    const allowedFields = new Set(['name', 'photoUrl', 'memberLimit', 'notificationPolicy']);
    const fields = Object.keys(body);
    if (fields.length === 0 || fields.some((field) => !allowedFields.has(field))) {
      throw new RouteError(400, 'A atualização contém campos não permitidos.');
    }

    const groupRef = adminFirestore.collection('groups').doc(groupId);
    await adminFirestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(groupRef);
      if (!snapshot.exists) {
        throw new RouteError(404, 'Grupo não encontrado.');
      }

      const current = readGroup(groupId, snapshot.data());
      if (current.ownerId !== user.uid) {
        throw new RouteError(403, 'Somente o proprietário pode alterar o grupo.');
      }

      const updates: Partial<Pick<GroupRecord, 'name' | 'photoUrl' | 'memberLimit' | 'notificationPolicy'>> = {};
      if (body.name !== undefined) {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!isNonEmptyString(name, 80)) {
          throw new RouteError(400, 'O nome do grupo é obrigatório e deve ter até 80 caracteres.');
        }
        updates.name = name;
      }
      if (body.photoUrl !== undefined) {
        if (!isHttpsPhotoUrl(body.photoUrl)) {
          throw new RouteError(400, 'A foto do grupo deve ser uma URL HTTPS válida.');
        }
        updates.photoUrl = body.photoUrl;
      }
      if (body.memberLimit !== undefined) {
        if (
          typeof body.memberLimit !== 'number'
          || !Number.isInteger(body.memberLimit)
          || body.memberLimit < current.memberIds.length
        ) {
          throw new RouteError(
            400,
            'O limite deve ser inteiro e não pode ser menor que a quantidade atual de integrantes.',
          );
        }
        updates.memberLimit = body.memberLimit;
      }
      if (body.notificationPolicy !== undefined) {
        if (!isNotificationPolicy(body.notificationPolicy)) {
          throw new RouteError(400, 'A política de notificação é inválida.');
        }
        updates.notificationPolicy = body.notificationPolicy;
      }

      transaction.update(groupRef, { ...updates, updatedAt: Date.now() });
    });

    res.status(200).json({ success: true });
  } catch (error: unknown) {
    sendRouteError(res, error);
  }
});

export default router;
