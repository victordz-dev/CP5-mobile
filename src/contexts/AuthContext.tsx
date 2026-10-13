import { createContext, useState, useEffect, type ReactNode } from 'react';
import { AuthenticatedUser, observeAuthState } from '../services/authService';
import { listenToOwnUserProfile } from '../services/userService';
import { ChatUser } from '../types/user';

export type AuthContextType = {
  user: AuthenticatedUser | null;
  profile: ChatUser | null;
  loading: boolean;
  profileError: string;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  profileError: '',
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [profile, setProfile] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    const unsubscribe = observeAuthState((currentUser) => {
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;
      setUser(currentUser);
      setProfile(null);
      setProfileError('');

      if (!currentUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      unsubscribeProfile = listenToOwnUserProfile(currentUser.uid, (currentProfile) => {
        setProfile(currentProfile);
        if (currentProfile) {
          setProfileError('');
        }
        setLoading(false);
      }, (error) => {
        setProfileError(error.message);
        setLoading(false);
      });
    });

    return () => {
      unsubscribe();
      unsubscribeProfile?.();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileError }}>
      {children}
    </AuthContext.Provider>
  );
};
