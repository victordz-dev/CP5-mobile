import { doc, setDoc, getDoc, collection, updateDoc, runTransaction, query, where, getDocs } from 'firebase/firestore';
import { firestore } from './firebase';
import { ChatGroup, NotificationPolicy } from '../types/group';
import { syncChatMembers } from './chatService';

export const createGroup = async (groupData: Omit<ChatGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const groupRef = doc(collection(firestore, 'groups'));
  const newGroup: ChatGroup = {
    ...groupData,
    id: groupRef.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await setDoc(groupRef, newGroup);
  await syncChatMembers(groupRef.id, 'group');
  return groupRef.id;
};

export const joinGroup = async (groupId: string, userId: string) => {
  const groupRef = doc(firestore, 'groups', groupId);
  await runTransaction(firestore, async (transaction) => {
    const groupDoc = await transaction.get(groupRef);
    if (!groupDoc.exists()) {
      throw new Error("Group does not exist.");
    }
    const data = groupDoc.data() as ChatGroup;
    if (data.memberIds.includes(userId)) {
      return; // Already a member
    }
    if (data.memberIds.length >= data.memberLimit) {
      throw new Error("Group limit reached.");
    }
    transaction.update(groupRef, {
      memberIds: [...data.memberIds, userId],
      updatedAt: Date.now()
    });
  });
  // Since we don't have memberIds in scope outside transaction, fetch it or set it inside but setChatMembers is not a transaction.
  // Actually we can do it after the transaction completes.
  const newGroupDoc = await getDoc(groupRef);
  if (newGroupDoc.exists()) {
    const finalData = newGroupDoc.data() as ChatGroup;
    await syncChatMembers(groupId, 'group');
  }
};

export const leaveGroup = async (groupId: string, userId: string) => {
  const groupRef = doc(firestore, 'groups', groupId);
  await runTransaction(firestore, async (transaction) => {
    const groupDoc = await transaction.get(groupRef);
    if (!groupDoc.exists()) {
      throw new Error("Group does not exist.");
    }
    const data = groupDoc.data() as ChatGroup;
    const newMembers = data.memberIds.filter(id => id !== userId);
    transaction.update(groupRef, {
      memberIds: newMembers,
      updatedAt: Date.now()
    });
  });
  const newGroupDoc = await getDoc(groupRef);
  if (newGroupDoc.exists()) {
    const finalData = newGroupDoc.data() as ChatGroup;
    await syncChatMembers(groupId, 'group');
  }
};

export const removeMember = async (groupId: string, userId: string) => {
  return leaveGroup(groupId, userId);
};

export const updateGroupConfig = async (
  groupId: string,
  updates: Partial<Pick<ChatGroup, 'name' | 'photoUrl' | 'memberLimit' | 'notificationPolicy' | 'memberIds'>>
) => {
  const groupRef = doc(firestore, 'groups', groupId);
  await updateDoc(groupRef, {
    ...updates,
    updatedAt: Date.now(),
  });
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
