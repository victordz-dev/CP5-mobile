import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDoc, doc } from 'firebase/firestore';
import { firestore } from '../../services/firebase';
import { ChatGroup } from '../../types/group';
import { useAuth } from '../../hooks/useAuth';
import { updateGroupConfig } from '../../services/groupService';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Loading } from '../../components/Loading';

export default function GroupDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  
  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetchGroup = async () => {
      const snap = await getDoc(doc(firestore, 'groups', id));
      if (snap.exists()) {
        setGroup({ id: snap.id, ...snap.data() } as ChatGroup);
      } else {
        setError('Grupo não encontrado');
      }
      setLoading(false);
    };
    fetchGroup();
  }, [id]);

  if (loading) return <Loading />;
  if (error || !group) return <View style={styles.container}><ErrorMessage message={error} /></View>;

  const isOwner = user?.uid === group.ownerId;
  const vagas = group.memberLimit - group.memberIds.length;

  const handleUpdateLimit = async () => {
    if (!isOwner) return;
    const newLimit = group.memberLimit + 1;
    try {
      await updateGroupConfig(group.id, { memberLimit: newLimit });
      setGroup({ ...group, memberLimit: newLimit });
    } catch (e) {
      alert('Erro ao atualizar');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{group.name}</Text>
      <Text>Membros Atuais: {group.memberIds.length}</Text>
      <Text>Limite: {group.memberLimit}</Text>
      <Text>Vagas Disponíveis: {vagas}</Text>
      <Text>Política: {group.notificationPolicy}</Text>
      
      {isOwner && (
        <View style={styles.ownerActions}>
          <Text style={styles.ownerTitle}>Ações de Dono</Text>
          <Button title="Aumentar Limite" onPress={handleUpdateLimit} />
          {/* Members management could be added here similarly */}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  ownerActions: { marginTop: 30, padding: 10, borderWidth: 1, borderColor: '#ccc' },
  ownerTitle: { fontWeight: 'bold', marginBottom: 10 }
});
