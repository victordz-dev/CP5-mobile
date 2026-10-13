function requireValue(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Configure ${name} no ambiente do aplicativo.`);
  }
  return normalized;
}

function requireHttpsUrl(value: string | undefined, name: string): string {
  const normalized = requireValue(value, name).replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${name} deve conter uma URL válida.`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${name} deve usar HTTPS.`);
  }
  return normalized;
}

export function getApiBaseUrl(): string {
  return requireHttpsUrl(process.env.EXPO_PUBLIC_API_URL, 'EXPO_PUBLIC_API_URL');
}

export function getFirebaseEnvironment() {
  return {
    apiKey: requireValue(process.env.EXPO_PUBLIC_FIREBASE_API_KEY, 'EXPO_PUBLIC_FIREBASE_API_KEY'),
    authDomain: requireValue(
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    ),
    databaseURL: requireHttpsUrl(
      process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
      'EXPO_PUBLIC_FIREBASE_DATABASE_URL',
    ),
    projectId: requireValue(
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    ),
    storageBucket: requireValue(
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    ),
    messagingSenderId: requireValue(
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    ),
    appId: requireValue(process.env.EXPO_PUBLIC_FIREBASE_APP_ID, 'EXPO_PUBLIC_FIREBASE_APP_ID'),
  };
}

export function getSupabaseStorageEnvironment(): {
  url: string;
  publishableKey: string;
  bucket: string;
} {
  const bucket = requireValue(
    process.env.EXPO_PUBLIC_SUPABASE_BUCKET,
    'EXPO_PUBLIC_SUPABASE_BUCKET',
  );
  if (!/^[a-zA-Z0-9_-]+$/.test(bucket)) {
    throw new Error('EXPO_PUBLIC_SUPABASE_BUCKET possui formato inválido.');
  }
  return {
    url: requireHttpsUrl(process.env.EXPO_PUBLIC_SUPABASE_URL, 'EXPO_PUBLIC_SUPABASE_URL'),
    publishableKey: requireValue(
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    ),
    bucket,
  };
}
