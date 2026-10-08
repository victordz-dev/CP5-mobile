import { useState } from 'react';
import { View, TextInput, Button, StyleSheet, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { register } from '../../services/authService';
import { createUserProfile } from '../../services/userService';
import { uploadImageAsync } from '../../services/storageService';
import { ErrorMessage } from '../../components/ErrorMessage';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError('Preencha todos os campos.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const userCredential = await register(email, password);
      const uid = userCredential.user.uid;

      let photoUrl = '';
      if (photoUri) {
        photoUrl = await uploadImageAsync(photoUri, `profiles/${uid}`);
      }

      await createUserProfile(uid, {
        name,
        email,
        photoUrl,
      });

    } catch (err) {
      const e = err as Error;
      setError(e.message || 'Erro ao realizar cadastro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Button title="Escolher Foto de Perfil" onPress={pickImage} />
      {photoUri && <Image source={{ uri: photoUri }} style={styles.image} />}
      
      <TextInput style={styles.input} placeholder="Nome" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      
      <TextInput style={styles.input} placeholder="Senha" value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput style={styles.input} placeholder="Confirmar Senha" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
      
      <ErrorMessage message={error} />
      <Button title={loading ? "Carregando..." : "Cadastrar"} onPress={handleRegister} disabled={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, justifyContent: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 5 },
  image: { width: 100, height: 100, borderRadius: 50, alignSelf: 'center', marginVertical: 10 },
});
