import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Button } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../services/firebase';
import { ChatGroup } from '../../types/group';
import { getUserProfile } from '../../services/userService';
import { Loading } from '../../components/Loading';
import { Avatar } from '../../components/Avatar';

type ConversationItem = {
  id: string;
  name: string;
  photoUrl?: string;
  type: 'direct' | 'group';
  otherUserId?: string;
};

export default function ConversationsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [directItems, setDirectItems] = useState<ConversationItem[]>([]);
  const [groupItems, setGroupItems] = useState<ConversationItem[]>([]);
  const [loadingDirects, setLoadingDirects] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Direct conversations
    const dRef = collection(firestore, 'directConversations');
    const qDirects = query(dRef, where('participantIds', 'array-contains', user.uid));
    const unsubscribeDirects = onSnapshot(qDirects, async (snap) => {
      const directs: ConversationItem[] = [];
      for (const doc of snap.docs) {
        const data = doc.data();
        const otherId = data.participantIds.find((id: string) => id !== user.uid);
        if (otherId) {
          const profile = await getUserProfile(otherId);
          directs.push({
            id: doc.id,
            name: profile?.name || 'Usuário',
            photoUrl: profile?.photoUrl,
            type: 'direct',
            otherUserId: otherId
          });
        }
      }
      setDirectItems(directs);
      setLoadingDirects(false);
    }, () => {
      alert('Não foi possível carregar as conversas diretas. Verifique sua conexão.');
      setLoadingDirects(false);
    });

    // Groups
    const gRef = collection(firestore, 'groups');
    const qGroups = query(gRef, where('memberIds', 'array-contains', user.uid));
    const unsubscribeGroups = onSnapshot(qGroups, (gSnap) => {
      const groups: ConversationItem[] = gSnap.docs.map(doc => {
        const data = doc.data() as ChatGroup;
        return {
          id: doc.id,
          name: data.name,
          photoUrl: data.photoUrl,
          type: 'group'
        };
      });
      setGroupItems(groups);
      setLoadingGroups(false);
    }, () => {
      alert('Não foi possível carregar os grupos. Verifique sua conexão.');
      setLoadingGroups(false);
    });

    return () => {
      unsubscribeDirects();
      unsubscribeGroups();
    };
  }, [user]);

  const items = [...directItems, ...groupItems];
  const loading = loadingDirects || loadingGroups;

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Button title="Nova Conversa" onPress={() => router.push('/(main)/users')} />
        <Button title="Novo Grupo" onPress={() => router.push('/(main)/group-form')} />
      </View>

      {items.length === 0 ? (
        <Text style={styles.empty}>Nenhuma conversa encontrada.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.item}
              onPress={() => router.push(`/(main)/chat?id=${item.id}&type=${item.type}&name=${encodeURIComponent(item.name)}&photoUrl=${encodeURIComponent(item.photoUrl || '')}&otherUserId=${item.otherUserId || ''}`)}
            >
              <Avatar 
                uri={item.photoUrl} 
                style={styles.avatar} 
              />
              <View>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.type}>{item.type === 'group' ? 'Grupo' : 'Privado'}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  actions: { flexDirection: 'row', justifyContent: 'space-around', padding: 10, borderBottomWidth: 1, borderColor: '#eee' },
  empty: { textAlign: 'center', marginTop: 50, color: '#999' },
  item: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderColor: '#eee', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  name: { fontSize: 16, fontWeight: 'bold' },
  type: { fontSize: 12, color: '#666' }
});
