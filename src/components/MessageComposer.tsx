import { ActivityIndicator, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

type MessageComposerProps = {
  value: string;
  sending: boolean;
  disabled?: boolean;
  onChangeText: (value: string) => void;
  onSend: () => void;
};

export function MessageComposer({
  value,
  sending,
  disabled = false,
  onChangeText,
  onSend,
}: MessageComposerProps) {
  const cannotSend = disabled || sending || value.trim().length === 0;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={disabled ? 'Conversa indisponível' : 'Digite uma mensagem...'}
        placeholderTextColor={theme.colors.textSecondary}
        editable={!disabled && !sending}
        multiline
        maxLength={10_000}
      />
      <TouchableOpacity
        accessibilityLabel="Enviar mensagem"
        accessibilityRole="button"
        style={[styles.sendButton, cannotSend && styles.sendButtonDisabled]}
        onPress={onSend}
        disabled={cannotSend}
      >
        {sending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons
            name="send"
            size={20}
            color={cannotSend ? theme.colors.textSecondary : '#FFFFFF'}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: theme.spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? theme.spacing.xl : theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    marginRight: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: theme.colors.inputBackground,
    color: theme.colors.text,
    fontSize: 16,
  },
  sendButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: theme.colors.primaryDark,
    ...theme.shadows.sm,
  },
  sendButtonDisabled: { backgroundColor: theme.colors.inputBackground },
});
