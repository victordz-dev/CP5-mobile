import AsyncStorage from '@react-native-async-storage/async-storage';
import * as nativeAuth from '@firebase/auth';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, type Persistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import { getFirebaseEnvironment } from '../config/environment';

type NativeAuthModule = typeof nativeAuth & {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

const getReactNativePersistence = (nativeAuth as NativeAuthModule).getReactNativePersistence;

let app: FirebaseApp;
let isNewApp = false;

if (getApps().length === 0) {
  app = initializeApp(getFirebaseEnvironment());
  isNewApp = true;
} else {
  app = getApps()[0];
}

export const auth = isNewApp && Platform.OS !== 'web'
  ? initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    })
  : getAuth(app);

export const database = getDatabase(app);
export const firestore = getFirestore(app);

export default app;
