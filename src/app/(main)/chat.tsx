import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { listenToMessages, sendMessage } from '../../services/chatService';
import { ChatMessage } from '../../types/chat';
import { getUserProfile } from '../../services/userService';

export default function ChatScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { id, type, name, photoUrl, otherUserId } = useLocalSearchParams<{ id: string, type: 'direct' | 'group', name: string, photoUrl: string, otherUserId?: string }>();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const flatListRef = useRef<FlatList>(null);

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
      const newNames: Record<string, string> = { ...authorNames };
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
    loadAuthors();
  }, [messages, type]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !user || !id) return;
    
    // Simple logic for mentioned users
    const mentionedUserIds: string[] = [];
    // Could parse text for @... in a real app, but for now we leave it empty unless a UI for mention is added

    try {
      setSending(true);
      await sendMessage({
        conversationId: id,
        conversationType: type,
        senderId: user.uid,
        text: text.trim(),
        target: { type: 'conversation' },
        mentionedUserIds
      });
      setText('');
    } catch (err) {
      const e = err as Error;
      console.error(e);
      alert('Falha ao enviar mensagem');
    } finally {
      setSending(false);
    }
  }, [text, user, id, type]);

  const goToProfileOrGroup = useCallback(() => {
    if (type === 'direct' && otherUserId) {
      router.push(`/(main)/profile?userId=${otherUserId}`);
    } else if (type === 'group') {
      router.push(`/(main)/group-details?id=${id}`);
    }
  }, [type, otherUserId, router]);

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
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
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
  empty: { textAlign: 'center', color: '#999', marginTop: 20 }
});
