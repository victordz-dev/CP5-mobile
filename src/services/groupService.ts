import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { firestore } from './firebase';
import { ChatGroup, NotificationPolicy } from '../types/group';
import { authenticatedApiFetch, readApiError } from './api';

export type CreateGroupInput = Omit<ChatGroup, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>;
export type GroupConfigUpdate = Partial<Pick<ChatGroup, 'name' | 'photoUrl' | 'memberLimit' | 'notificationPolicy'>>;

const notificationPolicies: readonly NotificationPolicy[] = [
  'all_group_messages',
  'mentioned_members',
  'direct_messages_only',
  'disabled',
];

function parseChatGroup(value: unknown): ChatGroup | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string'
    || typeof record.name !== 'string'
    || typeof record.photoUrl !== 'string'
    || typeof record.ownerId !== 'string'
    || !Array.isArray(record.memberIds)
    || !record.memberIds.every((memberId) => typeof memberId === 'string')
    || typeof record.memberLimit !== 'number'
    || !Number.isInteger(record.memberLimit)
    || typeof record.notificationPolicy !== 'string'
    || !notificationPolicies.includes(record.notificationPolicy as NotificationPolicy)
    || typeof record.createdAt !== 'number'
    || typeof record.updatedAt !== 'number'
  ) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    photoUrl: record.photoUrl,
    ownerId: record.ownerId,
    memberIds: [...new Set(record.memberIds)],
    memberLimit: record.memberLimit,
    notificationPolicy: record.notificationPolicy as NotificationPolicy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function validateCreateGroupInput(groupData: CreateGroupInput): CreateGroupInput {
  const name = groupData.name.trim();
  const memberIds = [...new Set(groupData.memberIds)];
  if (!name || name.length > 80) {
    throw new Error('Informe um nome de grupo com até 80 caracteres.');
  }
  if (!groupData.photoUrl.startsWith('https://')) {
    throw new Error('Envie uma foto válida para o grupo.');
  }
  if (!Number.isInteger(groupData.memberLimit) || groupData.memberLimit < 2) {
    throw new Error('O limite deve ser um número inteiro maior ou igual a 2.');
  }
  if (memberIds.length < 2 || memberIds.length > groupData.memberLimit) {
    throw new Error('A quantidade de integrantes deve respeitar o mínimo e o limite do grupo.');
  }
  return { ...groupData, name, memberIds };
}

export const createGroup = async (input: CreateGroupInput): Promise<string> => {
  const groupData = validateCreateGroupInput(input);
  const res = await authenticatedApiFetch('/groups', {
    method: 'POST',
    body: JSON.stringify(groupData)
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Falha ao criar grupo'));
  }
  const data: unknown = await res.json();
  if (typeof data !== 'object' || data === null || !('groupId' in data) || typeof data.groupId !== 'string') {
    throw new Error('A API retornou uma resposta inválida ao criar o grupo.');
  }
  return data.groupId;
};

export const joinGroup = async (groupId: string, userId: string): Promise<void> => {
  const res = await authenticatedApiFetch(`/groups/${encodeURIComponent(groupId)}/join`, {
    method: 'POST',
    body: JSON.stringify({ userId })
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Falha ao adicionar integrante'));
  }
};

export const leaveGroup = async (groupId: string, userId: string): Promise<void> => {
  const res = await authenticatedApiFetch(`/groups/${encodeURIComponent(groupId)}/leave`, {
    method: 'POST',
    body: JSON.stringify({ userId })
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Falha ao remover integrante'));
  }
};

export const removeMember = async (groupId: string, userId: string): Promise<void> => {
  return leaveGroup(groupId, userId);
};

export const addMember = async (groupId: string, userId: string): Promise<void> => {
  return joinGroup(groupId, userId);
};

export const updateGroupConfig = async (
  groupId: string,
  updates: GroupConfigUpdate,
): Promise<void> => {
  if (updates.name !== undefined && (updates.name.trim() === '' || updates.name.trim().length > 80)) {
    throw new Error('Informe um nome de grupo com até 80 caracteres.');
  }
  if (updates.memberLimit !== undefined && (!Number.isInteger(updates.memberLimit) || updates.memberLimit < 2)) {
    throw new Error('O limite deve ser um número inteiro maior ou igual a 2.');
  }
  const res = await authenticatedApiFetch(`/groups/${encodeURIComponent(groupId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...updates,
      ...(updates.name !== undefined && { name: updates.name.trim() }),
    })
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Falha ao atualizar grupo'));
  }
};

export const getUserGroups = async (userId: string): Promise<ChatGroup[]> => {
  const groupsRef = collection(firestore, 'groups');
  const q = query(groupsRef, where('memberIds', 'array-contains', userId));
  const snap = await getDocs(q);
  return snap.docs.map((document) => {
    const group = parseChatGroup({ ...document.data(), id: document.id });
    if (!group) {
      throw new Error('O banco retornou um grupo com dados inválidos.');
    }
    return group;
  });
};

export const getGroupById = async (groupId: string): Promise<ChatGroup | null> => {
  const groupRef = doc(firestore, 'groups', groupId);
  const snap = await getDoc(groupRef);
  if (snap.exists()) {
    const group = parseChatGroup({ ...snap.data(), id: snap.id });
    if (!group) {
      throw new Error('O banco retornou um grupo com dados inválidos.');
    }
    return group;
  }
  return null;
};

export const listenToGroup = (
  groupId: string,
  callback: (group: ChatGroup | null) => void,
  onError?: (error: Error) => void,
): (() => void) => onSnapshot(doc(firestore, 'groups', groupId), (snapshot) => {
  if (!snapshot.exists()) {
    callback(null);
    return;
  }
  const group = parseChatGroup({ ...snapshot.data(), id: snapshot.id });
  if (!group) {
    onError?.(new Error('O banco retornou um grupo com dados inválidos.'));
    return;
  }
  callback(group);
}, () => {
  onError?.(new Error('Não foi possível acompanhar as alterações do grupo.'));
});

export const listenToUserGroups = (
  userId: string,
  callback: (groups: ChatGroup[]) => void,
  onError?: (error: Error) => void,
): (() => void) => {
  const groupsQuery = query(
    collection(firestore, 'groups'),
    where('memberIds', 'array-contains', userId),
  );
  return onSnapshot(groupsQuery, (snapshot) => {
    const groups: ChatGroup[] = [];
    for (const document of snapshot.docs) {
      const group = parseChatGroup({ ...document.data(), id: document.id });
      if (!group) {
        onError?.(new Error('O banco retornou um grupo com dados inválidos.'));
        continue;
      }
      groups.push(group);
    }
    callback(groups);
  }, () => {
    onError?.(new Error('Não foi possível carregar os grupos.'));
  });
};
