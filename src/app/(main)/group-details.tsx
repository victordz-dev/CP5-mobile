import { type ComponentProps, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
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
import { Avatar } from '../../components/Avatar';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

const notificationPolicyOptions: readonly {
  id: NotificationPolicy;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}[] = [
  { id: 'all_group_messages', label: 'Todas as mensagens', icon: 'notifications' },
  { id: 'mentioned_members', label: 'Apenas menções', icon: 'at' },
  { id: 'direct_messages_only', label: 'Apenas diretas', icon: 'chatbubble' },
  { id: 'disabled', label: 'Silenciado', icon: 'notifications-off' },
];

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
    const unsubscribe = onSnapshot(doc(firestore, 'groups', id), async (snap) => {
      if (snap.exists()) {
        const g = { id: snap.id, ...snap.data() } as ChatGroup;
        setGroup(g);
        setEditName(curr => curr === '' ? g.name : curr);
        setEditLimit(curr => curr === '' ? g.memberLimit.toString() : curr);
        setEditPolicy(curr => curr === 'all_group_messages' ? (g.notificationPolicy || 'all_group_messages') : curr);
        
        try {
          const users = await getAllUsers();
          setAllUsers(users);
          setMembers(users.filter(u => g.memberIds.includes(u.uid)));
        } catch {}
        setLoading(false);
      } else {
        setError('Grupo não encontrado');
        setLoading(false);
      }
    }, (err) => {
      setError('Erro ao carregar.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  if (loading) return <Loading />;
  if (error || !group) return <View style={styles.container}><ErrorMessage message={error} /></View>;

  const isOwner = user?.uid === group.ownerId;
  const vagas = group.memberLimit - group.memberIds.length;

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

  const handleSave = async () => {
    try {
      setLoading(true);
      let photoUrl = group.photoUrl;
      if (photoUri) {
        photoUrl = await uploadImageAsync(photoUri, `groups/${group.id}`);
      }
      
      if (!/^\d+$/.test(editLimit)) {
        throw new Error('O limite de membros deve ser estritamente numérico.');
      }
      const newLimit = Number(editLimit);
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
    } catch {
      setError('Erro ao salvar as configurações.');
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
    } catch {
      alert('Não foi possível adicionar o membro.');
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
    } catch {
      alert('Erro ao remover');
    }
  };

  const getPolicyName = (policy: string) => {
    switch(policy) {
      case 'all_group_messages': return 'Todas as mensagens';
      case 'mentioned_members': return 'Apenas menções';
      case 'direct_messages_only': return 'Apenas diretas';
      case 'disabled': return 'Silenciado';
      default: return policy;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {!editing ? (
        <View style={styles.content}>
          <View style={styles.headerSection}>
            <Avatar uri={group.photoUrl} style={styles.mainAvatar} />
            <Text style={styles.title}>{group.name}</Text>
            
            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Ionicons name="people" size={24} color={theme.colors.primaryDark} />
                <Text style={styles.statValue}>{group.memberIds.length} / {group.memberLimit}</Text>
                <Text style={styles.statLabel}>Membros</Text>
              </View>
              <View style={styles.statBox}>
                <Ionicons name="person-add" size={24} color={theme.colors.success} />
                <Text style={[styles.statValue, { color: theme.colors.success }]}>{vagas}</Text>
                <Text style={styles.statLabel}>Vagas</Text>
              </View>
            </View>
            
            <View style={styles.infoBadge}>
              <Ionicons name="notifications" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.infoText}>Notificações: {getPolicyName(group.notificationPolicy || 'all_group_messages')}</Text>
            </View>
          </View>

          {isOwner && (
            <TouchableOpacity style={styles.primaryButton} onPress={() => setEditing(true)}>
              <Ionicons name="settings-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Configurações do Grupo</Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Membros do Grupo</Text>
            {members.map(m => (
              <TouchableOpacity key={m.uid} style={styles.userRow} activeOpacity={0.7} onPress={() => router.push(`/(main)/profile?userId=${m.uid}`)}>
                <Avatar uri={m.photoUrl} style={styles.smallAvatar} />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{m.name}</Text>
                  {m.uid === group.ownerId && <Text style={styles.ownerBadge}>Dono</Text>}
                </View>
                {isOwner && m.uid !== group.ownerId && (
                  <TouchableOpacity style={styles.actionIconButton} onPress={() => handleRemoveMember(m.uid)}>
                    <Ionicons name="person-remove" size={20} color={theme.colors.error} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {isOwner && vagas > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Adicionar Membros</Text>
              {allUsers.filter(u => !group.memberIds.includes(u.uid)).map(m => (
                <TouchableOpacity key={m.uid} style={styles.userRow} activeOpacity={0.7} onPress={() => router.push(`/(main)/profile?userId=${m.uid}`)}>
                  <Avatar uri={m.photoUrl} style={styles.smallAvatar} />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{m.name}</Text>
                  </View>
                  <TouchableOpacity style={[styles.actionIconButton, { backgroundColor: theme.colors.primaryLight + '20' }]} onPress={() => handleAddMember(m.uid)}>
                    <Ionicons name="person-add" size={20} color={theme.colors.primaryDark} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!isOwner && (
            <TouchableOpacity style={styles.dangerButton} onPress={async () => {
              if(group.memberIds.length <= 2) return alert('Impossível sair, mínimo 2 membros.');
              try {
                await leaveGroup(group.id, user!.uid);
                router.replace('/(main)/conversations');
              } catch {
                alert('Erro ao sair do grupo');
              }
            }}>
              <Ionicons name="exit-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Sair do Grupo</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.content}>
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8}>
            {photoUri || group.photoUrl ? (
              <Avatar uri={photoUri || group.photoUrl} style={styles.mainAvatar} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera" size={32} color={theme.colors.primaryDark} />
                <Text style={styles.imagePlaceholderText}>Mudar Foto</Text>
              </View>
            )}
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={14} color="#FFF" />
            </View>
          </TouchableOpacity>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Nome do Grupo</Text>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Nome" placeholderTextColor={theme.colors.textSecondary} />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Limite de Membros</Text>
            <TextInput style={styles.input} value={editLimit} onChangeText={setEditLimit} placeholder="Ex: 10" keyboardType="numeric" placeholderTextColor={theme.colors.textSecondary} />
          </View>
          
          <Text style={styles.sectionTitle}>Política de Notificações</Text>
          <View style={styles.policyContainer}>
            {notificationPolicyOptions.map((policy) => (
              <TouchableOpacity 
                key={policy.id}
                style={[styles.policyOption, editPolicy === policy.id && styles.policyOptionActive]}
                onPress={() => setEditPolicy(policy.id)}
              >
                <Ionicons name={policy.icon} size={20} color={editPolicy === policy.id ? '#FFF' : theme.colors.primaryDark} />
                <Text style={[styles.policyText, editPolicy === policy.id && styles.policyTextActive]}>{policy.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[styles.primaryButton, { marginTop: theme.spacing.xl }]} onPress={handleSave}>
            <Text style={styles.primaryButtonText}>Salvar Alterações</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setEditing(false)}>
            <Text style={styles.secondaryButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xxl,
  },
  content: {
    padding: theme.spacing.lg,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    backgroundColor: theme.colors.card,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    ...theme.shadows.sm,
  },
  mainAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: theme.spacing.md,
    borderWidth: 4,
    borderColor: theme.colors.background,
  },
  title: {
    ...theme.typography.title,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    ...theme.typography.title,
    fontSize: 24,
    color: theme.colors.text,
    marginTop: 4,
  },
  statLabel: {
    ...theme.typography.caption,
    marginTop: 2,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.round,
  },
  infoText: {
    ...theme.typography.caption,
    marginLeft: 4,
  },
  section: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  sectionTitle: {
    ...theme.typography.subtitle,
    fontWeight: 'bold',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  smallAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: theme.spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    ...theme.typography.body,
    fontWeight: 'bold',
  },
  ownerBadge: {
    ...theme.typography.caption,
    color: theme.colors.primaryDark,
    marginTop: 2,
    fontWeight: '600',
  },
  actionIconButton: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.error + '20',
    borderRadius: theme.borderRadius.round,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primaryDark,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    ...theme.shadows.md,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dangerButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.error,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xl,
    ...theme.shadows.md,
  },
  secondaryButton: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  secondaryButtonText: {
    color: theme.colors.error,
    fontSize: 16,
    fontWeight: 'bold',
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
  imagePicker: {
    alignSelf: 'center',
    marginBottom: theme.spacing.xl,
    position: 'relative',
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
  policyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
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
});
