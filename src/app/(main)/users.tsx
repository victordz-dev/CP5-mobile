import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { getAllUsers } from '../../services/userService';
import { ChatUser } from '../../types/user';
import { Loading } from '../../components/Loading';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Avatar } from '../../components/Avatar';
import { generateDirectConversationId, syncChatMembers } from '../../services/chatService';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { firestore } from '../../services/firebase';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

export default function UsersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);
  const [search, setSearch] = useState('');

  const [error, setError] = useState('');

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const allUsers = await getAllUsers();
        // Exclude current user
        setUsers(allUsers.filter(u => u.uid !== user?.uid));
      } catch {
        setError('Erro ao carregar usuários. Verifique sua conexão.');
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, [user]);

  const startChat = async (otherUser: ChatUser) => {
    if (!user) return;
    try {
      setStartingChat(true);
      const conversationId = generateDirectConversationId(user.uid, otherUser.uid);
      
      // Ensure direct conversation exists in Firestore
      const convRef = doc(firestore, 'directConversations', conversationId);
      const snap = await getDoc(convRef);
      if (!snap.exists()) {
        const now = new Date().getTime();
        await setDoc(convRef, {
          participantIds: [user.uid, otherUser.uid].sort(),
          createdAt: now
        });
        await syncChatMembers(conversationId, 'direct');
      }

      router.replace(`/(main)/chat?id=${conversationId}&type=direct&name=${encodeURIComponent(otherUser.name)}&photoUrl=${encodeURIComponent(otherUser.photoUrl)}&otherUserId=${otherUser.uid}`);
    } catch (err) {
      console.error(err);
      setError('Erro ao iniciar a conversa. Verifique sua conexão.');
    } finally {
      setStartingChat(false);
    }
  };

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

  if (loading || startingChat) return <Loading />;
  if (error) return <View style={styles.container}><ErrorMessage message={error} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar contatos..."
          placeholderTextColor={theme.colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={filteredUsers}
        keyExtractor={item => item.uid}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={theme.colors.border} />
            <Text style={styles.emptyText}>Nenhum usuário encontrado.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => startChat(item)} activeOpacity={0.7}>
            <Avatar uri={item.photoUrl} style={styles.avatar} />
            <View style={styles.itemContent}>
              <Text style={styles.name}>{item.name}</Text>
              {item.phoneNumber && <Text style={styles.phone}>{item.phoneNumber}</Text>}
            </View>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={theme.colors.primaryLight} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    margin: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text,
  },
  listContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: theme.spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  name: {
    ...theme.typography.body,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  phone: {
    ...theme.typography.caption,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: theme.spacing.xxl,
  },
  emptyText: {
    ...theme.typography.subtitle,
    marginTop: theme.spacing.md,
  },
});
