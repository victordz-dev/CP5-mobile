export type ConversationType = 'direct' | 'group';

export type ChatRouteParams = {
  id: string;
  type: ConversationType;
  name: string;
  photoUrl?: string;
  otherUserId?: string;
};

export type ProfileRouteParams = {
  userId?: string;
};

export type GroupDetailsRouteParams = {
  id: string;
};

export const chatRoute = (params: ChatRouteParams) => ({
  pathname: '/(main)/chat' as const,
  params,
});

export const profileRoute = (params: ProfileRouteParams = {}) => ({
  pathname: '/(main)/profile' as const,
  params,
});

export const groupDetailsRoute = (params: GroupDetailsRouteParams) => ({
  pathname: '/(main)/group-details' as const,
  params,
});
