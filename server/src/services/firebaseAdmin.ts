import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import * as dotenv from 'dotenv';
dotenv.config();

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const configuredCredentialFields = [projectId, clientEmail, privateKey].filter(Boolean).length;

  if (configuredCredentialFields > 0 && configuredCredentialFields < 3) {
    throw new Error(
      'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY devem ser configuradas em conjunto.',
    );
  }

  const credential = projectId && clientEmail && privateKey
    ? cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    })
    : applicationDefault();

  const databaseURL = process.env.FIREBASE_DATABASE_URL
    ?? (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : undefined);

  if (!databaseURL) {
    throw new Error('FIREBASE_DATABASE_URL ou FIREBASE_PROJECT_ID deve ser configurada.');
  }

  initializeApp({
    credential,
    databaseURL,
    projectId,
  });
}

export const adminAuth = getAuth();
export const adminFirestore = getFirestore();
export const adminDatabase = getDatabase();
