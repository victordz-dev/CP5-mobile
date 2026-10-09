import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { registerForPushNotificationsAsync } from '../../services/notificationService';

import * as Notifications from 'expo-notifications';

export default function MainLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync(user.uid).catch((err) => {
        console.warn('Erro ao registrar push notifications', err);
        // Removed alert so it doesn't loop just in case
      });
    }
  }, [user]);

  useEffect(() => {
    if (lastNotificationResponse) {
      const data = lastNotificationResponse.notification.request.content.data;
      if (data && data.conversationId) {
        router.push(`/(main)/chat?id=${data.conversationId}&type=${data.conversationType}&name=${encodeURIComponent((data.name as string) || 'Chat')}`);
      }
    }
  }, [lastNotificationResponse, router]);

  const headerStyle = {
    backgroundColor: '#FFFFFF', // theme.colors.card
  };
  const headerTintColor = '#111827'; // theme.colors.text

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
          headerShown: false // Custom header inside conversations.tsx
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
