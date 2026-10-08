import { doc, setDoc } from 'firebase/firestore';
import { firestore, auth } from './firebase';
import Constants from 'expo-constants';
import { ChatUser } from '../types/user';

export const createUserProfile = async (uid: string, profile: Omit<ChatUser, 'uid' | 'createdAt'>) => {
  const userDoc = doc(firestore, 'users', uid);
  await setDoc(userDoc, {
    ...profile,
    createdAt: Date.now(),
  });
};

export const getUserProfile = async (uid: string): Promise<ChatUser | null> => {
  const token = await auth.currentUser?.getIdToken();
  const apiUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
  const res = await fetch(`${apiUrl}/sync-members/users/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userIds: [uid] })
  });
  if (res.ok) {
    const data = await res.json();
    return data[0] || null;
  }
  return null;
};

export const getAllUsers = async (): Promise<ChatUser[]> => {
  const token = await auth.currentUser?.getIdToken();
  const apiUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
  const res = await fetch(`${apiUrl}/sync-members/users`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.ok) return await res.json();
  return [];
};
