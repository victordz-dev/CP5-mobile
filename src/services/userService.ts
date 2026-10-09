import { doc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import { ChatUser } from '../types/user';
import { authenticatedApiFetch, readApiError } from './api';

function parseChatUsers(value: unknown): ChatUser[] {
  if (!Array.isArray(value)) {
    throw new Error('A API retornou uma lista de usuários inválida.');
  }

  return value.flatMap((item) => {
    if (
      typeof item !== 'object'
      || item === null
      || !('uid' in item)
      || typeof item.uid !== 'string'
      || !('name' in item)
      || typeof item.name !== 'string'
    ) {
      return [];
    }
    return [{
      uid: item.uid,
      name: item.name,
      email: 'email' in item && typeof item.email === 'string' ? item.email : '',
      phoneNumber: 'phoneNumber' in item && typeof item.phoneNumber === 'string' ? item.phoneNumber : '',
      birthDate: 'birthDate' in item && typeof item.birthDate === 'string' ? item.birthDate : '',
      photoUrl: 'photoUrl' in item && typeof item.photoUrl === 'string' ? item.photoUrl : '',
      createdAt: 'createdAt' in item && typeof item.createdAt === 'number' ? item.createdAt : 0,
    }];
  });
}

export const createUserProfile = async (uid: string, profile: Omit<ChatUser, 'uid' | 'createdAt'>) => {
  const userDoc = doc(firestore, 'users', uid);
  await setDoc(userDoc, {
    ...profile,
    createdAt: Date.now(),
  });
};

export const updateUserProfile = async (uid: string, data: Partial<Omit<ChatUser, 'uid' | 'createdAt'>>) => {
  const userDoc = doc(firestore, 'users', uid);
  await setDoc(userDoc, data, { merge: true });
};

export const getUserProfile = async (uid: string): Promise<ChatUser | null> => {
  const profiles = await getUserProfiles([uid]);
  return profiles[0] ?? null;
};

export const getUserProfiles = async (userIds: string[]): Promise<ChatUser[]> => {
  const res = await authenticatedApiFetch('/sync-members/users/profiles', {
    method: 'POST',
    body: JSON.stringify({ userIds })
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Falha ao carregar perfis'));
  }
  const data: unknown = await res.json();
  return parseChatUsers(data);
};

export const getAllUsers = async (): Promise<ChatUser[]> => {
  const res = await authenticatedApiFetch('/sync-members/users');
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Falha ao carregar usuários'));
  }
  const data: unknown = await res.json();
  return parseChatUsers(data);
};
