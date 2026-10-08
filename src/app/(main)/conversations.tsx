import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Button } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { getUserGroups } from '../../services/groupService';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../services/firebase';
import { ChatGroup } from '../../types/group';
import { DirectConversation } from '../../types/chat';
import { getUserProfile } from '../../services/userService';
import { Loading } from '../../components/Loading';

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
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let unsubscribeDirects = () => {};
    let unsubscribeGroups = () => {};

    const loadData = () => {
      // Direct conversations
      const dRef = collection(firestore, 'directConversations');
      const qDirects = query(dRef, where('participantIds', 'array-contains', user.uid));
      unsubscribeDirects = onSnapshot(qDirects, async (snap) => {
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
        
        // Groups
        const gRef = collection(firestore, 'groups');
        const qGroups = query(gRef, where('memberIds', 'array-contains', user.uid));
        unsubscribeGroups = onSnapshot(qGroups, (gSnap) => {
          const groups: ConversationItem[] = gSnap.docs.map(doc => {
            const data = doc.data() as ChatGroup;
            return {
              id: doc.id,
              name: data.name,
              photoUrl: data.photoUrl,
              type: 'group'
            };
          });

          setItems([...directs, ...groups]);
          setLoading(false);
        });
      });
    };

    loadData();

    return () => {
      unsubscribeDirects();
      unsubscribeGroups();
    };
  }, [user]);

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
              <Image 
                source={{ uri: item.photoUrl || 'https://via.placeholder.com/50' }} 
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
