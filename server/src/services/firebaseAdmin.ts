import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { requireEnvironmentVariable, requireHttpsEnvironmentVariable } from '../config/environment';

if (getApps().length === 0) {
  const projectId = requireEnvironmentVariable('FIREBASE_PROJECT_ID');
  const clientEmail = requireEnvironmentVariable('FIREBASE_CLIENT_EMAIL');
  const privateKey = requireEnvironmentVariable('FIREBASE_PRIVATE_KEY');
  const databaseURL = requireHttpsEnvironmentVariable('FIREBASE_DATABASE_URL');
  const credential = cert({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n'),
  });

  initializeApp({
    credential,
    databaseURL,
    projectId,
  });
}

export const adminAuth = getAuth();
export const adminFirestore = getFirestore();
export const adminDatabase = getDatabase();
