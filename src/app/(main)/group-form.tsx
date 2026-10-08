import { useState, useEffect } from 'react';
import { View, TextInput, Button, StyleSheet, Text, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { createGroup } from '../../services/groupService';
import { uploadImageAsync } from '../../services/storageService';
import { getAllUsers } from '../../services/userService';
import { ChatUser } from '../../types/user';
import { ErrorMessage } from '../../components/ErrorMessage';
import * as ImagePicker from 'expo-image-picker';
import { NotificationPolicy } from '../../types/group';

export default function GroupFormScreen() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [memberLimit, setMemberLimit] = useState('10');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [policy, setPolicy] = useState<NotificationPolicy>('all_group_messages');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getAllUsers().then(u => setUsers(u.filter(ui => ui.uid !== user?.uid)));
  }, [user]);

  const toggleUser = (id: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUserIds(newSet);
  };

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

  const handleCreate = async () => {
    const limitNum = parseInt(memberLimit, 10);
    if (!name || !memberLimit || !user) {
      setError('Preencha os campos obrigatórios.');
      return;
    }
    if (selectedUserIds.size < 1) {
      setError('Selecione pelo menos 1 membro adicional (total 2 com você).');
      return;
    }
    if (selectedUserIds.size + 1 > limitNum) {
      setError('O número de membros selecionados excede o limite do grupo.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      let photoUrl = '';
      if (photoUri) {
        photoUrl = await uploadImageAsync(photoUri, `groups/${Date.now()}`);
      }

      const finalMemberIds = [user.uid, ...Array.from(selectedUserIds)];
      
      const groupId = await createGroup({
        name,
        photoUrl,
        ownerId: user.uid,
        memberIds: finalMemberIds,
        memberLimit: limitNum,
        notificationPolicy: policy,
      });

      router.replace(`/(main)/chat?id=${groupId}&type=group&name=${encodeURIComponent(name)}&photoUrl=${encodeURIComponent(photoUrl)}`);
    } catch (err) {
      const e = err as Error;
      setError(e.message || 'Erro ao criar grupo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Button title="Escolher Foto do Grupo" onPress={pickImage} />
      {photoUri && <Image source={{ uri: photoUri }} style={styles.image} />}

      <TextInput
        style={styles.input}
        placeholder="Nome do Grupo"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Limite de Integrantes (min: 2)"
        value={memberLimit}
        onChangeText={setMemberLimit}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Política de Notificações:</Text>
      <View style={styles.policyContainer}>
        <Button title="Todas" onPress={() => setPolicy('all_group_messages')} color={policy === 'all_group_messages' ? 'blue' : 'gray'} />
        <Button title="Menções" onPress={() => setPolicy('mentioned_members')} color={policy === 'mentioned_members' ? 'blue' : 'gray'} />
        <Button title="Diretas" onPress={() => setPolicy('direct_messages_only')} color={policy === 'direct_messages_only' ? 'blue' : 'gray'} />
        <Button title="Off" onPress={() => setPolicy('disabled')} color={policy === 'disabled' ? 'blue' : 'gray'} />
      </View>

      <Text style={styles.label}>Selecionar Membros:</Text>
      {users.map(u => (
        <TouchableOpacity key={u.uid} onPress={() => toggleUser(u.uid)} style={styles.userRow}>
          <Text style={{ fontWeight: selectedUserIds.has(u.uid) ? 'bold' : 'normal' }}>
            {selectedUserIds.has(u.uid) ? '✓ ' : '  '} {u.name}
          </Text>
        </TouchableOpacity>
      ))}

      <ErrorMessage message={error} />
      <Button title={loading ? "Criando..." : "Criar Grupo"} onPress={handleCreate} disabled={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 15, borderRadius: 5 },
  label: { fontSize: 16, marginBottom: 5, marginTop: 10 },
  policyContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap' },
  image: { width: 100, height: 100, borderRadius: 50, alignSelf: 'center', marginVertical: 10 },
  userRow: { padding: 10, borderBottomWidth: 1, borderColor: '#eee' },
});
