import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Store, UserCheck, KeyRound, Building2 } from 'lucide-react';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'business_owner' | 'cashier'>('business_owner');
  const [branchCode, setBranchCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signIn, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const { user, error } = await signInWithGoogle();
      if (error) {
        toast.error(error.message || 'Google Auth failed.');
      } else if (user) {
        toast.success('Signed in with Google!');
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during Google sign-in');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Welcome back!');
          navigate('/dashboard');
        }
      } else {
        if (!fullName.trim()) {
          toast.error('Please enter your full name');
          setLoading(false);
          return;
        }

        if (role === 'cashier' && !branchCode.trim()) {
          toast.error('Please enter your Branch Access Code');
          setLoading(false);
          return;
        }

        const { error } = await signUp(email, password, fullName, role, branchCode);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Account created! You can now access your dashboard.');
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border border-border/60">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Store className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? 'Sign in to manage your stores and branches'
              : 'Sign up as a Business Owner or Cashier'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-2 border-input py-5 hover:bg-muted/50"
            disabled={loading}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                {/* Role Selector */}
                <div className="space-y-2">
                  <Label>Select Account Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('business_owner')}
                      className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 text-xs font-semibold transition-all ${
                        role === 'business_owner'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <Building2 className="h-5 w-5" />
                      <span>Business Owner</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('cashier')}
                      className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 text-xs font-semibold transition-all ${
                        role === 'cashier'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <UserCheck className="h-5 w-5" />
                      <span>Store Cashier</span>
                    </button>
                  </div>
                </div>

                {/* Branch Code input for cashier */}
                {role === 'cashier' && (
                  <div className="space-y-2 p-3 bg-muted/40 rounded-xl border border-primary/20">
                    <Label htmlFor="branchCode" className="flex items-center gap-1.5 text-xs font-bold text-primary">
                      <KeyRound className="h-3.5 w-3.5" />
                      Branch Access Code (Provided by Owner)
                    </Label>
                    <Input
                      id="branchCode"
                      type="text"
                      placeholder="e.g. BR-8X92K"
                      value={branchCode}
                      onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                      required={role === 'cashier'}
                      className="font-mono uppercase font-bold tracking-wider"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Ask your business owner for your branch's 5-character access code to connect.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {isLogin && (
                  <a
                    href="/forgot-password"
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </a>
                )}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full py-5 font-bold" disabled={loading}>
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : role === 'cashier' ? 'Join Branch as Cashier' : 'Create Owner Account'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary underline-offset-4 hover:underline font-semibold"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;

