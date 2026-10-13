import { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { theme } from '../theme';
import { ConversationType } from '../types/navigation';

export type ConversationListItemModel = {
  id: string;
  name: string;
  photoUrl?: string;
  type: ConversationType;
  otherUserId?: string;
};

type ConversationListItemProps = {
  item: ConversationListItemModel;
  onPress: (item: ConversationListItemModel) => void;
};

export const ConversationListItem = memo(function ConversationListItem({
  item,
  onPress,
}: ConversationListItemProps) {
  const isGroup = item.type === 'group';
  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={() => onPress(item)}>
      <View style={styles.avatarContainer}>
        <Avatar uri={item.photoUrl} style={styles.avatar} />
        {isGroup && (
          <View style={styles.groupBadge}>
            <Ionicons name="people" size={10} color="#FFFFFF" />
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.type}>{isGroup ? 'Grupo' : 'Conversa individual'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.border} />
    </TouchableOpacity>
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
  avatarContainer: { position: 'relative', marginRight: theme.spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  groupBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.card,
    borderRadius: 10,
    backgroundColor: theme.colors.primaryDark,
  },
  content: { flex: 1 },
  name: { ...theme.typography.body, fontWeight: 'bold', marginBottom: theme.spacing.xs },
  type: { ...theme.typography.caption },
});
