import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const imageBucket = 'cp5-images';

const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

const extensionByContentType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function buildObjectPath(path: string, contentType: string) {
  const safePath = path.replace(/[^a-zA-Z0-9/_-]/g, '');
  const extension = extensionByContentType[contentType] ?? 'jpg';
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${safePath}-${uniqueSuffix}.${extension}`;
}

export const uploadImageAsync = async (uri: string, path: string): Promise<string> => {
  if (!supabase) {
    throw new Error('Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY para enviar imagens.');
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  const contentType = blob.type.toLowerCase() || 'image/jpeg';

  if (!contentType.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem válido.');
  }

  const objectPath = buildObjectPath(path, contentType);
  const { error } = await supabase.storage.from(imageBucket).upload(
    objectPath,
    await blob.arrayBuffer(),
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

  const { data } = supabase.storage.from(imageBucket).getPublicUrl(objectPath);
  return data.publicUrl;
};
