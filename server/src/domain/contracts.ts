export const NOTIFICATION_POLICIES = [
  'all_group_messages',
  'mentioned_members',
  'direct_messages_only',
  'disabled',
] as const;

export type NotificationPolicy = (typeof NOTIFICATION_POLICIES)[number];
export type ConversationType = 'direct' | 'group';

export type MessageTarget =
  | { type: 'conversation' }
  | { type: 'member'; memberId: string };

export interface StoredMessage {
  id: string;
  conversationId: string;
  conversationType: ConversationType;
  senderId: string;
  text: string;
  target: MessageTarget;
  mentionedUserIds: string[];
  createdAt: number;
}

export interface GroupRecord {
  id: string;
  name: string;
  photoUrl: string;
  ownerId: string;
  memberIds: string[];
  memberLimit: number;
  notificationPolicy: NotificationPolicy;
  membershipVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface DirectConversationRecord {
  participantIds: [string, string];
  notificationPolicy?: 'disabled';
  createdAt: number;
  updatedAt?: number;
}

export type JsonObject = Record<string, unknown>;

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown, maxLength = 1_500): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

export function isDocumentId(value: unknown): value is string {
  return isNonEmptyString(value, 1_500) && !value.includes('/');
}

export function isUid(value: unknown): value is string {
  return isNonEmptyString(value, 128) && !value.includes('/');
}

export function parseStringArray(value: unknown, validator = isUid): string[] | null {
  if (!Array.isArray(value) || !value.every(validator)) {
    return null;
  }

  return [...new Set(value)];
}

export function isNotificationPolicy(value: unknown): value is NotificationPolicy {
  return typeof value === 'string' && NOTIFICATION_POLICIES.includes(value as NotificationPolicy);
}

export function parseStoredMessage(value: unknown): StoredMessage | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const mentionedUserIds = value.mentionedUserIds === undefined
    ? []
    : parseStringArray(value.mentionedUserIds);

  if (
    !isDocumentId(value.id)
    || !isDocumentId(value.conversationId)
    || (value.conversationType !== 'direct' && value.conversationType !== 'group')
    || !isUid(value.senderId)
    || !isNonEmptyString(value.text, 10_000)
    || typeof value.createdAt !== 'number'
    || !Number.isFinite(value.createdAt)
    || !mentionedUserIds
    || !isJsonObject(value.target)
  ) {
    return null;
  }

  let target: MessageTarget;
  if (value.target.type === 'conversation') {
    target = { type: 'conversation' };
  } else if (value.target.type === 'member' && isUid(value.target.memberId)) {
    target = { type: 'member', memberId: value.target.memberId };
  } else {
    return null;
  }

  return {
    id: value.id,
    conversationId: value.conversationId,
    conversationType: value.conversationType,
    senderId: value.senderId,
    text: value.text,
    target,
    mentionedUserIds,
    createdAt: value.createdAt,
  };
}

export function parseDirectConversation(value: unknown): DirectConversationRecord | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const participantIds = parseStringArray(value.participantIds);
  if (
    !participantIds
    || participantIds.length !== 2
    || participantIds[0] >= participantIds[1]
    || typeof value.createdAt !== 'number'
  ) {
    return null;
  }

  if (value.notificationPolicy !== undefined && value.notificationPolicy !== 'disabled') {
    return null;
  }

  return {
    participantIds: [participantIds[0], participantIds[1]],
    notificationPolicy: value.notificationPolicy,
    createdAt: value.createdAt,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : undefined,
  };
}

export function parseGroupRecord(value: unknown): GroupRecord | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const memberIds = parseStringArray(value.memberIds);
  if (
    !isDocumentId(value.id)
    || !isNonEmptyString(value.name, 80)
    || typeof value.photoUrl !== 'string'
    || !isUid(value.ownerId)
    || !memberIds
    || memberIds.length < 2
    || !memberIds.includes(value.ownerId)
    || typeof value.memberLimit !== 'number'
    || !Number.isInteger(value.memberLimit)
    || value.memberLimit < memberIds.length
    || !isNotificationPolicy(value.notificationPolicy)
    || typeof value.createdAt !== 'number'
    || typeof value.updatedAt !== 'number'
  ) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    photoUrl: value.photoUrl,
    ownerId: value.ownerId,
    memberIds,
    memberLimit: value.memberLimit,
    notificationPolicy: value.notificationPolicy,
    membershipVersion: typeof value.membershipVersion === 'number'
      ? value.membershipVersion
      : 0,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}
