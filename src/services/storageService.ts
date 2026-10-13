import { createClient } from '@supabase/supabase-js';
import { getSupabaseStorageEnvironment } from '../config/environment';

const maxImageBytes = 10 * 1024 * 1024;
let storageClient: ReturnType<typeof createClient> | null = null;

function getStorageClient() {
  const environment = getSupabaseStorageEnvironment();
  storageClient ??= createClient(environment.url, environment.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return { client: storageClient, bucket: environment.bucket };
}

const extensionByContentType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function buildObjectPath(path: string, contentType: string) {
  const safePath = path.replace(/[^a-zA-Z0-9/_-]/g, '');
  if (!safePath || safePath.startsWith('/') || safePath.includes('..')) {
    throw new Error('O destino da imagem é inválido.');
  }
  const extension = extensionByContentType[contentType] ?? 'jpg';
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${safePath}-${uniqueSuffix}.${extension}`;
}

export const uploadImageAsync = async (uri: string, path: string): Promise<string> => {
  const { client, bucket } = getStorageClient();

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('N\u00e3o foi poss\u00edvel ler a imagem selecionada.');
  }
  const contentType = response.headers.get('content-type')?.toLowerCase() || 'image/jpeg';
  const imageData = await response.arrayBuffer();

  if (!contentType.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem válido.');
  }
  if (imageData.byteLength <= 0 || imageData.byteLength > maxImageBytes) {
    throw new Error('A imagem deve ter no máximo 10 MB.');
  }

  const objectPath = buildObjectPath(path, contentType);
  const { error } = await client.storage.from(bucket).upload(
    objectPath,
    imageData,
    {
      cacheControl: '31536000',
      contentType,
      upsert: false,
    },
  );

  if (error) {
    console.error('Supabase Storage upload error:', error);
    throw new Error('Não foi possível enviar a imagem. Tente novamente.');
  }

  const { data } = client.storage.from(bucket).getPublicUrl(objectPath);
  if (!data.publicUrl.startsWith('https://')) {
    throw new Error('O armazenamento não retornou uma URL segura para a imagem.');
  }
  return data.publicUrl;
};
