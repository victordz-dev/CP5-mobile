import { ref, push, set, onValue, query, orderByChild } from 'firebase/database';
import { database } from './firebase';
import { ChatMessage } from '../types/chat';
import { authenticatedApiFetch, readApiError } from './api';

export const sendMessage = async (message: Omit<ChatMessage, 'id' | 'createdAt'>) => {
  const messagesRef = ref(database, `messages/${message.conversationId}`);
  const newMessageRef = push(messagesRef);
  
  const newMessage: ChatMessage = {
    ...message,
    id: newMessageRef.key as string,
    createdAt: Date.now(),
  };

  await set(newMessageRef, newMessage);

  // After saving, trigger API to send push notification
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
    throw new Error('Falha de rede ao acionar a API de notificações.');
  }

  return newMessage.id;
};

export const listenToMessages = (conversationId: string, callback: (messages: ChatMessage[]) => void) => {
  const messagesRef = ref(database, `messages/${conversationId}`);
  const q = query(messagesRef, orderByChild('createdAt'));

  const unsubscribe = onValue(q, (snapshot) => {
    const messages: ChatMessage[] = [];
    snapshot.forEach((child) => {
      messages.push(child.val() as ChatMessage);
    });
    callback(messages);
  }, () => {
    alert('Problema na conexão do chat em tempo real.');
  });

  return unsubscribe;
};

export const generateDirectConversationId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join('_');
};

export const syncChatMembers = async (conversationId: string, type: 'direct' | 'group') => {
  const res = await authenticatedApiFetch('/sync-members', {
    method: 'POST',
    body: JSON.stringify({ conversationId, type })
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Falha ao sincronizar integrantes'));
  }
};
