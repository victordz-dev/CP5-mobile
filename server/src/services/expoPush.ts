import { isJsonObject } from '../domain/contracts';

const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const PUSH_BATCH_SIZE = 100;

export interface ExpoPushMessage {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: {
    conversationId: string;
    conversationType: 'direct' | 'group';
    name: string;
  };
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  details?: { error?: string };
}

export interface ExpoPushReceipt {
  status: 'ok' | 'error';
  details?: { error?: string };
}

function requestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }
  return headers;
}

function parseTicket(value: unknown): ExpoPushTicket | null {
  if (!isJsonObject(value) || (value.status !== 'ok' && value.status !== 'error')) {
    return null;
  }

  const details = isJsonObject(value.details) && typeof value.details.error === 'string'
    ? { error: value.details.error }
    : undefined;
  return {
    status: value.status,
    id: typeof value.id === 'string' ? value.id : undefined,
    details,
  };
}

function parseReceipt(value: unknown): ExpoPushReceipt | null {
  const ticket = parseTicket(value);
  if (!ticket) {
    return null;
  }
  return { status: ticket.status, details: ticket.details };
}

export function isExpoPushToken(token: string): boolean {
  return /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(token);
}

export async function sendExpoPushMessages(messages: readonly ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const tickets: ExpoPushTicket[] = [];

  for (let offset = 0; offset < messages.length; offset += PUSH_BATCH_SIZE) {
    const chunk = messages.slice(offset, offset + PUSH_BATCH_SIZE);
    const response = await fetch(EXPO_SEND_URL, {
      method: 'POST',
      headers: requestHeaders(),
      body: JSON.stringify(chunk),
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok || !isJsonObject(payload) || !Array.isArray(payload.data)) {
      throw new Error(`Expo Push Service respondeu com status ${response.status}.`);
    }

    const chunkTickets = payload.data.map(parseTicket);
    if (chunkTickets.some((ticket) => ticket === null) || chunkTickets.length !== chunk.length) {
      throw new Error('Expo Push Service retornou tickets inválidos.');
    }
    tickets.push(...(chunkTickets as ExpoPushTicket[]));
  }

  return tickets;
}

export async function getExpoPushReceipts(
  receiptIds: readonly string[],
): Promise<Record<string, ExpoPushReceipt>> {
  const response = await fetch(EXPO_RECEIPTS_URL, {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({ ids: receiptIds }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isJsonObject(payload) || !isJsonObject(payload.data)) {
    throw new Error(`Expo Push Service respondeu com status ${response.status}.`);
  }

  const receipts: Record<string, ExpoPushReceipt> = {};
  Object.entries(payload.data).forEach(([receiptId, value]) => {
    const receipt = parseReceipt(value);
    if (receipt) {
      receipts[receiptId] = receipt;
    }
  });
  return receipts;
}
