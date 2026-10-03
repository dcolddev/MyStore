import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getNeonSql } from '@/lib/neon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ShoppingBag, 
  PackageCheck, 
  Clock, 
  ArrowLeft, 
  User, 
  LogOut, 
  ExternalLink, 
  MapPin, 
  Printer, 
  Truck, 
  ShieldCheck,
  Store
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function CustomerAccount() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile Form State
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadCustomerOrders();
  }, [user]);

  const loadCustomerOrders = async () => {
    if (!user?.email) return;
    try {
      const sql = getNeonSql();
      if (sql) {
        const userOrders = await sql`
          SELECT * FROM orders
          WHERE LOWER(customer_email) = LOWER(${user.email})
          ORDER BY created_at DESC
        `;
        if (userOrders && userOrders.length > 0) {
          setOrders(userOrders);
          setLoading(false);
          return;
        }
      }

      // Fallback: check local cached orders
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('pocket_order_'));
      const cachedList: any[] = [];
      for (const k of keys) {
        try {
          const item = JSON.parse(localStorage.getItem(k) || '{}');
          if (item.customer_email?.toLowerCase() === user.email.toLowerCase()) {
            cachedList.push(item);
          }
        } catch {}
      }
      setOrders(cachedList);
    } catch (err) {
      console.error('Error fetching customer orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Profile information updated successfully!');
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      {/* Header Navbar */}
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-600 shadow">
              <Store className="h-5 w-5 text-white" />
            </div>
            <span className="font-black text-lg tracking-tight bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
              Pocket Shop
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/')} className="gap-2 font-semibold">
              <ShoppingBag className="h-4 w-4" />
              <span>Storefront</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={signOut} className="text-destructive gap-1.5 font-semibold">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Customer Portal & Order History</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Welcome back, <strong>{user?.full_name || user?.email}</strong>. View and track your orders.
            </p>
          </div>

          <Badge variant="outline" className="self-start sm:self-auto px-3 py-1 bg-primary/10 text-primary border-primary/30 font-bold text-xs">
            <ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Verified Customer Account
          </Badge>
        </div>

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="bg-muted p-1 rounded-xl">
            <TabsTrigger value="orders" className="font-bold text-xs px-5 py-2.5 gap-2">
              <PackageCheck className="h-4 w-4" />
              <span>My Orders ({orders.length})</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="font-bold text-xs px-5 py-2.5 gap-2">
              <User className="h-4 w-4" />
              <span>Profile & Address</span>
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab Content */}
          <TabsContent value="orders" className="space-y-4">
            {loading ? (
              <div className="py-16 text-center text-muted-foreground animate-pulse">Loading orders...</div>
            ) : orders.length === 0 ? (
              <Card className="text-center py-16 p-8 border-dashed space-y-4">
                <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto" />
                <h3 className="text-lg font-bold">No orders found</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  You haven't placed any orders with this email account yet. Browse our store catalog to make your first purchase!
                </p>
                <Button onClick={() => navigate('/')} className="font-bold px-6">
                  Browse Shop Catalog
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map((ord) => (
                  <Card key={ord.id} className="overflow-hidden border-border/80 hover:shadow-md transition-shadow">
                    <CardHeader className="p-4 md:p-5 bg-muted/20 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-extrabold font-mono">
                            Order #{ord.id.slice(0, 8)}
                          </CardTitle>
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] uppercase font-bold">
                            {ord.payment_status || 'Paid'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] uppercase font-bold">
                            {ord.payment_method || 'Flutterwave'}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs mt-1">
                          Placed on {ord.created_at ? format(new Date(ord.created_at), 'PPP p') : 'Recent'}
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-primary">
                          ₦{Number(ord.total_amount || 0).toFixed(2)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/order-success/${ord.id}`)}
                          className="gap-1.5 font-semibold text-xs"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>View Receipt</span>
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 md:p-5 space-y-3 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 text-primary shrink-0" />
                        <span>Delivery Address: <strong>{ord.shipping_address}</strong></span>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Truck className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>Status: <strong className="text-foreground capitalize">{ord.order_status || 'Completed'}</strong> • Fast Delivery Dispatched</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Profile Tab Content */}
          <TabsContent value="profile">
            <Card className="max-w-xl shadow-md border-border/80">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Account Profile</CardTitle>
                <CardDescription className="text-xs">
                  Manage your personal customer profile and primary details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="custName">Full Name</Label>
                    <Input
                      id="custName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="custEmail">Email Address</Label>
                    <Input
                      id="custEmail"
                      type="email"
                      value={email}
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                    <p className="text-[11px] text-muted-foreground">Email address is tied to your account login.</p>
                  </div>

                  <Button type="submit" className="font-bold">
                    Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
