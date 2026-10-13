import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Unsubscribe,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from './firebase';
import { disablePushNotificationsAsync } from './notificationService';

export type AuthenticatedUser = User;

export const observeAuthState = (
  callback: (user: AuthenticatedUser | null) => void,
): Unsubscribe => onAuthStateChanged(auth, callback);

function toAuthenticationError(error: unknown): Error {
  if (!(error instanceof FirebaseError)) {
    return new Error('Não foi possível acessar sua conta. Verifique a conexão e tente novamente.');
  }

  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-email':
    case 'auth/user-disabled':
      return new Error('E-mail ou senha inválidos. Confira os dados e tente novamente.');
    case 'auth/email-already-in-use':
      return new Error('Este e-mail já está associado a uma conta.');
    case 'auth/weak-password':
      return new Error('A senha não atende aos requisitos mínimos de segurança.');
    case 'auth/network-request-failed':
      return new Error('Sem conexão com o serviço de autenticação. Tente novamente.');
    case 'auth/too-many-requests':
      return new Error('Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.');
    case 'auth/user-token-expired':
    case 'auth/requires-recent-login':
      return new Error('Sua sessão expirou. Entre novamente.');
    default:
      return new Error('Não foi possível concluir a autenticação. Tente novamente.');
  }
}

export const login = async (email: string, password: string): Promise<UserCredential> => {
  try {
    return await signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (error: unknown) {
    throw toAuthenticationError(error);
  }
};

export const register = async (email: string, password: string): Promise<UserCredential> => {
  try {
    return await createUserWithEmailAndPassword(auth, email.trim(), password);
  } catch (error: unknown) {
    throw toAuthenticationError(error);
  }
};

export const logout = async (): Promise<void> => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    await disablePushNotificationsAsync(currentUser.uid);
  }
  await signOut(auth);
};

export const rollbackRegistration = async (uid: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid) {
    return;
  }

  try {
    await deleteUser(currentUser);
  } catch (error: unknown) {
    await signOut(auth);
    console.warn('A conta incompleta não pôde ser removida automaticamente.', error);
  }
};
