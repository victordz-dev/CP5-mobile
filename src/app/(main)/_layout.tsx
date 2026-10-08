import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { registerForPushNotificationsAsync } from '../../services/notificationService';
import { Button } from 'react-native';
import { logout } from '../../services/authService';

export default function MainLayout() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync(user.uid);
    }
  }, [user]);

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
