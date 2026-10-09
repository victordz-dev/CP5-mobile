import { type ComponentProps, useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { createGroup } from '../../services/groupService';
import { uploadImageAsync } from '../../services/storageService';
import { getAllUsers } from '../../services/userService';
import { ChatUser } from '../../types/user';
import { ErrorMessage } from '../../components/ErrorMessage';
import * as ImagePicker from 'expo-image-picker';
import { NotificationPolicy } from '../../types/group';
import { Avatar } from '../../components/Avatar';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

const notificationPolicyOptions: readonly {
  id: NotificationPolicy;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}[] = [
  { id: 'all_group_messages', label: 'Todas', icon: 'notifications' },
  { id: 'mentioned_members', label: 'Menções', icon: 'at' },
  { id: 'direct_messages_only', label: 'Diretas', icon: 'chatbubble' },
  { id: 'disabled', label: 'Off', icon: 'notifications-off' },
];

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
    getAllUsers().then(u => setUsers(u.filter(ui => ui.uid !== user?.uid))).catch(() => setError('Falha de rede ao buscar usuários.'));
  }, [user]);

  const toggleUser = (id: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUserIds(newSet);
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      setError("Permissão para acessar a galeria é necessária!");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleCreate = async () => {
    if (!name || !memberLimit || !user) {
      setError('Preencha os campos obrigatórios.');
      return;
    }
    if (!photoUri) {
      setError('A foto do grupo é obrigatória.');
      return;
    }
    if (!/^\d+$/.test(memberLimit)) {
      setError('O limite de membros deve ser estritamente numérico.');
      return;
    }
    const limitNum = Number(memberLimit);
    if (isNaN(limitNum) || limitNum < 2) {
      setError('O limite de membros deve ser um número inteiro (mínimo 2).');
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
        photoUrl = await uploadImageAsync(photoUri, `groups/${user.uid}-${Date.now()}`);
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
    } catch {
      setError('Falha ao processar criação do grupo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Novo Grupo</Text>
        <Text style={styles.subtitle}>Crie um espaço para conversar com seus amigos</Text>
      </View>

      <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8}>
        {photoUri ? (
          <Avatar uri={photoUri} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="camera" size={32} color={theme.colors.primaryDark} />
            <Text style={styles.imagePlaceholderText}>Adicionar Foto</Text>
          </View>
        )}
        {photoUri && (
          <View style={styles.editBadge}>
            <Ionicons name="pencil" size={14} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Nome do Grupo</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Amigos da Faculdade"
            placeholderTextColor={theme.colors.textSecondary}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Limite de Integrantes (min: 2)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 10"
            placeholderTextColor={theme.colors.textSecondary}
            value={memberLimit}
            onChangeText={setMemberLimit}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Política de Notificações</Text>
          <View style={styles.policyContainer}>
            {notificationPolicyOptions.map((p) => (
              <TouchableOpacity 
                key={p.id}
                style={[styles.policyOption, policy === p.id && styles.policyOptionActive]}
                onPress={() => setPolicy(p.id)}
              >
                <Ionicons name={p.icon} size={18} color={policy === p.id ? '#FFF' : theme.colors.primaryDark} />
                <Text style={[styles.policyText, policy === p.id && styles.policyTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.membersHeader}>
          <Text style={styles.sectionTitle}>Selecionar Membros</Text>
          <Text style={styles.membersCount}>
            {selectedUserIds.size} / {Number(memberLimit) > 0 ? (Number(memberLimit) - 1) : '?'} vagas
          </Text>
        </View>
        
        {users.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum usuário disponível para adicionar.</Text>
        ) : (
          users.map(u => {
            const isSelected = selectedUserIds.has(u.uid);
            return (
              <TouchableOpacity 
                key={u.uid} 
                onPress={() => toggleUser(u.uid)} 
                style={[styles.userRow, isSelected && styles.userRowSelected]}
                activeOpacity={0.7}
              >
                <Avatar uri={u.photoUrl} style={styles.userAvatar} />
                <Text style={[styles.userName, isSelected && styles.userNameSelected]}>
                  {u.name}
                </Text>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={16} color="#FFF" />}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <ErrorMessage message={error} />
      
      <TouchableOpacity style={styles.primaryButton} onPress={handleCreate} disabled={loading}>
        <View
          style={styles.gradientButton}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Criar Grupo</Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    flexGrow: 1,
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    marginBottom: theme.spacing.xl,
    alignItems: 'center',
  },
  title: {
    ...theme.typography.title,
    fontSize: 28,
  },
  subtitle: {
    ...theme.typography.subtitle,
    marginTop: theme.spacing.xs,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  imagePicker: {
    alignSelf: 'center',
    marginBottom: theme.spacing.xl,
    position: 'relative',
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: theme.colors.primaryLight,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primaryLight,
    borderStyle: 'dashed',
  },
  imagePlaceholderText: {
    color: theme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primaryDark,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    ...theme.typography.caption,
    fontWeight: 'bold',
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    fontSize: 16,
    color: theme.colors.text,
  },
  policyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  policyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.round,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  policyOptionActive: {
    backgroundColor: theme.colors.primaryDark,
    borderColor: theme.colors.primaryDark,
  },
  policyText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    marginLeft: 6,
    fontWeight: '500',
  },
  policyTextActive: {
    color: '#FFF',
  },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.subtitle,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  membersCount: {
    ...theme.typography.caption,
    color: theme.colors.primaryDark,
    fontWeight: 'bold',
    backgroundColor: theme.colors.primaryLight + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.inputBackground,
  },
  userRowSelected: {
    backgroundColor: theme.colors.primaryLight + '15',
    borderColor: theme.colors.primaryLight,
    borderWidth: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: theme.spacing.md,
  },
  userName: {
    flex: 1,
    ...theme.typography.body,
  },
  userNameSelected: {
    fontWeight: 'bold',
    color: theme.colors.primaryDark,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: theme.colors.primaryDark,
    borderColor: theme.colors.primaryDark,
  },
  primaryButton: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  gradientButton: {
    backgroundColor: theme.colors.primaryDark,
    flexDirection: 'row',
    padding: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
