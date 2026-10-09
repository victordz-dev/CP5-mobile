import { adminDatabase } from './firebaseAdmin';

type MembershipRecord = Record<string, boolean | number> & { _version: number };

function makeMembershipRecord(memberIds: readonly string[], version: number): MembershipRecord {
  const record: MembershipRecord = { _version: version };
  memberIds.forEach((uid) => {
    record[uid] = true;
  });
  return record;
}

export async function syncConversationMembers(
  conversationId: string,
  memberIds: readonly string[],
  version: number,
): Promise<void> {
  const membersRef = adminDatabase.ref(`chat_members/${conversationId}`);
  const desiredState = makeMembershipRecord(memberIds, version);

  const result = await membersRef.transaction((currentValue: unknown) => {
    const currentVersion = typeof currentValue === 'object'
      && currentValue !== null
      && '_version' in currentValue
      && typeof currentValue._version === 'number'
      ? currentValue._version
      : -1;

    if (currentVersion > version) {
      return;
    }

    return desiredState;
  }, undefined, false);

  if (!result.committed) {
    const currentVersion = result.snapshot.child('_version').val() as unknown;
    if (typeof currentVersion !== 'number' || currentVersion < version) {
      throw new Error('Não foi possível sincronizar os integrantes da conversa.');
    }
  }
}
