import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from './firebase';
import { ChatGroup } from '../types/group';
import { authenticatedApiFetch, readApiError } from './api';

export const createGroup = async (groupData: Omit<ChatGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
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

export const joinGroup = async (groupId: string, userId: string) => {
  const res = await authenticatedApiFetch(`/groups/${encodeURIComponent(groupId)}/join`, {
    method: 'POST',
    body: JSON.stringify({ userId })
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Falha ao adicionar integrante'));
  }
};

export const leaveGroup = async (groupId: string, userId: string) => {
  const res = await authenticatedApiFetch(`/groups/${encodeURIComponent(groupId)}/leave`, {
    method: 'POST',
    body: JSON.stringify({ userId })
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Falha ao remover integrante'));
  }
};

export const removeMember = async (groupId: string, userId: string) => {
  return leaveGroup(groupId, userId);
};

export const addMember = async (groupId: string, userId: string) => {
  return joinGroup(groupId, userId);
};

export const updateGroupConfig = async (
  groupId: string,
  updates: Partial<Pick<ChatGroup, 'name' | 'photoUrl' | 'memberLimit' | 'notificationPolicy'>>
) => {
  const res = await authenticatedApiFetch(`/groups/${encodeURIComponent(groupId)}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Falha ao atualizar grupo'));
  }
};

export const getUserGroups = async (userId: string): Promise<ChatGroup[]> => {
  const groupsRef = collection(firestore, 'groups');
  const q = query(groupsRef, where('memberIds', 'array-contains', userId));
  const snap = await getDocs(q);
  return snap.docs.map(doc => doc.data() as ChatGroup);
};

export const getGroupById = async (groupId: string): Promise<ChatGroup | null> => {
  const groupRef = doc(firestore, 'groups', groupId);
  const snap = await getDoc(groupRef);
  if (snap.exists()) {
    return snap.data() as ChatGroup;
  }
  return null;
};
