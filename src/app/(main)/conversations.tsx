import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { getUserProfile } from '../../services/userService';
import { logout } from '../../services/authService';
import { listenToDirectConversations } from '../../services/chatService';
import { listenToUserGroups } from '../../services/groupService';
import { Loading } from '../../components/Loading';
import { ErrorMessage } from '../../components/ErrorMessage';
import {
  ConversationListItem,
  ConversationListItemModel,
} from '../../components/ConversationListItem';
import { chatRoute, profileRoute } from '../../types/navigation';
import { theme } from '../../theme';

export default function ConversationsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [directItems, setDirectItems] = useState<ConversationListItemModel[]>([]);
  const [groupItems, setGroupItems] = useState<ConversationListItemModel[]>([]);
  const [loadingDirects, setLoadingDirects] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = useCallback(async () => {
    try {
      setLoggingOut(true);
      setError('');
      await logout();
    } catch {
      setError('Não foi possível sair da conta. Verifique sua conexão e tente novamente.');
      setLoggingOut(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const unsubscribeDirects = listenToDirectConversations(user.uid, async (conversations) => {
      try {
        const directs = await Promise.all(conversations.map(async (conversation) => {
          const otherUserId = conversation.participantIds.find(
            (participantId) => participantId !== user.uid,
          );
          if (!otherUserId) {
            throw new Error('Conversa individual sem outro participante.');
          }
          const profile = await getUserProfile(otherUserId);
          return {
            id: conversation.id,
            name: profile?.name || 'Usuário indisponível',
            photoUrl: profile?.photoUrl,
            type: 'direct' as const,
            otherUserId,
          };
        }));
        if (active) {
          setDirectItems(directs);
          setLoadingDirects(false);
        }
      } catch {
        if (active) {
          setError('Não foi possível carregar os participantes das conversas.');
          setLoadingDirects(false);
        }
      }
    }, () => {
      if (active) {
        setError('Não foi possível carregar as conversas diretas. Verifique sua conexão.');
        setLoadingDirects(false);
      }
    });

    const unsubscribeGroups = listenToUserGroups(user.uid, (groups) => {
      if (active) {
        setGroupItems(groups.map((group) => ({
          id: group.id,
          name: group.name,
          photoUrl: group.photoUrl,
          type: 'group',
        })));
        setLoadingGroups(false);
      }
    }, () => {
      if (active) {
        setError('Não foi possível carregar os grupos. Verifique sua conexão.');
        setLoadingGroups(false);
      }
    });

    return () => {
      active = false;
      unsubscribeDirects();
      unsubscribeGroups();
    };
  }, [user]);

  const items = useMemo(
    () => [...directItems, ...groupItems],
    [directItems, groupItems],
  );

  const openConversation = useCallback((item: ConversationListItemModel) => {
    router.push(chatRoute({
      id: item.id,
      type: item.type,
      name: item.name,
      photoUrl: item.photoUrl,
      otherUserId: item.otherUserId,
    }));
  }, [router]);

  if (loadingDirects || loadingGroups) {
    return <Loading message="Carregando conversas..." />;
  }
  if (loggingOut) {
    return <Loading message="Encerrando sessão..." />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mensagens</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity accessibilityLabel="Nova conversa" style={styles.actionButton} onPress={() => router.push('/(main)/users')}>
            <Ionicons name="chatbubble-outline" size={24} color={theme.colors.primaryDark} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Novo grupo" style={styles.actionButton} onPress={() => router.push('/(main)/group-form')}>
            <Ionicons name="people-outline" size={24} color={theme.colors.primaryDark} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Meu perfil" style={styles.actionButton} onPress={() => router.push(profileRoute())}>
            <Ionicons name="person-circle-outline" size={26} color={theme.colors.primaryDark} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Sair" style={styles.actionButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={26} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ErrorMessage message={error} />

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.border} />
          <Text style={styles.emptyTitle}>Nenhuma conversa</Text>
          <Text style={styles.emptySubtitle}>Comece um novo chat ou crie um grupo.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.type}:${item.id}`}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ConversationListItem item={item} onPress={openConversation} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: { ...theme.typography.title, fontSize: 28 },
  headerActions: { flexDirection: 'row', gap: theme.spacing.sm },
  actionButton: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.round,
  },
  listContent: { padding: theme.spacing.md },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xxl,
  },
  emptyTitle: { ...theme.typography.title, fontSize: 20, marginTop: theme.spacing.md },
  emptySubtitle: { ...theme.typography.subtitle, textAlign: 'center', marginTop: theme.spacing.sm },
});
