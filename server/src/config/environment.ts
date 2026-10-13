import 'dotenv/config';

export function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} deve ser configurada no ambiente da API.`);
  }
  return value;
}

export function requireHttpsEnvironmentVariable(name: string): string {
  const value = requireEnvironmentVariable(name);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} deve conter uma URL válida.`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${name} deve usar HTTPS.`);
  }
  return value.replace(/\/+$/, '');
}
