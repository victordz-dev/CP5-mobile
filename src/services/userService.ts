import { doc, setDoc, getDoc, collection, query, getDocs } from 'firebase/firestore';
import { firestore } from './firebase';
import { ChatUser } from '../types/user';

export const createUserProfile = async (uid: string, profile: Omit<ChatUser, 'uid' | 'createdAt'>) => {
  const userDoc = doc(firestore, 'users', uid);
  await setDoc(userDoc, {
    ...profile,
    createdAt: Date.now(),
  });
};

export const getUserProfile = async (uid: string): Promise<ChatUser | null> => {
  const userDoc = doc(firestore, 'users', uid);
  const snap = await getDoc(userDoc);
  if (snap.exists()) {
    return { uid, ...snap.data() } as ChatUser;
  }
  return null;
};

export const getAllUsers = async (): Promise<ChatUser[]> => {
  const usersRef = collection(firestore, 'users');
  const q = query(usersRef);
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as ChatUser));
};
