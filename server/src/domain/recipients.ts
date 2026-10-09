import { GroupRecord, StoredMessage } from './contracts';

export function selectDirectRecipients(
  participantIds: readonly string[],
  senderId: string,
  notificationsDisabled: boolean,
): string[] {
  if (notificationsDisabled) {
    return [];
  }

  return participantIds.filter((participantId) => participantId !== senderId);
}

export function selectGroupRecipients(group: GroupRecord, message: StoredMessage): string[] {
  if (
    group.notificationPolicy === 'disabled'
    || group.notificationPolicy === 'direct_messages_only'
  ) {
    return [];
  }

  if (group.notificationPolicy === 'all_group_messages') {
    return group.memberIds.filter((memberId) => memberId !== message.senderId);
  }

  const requestedRecipients = new Set(message.mentionedUserIds);
  if (message.target.type === 'member') {
    requestedRecipients.add(message.target.memberId);
  }

  return group.memberIds.filter(
    (memberId) => memberId !== message.senderId && requestedRecipients.has(memberId),
  );
}
