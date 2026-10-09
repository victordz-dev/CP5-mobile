import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebaseConfig.json';

// Supress Firebase Auth warning about AsyncStorage
const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('AsyncStorage')) return;
  originalWarn(...args);
};

let app: FirebaseApp;
let isNewApp = false;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  isNewApp = true;
} else {
  app = getApps()[0];
}

export const auth = isNewApp ? initializeAuth(app, {
  persistence: inMemoryPersistence
}) : getAuth(app);

export const database = getDatabase(app);
export const firestore = getFirestore(app);

export default app;
