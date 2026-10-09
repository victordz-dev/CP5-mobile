export const theme = {
  colors: {
    primary: '#6366F1', // Indigo 500
    primaryLight: '#818CF8', // Indigo 400
    primaryDark: '#4F46E5', // Indigo 600
    background: '#F9FAFB', // Gray 50
    card: '#FFFFFF',
    text: '#111827', // Gray 900
    textSecondary: '#6B7280', // Gray 500
    border: '#E5E7EB', // Gray 200
    error: '#EF4444', // Red 500
    success: '#10B981', // Emerald 500
    messageReceived: '#FFFFFF',
    messageSent: '#6366F1',
    inputBackground: '#F3F4F6', // Gray 100
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    round: 9999,
  },
  typography: {
    title: {
      fontSize: 28,
      fontWeight: 'bold' as const,
      color: '#111827',
    },
    subtitle: {
      fontSize: 16,
      color: '#6B7280',
    },
    body: {
      fontSize: 15,
      color: '#111827',
    },
    caption: {
      fontSize: 13,
      color: '#9CA3AF',
    },
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 4,
    },
  }
};
