import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ScrollView, TextInput, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDoc, doc } from 'firebase/firestore';
import { firestore } from '../../services/firebase';
import { ChatGroup, NotificationPolicy } from '../../types/group';
import { ChatUser } from '../../types/user';
import { useAuth } from '../../hooks/useAuth';
import { updateGroupConfig, removeMember, leaveGroup, addMember } from '../../services/groupService';
import { getAllUsers } from '../../services/userService';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Loading } from '../../components/Loading';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageAsync } from '../../services/storageService';

export default function GroupDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  
  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [members, setMembers] = useState<ChatUser[]>([]);
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Edit states
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLimit, setEditLimit] = useState('');
  const [editPolicy, setEditPolicy] = useState<NotificationPolicy>('all_group_messages');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const snap = await getDoc(doc(firestore, 'groups', id));
        if (snap.exists()) {
          const g = { id: snap.id, ...snap.data() } as ChatGroup;
          setGroup(g);
          setEditName(g.name);
          setEditLimit(g.memberLimit.toString());
          setEditPolicy(g.notificationPolicy || 'all_group_messages');
          
          const users = await getAllUsers();
          setAllUsers(users);
          setMembers(users.filter(u => g.memberIds.includes(u.uid)));
        } else {
          setError('Grupo não encontrado');
        }
      } catch (e) {
        setError('Erro ao carregar.');
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  if (loading) return <Loading />;
  if (error || !group) return <View style={styles.container}><ErrorMessage message={error} /></View>;

  const isOwner = user?.uid === group.ownerId;
  const vagas = group.memberLimit - group.memberIds.length;

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      let photoUrl = group.photoUrl;
      if (photoUri) {
        photoUrl = await uploadImageAsync(photoUri, `groups/${Date.now()}`);
      }
      
      const newLimit = parseInt(editLimit, 10);
      if (newLimit < group.memberIds.length) {
        throw new Error('Limite menor que a quantidade atual de membros.');
      }

      await updateGroupConfig(group.id, {
        name: editName,
        photoUrl,
        memberLimit: newLimit,
        notificationPolicy: editPolicy
      });
      
      setGroup({ ...group, name: editName, photoUrl, memberLimit: newLimit, notificationPolicy: editPolicy });
      setEditing(false);
    } catch (err) {
      const e = err as Error;
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (vagas <= 0) return alert('Sem vagas');
    try {
      await addMember(group.id, userId);
      const m = allUsers.find(u => u.uid === userId);
      if (m) {
        setMembers([...members, m]);
        setGroup({ ...group, memberIds: [...group.memberIds, userId] });
      }
    } catch (err) {
      const e = err as Error;
      alert(e.message);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (group.memberIds.length <= 2) {
      return alert('O grupo deve ter no mínimo 2 membros.');
    }
    try {
      await removeMember(group.id, userId);
      setMembers(members.filter(m => m.uid !== userId));
      setGroup({ ...group, memberIds: group.memberIds.filter(id => id !== userId) });
    } catch (e) {
      alert('Erro ao remover');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {!editing ? (
        <>
          {group.photoUrl ? <Image source={{uri: group.photoUrl}} style={styles.image} /> : <View style={styles.image} />}
          <Text style={styles.title}>{group.name}</Text>
          <Text>Membros: {group.memberIds.length} / {group.memberLimit}</Text>
          <Text>Vagas: {vagas}</Text>
          <Text>Política de Notificação: {group.notificationPolicy}</Text>

          {isOwner && <Button title="Editar Configurações" onPress={() => setEditing(true)} />}
          
          <Text style={styles.sectionTitle}>Membros do Grupo</Text>
          {members.map(m => (
            <View key={m.uid} style={styles.userRow}>
              <Text>{m.name} {m.uid === group.ownerId ? '(Dono)' : ''}</Text>
              {isOwner && m.uid !== group.ownerId && (
                <Button title="Remover" color="red" onPress={() => handleRemoveMember(m.uid)} />
              )}
            </View>
          ))}

          {isOwner && vagas > 0 && (
            <>
              <Text style={styles.sectionTitle}>Adicionar Membros</Text>
              {allUsers.filter(u => !group.memberIds.includes(u.uid)).map(m => (
                <View key={m.uid} style={styles.userRow}>
                  <Text>{m.name}</Text>
                  <Button title="Adicionar" onPress={() => handleAddMember(m.uid)} />
                </View>
              ))}
            </>
          )}

          {!isOwner && (
            <Button title="Sair do Grupo" color="red" onPress={async () => {
              if(group.memberIds.length <= 2) return alert('Impossível sair, mínimo 2 membros.');
              try {
                await leaveGroup(group.id, user!.uid);
                router.replace('/(main)/conversations');
              } catch(err) {
                alert('Erro ao sair do grupo');
              }
            }} />
          )}
        </>
      ) : (
        <>
          <Button title="Escolher Nova Foto" onPress={pickImage} />
          {photoUri && <Image source={{uri: photoUri}} style={styles.image} />}
          <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Nome" />
          <TextInput style={styles.input} value={editLimit} onChangeText={setEditLimit} placeholder="Limite (ex: 10)" keyboardType="numeric" />
          
          <Text>Política:</Text>
          <Button title="Todas" onPress={() => setEditPolicy('all_group_messages')} color={editPolicy === 'all_group_messages' ? 'blue' : 'gray'} />
          <Button title="Menções" onPress={() => setEditPolicy('mentioned_members')} color={editPolicy === 'mentioned_members' ? 'blue' : 'gray'} />
          <Button title="Diretas" onPress={() => setEditPolicy('direct_messages_only')} color={editPolicy === 'direct_messages_only' ? 'blue' : 'gray'} />
          <Button title="Off" onPress={() => setEditPolicy('disabled')} color={editPolicy === 'disabled' ? 'blue' : 'gray'} />

          <Button title="Salvar" onPress={handleSave} />
          <Button title="Cancelar" color="red" onPress={() => setEditing(false)} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  image: { width: 100, height: 100, borderRadius: 50, alignSelf: 'center', marginBottom: 10, backgroundColor: '#ccc' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1, borderColor: '#eee', alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 15, borderRadius: 5 },
});
