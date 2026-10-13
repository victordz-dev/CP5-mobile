import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import {
  parseNotificationConversationData,
  registerForPushNotificationsAsync,
} from '../../services/notificationService';

import * as Notifications from 'expo-notifications';
import { chatRoute } from '../../types/navigation';

export default function MainLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync(user.uid).catch(() => {
        Alert.alert(
          'Notificações indisponíveis',
          'Não foi possível registrar este aparelho. As mensagens continuam disponíveis dentro do aplicativo.',
        );
      });
    }
  }, [user]);

  useEffect(() => {
    if (lastNotificationResponse) {
      const data = parseNotificationConversationData(
        lastNotificationResponse.notification.request.content.data,
      );
      if (data) {
        router.push(chatRoute({
          id: data.conversationId,
          type: data.conversationType,
          name: data.name,
        }));
        void Notifications.clearLastNotificationResponseAsync();
      }
    }
  }, [lastNotificationResponse, router]);

  const headerStyle = {
    backgroundColor: '#FFFFFF',
  };
  const headerTintColor = '#111827';

  return (
    <Stack
      screenOptions={{
        headerStyle,
        headerTintColor,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="conversations" 
        options={{ 
          title: 'Conversas',
          headerShown: false
        }} 
      />
      <Stack.Screen name="users" options={{ title: 'Contatos' }} />
      <Stack.Screen name="group-form" options={{ title: 'Novo Grupo' }} />
      <Stack.Screen name="chat" options={{ title: 'Chat' }} />
      <Stack.Screen name="profile" options={{ title: 'Perfil' }} />
      <Stack.Screen name="group-details" options={{ title: 'Detalhes do Grupo' }} />
    </Stack>
  );
}
