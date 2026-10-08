import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, Image, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { listenToMessages, sendMessage } from '../../services/chatService';
import { ChatMessage } from '../../types/chat';
import { getUserProfile } from '../../services/userService';
import { getDoc, doc, documentId } from 'firebase/firestore';
import { firestore, auth } from '../../services/firebase';
import Constants from 'expo-constants';

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
          const apiUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
          const token = await auth.currentUser?.getIdToken();
          const usersRes = await fetch(`${apiUrl}/sync-members/users/profiles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ userIds: mIds })
          });
          if (usersRes.ok) {
            const loadedMembers = await usersRes.json();
            setChatMembers(loadedMembers);
          }
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
        target: { type: 'conversation' },
        mentionedUserIds: mentions
      });
      setText('');
      setMentions([]);
    } catch (err) {
      const e = err as Error;
      console.error(e);
      alert('Falha ao enviar mensagem');
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
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: name || 'Chat',
          headerRight: () => (
            <TouchableOpacity onPress={goToProfileOrGroup}>
              <Image source={{ uri: photoUrl || 'https://via.placeholder.com/40' }} style={styles.headerAvatar} />
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
          const authorName = type === 'group' && !isMine ? (authorNames[item.senderId] || '...') : null;

          return (
            <View style={[styles.messageBubble, isMine ? styles.mine : styles.theirs]}>
              {authorName && <Text style={styles.authorText}>{authorName}</Text>}
              <Text style={styles.messageText}>{item.text}</Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma mensagem. Comece a conversar!</Text>}
        contentContainerStyle={{ padding: 10, flexGrow: 1, justifyContent: 'flex-end' }}
      />

      {mentionQuery !== null && chatMembers.length > 0 && (
        <ScrollView style={styles.mentionBox} keyboardShouldPersistTaps="always">
          {chatMembers.filter(m => m.name.toLowerCase().includes(mentionQuery) && m.uid !== user?.uid).map(m => (
            <TouchableOpacity key={m.uid} style={styles.mentionItem} onPress={() => selectMention(m)}>
              <Text>{m.name}</Text>
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
          editable={!sending}
        />
        {sending ? <ActivityIndicator size="small" /> : <Button title="Enviar" onPress={handleSend} disabled={!text.trim()} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  headerAvatar: { width: 35, height: 35, borderRadius: 17.5, marginRight: 10 },
  messageBubble: { padding: 10, borderRadius: 10, marginVertical: 5, maxWidth: '80%' },
  mine: { backgroundColor: '#dcf8c6', alignSelf: 'flex-end' },
  theirs: { backgroundColor: '#fff', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#eee' },
  authorText: { fontSize: 12, color: '#075e54', fontWeight: 'bold', marginBottom: 2 },
  messageText: { fontSize: 16 },
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee', alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingHorizontal: 15, marginRight: 10, minHeight: 40 },
  empty: { textAlign: 'center', color: '#999', marginTop: 20 },
  mentionBox: { maxHeight: 150, backgroundColor: '#f9f9f9', borderTopWidth: 1, borderColor: '#eee' },
  mentionItem: { padding: 10, borderBottomWidth: 1, borderColor: '#ddd' }
});
