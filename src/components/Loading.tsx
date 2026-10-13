import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

export const Loading = ({ message = 'Carregando...' }: { message?: string }) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primaryDark} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
});
