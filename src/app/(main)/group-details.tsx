import { type ComponentProps, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../hooks/useAuth';
import { addMember, leaveGroup, listenToGroup, removeMember, updateGroupConfig } from '../../services/groupService';
import { getAllUsers } from '../../services/userService';
import { uploadImageAsync } from '../../services/storageService';
import { ChatGroup, NotificationPolicy } from '../../types/group';
import { ChatUser } from '../../types/user';
import { GroupDetailsRouteParams, profileRoute } from '../../types/navigation';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Loading } from '../../components/Loading';
import { Avatar } from '../../components/Avatar';
import { UserListItem } from '../../components/UserListItem';
import { theme } from '../../theme';

const notificationPolicyOptions: readonly {
  id: NotificationPolicy;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}[] = [
  { id: 'all_group_messages', label: 'Todas as mensagens', icon: 'notifications' },
  { id: 'mentioned_members', label: 'Apenas menções', icon: 'at' },
  { id: 'direct_messages_only', label: 'Apenas diretas', icon: 'chatbubble' },
  { id: 'disabled', label: 'Desativadas', icon: 'notifications-off' },
];

export default function GroupDetailsScreen() {
  const { id } = useLocalSearchParams<GroupDetailsRouteParams>();
  const { user } = useAuth();
  const router = useRouter();
  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [groupLoading, setGroupLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLimit, setEditLimit] = useState('');
  const [editPolicy, setEditPolicy] = useState<NotificationPolicy>('all_group_messages');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [operation, setOperation] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = listenToGroup(id, (nextGroup) => {
      setGroup(nextGroup);
      setGroupLoading(false);
      if (!nextGroup) setError('Grupo não encontrado ou acesso removido.');
    }, () => {
      setError('Não foi possível acompanhar as alterações do grupo.');
      setGroupLoading(false);
    });
    return unsubscribe;
  }, [id]);

  useEffect(() => {
    let active = true;
    getAllUsers().then((users) => {
      if (active) setAllUsers(users);
    }).catch(() => {
      if (active) setError('Não foi possível carregar os perfis dos integrantes.');
    }).finally(() => {
      if (active) setUsersLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const memberIdSet = useMemo(() => new Set(group?.memberIds ?? []), [group?.memberIds]);
  const members = useMemo(
    () => allUsers.filter((candidate) => memberIdSet.has(candidate.uid)),
    [allUsers, memberIdSet],
  );
  const availableUsers = useMemo(
    () => allUsers.filter((candidate) => !memberIdSet.has(candidate.uid)),
    [allUsers, memberIdSet],
  );
  const isOwner = Boolean(group && user?.uid === group.ownerId);
  const vacancies = group ? Math.max(group.memberLimit - group.memberIds.length, 0) : 0;

  const beginEditing = useCallback(() => {
    if (!group || !isOwner) return;
    setEditName(group.name);
    setEditLimit(String(group.memberLimit));
    setEditPolicy(group.notificationPolicy);
    setPhotoUri(null);
    setError('');
    setEditing(true);
  }, [group, isOwner]);

  const pickImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Permissão da galeria negada. Ative-a nas configurações do aparelho.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.3,
      });
      if (!result.canceled) setPhotoUri(result.assets[0].uri);
    } catch {
      setError('Não foi possível abrir a galeria.');
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!group || !isOwner) return;
    if (!editName.trim()) {
      setError('O nome do grupo é obrigatório.');
      return;
    }
    if (!/^\d+$/.test(editLimit)) {
      setError('O limite deve ser um número inteiro.');
      return;
    }
    const memberLimit = Number(editLimit);
    if (memberLimit < group.memberIds.length) {
      setError('O limite não pode ser menor que a quantidade atual de integrantes.');
      return;
    }

    try {
      setOperation('save');
      setError('');
      const photoUrl = photoUri
        ? await uploadImageAsync(photoUri, `groups/${group.id}`)
        : group.photoUrl;
      await updateGroupConfig(group.id, {
        name: editName.trim(),
        photoUrl,
        memberLimit,
        notificationPolicy: editPolicy,
      });
      setEditing(false);
      setPhotoUri(null);
    } catch {
      setError('Não foi possível salvar as configurações do grupo.');
    } finally {
      setOperation(null);
    }
  }, [editLimit, editName, editPolicy, group, isOwner, photoUri]);

  const handleAddMember = useCallback(async (candidate: ChatUser) => {
    if (!group || !isOwner) return;
    if (vacancies <= 0) {
      setError('O grupo está sem vagas. Aumente o limite antes de adicionar alguém.');
      return;
    }
    try {
      setOperation(`add:${candidate.uid}`);
      setError('');
      await addMember(group.id, candidate.uid);
    } catch {
      setError('Não foi possível adicionar o integrante. A vaga pode ter sido ocupada simultaneamente.');
    } finally {
      setOperation(null);
    }
  }, [group, isOwner, vacancies]);

  const handleRemoveMember = useCallback(async (candidate: ChatUser) => {
    if (!group || !isOwner || candidate.uid === group.ownerId) return;
    if (group.memberIds.length <= 2) {
      setError('O grupo deve permanecer com no mínimo dois integrantes.');
      return;
    }
    try {
      setOperation(`remove:${candidate.uid}`);
      setError('');
      await removeMember(group.id, candidate.uid);
    } catch {
      setError('Não foi possível remover o integrante.');
    } finally {
      setOperation(null);
    }
  }, [group, isOwner]);

  const handleLeave = useCallback(async () => {
    if (!group || !user || isOwner) return;
    if (group.memberIds.length <= 2) {
      setError('Não é possível sair: o grupo precisa manter no mínimo dois integrantes.');
      return;
    }
    try {
      setOperation('leave');
      setError('');
      await leaveGroup(group.id, user.uid);
      router.replace('/(main)/conversations');
    } catch {
      setError('Não foi possível sair do grupo.');
      setOperation(null);
    }
  }, [group, isOwner, router, user]);

  const openProfile = useCallback((candidate: ChatUser) => {
    router.push(profileRoute({ userId: candidate.uid }));
  }, [router]);

  if (!id) return <View style={styles.container}><ErrorMessage message="Grupo inválido." /></View>;
  if (groupLoading || usersLoading) return <Loading message="Carregando grupo..." />;
  if (!group) return <View style={styles.container}><ErrorMessage message={error || 'Grupo indisponível.'} /></View>;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <ErrorMessage message={error} />

      {editing ? (
        <View style={styles.content}>
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage} disabled={operation !== null}>
            <Avatar uri={photoUri || group.photoUrl} style={styles.mainAvatar} />
            <View style={styles.editBadge}><Ionicons name="camera" size={14} color="#FFFFFF" /></View>
          </TouchableOpacity>
          <Text style={styles.label}>Nome do grupo</Text>
          <TextInput style={styles.input} value={editName} onChangeText={setEditName} maxLength={80} editable={operation === null} />
          <Text style={styles.label}>Limite de integrantes</Text>
          <TextInput style={styles.input} value={editLimit} onChangeText={setEditLimit} keyboardType="number-pad" editable={operation === null} />
          <Text style={styles.helper}>{group.memberIds.length} integrantes atuais • {Math.max(Number(editLimit) - group.memberIds.length, 0) || 0} vagas após salvar</Text>
          <Text style={styles.sectionTitle}>Política de notificações</Text>
          <View style={styles.policyContainer}>
            {notificationPolicyOptions.map((option) => (
              <TouchableOpacity key={option.id} style={[styles.policyOption, editPolicy === option.id && styles.policyOptionActive]} onPress={() => setEditPolicy(option.id)} disabled={operation !== null}>
                <Ionicons name={option.icon} size={18} color={editPolicy === option.id ? '#FFFFFF' : theme.colors.primaryDark} />
                <Text style={[styles.policyText, editPolicy === option.id && styles.policyTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={operation !== null}>
            {operation === 'save' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Salvar alterações</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setEditing(false)} disabled={operation !== null}>
            <Text style={styles.secondaryButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.headerSection}>
            <Avatar uri={group.photoUrl} style={styles.mainAvatar} />
            <Text style={styles.title}>{group.name}</Text>
            <Text style={styles.stats}>{group.memberIds.length} / {group.memberLimit} integrantes • {vacancies} vagas</Text>
            <Text style={styles.helper}>Notificações: {notificationPolicyOptions.find((option) => option.id === group.notificationPolicy)?.label}</Text>
          </View>

          {isOwner && (
            <TouchableOpacity style={styles.primaryButton} onPress={beginEditing}>
              <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Configurações do grupo</Text>
            </TouchableOpacity>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Integrantes ({group.memberIds.length})</Text>
            {members.map((member) => (
              <UserListItem
                key={member.uid}
                user={member}
                subtitle={member.uid === group.ownerId ? 'Proprietário' : 'Integrante'}
                onPress={openProfile}
                action={isOwner && member.uid !== group.ownerId ? (
                  <TouchableOpacity accessibilityLabel={`Remover ${member.name}`} style={styles.actionButton} onPress={() => handleRemoveMember(member)} disabled={operation !== null}>
                    {operation === `remove:${member.uid}` ? <ActivityIndicator color={theme.colors.error} /> : <Ionicons name="person-remove" size={20} color={theme.colors.error} />}
                  </TouchableOpacity>
                ) : undefined}
              />
            ))}
          </View>

          {isOwner && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Adicionar integrantes</Text>
              {vacancies === 0 ? (
                <Text style={styles.emptyText}>Grupo sem vagas. Aumente o limite nas configurações.</Text>
              ) : availableUsers.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum usuário disponível para adicionar.</Text>
              ) : availableUsers.map((candidate) => (
                <UserListItem
                  key={candidate.uid}
                  user={candidate}
                  subtitle={`${vacancies} vaga${vacancies === 1 ? '' : 's'} disponível${vacancies === 1 ? '' : 'is'}`}
                  onPress={openProfile}
                  action={(
                    <TouchableOpacity accessibilityLabel={`Adicionar ${candidate.name}`} style={styles.actionButton} onPress={() => handleAddMember(candidate)} disabled={operation !== null}>
                      {operation === `add:${candidate.uid}` ? <ActivityIndicator color={theme.colors.primaryDark} /> : <Ionicons name="person-add" size={20} color={theme.colors.primaryDark} />}
                    </TouchableOpacity>
                  )}
                />
              ))}
            </View>
          )}

          {!isOwner && (
            <TouchableOpacity style={styles.dangerButton} onPress={handleLeave} disabled={operation !== null}>
              {operation === 'leave' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Sair do grupo</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  scrollContent: { flexGrow: 1, paddingBottom: theme.spacing.xxl, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg },
  headerSection: { alignItems: 'center', marginBottom: theme.spacing.lg, padding: theme.spacing.xl, borderRadius: theme.borderRadius.xl, backgroundColor: theme.colors.card, ...theme.shadows.sm },
  mainAvatar: { width: 120, height: 120, marginBottom: theme.spacing.md, borderRadius: 60 },
  title: { ...theme.typography.title, textAlign: 'center', marginBottom: theme.spacing.sm },
  stats: { ...theme.typography.body, color: theme.colors.primaryDark, fontWeight: 'bold' },
  helper: { ...theme.typography.caption, marginVertical: theme.spacing.sm, textAlign: 'center' },
  section: { marginTop: theme.spacing.lg, padding: theme.spacing.md, borderRadius: theme.borderRadius.xl, backgroundColor: theme.colors.card, ...theme.shadows.sm },
  sectionTitle: { ...theme.typography.subtitle, marginBottom: theme.spacing.md, color: theme.colors.text, fontWeight: 'bold' },
  emptyText: { ...theme.typography.body, padding: theme.spacing.md, color: theme.colors.textSecondary, textAlign: 'center' },
  actionButton: { padding: theme.spacing.sm, borderRadius: theme.borderRadius.round, backgroundColor: theme.colors.inputBackground },
  primaryButton: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.sm, padding: theme.spacing.lg, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.primaryDark, ...theme.shadows.md },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  dangerButton: { alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.xl, padding: theme.spacing.lg, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.error },
  secondaryButton: { alignItems: 'center', padding: theme.spacing.lg },
  secondaryButtonText: { color: theme.colors.error, fontSize: 16, fontWeight: 'bold' },
  imagePicker: { alignSelf: 'center', position: 'relative', marginBottom: theme.spacing.xl },
  editBadge: { position: 'absolute', right: 0, bottom: theme.spacing.md, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: theme.colors.primaryDark },
  label: { ...theme.typography.caption, marginBottom: theme.spacing.sm, fontWeight: 'bold' },
  input: { marginBottom: theme.spacing.lg, padding: theme.spacing.lg, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.inputBackground, color: theme.colors.text, fontSize: 16 },
  policyContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  policyOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.round, backgroundColor: theme.colors.inputBackground },
  policyOptionActive: { borderColor: theme.colors.primaryDark, backgroundColor: theme.colors.primaryDark },
  policyText: { ...theme.typography.caption, marginLeft: 6, color: theme.colors.text },
  policyTextActive: { color: '#FFFFFF' },
});
