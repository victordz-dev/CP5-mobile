import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushRegistrationResult =
  | { status: 'registered'; token: string }
  | { status: 'denied' | 'unsupported' };

export type NotificationConversationData = {
  conversationId: string;
  conversationType: 'direct' | 'group';
  name: string;
};

const pushTokenStorageKey = (userId: string) => `push-token:${userId}`;

function getProjectId(): string {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId;

  if (typeof projectId !== 'string' || projectId.trim() === '') {
    throw new Error('O identificador do projeto EAS não está configurado para notificações.');
  }
  return projectId;
}

function getDeviceDocumentId(token: string): string {
  return token.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function parseNotificationConversationData(data: unknown): NotificationConversationData | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const record = data as Record<string, unknown>;
  if (
    typeof record.conversationId !== 'string'
    || record.conversationId.trim() === ''
    || (record.conversationType !== 'direct' && record.conversationType !== 'group')
  ) {
    return null;
  }

  return {
    conversationId: record.conversationId,
    conversationType: record.conversationType,
    name: typeof record.name === 'string' && record.name.trim() !== '' ? record.name : 'Chat',
  };
}

export async function registerForPushNotificationsAsync(userId: string): Promise<PushRegistrationResult> {
  if (!userId.trim()) {
    throw new Error('Não foi possível associar as notificações ao usuário.');
  }

  if (!Device.isDevice || (Platform.OS !== 'android' && Platform.OS !== 'ios')) {
    Alert.alert('Aviso', 'Utilize um dispositivo físico Android ou iOS para notificações push.');
    return { status: 'unsupported' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    await disablePushNotificationsAsync(userId);
    Alert.alert('Permissão negada', 'Ative as notificações nas configurações do aparelho para receber novas mensagens.');
    return { status: 'denied' };
  }

  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: getProjectId(),
  })).data;
  const previousToken = await AsyncStorage.getItem(pushTokenStorageKey(userId));
  if (previousToken && previousToken !== token) {
    const previousDeviceDoc = doc(
      firestore,
      'users',
      userId,
      'devices',
      getDeviceDocumentId(previousToken),
    );
    await setDoc(previousDeviceDoc, {
      token: previousToken,
      platform: Platform.OS,
      enabled: false,
      updatedAt: Date.now(),
    }, { merge: true });
  }
  const deviceDoc = doc(firestore, 'users', userId, 'devices', getDeviceDocumentId(token));
  await setDoc(deviceDoc, {
    token,
    platform: Platform.OS,
    enabled: true,
    updatedAt: Date.now(),
  }, { merge: true });
  await AsyncStorage.setItem(pushTokenStorageKey(userId), token);

  return { status: 'registered', token };
}

export async function disablePushNotificationsAsync(userId: string): Promise<void> {
  const token = await AsyncStorage.getItem(pushTokenStorageKey(userId));
  if (!token || (Platform.OS !== 'android' && Platform.OS !== 'ios')) {
    return;
  }

  const deviceDoc = doc(firestore, 'users', userId, 'devices', getDeviceDocumentId(token));
  await setDoc(deviceDoc, {
    token,
    platform: Platform.OS,
    enabled: false,
    updatedAt: Date.now(),
  }, { merge: true });
  await AsyncStorage.removeItem(pushTokenStorageKey(userId));
}
