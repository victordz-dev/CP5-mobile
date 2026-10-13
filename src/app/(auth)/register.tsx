import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { register } from '../../services/authService';
import { createUserProfile } from '../../services/userService';
import { uploadImageAsync } from '../../services/storageService';
import { ErrorMessage } from '../../components/ErrorMessage';
import { useAuth } from '../../hooks/useAuth';
import { formatDate, formatPhone, isValidBirthDate, isValidPhone } from '../../utils/formatters';
import { theme } from '../../theme';

export default function RegisterScreen() {
  const { user } = useAuth();
  const completingProfile = Boolean(user);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const pickImage = useCallback(async () => {
    try {
      setError('');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Permissão para acessar a galeria foi negada. Ative-a nas configurações do aparelho.');
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
      setError('Não foi possível abrir a galeria. Tente novamente.');
    }
  }, []);

  const handleRegister = useCallback(async () => {
    if (
      !name.trim()
      || !email.trim()
      || (!completingProfile && (!password || !confirmPassword))
      || !phoneNumber
      || !birthDate
    ) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    if (!completingProfile && password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (completingProfile && user?.email?.toLocaleLowerCase() !== email.trim().toLocaleLowerCase()) {
      setError('Conclua o perfil usando o mesmo e-mail da conta autenticada.');
      return;
    }
    if (!isValidPhone(phoneNumber)) {
      setError('Informe um celular válido com DDD.');
      return;
    }
    if (!isValidBirthDate(birthDate)) {
      setError('Informe uma data de nascimento válida no formato DD/MM/AAAA.');
      return;
    }
    if (!photoUri) {
      setError('Adicione uma foto de perfil para concluir o cadastro.');
      return;
    }

    let createdUid: string | null = user?.uid ?? null;
    try {
      setLoading(true);
      setError('');
      if (!createdUid) {
        const credential = await register(email, password);
        createdUid = credential.user.uid;
      }
      const photoUrl = await uploadImageAsync(photoUri, `profiles/${createdUid}`);
      await createUserProfile(createdUid, {
        name: name.trim(),
        email: email.trim(),
        phoneNumber,
        birthDate,
        photoUrl,
      });
    } catch (registrationError: unknown) {
      setError(registrationError instanceof Error
        ? registrationError.message
        : 'Não foi possível concluir o cadastro. Verifique a conexão.');
    } finally {
      setLoading(false);
    }
  }, [birthDate, completingProfile, confirmPassword, email, name, password, phoneNumber, photoUri, user]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>{completingProfile ? 'Completar perfil' : 'Criar conta'}</Text>
          <Text style={styles.subtitle}>Todos os campos exibidos são obrigatórios.</Text>
        </View>

        <View style={styles.form}>
          <TouchableOpacity accessibilityLabel="Selecionar foto de perfil" style={styles.imagePicker} onPress={pickImage} disabled={loading}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.image} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera" size={32} color={theme.colors.primaryDark} />
                <Text style={styles.imagePlaceholderText}>Adicionar foto</Text>
              </View>
            )}
          </TouchableOpacity>

          <TextInput style={styles.input} placeholder="Nome completo" placeholderTextColor={theme.colors.textSecondary} value={name} onChangeText={setName} editable={!loading} autoComplete="name" />
          <TextInput style={styles.input} placeholder="E-mail" placeholderTextColor={theme.colors.textSecondary} value={email} onChangeText={setEmail} editable={!loading && !completingProfile} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <TextInput style={styles.input} placeholder="Celular com DDD" placeholderTextColor={theme.colors.textSecondary} value={phoneNumber} onChangeText={(value) => setPhoneNumber(formatPhone(value))} editable={!loading} keyboardType="phone-pad" autoComplete="tel" />
          <TextInput style={styles.input} placeholder="Nascimento (DD/MM/AAAA)" placeholderTextColor={theme.colors.textSecondary} value={birthDate} onChangeText={(value) => setBirthDate(formatDate(value))} editable={!loading} keyboardType="number-pad" />

          {!completingProfile && (
            <>
              <PasswordField value={password} onChangeText={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} placeholder="Senha" editable={!loading} />
              <PasswordField value={confirmPassword} onChangeText={setConfirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((value) => !value)} placeholder="Confirmar senha" editable={!loading} />
            </>
          )}

          <ErrorMessage message={error} />

          <TouchableOpacity style={styles.primaryButton} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{completingProfile ? 'Salvar perfil' : 'Cadastrar'}</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type PasswordFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
  editable: boolean;
};

function PasswordField({ value, onChangeText, visible, onToggle, placeholder, editable }: PasswordFieldProps) {
  return (
    <View style={styles.passwordContainer}>
      <TextInput style={styles.passwordInput} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={theme.colors.textSecondary} secureTextEntry={!visible} editable={editable} autoComplete="new-password" />
      <TouchableOpacity accessibilityLabel="Mostrar ou ocultar senha" onPress={onToggle} style={styles.eyeIcon}>
        <Ionicons name={visible ? 'eye-off' : 'eye'} size={24} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, padding: theme.spacing.xl, paddingBottom: theme.spacing.xxl },
  header: { marginBottom: theme.spacing.lg },
  title: { ...theme.typography.title, fontSize: 36, marginBottom: theme.spacing.sm },
  subtitle: { ...theme.typography.subtitle, fontSize: 18 },
  form: { padding: theme.spacing.lg, borderRadius: theme.borderRadius.xl, backgroundColor: theme.colors.card, ...theme.shadows.md },
  imagePicker: { alignSelf: 'center', marginBottom: theme.spacing.xl },
  image: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: theme.colors.primaryLight },
  imagePlaceholder: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: theme.colors.primaryLight, borderRadius: 60, backgroundColor: theme.colors.inputBackground },
  imagePlaceholderText: { color: theme.colors.primaryDark, fontWeight: '500', marginTop: theme.spacing.xs },
  input: { marginBottom: theme.spacing.md, padding: theme.spacing.lg, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.inputBackground, color: theme.colors.text, fontSize: 16 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.inputBackground },
  passwordInput: { flex: 1, padding: theme.spacing.lg, color: theme.colors.text, fontSize: 16 },
  eyeIcon: { padding: theme.spacing.lg },
  primaryButton: { alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.md, padding: theme.spacing.lg, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.primaryDark, ...theme.shadows.md },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
