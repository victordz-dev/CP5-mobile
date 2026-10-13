import { ref, push, set, onValue, query as databaseQuery, orderByChild } from 'firebase/database';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query as firestoreQuery,
  runTransaction,
  where,
} from 'firebase/firestore';
import { auth, database, firestore } from './firebase';
import { ChatMessage, ChatMessageDraft, DirectConversation, MessageTarget } from '../types/chat';
import { authenticatedApiFetch, readApiError } from './api';

export class MessagePersistedPushError extends Error {
  constructor(readonly messageId: string) {
    super('A mensagem foi salva, mas não foi possível acionar a notificação.');
    this.name = 'MessagePersistedPushError';
  }
}

function isMessageTarget(value: unknown): value is MessageTarget {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }
  if (value.type === 'conversation') {
    return true;
  }
  return value.type === 'member'
    && 'memberId' in value
    && typeof value.memberId === 'string'
    && value.memberId.length > 0;
}

function parseChatMessage(value: unknown): ChatMessage | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const mentionedUserIds = record.mentionedUserIds === undefined
    ? []
    : record.mentionedUserIds;
  if (
    typeof record.id !== 'string'
    || typeof record.conversationId !== 'string'
    || (record.conversationType !== 'direct' && record.conversationType !== 'group')
    || typeof record.senderId !== 'string'
    || typeof record.text !== 'string'
    || !isMessageTarget(record.target)
    || !Array.isArray(mentionedUserIds)
    || !mentionedUserIds.every((userId) => typeof userId === 'string')
    || typeof record.createdAt !== 'number'
    || !Number.isFinite(record.createdAt)
  ) {
    return null;
  }

  return {
    id: record.id,
    conversationId: record.conversationId,
    conversationType: record.conversationType,
    senderId: record.senderId,
    text: record.text,
    target: record.target,
    mentionedUserIds,
    createdAt: record.createdAt,
  };
}

function normalizeMessageDraft(message: ChatMessageDraft): ChatMessageDraft {
  const text = message.text.trim();
  const mentionedUserIds = [...new Set(message.mentionedUserIds)];
  if (!message.conversationId || text.length === 0 || text.length > 10_000) {
    throw new Error('Digite uma mensagem válida com até 10.000 caracteres.');
  }
  if (message.conversationType === 'direct' && (message.target.type !== 'conversation' || mentionedUserIds.length > 0)) {
    throw new Error('Conversas individuais não aceitam destinatários de grupo.');
  }
  if (
    message.target.type === 'member'
    && !mentionedUserIds.includes(message.target.memberId)
  ) {
    throw new Error('O destinatário direcionado deve constar nas menções da mensagem.');
  }

  return { ...message, text, mentionedUserIds };
}

function parseDirectConversation(
  conversationId: string,
  value: unknown,
): DirectConversation | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    !Array.isArray(record.participantIds)
    || record.participantIds.length !== 2
    || !record.participantIds.every((participantId) => typeof participantId === 'string')
    || record.participantIds[0] >= record.participantIds[1]
    || conversationId !== record.participantIds.join('_')
    || typeof record.createdAt !== 'number'
  ) {
    return null;
  }

  return {
    id: conversationId,
    type: 'direct',
    participantIds: [record.participantIds[0], record.participantIds[1]],
    notificationPolicy: record.notificationPolicy === 'disabled' ? 'disabled' : undefined,
    createdAt: record.createdAt,
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : undefined,
  };
}

