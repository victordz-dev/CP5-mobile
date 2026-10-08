import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { registerForPushNotificationsAsync } from '../../services/notificationService';
import { Button } from 'react-native';
import { logout } from '../../services/authService';

import * as Notifications from 'expo-notifications';

export default function MainLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync(user.uid);
    }
  }, [user]);

  useEffect(() => {
    if (lastNotificationResponse) {
      const data = lastNotificationResponse.notification.request.content.data;
      if (data && data.conversationId) {
        router.push(`/(main)/chat?id=${data.conversationId}&type=${data.type}&name=${encodeURIComponent((data.name as string) || 'Chat')}`);
      }
    }
  }, [lastNotificationResponse, router]);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <Stack>
      <Stack.Screen 
        name="conversations" 
        options={{ 
          title: 'Conversas',
          headerRight: () => <Button title="Sair" onPress={handleLogout} />
        }} 
      />
      <Stack.Screen name="users" options={{ title: 'Contatos' }} />
      <Stack.Screen name="group-form" options={{ title: 'Novo Grupo' }} />
      <Stack.Screen name="chat" options={{ title: 'Chat' }} />
      <Stack.Screen name="profile" options={{ title: 'Perfil' }} />
    </Stack>
  );
}
