import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, firestore } from './firebase';
import { ChatUser } from '../types/user';
import { authenticatedApiFetch, readApiError } from './api';

function parseChatUsers(value: unknown): ChatUser[] {
  if (!Array.isArray(value)) {
    throw new Error('A API retornou uma lista de usuários inválida.');
  }

  return value.map((item) => {
    if (
      typeof item !== 'object'
      || item === null
      || !('uid' in item)
      || typeof item.uid !== 'string'
      || !('name' in item)
      || typeof item.name !== 'string'
    ) {
      throw new Error('A API retornou um perfil de usuário inválido.');
    }
    return {
      uid: item.uid,
      name: item.name,
      email: 'email' in item && typeof item.email === 'string' ? item.email : '',
      phoneNumber: 'phoneNumber' in item && typeof item.phoneNumber === 'string' ? item.phoneNumber : '',
      birthDate: 'birthDate' in item && typeof item.birthDate === 'string' ? item.birthDate : '',
      photoUrl: 'photoUrl' in item && typeof item.photoUrl === 'string' ? item.photoUrl : '',
      createdAt: 'createdAt' in item && typeof item.createdAt === 'number' ? item.createdAt : 0,
    };
  });
}

function parseOwnUserProfile(uid: string, value: unknown): ChatUser | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.name !== 'string'
    || record.name.trim() === ''
    || typeof record.email !== 'string'
    || record.email.trim() === ''
    || typeof record.phoneNumber !== 'string'
    || record.phoneNumber.trim() === ''
    || typeof record.birthDate !== 'string'
    || !/^\d{2}\/\d{2}\/\d{4}$/.test(record.birthDate)
    || typeof record.photoUrl !== 'string'
    || !record.photoUrl.startsWith('https://')
    || typeof record.createdAt !== 'number'
    || !Number.isFinite(record.createdAt)
  ) {
    return null;
  }

  return {
    uid,
    name: record.name,
    email: record.email,
    phoneNumber: record.phoneNumber,
    birthDate: record.birthDate,
    photoUrl: record.photoUrl,
    createdAt: record.createdAt,
  };
}

function assertOwnProfile(uid: string): void {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error('Sua sessão expirou. Entre novamente.');
  }
}

export const createUserProfile = async (
  uid: string,
  profile: Omit<ChatUser, 'uid' | 'createdAt'>,
): Promise<void> => {
  assertOwnProfile(uid);
  if (
    !profile.name.trim()
    || !profile.email.trim()
    || !profile.phoneNumber.trim()
    || !/^\d{2}\/\d{2}\/\d{4}$/.test(profile.birthDate)
    || !profile.photoUrl.startsWith('https://')
  ) {
    throw new Error('Preencha nome, e-mail, celular, nascimento e foto com dados válidos.');
  }
  const userDoc = doc(firestore, 'users', uid);
  await setDoc(userDoc, {
    ...profile,
    name: profile.name.trim(),
    email: profile.email.trim(),
    createdAt: Date.now(),
  });
};

export const updateUserProfile = async (
  uid: string,
  data: Partial<Omit<ChatUser, 'uid' | 'createdAt'>>,
): Promise<void> => {
  assertOwnProfile(uid);
  if (data.email !== undefined) {
    throw new Error('O e-mail da conta não pode ser alterado por esta tela.');
  }
  const userDoc = doc(firestore, 'users', uid);
  await setDoc(userDoc, {
    ...data,
    ...(data.name !== undefined && { name: data.name.trim() }),
  }, { merge: true });
};

export const listenToOwnUserProfile = (
  uid: string,
  callback: (profile: ChatUser | null) => void,
  onError?: (error: Error) => void,
): (() => void) => onSnapshot(doc(firestore, 'users', uid), (snapshot) => {
  if (!snapshot.exists()) {
    callback(null);
    onError?.(new Error('Seu cadastro ainda não foi concluído. Complete os dados do perfil.'));
    return;
  }

  const profile = parseOwnUserProfile(uid, snapshot.data());
  callback(profile);
  if (!profile) {
    onError?.(new Error('Seu perfil está incompleto ou possui dados inválidos.'));
  }
}, () => {
  callback(null);
  onError?.(new Error('Não foi possível validar seu perfil. Verifique a conexão.'));
});

export const getUserProfile = async (uid: string): Promise<ChatUser | null> => {
  const profiles = await getUserProfiles([uid]);
  return profiles[0] ?? null;
};

export const getUserProfiles = async (userIds: string[]): Promise<ChatUser[]> => {
  const uniqueUserIds = [...new Set(userIds)].filter(Boolean);
  if (uniqueUserIds.length > 100) {
    throw new Error('Consulte no máximo 100 perfis por vez.');
  }
  const res = await authenticatedApiFetch('/sync-members/users/profiles', {
    method: 'POST',
    body: JSON.stringify({ userIds: uniqueUserIds })
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
