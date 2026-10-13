import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { getAllUsers } from '../../services/userService';
import { createDirectConversation } from '../../services/chatService';
import { ChatUser } from '../../types/user';
import { chatRoute } from '../../types/navigation';
import { Loading } from '../../components/Loading';
import { ErrorMessage } from '../../components/ErrorMessage';
import { UserListItem } from '../../components/UserListItem';
import { theme } from '../../theme';

export default function UsersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingUserId, setStartingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const loadUsers = async () => {
      try {
        setLoading(true);
        setError('');
        const allUsers = await getAllUsers();
        if (active) {
          setUsers(allUsers.filter((candidate) => candidate.uid !== user?.uid));
        }
      } catch {
        if (active) setError('Erro ao carregar usuários. Verifique sua conexão.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadUsers();
    return () => {
      active = false;
    };
  }, [reloadKey, user?.uid]);

  const startChat = useCallback(async (otherUser: ChatUser) => {
    if (!user || otherUser.uid === user.uid) return;
    try {
      setStartingUserId(otherUser.uid);
      setError('');
      const conversationId = await createDirectConversation(otherUser.uid);
      router.replace(chatRoute({
        id: conversationId,
        type: 'direct',
        name: otherUser.name,
        photoUrl: otherUser.photoUrl,
        otherUserId: otherUser.uid,
      }));
    } catch {
      setError('Erro ao iniciar a conversa. Verifique sua conexão.');
    } finally {
      setStartingUserId(null);
    }
  }, [router, user]);

  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  const filteredUsers = useMemo(() => users.filter((candidate) => (
    candidate.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
    || candidate.email.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
  )), [normalizedSearch, users]);

  if (loading) return <Loading message="Carregando usuários..." />;

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome ou e-mail..."
          placeholderTextColor={theme.colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      <ErrorMessage message={error} onRetry={() => setReloadKey((value) => value + 1)} />

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.listContainer}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={theme.colors.border} />
            <Text style={styles.emptyText}>
              {search.trim() ? 'Nenhum usuário corresponde à busca.' : 'Nenhum outro usuário disponível.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <UserListItem
            user={item}
            subtitle={item.email || 'E-mail não informado'}
            onPress={startChat}
            action={startingUserId === item.uid
              ? <LoadingIndicator />
              : <Ionicons name="chatbubble-ellipses-outline" size={24} color={theme.colors.primaryLight} />}
          />
        )}
      />
    </View>
  );
}

function LoadingIndicator() {
  return <Ionicons name="hourglass-outline" size={24} color={theme.colors.primaryDark} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.inputBackground,
  },
  searchIcon: { marginRight: theme.spacing.sm },
  searchInput: { flex: 1, paddingVertical: theme.spacing.md, fontSize: 16, color: theme.colors.text },
  listContainer: { flexGrow: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.xxl },
  emptyText: { ...theme.typography.subtitle, marginTop: theme.spacing.md, textAlign: 'center' },
});
