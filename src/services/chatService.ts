import { ref, push, set, onValue, query, orderByChild } from 'firebase/database';
import { database, auth } from './firebase';
import Constants from 'expo-constants';
import { ChatMessage } from '../types/chat';

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
    const token = await auth.currentUser?.getIdToken();
    const response = await fetch((Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL) + '/notifications/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        conversationId: message.conversationId,
        messageId: newMessage.id
      })
    });
    if (!response.ok) {
      console.warn('Failed to trigger notification API', await response.text());
      throw new Error('Servidor retornou erro ao acionar o Push');
    }
  } catch (error) {
    console.error('Error calling notification API', error);
    throw new Error('Falha de rede ao acionar a API de notificações');
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
  }, (error) => {
    console.error("Erro na sincronização de mensagens do RTDB:", error);
  });

  return unsubscribe;
};

export const generateDirectConversationId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join('_');
};

export const syncChatMembers = async (conversationId: string, type: 'direct' | 'group') => {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch((Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL) + '/sync-members', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ conversationId, type })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao sincronizar membros');
  }
};
