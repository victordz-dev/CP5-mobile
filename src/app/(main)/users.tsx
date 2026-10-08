import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { getAllUsers } from '../../services/userService';
import { ChatUser } from '../../types/user';
import { Loading } from '../../components/Loading';
import { generateDirectConversationId, syncChatMembers } from '../../services/chatService';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { firestore } from '../../services/firebase';

export default function UsersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadUsers = async () => {
      const allUsers = await getAllUsers();
      // Exclude current user
      setUsers(allUsers.filter(u => u.uid !== user?.uid));
      setLoading(false);
    };
    loadUsers();
  }, [user]);

  const startChat = async (otherUser: ChatUser) => {
    if (!user) return;
    const conversationId = generateDirectConversationId(user.uid, otherUser.uid);
    
    // Ensure direct conversation exists in Firestore
    const convRef = doc(firestore, 'directConversations', conversationId);
    const snap = await getDoc(convRef);
    if (!snap.exists()) {
      const now = new Date().getTime();
      await setDoc(convRef, {
        participantIds: [user.uid, otherUser.uid],
        createdAt: now
      });
      await syncChatMembers(conversationId, 'direct');
    }

    router.replace(`/(main)/chat?id=${conversationId}&type=direct&name=${encodeURIComponent(otherUser.name)}&photoUrl=${encodeURIComponent(otherUser.photoUrl)}&otherUserId=${otherUser.uid}`);
  };

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar usuários..."
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filteredUsers}
        keyExtractor={item => item.uid}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => startChat(item)}>
            <Image source={{ uri: item.photoUrl || 'https://via.placeholder.com/50' }} style={styles.avatar} />
            <Text style={styles.name}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchInput: { margin: 15, padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
  item: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderColor: '#eee', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  name: { fontSize: 16 }
});
