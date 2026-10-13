import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Avatar } from './Avatar';
import { ChatUser } from '../types/user';
import { theme } from '../theme';

type UserListItemProps = {
  user: ChatUser;
  subtitle?: string;
  action?: ReactNode;
  onPress: (user: ChatUser) => void;
};

export const UserListItem = memo(function UserListItem({
  user,
  subtitle,
  action,
  onPress,
}: UserListItemProps) {
  return (
    <View style={styles.item}>
      <TouchableOpacity style={styles.mainAction} activeOpacity={0.7} onPress={() => onPress(user)}>
        <Avatar uri={user.photoUrl} style={styles.avatar} />
        <View style={styles.content}>
          <Text style={styles.name}>{user.name || 'Usuário sem nome'}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </TouchableOpacity>
      {action}
    </View>
  );
});

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.card,
    ...theme.shadows.sm,
  },
  mainAction: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: theme.spacing.md,
  },
  content: { flex: 1 },
  name: { ...theme.typography.body, fontWeight: 'bold', marginBottom: theme.spacing.xs },
  subtitle: { ...theme.typography.caption },
});
