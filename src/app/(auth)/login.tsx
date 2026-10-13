import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { login, logout } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { ErrorMessage } from '../../components/ErrorMessage';
import { theme } from '../../theme';

export default function LoginScreen() {
  const { user, profile, profileError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleIncompleteLogout = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      await logout();
    } catch {
      setError('Não foi possível sair desta conta. Verifique a conexão e tente novamente.');
      setLoading(false);
    }
  }, []);

  const handleLogin = useCallback(async () => {
    if (!email.trim() || !password) {
      setError('Informe o e-mail e a senha.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await login(email, password);
    } catch (loginError: unknown) {
      setError(loginError instanceof Error
        ? loginError.message
        : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [email, password]);

  if (user && !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.incompleteContainer}>
          <Ionicons name="person-add-outline" size={48} color={theme.colors.primaryDark} />
          <Text style={styles.incompleteTitle}>Conclua seu cadastro</Text>
          <Text style={styles.incompleteText}>
            Sua conta foi autenticada, mas o perfil ainda não está pronto. As conversas e notificações permanecem bloqueadas até a conclusão.
          </Text>
          <ErrorMessage message={error || profileError} />
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/register')}
            disabled={loading}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.primaryButtonText}>Completar perfil</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleIncompleteLogout} disabled={loading}>
            {loading
              ? <ActivityIndicator color={theme.colors.primaryDark} />
              : <Text style={styles.secondaryButtonText}>Sair desta conta</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Bem-vindo</Text>
            <Text style={styles.subtitle}>Faça login para continuar sua jornada</Text>
          </View>

          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor={theme.colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!loading}
            />
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Senha"
                placeholderTextColor={theme.colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                editable={!loading}
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity accessibilityLabel="Mostrar ou ocultar senha" onPress={() => setShowPassword((value) => !value)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ErrorMessage message={error} />

            <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
              <View style={styles.buttonContent}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Entrar</Text>}
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Não tem uma conta?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')} disabled={loading}>
              <Text style={styles.linkText}> Criar conta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  keyboardView: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.xl },
  headerContainer: { marginBottom: theme.spacing.xxl },
  title: { ...theme.typography.title, fontSize: 36, marginBottom: theme.spacing.sm },
  subtitle: { ...theme.typography.subtitle, fontSize: 18 },
  formContainer: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.card,
    ...theme.shadows.md,
  },
  input: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.inputBackground,
    color: theme.colors.text,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.inputBackground,
  },
  passwordInput: { flex: 1, padding: theme.spacing.lg, color: theme.colors.text, fontSize: 16 },
  eyeIcon: { padding: theme.spacing.lg },
  primaryButton: { marginTop: theme.spacing.md, borderRadius: theme.borderRadius.lg, overflow: 'hidden', ...theme.shadows.md },
  buttonContent: { alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: theme.colors.primaryDark },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing.xxl },
  footerText: { ...theme.typography.body, color: theme.colors.textSecondary },
  linkText: { ...theme.typography.body, color: theme.colors.primaryDark, fontWeight: 'bold' },
  incompleteContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  incompleteTitle: { ...theme.typography.title, fontSize: 28, marginTop: theme.spacing.lg },
  incompleteText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  secondaryButton: { padding: theme.spacing.lg, marginTop: theme.spacing.sm },
  secondaryButtonText: { color: theme.colors.primaryDark, fontWeight: 'bold' },
});
