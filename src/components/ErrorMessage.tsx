import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

type ErrorMessageProps = {
  message: string;
  onRetry?: () => void;
};

export const ErrorMessage = ({ message, onRetry }: ErrorMessageProps) => {
  if (!message) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} accessibilityRole="button">
          <Text style={styles.retry}>Tentar novamente</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: theme.borderRadius.md,
    marginVertical: theme.spacing.sm,
  },
  text: {
    color: '#991B1B',
    textAlign: 'center',
  },
  retry: {
    color: theme.colors.primaryDark,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
});
