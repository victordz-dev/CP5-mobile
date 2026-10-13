import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { useAuth } from '../hooks/useAuth';
import { Loading } from '../components/Loading';

const InitialLayout = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <Loading message="Recuperando sua sessao..." />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!user || !profile}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(user && profile)}>
        <Stack.Screen name="(main)" />
      </Stack.Protected>
    </Stack>
  );
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <InitialLayout />
    </AuthProvider>
  );
}
