import { type ComponentProps, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../hooks/useAuth';
import { createGroup } from '../../services/groupService';
import { uploadImageAsync } from '../../services/storageService';
import { getAllUsers } from '../../services/userService';
import { ChatUser } from '../../types/user';
import { NotificationPolicy } from '../../types/group';
import { chatRoute } from '../../types/navigation';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Avatar } from '../../components/Avatar';
import { theme } from '../../theme';

const notificationPolicyOptions: readonly {
  id: NotificationPolicy;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}[] = [
  { id: 'all_group_messages', label: 'Todas', icon: 'notifications' },
  { id: 'mentioned_members', label: 'Menções', icon: 'at' },
  { id: 'direct_messages_only', label: 'Só diretas', icon: 'chatbubble' },
  { id: 'disabled', label: 'Desativadas', icon: 'notifications-off' },
];

export default function GroupFormScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [memberLimit, setMemberLimit] = useState('10');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [policy, setPolicy] = useState<NotificationPolicy>('all_group_messages');
  const [submitting, setSubmitting] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let active = true;
    getAllUsers().then((result) => {
      if (active) setUsers(result.filter((candidate) => candidate.uid !== user?.uid));
    }).catch(() => {
      if (active) setError('Falha ao buscar usuários. Verifique sua conexão.');
    }).finally(() => {
      if (active) setLoadingUsers(false);
    });
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const numericLimit = /^\d+$/.test(memberLimit) ? Number(memberLimit) : 0;
  const totalMembers = selectedUserIds.size + 1;
  const vacancies = Math.max(numericLimit - totalMembers, 0);
  const selectionAtLimit = numericLimit >= 2 && totalMembers >= numericLimit;

  const selectedSummary = useMemo(
    () => `${totalMembers} integrante${totalMembers === 1 ? '' : 's'} • ${vacancies} vaga${vacancies === 1 ? '' : 's'}`,
    [totalMembers, vacancies],
  );

  const toggleUser = useCallback((userId: string) => {
    setError('');
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else if (numericLimit >= 2 && next.size + 1 >= numericLimit) {
        setError('O grupo já atingiu o limite informado.');
      } else {
        next.add(userId);
      }
      return next;
    });
  }, [numericLimit]);

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

  const handleCreate = useCallback(async () => {
    if (!user) {
      setError('Sua sessão expirou. Entre novamente.');
      return;
    }
    if (!name.trim() || !photoUri) {
      setError('Informe o nome e selecione uma foto para o grupo.');
      return;
    }
    if (!Number.isInteger(numericLimit) || numericLimit < 2) {
      setError('O limite deve ser um número inteiro maior ou igual a 2.');
      return;
    }
    if (selectedUserIds.size < 1) {
      setError('Selecione pelo menos um integrante além de você.');
      return;
    }
    if (totalMembers > numericLimit) {
      setError('A quantidade de integrantes excede o limite do grupo.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const photoUrl = await uploadImageAsync(photoUri, `groups/${user.uid}-${Date.now()}`);
      const groupId = await createGroup({
        name: name.trim(),
        photoUrl,
        memberIds: [user.uid, ...selectedUserIds],
        memberLimit: numericLimit,
        notificationPolicy: policy,
      });
      router.replace(chatRoute({ id: groupId, type: 'group', name: name.trim(), photoUrl }));
    } catch (createError: unknown) {
      setError(createError instanceof Error
        ? createError.message
        : 'Não foi possível criar o grupo.');
    } finally {
      setSubmitting(false);
    }
  }, [name, numericLimit, photoUri, policy, router, selectedUserIds, totalMembers, user]);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Novo grupo</Text>
        <Text style={styles.subtitle}>Defina os dados, integrantes e notificações.</Text>
      </View>

      <TouchableOpacity style={styles.imagePicker} onPress={pickImage} disabled={submitting}>
        {photoUri ? <Avatar uri={photoUri} style={styles.image} /> : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="camera" size={32} color={theme.colors.primaryDark} />
            <Text style={styles.imagePlaceholderText}>Adicionar foto</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.label}>Nome do grupo</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={80} editable={!submitting} placeholder="Ex.: Amigos da faculdade" placeholderTextColor={theme.colors.textSecondary} />
        <Text style={styles.label}>Limite de integrantes (mínimo 2)</Text>
        <TextInput style={styles.input} value={memberLimit} onChangeText={setMemberLimit} editable={!submitting} keyboardType="number-pad" placeholder="Ex.: 10" placeholderTextColor={theme.colors.textSecondary} />
        <Text style={styles.summary}>{selectedSummary}</Text>

        <Text style={styles.label}>Política de notificações</Text>
        <View style={styles.policyContainer}>
          {notificationPolicyOptions.map((option) => (
            <TouchableOpacity key={option.id} style={[styles.policyOption, policy === option.id && styles.policyOptionActive]} onPress={() => setPolicy(option.id)} disabled={submitting}>
              <Ionicons name={option.icon} size={18} color={policy === option.id ? '#FFFFFF' : theme.colors.primaryDark} />
              <Text style={[styles.policyText, policy === option.id && styles.policyTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Selecionar integrantes</Text>
        {loadingUsers ? (
          <ActivityIndicator color={theme.colors.primaryDark} />
        ) : users.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum outro usuário disponível.</Text>
        ) : users.map((candidate) => {
          const selected = selectedUserIds.has(candidate.uid);
          return (
            <TouchableOpacity key={candidate.uid} style={[styles.userRow, selected && styles.userRowSelected]} onPress={() => toggleUser(candidate.uid)} disabled={submitting || (!selected && selectionAtLimit)}>
              <Avatar uri={candidate.photoUrl} style={styles.userAvatar} />
              <Text style={styles.userName}>{candidate.name}</Text>
              <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selected ? theme.colors.primaryDark : theme.colors.border} />
            </TouchableOpacity>
          );
        })}
      </View>

      <ErrorMessage message={error} />
      <TouchableOpacity style={styles.primaryButton} onPress={handleCreate} disabled={submitting || loadingUsers}>
        {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Criar grupo</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, backgroundColor: theme.colors.background },
  header: { alignItems: 'center', marginBottom: theme.spacing.xl },
  title: { ...theme.typography.title },
  subtitle: { ...theme.typography.subtitle, marginTop: theme.spacing.xs, textAlign: 'center' },
  imagePicker: { alignSelf: 'center', marginBottom: theme.spacing.xl },
  image: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: theme.colors.primaryLight },
  imagePlaceholder: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: theme.colors.primaryLight, borderRadius: 60, backgroundColor: theme.colors.inputBackground },
  imagePlaceholderText: { marginTop: theme.spacing.xs, color: theme.colors.primaryDark, fontWeight: '500' },
  card: { marginBottom: theme.spacing.lg, padding: theme.spacing.lg, borderRadius: theme.borderRadius.xl, backgroundColor: theme.colors.card, ...theme.shadows.sm },
  label: { ...theme.typography.caption, marginBottom: theme.spacing.sm, fontWeight: 'bold' },
  input: { marginBottom: theme.spacing.md, padding: theme.spacing.lg, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.inputBackground, color: theme.colors.text, fontSize: 16 },
  summary: { ...theme.typography.caption, marginBottom: theme.spacing.lg, color: theme.colors.primaryDark, fontWeight: 'bold' },
  policyContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  policyOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.round, backgroundColor: theme.colors.inputBackground },
  policyOptionActive: { borderColor: theme.colors.primaryDark, backgroundColor: theme.colors.primaryDark },
  policyText: { ...theme.typography.caption, marginLeft: 6, color: theme.colors.text, fontWeight: '500' },
  policyTextActive: { color: '#FFFFFF' },
  sectionTitle: { ...theme.typography.subtitle, marginBottom: theme.spacing.md, color: theme.colors.text, fontWeight: 'bold' },
  emptyText: { ...theme.typography.body, color: theme.colors.textSecondary, textAlign: 'center' },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.inputBackground },
  userRowSelected: { borderWidth: 1, borderColor: theme.colors.primaryLight },
  userAvatar: { width: 40, height: 40, marginRight: theme.spacing.md, borderRadius: 20 },
  userName: { ...theme.typography.body, flex: 1 },
  primaryButton: { alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.primaryDark, ...theme.shadows.md },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
