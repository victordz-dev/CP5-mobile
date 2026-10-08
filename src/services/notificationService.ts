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

export async function registerForPushNotificationsAsync(userId: string) {
  let token;

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Permissão Negada', 'Não foi possível obter token de Push Notification.');
      return;
    }
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId || '8b9f0a21-c121-4f3b-b2f5-b3e248cd9b82'
    })).data;
  } else {
    Alert.alert('Aviso', 'Utilize um dispositivo físico para Push Notifications.');
  }

  if (token) {
    // Save to Firestore
    const deviceId = Device.osBuildId || Device.osInternalBuildId || 'unknown-device';
    const deviceDoc = doc(firestore, `users/${userId}/devices/${deviceId}`);
    await setDoc(deviceDoc, {
      token,
      platform: Platform.OS,
      enabled: true,
      updatedAt: Date.now()
    }, { merge: true });
  }

  return token;
}
