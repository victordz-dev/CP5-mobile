import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { getDirectConversationById, listenToMessages, MessagePersistedPushError, sendMessage } from '../../services/chatService';
import { listenToGroup } from '../../services/groupService';
import { getUserProfile, getUserProfiles } from '../../services/userService';
import { ChatMessage } from '../../types/chat';
import { ChatRouteParams, groupDetailsRoute, profileRoute } from '../../types/navigation';
import { ChatUser } from '../../types/user';
import { Avatar } from '../../components/Avatar';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Loading } from '../../components/Loading';
import { MessageBubble } from '../../components/MessageBubble';
import { MessageComposer } from '../../components/MessageComposer';
import { theme } from '../../theme';

type ConversationAccess = 'checking' | 'available' | 'unavailable';
const EMPTY_CHAT_MEMBERS: ChatUser[] = [];

type ConversationMetadata = {
  conversationId: string;
  name: string;
  photoUrl?: string;
  otherUserId?: string;
  access: ConversationAccess;
};

export default function ChatScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { id, type } = useLocalSearchParams<ChatRouteParams>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadedConversationId, setLoadedConversationId] = useState<string | null>(null);
  const [screenError, setScreenError] = useState('');
  const [metadata, setMetadata] = useState<ConversationMetadata>({
    conversationId: '',
    name: 'Chat',
    access: 'checking',
  });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [memberState, setMemberState] = useState<{ conversationId: string; members: ChatUser[] }>({
    conversationId: '',
    members: [],
  });
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentions, setMentions] = useState<string[]>([]);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const validConversation = Boolean(id && (type === 'direct' || type === 'group'));
  const metadataIsCurrent = metadata.conversationId === id;
  const conversationName = metadataIsCurrent ? metadata.name : 'Chat';
  const conversationPhotoUrl = metadataIsCurrent ? metadata.photoUrl : undefined;
  const resolvedOtherUserId = metadataIsCurrent ? metadata.otherUserId : undefined;
  const accessStatus: ConversationAccess = metadataIsCurrent ? metadata.access : 'checking';
  const chatMembers = memberState.conversationId === id ? memberState.members : EMPTY_CHAT_MEMBERS;

  useEffect(() => {
    if (!validConversation) return;

    const unsubscribe = listenToMessages(id, (nextMessages) => {
      setMessages(nextMessages);
      setLoadedConversationId(id);
      requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: true }));
    }, (listenerError) => {
      setScreenError(listenerError.message);
      setLoadedConversationId(id);
    });
    return unsubscribe;
  }, [id, validConversation]);

  useEffect(() => {
    if (!id || !user || (type !== 'direct' && type !== 'group')) return;

    let active = true;
    let memberRequest = 0;

    const markUnavailable = (message: string) => {
      if (!active) return;
      setMetadata({ conversationId: id, name: 'Chat', access: 'unavailable' });
      setMemberState({ conversationId: id, members: [] });
      setScreenError(message);
    };

    if (type === 'direct') {
      void (async () => {
        try {
          const conversation = await getDirectConversationById(id);
          const nextOtherUserId = conversation?.participantIds.find(
            (participantId) => participantId !== user.uid,
          );
          if (!conversation || !conversation.participantIds.includes(user.uid) || !nextOtherUserId) {
            markUnavailable('Esta conversa não está disponível para a sua conta.');
            return;
          }

          const profile = await getUserProfile(nextOtherUserId);
          if (!profile) {
            markUnavailable('Não foi possível carregar o perfil do outro participante.');
            return;
          }

          if (active) {
            setMetadata({
              conversationId: id,
              name: profile.name,
              photoUrl: profile.photoUrl,
              otherUserId: profile.uid,
              access: 'available',
            });
            setScreenError('');
          }
        } catch {
          markUnavailable('Não foi possível validar esta conversa. Volte à lista e tente novamente.');
        }
      })();

      return () => {
        active = false;
      };
    }

    const unsubscribe = listenToGroup(id, (group) => {
      if (!active) return;
      if (!group || !group.memberIds.includes(user.uid)) {
        markUnavailable('Você não participa mais deste grupo.');
        return;
      }

      setMetadata({
        conversationId: id,
        name: group.name,
        photoUrl: group.photoUrl,
        access: 'available',
      });
      setScreenError('');

      const requestId = ++memberRequest;
      void getUserProfiles(group.memberIds).then((profiles) => {
        if (active && requestId === memberRequest) {
          setMemberState({ conversationId: id, members: profiles });
        }
      }).catch(() => {
        if (active && requestId === memberRequest) {
          setMemberState({ conversationId: id, members: [] });
          setScreenError('O chat está disponível, mas não foi possível carregar os nomes dos integrantes.');
        }
      });
    }, () => {
      markUnavailable('Seu acesso a este grupo não está mais disponível.');
    });

    return () => {
      active = false;
      memberRequest += 1;
      unsubscribe();
    };
  }, [id, type, user]);

  const authorNames = useMemo(
    () => Object.fromEntries(chatMembers.map((member) => [member.uid, member.name])),
    [chatMembers],
  );

  const sortedMessages = useMemo(
    () => [...messages].sort((left, right) => left.createdAt - right.createdAt),
    [messages],
  );

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null || type !== 'group' || accessStatus !== 'available') return [];
    return chatMembers.filter((member) => (
      member.uid !== user?.uid
      && member.name.toLocaleLowerCase('pt-BR').includes(mentionQuery)
    ));
  }, [accessStatus, chatMembers, mentionQuery, type, user?.uid]);

  const handleTextChange = useCallback((value: string) => {
    setText(value);
    const lastWord = value.split(/\s/).at(-1);
    setMentionQuery(lastWord?.startsWith('@')
      ? lastWord.slice(1).toLocaleLowerCase('pt-BR')
      : null);
  }, []);

  const selectMention = useCallback((member: ChatUser) => {
    setText((currentText) => {
      const words = currentText.split(/\s/);
      words.pop();
      return `${words.join(' ')}${words.length > 0 ? ' ' : ''}@${member.name} `;
    });
    setMentions((current) => current.includes(member.uid) ? current : [...current, member.uid]);
    setMentionQuery(null);
  }, []);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !user || !id || !validConversation || accessStatus !== 'available') return;
    try {
      setSending(true);
      setScreenError('');
      await sendMessage({
        conversationId: id,
        conversationType: type,
        text: text.trim(),
        target: mentions.length > 0
          ? { type: 'member', memberId: mentions[0] }
          : { type: 'conversation' },
        mentionedUserIds: mentions,
      });
      setText('');
      setMentions([]);
      setMentionQuery(null);
    } catch (error: unknown) {
      if (error instanceof MessagePersistedPushError) {
        setText('');
        setMentions([]);
        setMentionQuery(null);
        Alert.alert('Mensagem enviada', 'A mensagem foi salva, mas a notificação não pôde ser acionada.');
      } else {
        setScreenError('Falha ao enviar a mensagem. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setSending(false);
    }
  }, [accessStatus, id, mentions, text, type, user, validConversation]);

  const goToProfileOrGroup = useCallback(() => {
    if (type === 'direct' && resolvedOtherUserId) {
      router.push(profileRoute({ userId: resolvedOtherUserId }));
    } else if (type === 'group' && id) {
      router.push(groupDetailsRoute({ id }));
    }
  }, [id, resolvedOtherUserId, router, type]);

  const returnToConversations = useCallback(() => {
    router.replace('/(main)/conversations');
  }, [router]);

  if (!validConversation) {
    return <View style={styles.errorScreen}><ErrorMessage message="Conversa inválida. Volte para a lista e tente novamente." /></View>;
  }
  if (loadedConversationId !== id) {
    return <Loading message="Carregando mensagens..." />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: conversationName,
          headerRight: () => (
            <TouchableOpacity
              accessibilityLabel="Abrir detalhes"
              disabled={accessStatus !== 'available'}
              onPress={goToProfileOrGroup}
              style={styles.headerRight}
            >
              <Avatar uri={conversationPhotoUrl} style={styles.headerAvatar} />
              <Ionicons name="information-circle-outline" size={24} color={theme.colors.primaryDark} style={styles.infoIcon} />
            </TouchableOpacity>
          ),
        }}
      />

      <ErrorMessage message={screenError} />

      {accessStatus === 'checking' && (
        <View style={styles.accessNotice}>
          <Text style={styles.accessNoticeText}>Validando participantes da conversa...</Text>
        </View>
      )}

      {accessStatus === 'unavailable' && (
        <View style={styles.accessBlocked}>
          <Text style={styles.accessBlockedText}>O envio foi bloqueado para proteger esta conversa.</Text>
          <TouchableOpacity accessibilityRole="button" onPress={returnToConversations} style={styles.backButton}>
            <Text style={styles.backButtonText}>Voltar às conversas</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={sortedMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isMine={item.senderId === user?.uid}
            authorName={type === 'group'
              ? (item.senderId === user?.uid ? 'Você' : authorNames[item.senderId] || 'Participante')
              : undefined}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.border} />
            <Text style={styles.emptyText}>Nenhuma mensagem. Comece a conversar!</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {mentionQuery !== null && (
        <ScrollView style={styles.mentionBox} keyboardShouldPersistTaps="always">
          {mentionSuggestions.length === 0 ? (
            <Text style={styles.noMention}>Nenhum integrante encontrado.</Text>
          ) : mentionSuggestions.map((member) => (
            <TouchableOpacity key={member.uid} style={styles.mentionItem} onPress={() => selectMention(member)}>
              <Text style={styles.mentionText}>{member.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <MessageComposer
        value={text}
        sending={sending}
        disabled={accessStatus !== 'available'}
        onChangeText={handleTextChange}
        onSend={handleSend}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  errorScreen: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  infoIcon: { marginLeft: theme.spacing.sm },
  listContent: { flexGrow: 1, justifyContent: 'flex-end', padding: theme.spacing.md },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: theme.spacing.xxl },
  emptyText: { ...theme.typography.body, color: theme.colors.textSecondary, marginTop: theme.spacing.md },
  mentionBox: {
    maxHeight: 150,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.md,
  },
  mentionItem: { padding: theme.spacing.md, borderBottomWidth: 1, borderColor: theme.colors.border },
  mentionText: { ...theme.typography.body, color: theme.colors.primaryDark, fontWeight: '500' },
  noMention: { ...theme.typography.caption, padding: theme.spacing.md, textAlign: 'center' },
  accessNotice: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.inputBackground,
  },
  accessNoticeText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  accessBlocked: {
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: '#FFF7ED',
    borderBottomWidth: 1,
    borderBottomColor: '#FED7AA',
  },
  accessBlockedText: { ...theme.typography.body, color: '#9A3412', textAlign: 'center' },
  backButton: { marginTop: theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  backButtonText: { color: theme.colors.primaryDark, fontWeight: 'bold' },
});
