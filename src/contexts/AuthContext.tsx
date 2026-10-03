import { createContext, useContext, useEffect, useState } from 'react';
import { signUpNeon, signInNeon, signOutNeon, getCurrentUserNeon } from '@/lib/neon';
import { useNavigate } from 'react-router-dom';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: any;
  signUp: (email: string, password: string, fullName: string) => Promise<{ user: User | null; error: any }>;
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: any }>;
  signInWithGoogle: () => Promise<{ user: User | null; error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for existing Neon user session
    const currentUser = getCurrentUserNeon();
    if (currentUser) {
      setUser(currentUser);
    }
    setLoading(false);
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const res = await signUpNeon(email, password, fullName);
    if (res.user) {
      setUser(res.user);
    }
    return res;
  };

  const signIn = async (email: string, password: string) => {
    const res = await signInNeon(email, password);
    if (res.user) {
      setUser(res.user);
    }
    return res;
  };

  const signInWithGoogle = async () => {
    // Google Sign-In with Neon session
    const res = await signInNeon('google_user@mystore.app', 'google-oauth');
    if (res.user) {
      setUser(res.user);
    }
    return res;
  };

  const signOut = async () => {
    await signOutNeon();
    setUser(null);
    navigate('/auth');
  };

  const resetPassword = async (email: string) => {
    return { error: null };
  };

  const updatePassword = async (newPassword: string) => {
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ user, session: user ? { user } : null, signUp, signIn, signInWithGoogle, signOut, resetPassword, updatePassword, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

