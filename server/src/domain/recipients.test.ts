import assert from 'node:assert/strict';
import test from 'node:test';
import { GroupRecord, StoredMessage } from './contracts';
import { selectDirectRecipients, selectGroupRecipients } from './recipients';

const baseGroup: GroupRecord = {
  id: 'group-1',
  name: 'Grupo',
  photoUrl: '',
  ownerId: 'owner',
  memberIds: ['owner', 'member-1', 'member-2'],
  memberLimit: 3,
  notificationPolicy: 'all_group_messages',
  membershipVersion: 1,
  createdAt: 1,
  updatedAt: 1,
};

const baseMessage: StoredMessage = {
  id: 'message-1',
  conversationId: 'group-1',
  conversationType: 'group',
  senderId: 'owner',
  text: 'Mensagem privada que não deve aparecer no push',
  target: { type: 'conversation' },
  mentionedUserIds: [],
  createdAt: 1,
};

test('all_group_messages notifica todos os integrantes, menos o remetente', () => {
  assert.deepEqual(selectGroupRecipients(baseGroup, baseMessage), ['member-1', 'member-2']);
});

test('mentioned_members aceita menção e destinatário selecionado e filtra não integrantes', () => {
  const group = { ...baseGroup, notificationPolicy: 'mentioned_members' as const };
  const message: StoredMessage = {
    ...baseMessage,
    target: { type: 'member', memberId: 'member-1' },
    mentionedUserIds: ['member-2', 'outsider', 'owner'],
  };

  assert.deepEqual(selectGroupRecipients(group, message), ['member-1', 'member-2']);
});

test('direct_messages_only e disabled não notificam em grupos', () => {
  assert.deepEqual(
    selectGroupRecipients({ ...baseGroup, notificationPolicy: 'direct_messages_only' }, baseMessage),
    [],
  );
  assert.deepEqual(
    selectGroupRecipients({ ...baseGroup, notificationPolicy: 'disabled' }, baseMessage),
    [],
  );
});

test('conversa direta notifica somente o outro participante quando habilitada', () => {
  assert.deepEqual(selectDirectRecipients(['owner', 'member-1'], 'owner', false), ['member-1']);
  assert.deepEqual(selectDirectRecipients(['owner', 'member-1'], 'owner', true), []);
});
