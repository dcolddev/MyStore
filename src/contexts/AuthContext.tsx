import { createContext, useContext, useEffect, useState } from 'react';
import { signUpNeon, signInNeon, signOutNeon, getCurrentUserNeon, joinBranchWithCodeNeon, deleteUserAccountNeon, updateUserRoleNeon } from '@/lib/neon';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role?: 'business_owner' | 'cashier' | 'pending';
  store_id?: string | null;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: any;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role?: 'business_owner' | 'cashier',
    branchAccessCode?: string
  ) => Promise<{ user: User | null; error: any }>;
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: any }>;
  signInWithGoogle: (
    preRole?: 'business_owner' | 'cashier',
    branchAccessCode?: string
  ) => Promise<{ user: User | null; error: any }>;
  joinBranchWithCode: (accessCode: string) => Promise<{ success: boolean; error?: string }>;
  updateUserRole: (
    role: 'business_owner' | 'cashier',
    branchAccessCode?: string
  ) => Promise<{ success: boolean; error?: string }>;
  deleteAccount: () => Promise<void>;
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

    // Check if returning from Google OAuth redirect with access token in URL hash
    if (window.location.hash.includes('access_token=')) {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = params.get('access_token');
      if (accessToken) {
        window.history.replaceState(null, '', window.location.pathname);

        const storedRole = (sessionStorage.getItem('google_auth_pre_role') as 'business_owner' | 'cashier') || undefined;
        const storedCode = sessionStorage.getItem('google_auth_branch_code') || undefined;
        sessionStorage.removeItem('google_auth_pre_role');
        sessionStorage.removeItem('google_auth_branch_code');

        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((res) => res.json())
          .then(async (googleUser) => {
            if (googleUser?.email) {
              const res = await signInNeon(
                googleUser.email,
                'google-oauth',
                googleUser.name || googleUser.email.split('@')[0],
                storedRole,
                storedCode
              );
              if (res.user) setUser(res.user);
            }
          })
          .catch((err) => console.error('Google OAuth profile error:', err));
      }
    }

    setLoading(false);
  }, []);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: 'business_owner' | 'cashier' = 'business_owner',
    branchAccessCode?: string
  ) => {
    const res = await signUpNeon(email, password, fullName, role, branchAccessCode);
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

  const joinBranchWithCode = async (accessCode: string) => {
    if (!user) return { success: false, error: 'Not logged in' };
    const res = await joinBranchWithCodeNeon(user.id, accessCode);
    if (res.success) {
      const updated = getCurrentUserNeon();
      if (updated) setUser(updated);
    }
    return res;
  };

  const updateUserRole = async (
    role: 'business_owner' | 'cashier',
    branchAccessCode?: string
  ) => {
    if (!user) return { success: false, error: 'Not logged in' };
    const res = await updateUserRoleNeon(user.id, role, branchAccessCode);
    if (res.success && res.user) {
      setUser(res.user as User);
    }
    return res;
  };

  const deleteAccount = async () => {
    if (!user) return;
    await deleteUserAccountNeon(user.id);
    setUser(null);
    toast.success('Your account has been deleted.');
    navigate('/auth');
  };

  const signInWithGoogle = async (
    preRole?: 'business_owner' | 'cashier',
    branchAccessCode?: string
  ): Promise<{ user: User | null; error: any }> => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '';

    if (preRole) sessionStorage.setItem('google_auth_pre_role', preRole);
    if (branchAccessCode) sessionStorage.setItem('google_auth_branch_code', branchAccessCode);

    return new Promise((resolve) => {
      // 1. Try Google Identity Services Token Client Popup first
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
        try {
          const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'email profile openid',
            callback: async (response: any) => {
              if (response.access_token) {
                try {
                  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${response.access_token}` },
                  });
                  const googleUser = await userInfoRes.json();
                  if (googleUser?.email) {
                    const res = await signInNeon(
                      googleUser.email,
                      'google-oauth',
                      googleUser.name || googleUser.email.split('@')[0],
                      preRole,
                      branchAccessCode
                    );
                    if (res.user) {
                      setUser(res.user);
                      resolve({ user: res.user, error: null });
                      return;
                    }
                  }
                } catch (fetchErr: any) {
                  resolve({ user: null, error: fetchErr });
                  return;
                }
              }
              resolve({ user: null, error: new Error(response.error || 'Google auth cancelled') });
            },
          });
          client.requestAccessToken();
          return;
        } catch (e) {
          console.warn('GIS Token client error, falling back to redirect:', e);
        }
      }

      // 2. Fallback: Standard Google OAuth 2.0 Redirect
      const redirectUri = encodeURIComponent(`${window.location.origin}/auth`);
      const googleOAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=email%20profile%20openid&prompt=select_account`;
      window.location.href = googleOAuthUrl;
      resolve({ user: null, error: null });
    });
  };

  const signOut = async () => {
    await signOutNeon();
    setUser(null);
    toast.success('Logged out successfully!');
    navigate('/auth');
  };

  const resetPassword = async (email: string) => {
    return { error: null };
  };

  const updatePassword = async (newPassword: string) => {
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ user, session: user ? { user } : null, signUp, signIn, signInWithGoogle, joinBranchWithCode, deleteAccount, signOut, resetPassword, updatePassword, loading }}>
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


