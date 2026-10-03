import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Store, UserCheck, KeyRound, Building2, ShoppingBag, User } from 'lucide-react';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'customer' | 'business_owner' | 'cashier'>('customer');
  const [branchCode, setBranchCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signIn, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.role === 'customer') {
        navigate('/');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      if (role === 'cashier' && !branchCode.trim()) {
        toast.error('Please enter your Branch Access Code before continuing with Google.');
        return;
      }
      setLoading(true);
      const targetRole = role === 'customer' ? undefined : (role as 'business_owner' | 'cashier');
      const { user, error } = await signInWithGoogle(targetRole, branchCode);
      if (error) {
        toast.error(error.message || 'Google Auth failed.');
      } else if (user) {
        toast.success('Signed in with Google!');
        navigate(user.role === 'customer' ? '/' : '/dashboard');
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
        const { user: signedInUser, error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Welcome back!');
          if (signedInUser?.role === 'customer') {
            navigate('/');
          } else {
            navigate('/dashboard');
          }
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

        const signUpRole = role === 'cashier' ? 'cashier' : 'business_owner';
        const { user: newCreatedUser, error } = await signUp(email, password, fullName, signUpRole, branchCode);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Account created successfully!');
          if (role === 'customer') {
            navigate('/');
          } else {
            navigate('/dashboard');
          }
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 py-8 font-sans">
      <Card className="w-full max-w-md shadow-xl border border-border/80">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 shadow-md">
            <Store className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-black">
            {isLogin ? 'Welcome Back' : 'Create Pocket Shop Account'}
          </CardTitle>
          <CardDescription className="text-xs">
            {isLogin
              ? 'Sign in to your customer shopping or store management account'
              : 'Choose account type to start shopping or managing branches'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Role Selector */}
          <div className="space-y-2">
            <Label className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">Account Type</Label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setRole('customer')}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-[11px] font-bold transition-all ${
                  role === 'customer'
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-border text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Customer</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('business_owner')}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-[11px] font-bold transition-all ${
                  role === 'business_owner'
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-border text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <Building2 className="h-4 w-4" />
                <span>Store Owner</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('cashier')}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-[11px] font-bold transition-all ${
                  role === 'cashier'
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-border text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <UserCheck className="h-4 w-4" />
                <span>Cashier</span>
              </button>
            </div>
          </div>

          {/* Branch Access Code Input when Cashier is selected */}
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
                className="font-mono uppercase font-bold tracking-wider"
              />
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-2 border-input py-5 hover:bg-muted/50 font-bold text-xs"
            disabled={loading}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
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

          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
              <span className="bg-card px-2 text-muted-foreground">Or with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Chukwuma Adebayo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                  className="h-10 text-xs"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs">Password</Label>
                {isLogin && (
                  <a
                    href="/forgot-password"
                    className="text-xs text-primary underline-offset-4 hover:underline font-semibold"
                  >
                    Forgot?
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
                className="h-10 text-xs"
              />
            </div>

            <Button type="submit" className="w-full py-5 font-bold text-sm" disabled={loading}>
              {loading
                ? 'Please wait...'
                : isLogin
                ? 'Sign In'
                : role === 'customer'
                ? 'Create Customer Account'
                : role === 'cashier'
                ? 'Join Branch as Cashier'
                : 'Create Owner Account'}
            </Button>
          </form>

          <div className="mt-4 text-center text-xs">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary underline-offset-4 hover:underline font-bold"
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
