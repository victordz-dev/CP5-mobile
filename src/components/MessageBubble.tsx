import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChatMessage } from '../types/chat';
import { theme } from '../theme';

type MessageBubbleProps = {
  message: ChatMessage;
  isMine: boolean;
  authorName?: string;
};

export const MessageBubble = memo(function MessageBubble({
  message,
  isMine,
  authorName,
}: MessageBubbleProps) {
  return (
    <View style={[styles.wrapper, isMine ? styles.wrapperMine : styles.wrapperTheirs]}>
      <View style={[styles.bubble, isMine ? styles.mine : styles.theirs]}>
        {authorName ? (
          <Text style={[styles.author, isMine && styles.authorMine]}>{authorName}</Text>
        ) : null}
        <Text style={[styles.text, isMine ? styles.textMine : styles.textTheirs]}>
          {message.text}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    marginVertical: theme.spacing.xs,
  },
  wrapperMine: { justifyContent: 'flex-end' },
  wrapperTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: 20,
    ...theme.shadows.sm,
  },
  mine: {
    backgroundColor: theme.colors.messageSent,
    borderBottomRightRadius: theme.spacing.xs,
  },
  theirs: {
    backgroundColor: theme.colors.messageReceived,
    borderBottomLeftRadius: theme.spacing.xs,
  },
  author: {
    ...theme.typography.caption,
    color: theme.colors.primaryDark,
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
  },
  authorMine: { color: 'rgba(255, 255, 255, 0.75)' },
  text: { ...theme.typography.body, lineHeight: 22 },
  textMine: { color: '#FFFFFF' },
  textTheirs: { color: theme.colors.text },
});
