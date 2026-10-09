import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../services/firebase';
import { ChatGroup } from '../../types/group';
import { getUserProfile } from '../../services/userService';
import { logout } from '../../services/authService';
import { Loading } from '../../components/Loading';
import { Avatar } from '../../components/Avatar';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

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

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error', error);
    }
  };

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mensagens</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(main)/users')}>
            <Ionicons name="chatbubble-outline" size={24} color={theme.colors.primaryDark} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(main)/group-form')}>
            <Ionicons name="people-outline" size={24} color={theme.colors.primaryDark} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(main)/profile')}>
            <Ionicons name="person-circle-outline" size={26} color={theme.colors.primaryDark} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={26} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.border} />
          <Text style={styles.emptyTitle}>Nenhuma conversa</Text>
          <Text style={styles.emptySubtitle}>Comece um novo chat ou crie um grupo</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.item}
              activeOpacity={0.7}
              onPress={() => router.push(`/(main)/chat?id=${item.id}&type=${item.type}&name=${encodeURIComponent(item.name)}&photoUrl=${encodeURIComponent(item.photoUrl || '')}&otherUserId=${item.otherUserId || ''}`)}
            >
              <View style={styles.avatarContainer}>
                <Avatar uri={item.photoUrl} style={styles.avatar} />
                {item.type === 'group' && (
                  <View style={styles.groupBadge}>
                    <Ionicons name="people" size={10} color="#FFF" />
                  </View>
                )}
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.messagePreview}>Toque para abrir a conversa</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.border} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
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
  headerTitle: {
    ...theme.typography.title,
    fontSize: 28,
  },
  headerActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.round,
  },
  listContent: {
    padding: theme.spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xxl,
  },
  emptyTitle: {
    ...theme.typography.title,
    fontSize: 20,
    marginTop: theme.spacing.md,
  },
  emptySubtitle: {
    ...theme.typography.subtitle,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  item: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: theme.spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  groupBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.primaryDark,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.card,
  },
  itemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    ...theme.typography.body,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  messagePreview: {
    ...theme.typography.caption,
  },
});
