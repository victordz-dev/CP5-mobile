import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firestore, auth } from './firebase';
import { ChatGroup } from '../types/group';
import Constants from 'expo-constants';

const getApiUrl = () => Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export const createGroup = async (groupData: Omit<ChatGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${getApiUrl()}/groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(groupData)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao criar grupo');
  }
  const data = await res.json();
  return data.groupId;
};

export const joinGroup = async (groupId: string, userId: string) => {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${getApiUrl()}/groups/${groupId}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ userId })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao adicionar membro');
  }
};

export const leaveGroup = async (groupId: string, userId: string) => {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${getApiUrl()}/groups/${groupId}/leave`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ userId })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao remover membro');
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
  updates: Partial<Pick<ChatGroup, 'name' | 'photoUrl' | 'memberLimit' | 'notificationPolicy' | 'memberIds'>>
) => {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${getApiUrl()}/groups/${groupId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(updates)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao atualizar grupo');
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
