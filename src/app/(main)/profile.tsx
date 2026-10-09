import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getUserProfile, updateUserProfile } from '../../services/userService';
import { uploadImageAsync } from '../../services/storageService';
import * as ImagePicker from 'expo-image-picker';
import { ChatUser } from '../../types/user';
import { Loading } from '../../components/Loading';
import { Avatar } from '../../components/Avatar';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { formatPhone, formatDate } from '../../utils/formatters';

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const targetUserId = userId || user?.uid;
  const [profile, setProfile] = useState<ChatUser | null>(null);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const isOwnProfile = !userId || userId === user?.uid;

  const handleImagePick = async () => {
    if (!isOwnProfile) return;
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert("Permissão necessária", "É necessário permitir o acesso à galeria.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.3,
      });

      if (!result.canceled && user) {
        setUploadingImage(true);
        const photoUrl = await uploadImageAsync(result.assets[0].uri, `profiles/${user.uid}`);
        await updateUserProfile(user.uid, { photoUrl });
        setProfile(prev => prev ? { ...prev, photoUrl } : null);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Não foi possível atualizar a foto.");
    } finally {
      setUploadingImage(false);
    }
  };

  const toggleEdit = () => {
    if (!profile) return;
    if (!isEditing) {
      setEditName(profile.name);
      setEditPhone(profile.phoneNumber || '');
      setEditBirthDate(profile.birthDate || '');
    }
    setIsEditing(!isEditing);
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    if (!editName.trim()) {
      Alert.alert('Erro', 'O nome não pode ser vazio.');
      return;
    }
    try {
      setSavingConfig(true);
      const updates = {
        name: editName,
        phoneNumber: editPhone,
        birthDate: editBirthDate,
      };
      await updateUserProfile(user.uid, updates);
      setProfile({ ...profile, ...updates });
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Falha ao salvar o perfil.');
    } finally {
      setSavingConfig(false);
    }
  };

  useEffect(() => {
    if (!targetUserId) {
      return;
    }
    let active = true;
    const loadProfile = async () => {
      try {
        const p = await getUserProfile(targetUserId);
        if (active) setProfile(p);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setResolvedUserId(targetUserId);
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [targetUserId]);

  if (targetUserId && resolvedUserId !== targetUserId) return <Loading />;

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={theme.colors.error} />
        <Text style={styles.errorText}>Perfil não encontrado ou sem permissão.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <View
          style={styles.headerBackground}
        />
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={handleImagePick} disabled={!isOwnProfile || uploadingImage} activeOpacity={0.8}>
            {uploadingImage ? (
              <View style={[styles.avatar, styles.uploadingOverlay]}>
                <ActivityIndicator color={theme.colors.primaryDark} size="large" />
              </View>
            ) : (
              <Avatar uri={profile.photoUrl} style={styles.avatar} />
            )}
            {isOwnProfile && !uploadingImage && (
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={16} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>
        </View>
        {isEditing ? (
          <TextInput
            style={[styles.name, styles.inputEditing]}
            value={editName}
            onChangeText={setEditName}
            placeholder="Nome"
          />
        ) : (
          <Text style={styles.name}>{profile.name}</Text>
        )}
        <Text style={styles.uid}>ID: {profile.uid.substring(0, 8)}...</Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Informações de Contato</Text>
          {isOwnProfile && (
            <TouchableOpacity onPress={isEditing ? handleSaveProfile : toggleEdit} disabled={savingConfig}>
              {savingConfig ? (
                <ActivityIndicator size="small" color={theme.colors.primaryDark} />
              ) : (
                <Text style={styles.editActionText}>{isEditing ? 'Salvar' : 'Editar'}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.infoRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="mail" size={20} color={theme.colors.primaryDark} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>E-mail</Text>
            <Text style={styles.infoValue}>{profile.email}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="call" size={20} color={theme.colors.primaryDark} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Celular</Text>
            {isEditing ? (
              <TextInput
                style={styles.inputEditing}
                value={editPhone}
                onChangeText={(t) => setEditPhone(formatPhone(t))}
                placeholder="Celular"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.infoValue}>{profile.phoneNumber || 'Não informado'}</Text>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="calendar" size={20} color={theme.colors.primaryDark} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Data de Nascimento</Text>
            {isEditing ? (
              <TextInput
                style={styles.inputEditing}
                value={editBirthDate}
                onChangeText={(t) => setEditBirthDate(formatDate(t))}
                placeholder="Data de Nascimento"
                keyboardType="number-pad"
              />
            ) : (
              <Text style={styles.infoValue}>{profile.birthDate || 'Não informado'}</Text>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme.colors.background 
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  headerCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    position: 'relative',
    ...theme.shadows.sm,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  avatarContainer: {
    marginTop: 20,
    padding: 4,
    backgroundColor: theme.colors.card,
    borderRadius: 75,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  avatar: { 
    width: 120, 
    height: 120, 
    borderRadius: 60,
  },
  uploadingOverlay: {
    backgroundColor: theme.colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
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
    borderWidth: 3,
    borderColor: theme.colors.card,
  },
  name: { 
    ...theme.typography.title,
    textAlign: 'center',
  },
  uid: {
    ...theme.typography.caption,
    marginTop: theme.spacing.xs,
  },
  infoCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.subtitle,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  editActionText: {
    ...theme.typography.body,
    color: theme.colors.primaryDark,
    fontWeight: 'bold',
  },
  inputEditing: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primaryDark,
    paddingVertical: 2,
    ...theme.typography.body,
    fontWeight: '500',
    minWidth: '80%',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    ...theme.typography.caption,
    marginBottom: 2,
  },
  infoValue: {
    ...theme.typography.body,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.sm,
    marginLeft: 56, // Align with text
  },
  errorContainer: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  errorText: { 
    ...theme.typography.subtitle,
    color: theme.colors.error,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  }
});
