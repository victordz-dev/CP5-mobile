import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { listenToMessages, sendMessage } from '../../services/chatService';
import { ChatMessage } from '../../types/chat';
import { getUserProfile, getUserProfiles } from '../../services/userService';
import { getDoc, doc } from 'firebase/firestore';
import { firestore } from '../../services/firebase';
import { Avatar } from '../../components/Avatar';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

export default function ChatScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { id, type, name, photoUrl, otherUserId } = useLocalSearchParams<{ id: string, type: 'direct' | 'group', name: string, photoUrl: string, otherUserId?: string }>();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const flatListRef = useRef<FlatList>(null);

  // Mentions
  const [chatMembers, setChatMembers] = useState<{uid: string, name: string}[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentions, setMentions] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = listenToMessages(id, (msgs) => {
      setMessages(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (type !== 'group') return;
    const loadAuthors = async () => {
      setAuthorNames(prev => {
        const updateAuthors = async () => {
          let newNames = { ...prev };
          let changed = false;
          for (const msg of messages) {
            if (!newNames[msg.senderId]) {
              const profile = await getUserProfile(msg.senderId);
              if (profile) {
                newNames[msg.senderId] = profile.name;
                changed = true;
              }
            }
          }
          if (changed) setAuthorNames(newNames);
        };
        updateAuthors();
        return prev;
      });
    };
    loadAuthors();
  }, [messages, type]);

  useEffect(() => {
    if (type === 'group' && id) {
      const fetchMembers = async () => {
        const groupSnap = await getDoc(doc(firestore, 'groups', id));
        if (groupSnap.exists()) {
          const mIds = groupSnap.data().memberIds || [];
          if (mIds.length === 0) return;
          setChatMembers(await getUserProfiles(mIds));
        }
      };
      fetchMembers();
    }
  }, [type, id]);

  const handleTextChange = (val: string) => {
    setText(val);
    const lastWord = val.split(' ').pop();
    if (lastWord && lastWord.startsWith('@')) {
      setMentionQuery(lastWord.substring(1).toLowerCase());
    } else {
      setMentionQuery(null);
    }
  };

  const selectMention = (mUser: {uid: string, name: string}) => {
    const words = text.split(' ');
    words.pop();
    const newText = words.join(' ') + (words.length > 0 ? ' ' : '') + `@${mUser.name} `;
    setText(newText);
    if (!mentions.includes(mUser.uid)) {
      setMentions([...mentions, mUser.uid]);
    }
    setMentionQuery(null);
  };

  const handleSend = useCallback(async () => {
    if (!text.trim() || !user || !id) return;

    try {
      setSending(true);
      await sendMessage({
        conversationId: id,
        conversationType: type,
        senderId: user.uid,
        text: text.trim(),
        target: mentions.length > 0 ? { type: 'member', memberId: mentions[0] } : { type: 'conversation' },
        ...(mentions.length > 0 && { mentionedUserIds: mentions })
      });
      setText('');
      setMentions([]);
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error && err.message.includes('notificação')) {
        alert('Aviso: A mensagem foi gravada, mas houve uma falha no servidor ao enviar a notificação para os destinatários.');
      } else {
        alert('Falha ao enviar a mensagem. Verifique a conexão ou as permissões do banco de dados.');
      }
    } finally {
      setSending(false);
    }
  }, [text, user, id, type, mentions]);

  const goToProfileOrGroup = useCallback(() => {
    if (type === 'direct' && otherUserId) {
      router.push(`/(main)/profile?userId=${otherUserId}`);
    } else if (type === 'group') {
      router.push(`/(main)/group-details?id=${id}`);
    }
  }, [type, otherUserId, router, id]);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => a.createdAt - b.createdAt);
  }, [messages]);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen 
        options={{
          title: name || 'Chat',
          headerStyle: { backgroundColor: theme.colors.card },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity onPress={goToProfileOrGroup} activeOpacity={0.7} style={styles.headerRight}>
              <Avatar uri={photoUrl} style={styles.headerAvatar} />
              <Ionicons name="information-circle-outline" size={24} color={theme.colors.primaryDark} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          )
        }} 
      />
      <FlatList
        ref={flatListRef}
        data={sortedMessages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const isMine = item.senderId === user?.uid;
          const authorName = type === 'group' ? (isMine ? 'Você' : (authorNames[item.senderId] || '...')) : null;

          return (
            <View style={[styles.messageWrapper, isMine ? styles.wrapperMine : styles.wrapperTheirs]}>
              <View style={[styles.messageBubble, isMine ? styles.mine : styles.theirs]}>
                {authorName && <Text style={[styles.authorText, isMine && styles.authorTextMine]}>{authorName}</Text>}
                <Text style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextTheirs]}>{item.text}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.border} />
            <Text style={styles.emptyText}>Nenhuma mensagem. Comece a conversar!</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {mentionQuery !== null && chatMembers.length > 0 && (
        <ScrollView style={styles.mentionBox} keyboardShouldPersistTaps="always">
          {chatMembers.filter(m => m.name.toLowerCase().includes(mentionQuery) && m.uid !== user?.uid).map(m => (
            <TouchableOpacity key={m.uid} style={styles.mentionItem} onPress={() => selectMention(m)}>
              <Text style={styles.mentionText}>{m.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleTextChange}
          placeholder="Digite uma mensagem..."
          placeholderTextColor={theme.colors.textSecondary}
          editable={!sending}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]} 
          onPress={handleSend} 
          disabled={!text.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="send" size={20} color={text.trim() ? "#FFF" : theme.colors.textSecondary} style={{ marginLeft: 2 }} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  listContent: {
    padding: theme.spacing.md,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageWrapper: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  wrapperMine: {
    justifyContent: 'flex-end',
  },
  wrapperTheirs: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: '80%',
    ...theme.shadows.sm,
  },
  mine: {
    backgroundColor: theme.colors.primaryDark,
    borderBottomRightRadius: 4,
  },
  theirs: {
    backgroundColor: theme.colors.card,
    borderBottomLeftRadius: 4,
  },
  authorText: {
    ...theme.typography.caption,
    fontWeight: 'bold',
    color: theme.colors.primaryDark,
    marginBottom: 4,
  },
  authorTextMine: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageText: {
    ...theme.typography.body,
    lineHeight: 22,
  },
  messageTextMine: {
    color: '#FFFFFF',
  },
  messageTextTheirs: {
    color: theme.colors.text,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: theme.spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? theme.spacing.xl : theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 24,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 12,
    paddingBottom: 12,
    marginRight: theme.spacing.sm,
    minHeight: 48,
    maxHeight: 120,
    fontSize: 16,
    color: theme.colors.text,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.inputBackground,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  mentionBox: {
    maxHeight: 150,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.md,
  },
  mentionItem: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  mentionText: {
    ...theme.typography.body,
    fontWeight: '500',
    color: theme.colors.primaryDark,
  }
});
