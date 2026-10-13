import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { get, ref, remove, set } from 'firebase/database';

const projectId = 'demo-cp5-rules';
const testEnvironment = await initializeTestEnvironment({
  projectId,
  firestore: {
    rules: readFileSync('firestore.rules', 'utf8'),
  },
  database: {
    rules: readFileSync('database.rules.json', 'utf8'),
  },
});

const validProfile = {
  name: 'Alice Example',
  email: 'alice@example.com',
  phoneNumber: '(11) 99999-9999',
  birthDate: '01/01/2000',
  photoUrl: 'https://example.com/alice.jpg',
  createdAt: 1_700_000_000_000,
};

const validMessage = {
  id: 'message-1',
  conversationId: 'conversation-1',
  conversationType: 'direct',
  senderId: 'alice',
  text: 'Mensagem persistida',
  target: { type: 'conversation' },
  createdAt: 1_700_000_000_000,
};

try {
  await testEnvironment.clearFirestore();
  await testEnvironment.clearDatabase();

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await Promise.all([
      setDoc(doc(context.firestore(), 'users', 'alice'), validProfile),
      setDoc(doc(context.firestore(), 'users', 'bob'), {
        ...validProfile,
        name: 'Bob Example',
        email: 'bob@example.com',
      }),
      setDoc(doc(context.firestore(), 'groups', 'group-1'), {
        id: 'group-1',
        name: 'Grupo',
        photoUrl: 'https://example.com/group.jpg',
        ownerId: 'alice',
        memberIds: ['alice', 'bob'],
        memberLimit: 5,
        notificationPolicy: 'all_group_messages',
        membershipVersion: 1,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      }),
      set(ref(context.database(), 'chat_members/conversation-1'), {
        _version: 1,
        alice: true,
      }),
    ]);
  });

  const alice = testEnvironment.authenticatedContext('alice', {
    email: 'alice@example.com',
  });
  const bob = testEnvironment.authenticatedContext('bob', {
    email: 'bob@example.com',
  });
  const charlie = testEnvironment.authenticatedContext('charlie', {
    email: 'charlie@example.com',
  });
  const anonymous = testEnvironment.unauthenticatedContext();

  await assertFails(getDoc(doc(anonymous.firestore(), 'users', 'alice')));
  await assertFails(getDoc(doc(bob.firestore(), 'users', 'alice')));
  await assertFails(getDocs(collection(bob.firestore(), 'users')));
  await assertSucceeds(getDoc(doc(alice.firestore(), 'users', 'alice')));
  await assertFails(setDoc(doc(alice.firestore(), 'users', 'alice'), {
    ...validProfile,
    createdAt: validProfile.createdAt + 1,
    injectedRole: 'admin',
  }));
  await assertFails(updateDoc(doc(alice.firestore(), 'users', 'alice'), {
    email: 'attacker@example.com',
  }));
  await assertFails(updateDoc(doc(alice.firestore(), 'users', 'alice'), {
    name: 'x'.repeat(1_000_000),
  }));

  const aliceDevice = doc(alice.firestore(), 'users', 'alice', 'devices', 'device-1');
  await assertSucceeds(setDoc(aliceDevice, {
    token: 'ExponentPushToken[test]',
    platform: 'android',
    enabled: true,
    updatedAt: 1_700_000_000_000,
  }));
  await assertFails(getDoc(doc(
    bob.firestore(),
    'users',
    'alice',
    'devices',
    'device-1',
  )));
  await assertFails(updateDoc(aliceDevice, { platform: 'web' }));

  await assertSucceeds(setDoc(doc(alice.firestore(), 'directConversations', 'alice_bob'), {
    participantIds: ['alice', 'bob'],
    createdAt: 1_700_000_000_000,
  }));
  await assertSucceeds(getDoc(doc(bob.firestore(), 'directConversations', 'alice_bob')));
  await assertFails(getDoc(doc(charlie.firestore(), 'directConversations', 'alice_bob')));
  await assertFails(updateDoc(
    doc(alice.firestore(), 'directConversations', 'alice_bob'),
    { participantIds: ['alice', 'charlie'] },
  ));
  await assertFails(setDoc(doc(alice.firestore(), 'directConversations', 'alice_alice'), {
    participantIds: ['alice', 'alice'],
    createdAt: 1_700_000_000_000,
  }));
  await assertFails(setDoc(doc(alice.firestore(), 'directConversations', 'alice_bob_charlie'), {
    participantIds: ['alice', 'bob', 'charlie'],
    createdAt: 1_700_000_000_000,
  }));
  await assertSucceeds(getDoc(doc(alice.firestore(), 'directConversations', 'missing')));
  await assertSucceeds(getDocs(query(
    collection(alice.firestore(), 'directConversations'),
    where('participantIds', 'array-contains', 'alice'),
  )));
  await assertFails(getDocs(query(
    collection(anonymous.firestore(), 'directConversations'),
    where('participantIds', 'array-contains', 'alice'),
  )));
  await assertSucceeds(getDoc(doc(alice.firestore(), 'groups', 'group-1')));
  await assertFails(getDoc(doc(charlie.firestore(), 'groups', 'group-1')));
  await assertSucceeds(getDocs(query(
    collection(alice.firestore(), 'groups'),
    where('memberIds', 'array-contains', 'alice'),
  )));
  await assertFails(setDoc(doc(alice.firestore(), 'groups', 'group-2'), {
    id: 'group-2',
    name: 'Grupo injetado pelo cliente',
    photoUrl: '',
    ownerId: 'alice',
    memberIds: ['alice', 'bob'],
    memberLimit: 2,
    notificationPolicy: 'all_group_messages',
    membershipVersion: 1,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  }));
  await assertFails(setDoc(doc(alice.firestore(), 'pushTickets', 'ticket-1'), {
    token: 'ExponentPushToken[test]',
  }));
  await assertFails(getDoc(doc(alice.firestore(), 'pushTickets', 'ticket-1')));

  const aliceMessage = ref(alice.database(), 'messages/conversation-1/message-1');
  await assertSucceeds(set(aliceMessage, validMessage));
  await assertSucceeds(get(ref(alice.database(), 'messages/conversation-1')));
  await assertFails(get(ref(anonymous.database(), 'messages/conversation-1')));
  await assertFails(get(ref(bob.database(), 'messages/conversation-1')));
  await assertFails(set(ref(alice.database(), 'messages/conversation-1/message-2'), {
    ...validMessage,
    id: 'message-2',
    senderId: 'bob',
  }));
  await assertFails(set(ref(alice.database(), 'messages/conversation-1/message-3'), {
    ...validMessage,
    id: 'message-3',
    unexpected: true,
  }));
  await assertFails(set(ref(alice.database(), 'messages/conversation-1/message-4'), {
    ...validMessage,
    id: 'message-4',
    target: { type: 'member', memberId: 'bob' },
  }));
  await assertFails(set(ref(alice.database(), 'messages/conversation-1/message-long'), {
    ...validMessage,
    id: 'message-long',
    text: 'x'.repeat(10_001),
  }));
  await assertFails(set(ref(alice.database(), 'messages/conversation-1/message-future'), {
    ...validMessage,
    id: 'message-future',
    createdAt: Date.now() + 120_000,
  }));
  await assertFails(set(ref(alice.database(), 'messages/conversation-1/message-mentions'), {
    ...validMessage,
    id: 'message-mentions',
    mentionedUserIds: Array.from({ length: 101 }, () => 'alice'),
  }));
  await assertFails(set(aliceMessage, { ...validMessage, text: 'Mensagem alterada' }));

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await remove(ref(context.database(), 'chat_members/conversation-1/alice'));
  });
  await assertFails(get(ref(alice.database(), 'messages/conversation-1')));
  await assertFails(set(ref(alice.database(), 'messages/conversation-1/message-5'), {
    ...validMessage,
    id: 'message-5',
  }));

  console.log('Firebase Security Rules: cenários permitidos e negados validados.');
} finally {
  await testEnvironment.cleanup();
}
