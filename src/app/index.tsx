import { Redirect } from 'expo-router';
import { Loading } from '../components/Loading';
import { useAuth } from '../hooks/useAuth';

export default function IndexScreen() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <Loading message="Recuperando sua sessao..." />;
  }

  if (user && profile) {
    return <Redirect href="/(main)/conversations" />;
  }

  return <Redirect href={user ? '/(auth)/register' : '/(auth)/login'} />;
}