export const sendMessage = async (draft: ChatMessageDraft): Promise<string> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Sua sessão expirou. Entre novamente.');
  }

  const message = normalizeMessageDraft(draft);
  const messagesRef = ref(database, `messages/${message.conversationId}`);
  const newMessageRef = push(messagesRef);
  if (!newMessageRef.key) {
    throw new Error('Não foi possível gerar o identificador da mensagem.');
  }
  
  const newMessage: ChatMessage = {
    ...message,
    id: newMessageRef.key,
    senderId: currentUser.uid,
    createdAt: Date.now(),
  };

  await set(newMessageRef, newMessage);

  try {
    const response = await authenticatedApiFetch('/notifications/messages', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: message.conversationId,
        messageId: newMessage.id
      })
    });
    if (!response.ok) {
      throw new Error(await readApiError(response, 'Servidor retornou erro ao acionar o push.'));
    }
  } catch (error: unknown) {
    console.error('Falha ao acionar a API de notificações:', error);
    throw new MessagePersistedPushError(newMessage.id);
  }

  return newMessage.id;
};

export const listenToMessages = (
  conversationId: string,
  callback: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void,
): (() => void) => {
  const messagesRef = ref(database, `messages/${conversationId}`);
  const q = databaseQuery(messagesRef, orderByChild('createdAt'));

  const unsubscribe = onValue(q, (snapshot) => {
    const messages: ChatMessage[] = [];
    let containsInvalidMessage = false;
    snapshot.forEach((child) => {
      const message = parseChatMessage(child.val() as unknown);
      if (message && message.id === child.key && message.conversationId === conversationId) {
        messages.push(message);
      } else {
        containsInvalidMessage = true;
      }
    });
    callback(messages);
    if (containsInvalidMessage) {
      onError?.(new Error('Uma ou mais mensagens inválidas foram ignoradas.'));
    }
  }, () => {
    onError?.(new Error('Não foi possível acompanhar o chat em tempo real.'));
  });

  return unsubscribe;
};

export const generateDirectConversationId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join('_');
};

export const listenToDirectConversations = (
  userId: string,
  callback: (conversations: DirectConversation[]) => void,
  onError?: (error: Error) => void,
): (() => void) => {
  const conversationsQuery = firestoreQuery(
    collection(firestore, 'directConversations'),
    where('participantIds', 'array-contains', userId),
  );

  return onSnapshot(conversationsQuery, (snapshot) => {
    const conversations: DirectConversation[] = [];
    for (const document of snapshot.docs) {
      const conversation = parseDirectConversation(document.id, document.data());
      if (!conversation) {
        onError?.(new Error('A conversa individual possui dados inválidos.'));
        continue;
      }
      conversations.push(conversation);
    }
    callback(conversations);
  }, () => {
    onError?.(new Error('Não foi possível carregar as conversas individuais.'));
  });
};

export const getDirectConversationById = async (
  conversationId: string,
): Promise<DirectConversation | null> => {
  const snapshot = await getDoc(doc(firestore, 'directConversations', conversationId));
  if (!snapshot.exists()) {
    return null;
  }

  const conversation = parseDirectConversation(snapshot.id, snapshot.data());
  if (!conversation) {
    throw new Error('A conversa individual possui dados inválidos.');
  }
  return conversation;
};

export const createDirectConversation = async (otherUserId: string): Promise<string> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Sua sessão expirou. Entre novamente.');
  }
  if (!otherUserId || otherUserId === currentUser.uid) {
    throw new Error('Selecione outro usuário para iniciar a conversa.');
  }

  const participantIds = [currentUser.uid, otherUserId].sort();
  const conversationId = generateDirectConversationId(participantIds[0], participantIds[1]);
  const conversationRef = doc(firestore, 'directConversations', conversationId);
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(conversationRef);
    if (!snapshot.exists()) {
      transaction.set(conversationRef, {
        participantIds,
        createdAt: Date.now(),
      });
    }
  });
  await syncChatMembers(conversationId, 'direct');
  return conversationId;
};

export const syncChatMembers = async (
  conversationId: string,
  type: 'direct' | 'group',
): Promise<void> => {
  const res = await authenticatedApiFetch('/sync-members', {
    method: 'POST',
    body: JSON.stringify({ conversationId, type })
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Falha ao sincronizar integrantes'));
  }
};
