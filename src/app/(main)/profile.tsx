import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getUserProfile } from '../../services/userService';
import { ChatUser } from '../../types/user';
import { Loading } from '../../components/Loading';
import { Avatar } from '../../components/Avatar';

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [profile, setProfile] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const loadProfile = async () => {
      try {
        const p = await getUserProfile(userId);
        setProfile(p);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [userId]);

  if (loading) return <Loading />;

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Perfil não encontrado ou sem permissão.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Avatar uri={profile.photoUrl} style={styles.avatar} />
      <Text style={styles.name}>{profile.name}</Text>
      <Text style={styles.info}>E-mail: {profile.email}</Text>
      <Text style={styles.info}>Celular: {profile.phoneNumber || 'Não informado'}</Text>
      <Text style={styles.info}>Nascimento: {profile.birthDate || 'Não informado'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  avatar: { width: 150, height: 150, borderRadius: 75, marginBottom: 20 },
  name: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  info: { fontSize: 16, marginBottom: 5, color: '#444' },
  errorText: { fontSize: 18, color: 'red' }
});
