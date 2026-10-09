import { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { login } from '../../services/authService';
import { ErrorMessage } from '../../components/ErrorMessage';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      await login(email, password);
      // Navigation is handled by layout
    } catch {
      setError('Credenciais inválidas ou erro de rede. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <ErrorMessage message={error} />
      <Button title={loading ? "Carregando..." : "Entrar"} onPress={handleLogin} disabled={loading} />
      
      <View style={{ marginTop: 20 }}>
        <Text style={{ textAlign: 'center' }}>Não tem uma conta?</Text>
        <Button title="Criar conta" onPress={() => router.push('/(auth)/register')} color="#666" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
});
