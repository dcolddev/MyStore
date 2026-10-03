import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getNeonSql } from '@/lib/neon';
import { db } from '@/lib/db';
import { syncWithServer } from '@/lib/sync';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Store, Package, ShoppingCart, DollarSign, AlertCircle, TrendingUp, LogOut, Plus, Layers, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface DashboardStats {
  totalSales: number;
  totalExpenses: number;
  profit: number;
  transactionCount: number;
  lowStockCount: number;
  weekTotalSales?: number;
  weekTotalExpenses?: number;
  weekProfit?: number;
}

interface StoreRecord {
  id: string;
  name: string;
  location?: string | null;
  owner_id?: string;
  created_at?: string;
  updated_at?: string | null;
}

const Dashboard = () => {
  const { user, signOut, updateUserRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [store, setStore] = useState<StoreRecord | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalExpenses: 0,
    profit: 0,
    transactionCount: 0,
    lowStockCount: 0,
  });
  const [loading, setLoading] = useState(true);

  // Pending Role Selection Modal (Google Auth)
  const [pendingRole, setPendingRole] = useState<'customer' | 'business_owner'>('business_owner');
  const [updatingRole, setUpdatingRole] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (user?.role === 'customer') {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const handlePendingRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingRole(true);
    const res = await updateUserRole(pendingRole);
    setUpdatingRole(false);

    if (res.success) {
      if (pendingRole === 'customer') {
        toast.success('Account setup complete as Customer!');
        navigate('/');
      } else {
        toast.success('Account setup complete as Admin!');
        loadStore();
      }
    } else {
      toast.error(res.error || 'Failed to complete role setup');
    }
  };

  const loadStore = useCallback(async () => {
    if (!user) return;
    try {
      let storeList: StoreRecord[] = [];
      const sql = getNeonSql();

      if (navigator.onLine && sql) {
        try {
          const res = await sql`SELECT * FROM stores WHERE owner_id = ${user.id} ORDER BY created_at DESC LIMIT 1`;
          storeList = res as StoreRecord[];
        } catch (err) {
          console.warn('Neon stores query notice, fallback to local DB:', err);
        }
      }

      if (storeList.length === 0) {
        storeList = (await db.stores.toArray()) as StoreRecord[];
      }

      if (storeList.length > 0) {
        setStore(storeList[0]);
      } else {
        setStore(null);
      }
    } catch (error: any) {
      console.error('Error loading store:', error);
      const localStores = (await db.stores.toArray()) as StoreRecord[];
      if (localStores.length > 0) setStore(localStores[0]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadDashboardStats = useCallback(async () => {
    if (!user || !store) return;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const sql = getNeonSql();
      let salesData: any[] = [];
      let expensesData: any[] = [];
      let productsData: any[] = [];

      if (navigator.onLine && sql) {
        try {
          salesData = await sql`SELECT * FROM sales WHERE store_id = ${store.id} ORDER BY sale_date DESC`;
          expensesData = await sql`SELECT * FROM expenses WHERE store_id = ${store.id} ORDER BY expense_date DESC`;
          productsData = await sql`SELECT * FROM products WHERE store_id = ${store.id} AND quantity <= reorder_level`;
        } catch (err) {
          console.warn('Neon stats query fallback:', err);
        }
      }

      if (salesData.length === 0 && expensesData.length === 0) {
        const localSales = await db.sales.toArray();
        const localExpenses = await db.expenses.toArray();
        const localProducts = await db.products.toArray();

        salesData = localSales.filter((s) => s.store_id === store.id);
        expensesData = localExpenses.filter((e) => e.store_id === store.id);
        productsData = localProducts.filter((p) => p.store_id === store.id && p.quantity <= (p.reorder_level || 5));
      }

      const todaySales = salesData.filter((s) => new Date(s.sale_date) >= today);
      const weekSales = salesData.filter((s) => new Date(s.sale_date) >= weekAgo);
      const todayExpenses = expensesData.filter((e) => new Date(e.expense_date) >= today);
      const weekExpenses = expensesData.filter((e) => new Date(e.expense_date) >= weekAgo);

      const todayTotalSales = todaySales.reduce((sum, sale) => sum + Number(sale.total_revenue), 0);
      const todayTotalExpenses = todayExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
      const todayProfit = todaySales.reduce((sum, sale) => sum + Number(sale.profit), 0);
      const weekTotalSales = weekSales.reduce((sum, sale) => sum + Number(sale.total_revenue), 0);
      const weekTotalExpenses = weekExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
      const weekProfit = weekSales.reduce((sum, sale) => sum + Number(sale.profit), 0);

      setStats({
        totalSales: todayTotalSales,
        totalExpenses: todayTotalExpenses,
        profit: todayProfit - todayTotalExpenses,
        transactionCount: todaySales.length,
        lowStockCount: productsData.length,
        weekTotalSales,
        weekTotalExpenses,
        weekProfit: weekProfit - weekTotalExpenses,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [user, store]);

  useEffect(() => {
    if (user) {
      loadStore();
      syncWithServer(user);
    }
  }, [user]);

  useEffect(() => {
    if (store) {
      loadDashboardStats();
    }
  }, [store, loadDashboardStats]);

  const handleCreateStore = async () => {
    if (!user) return;
    try {
      const sql = getNeonSql();
      const storeId = crypto.randomUUID();
      const newStore = { id: storeId, name: 'My E-Commerce Store', location: 'Online', owner_id: user.id };
      
      if (navigator.onLine && sql) {
        await sql`INSERT INTO stores (id, name, location, owner_id) VALUES (${storeId}, ${newStore.name}, ${newStore.location}, ${user.id})`;
      }
      await db.stores.add(newStore as any);
      setStore(newStore as any);
      toast.success('Store profile initialized!');
    } catch (err: any) {
      toast.error('Failed to initialize store profile');
    }
  };

  if (authLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground font-medium">Loading store manager...</div>;
  }

  if (!store && user?.role !== 'pending') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full shadow-xl border-border/80">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-7 w-7" />
            </div>
            <CardTitle className="text-xl font-bold">Welcome to Pocket Shop Admin</CardTitle>
            <CardDescription>Initialize your e-commerce store profile to start managing products and orders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <Button onClick={handleCreateStore} className="w-full font-bold gap-2 py-5">
              <Plus className="h-4 w-4" />
              <span>Initialize Store Profile</span>
            </Button>
            <Button variant="ghost" onClick={signOut} className="w-full text-xs text-muted-foreground">Logout</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto flex items-center justify-between p-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight">{store?.name || 'E-Commerce Admin'}</h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">👔 Admin</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Store Management Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={signOut} className="text-destructive hover:bg-destructive/10 border-destructive/20 gap-1.5 font-medium text-xs">
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-6xl space-y-6">
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-primary text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <Badge className="bg-white/20 text-white font-black text-xs mb-1">E-COMMERCE ADMIN</Badge>
            <h2 className="text-2xl font-black tracking-tight flex items-center justify-center md:justify-start gap-2">
              <ShoppingCart className="h-6 w-6" />
              Manage Your Storefront
            </h2>
            <p className="text-xs text-blue-100 font-medium">Manage your product catalog, view online sales, and track inventory.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/')} variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold">
              View Storefront
            </Button>
            <Button onClick={() => navigate('/products/new')} className="bg-white text-blue-600 hover:bg-slate-100 font-black shadow-lg">
              <Plus className="h-4 w-4 mr-1" /> Add Product
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-xs uppercase font-bold text-muted-foreground"><ShoppingCart className="h-4 w-4 text-emerald-500" />Sales Today</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-extrabold text-success">₦{stats.totalSales.toFixed(2)}</div><p className="text-xs text-muted-foreground">{stats.transactionCount} transactions today</p></CardContent>
          </Card>
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-xs uppercase font-bold text-muted-foreground"><DollarSign className="h-4 w-4 text-destructive" />Expenses Today</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-extrabold text-destructive">₦{stats.totalExpenses.toFixed(2)}</div><p className="text-xs text-muted-foreground">Today's costs</p></CardContent>
          </Card>
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-xs uppercase font-bold text-muted-foreground"><TrendingUp className="h-4 w-4 text-primary" />Net Profit</CardTitle></CardHeader>
            <CardContent><div className={`text-2xl font-extrabold ${stats.profit >= 0 ? 'text-success' : 'text-destructive'}`}>₦{stats.profit.toFixed(2)}</div><p className="text-xs text-muted-foreground">Net today</p></CardContent>
          </Card>
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-xs uppercase font-bold text-muted-foreground"><AlertCircle className="h-4 w-4 text-primary" />Low Stock</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-extrabold text-primary">{stats.lowStockCount}</div><p className="text-xs text-muted-foreground">Items needing restock</p></CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base font-bold flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />This Week's Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1"><p className="text-xs text-muted-foreground font-medium uppercase">Weekly Total Sales</p><p className="text-2xl font-extrabold text-foreground">₦{(stats.weekTotalSales || 0).toFixed(2)}</p></div>
              <div className="space-y-1"><p className="text-xs text-muted-foreground font-medium uppercase">Weekly Expenses</p><p className="text-2xl font-extrabold text-destructive">₦{(stats.weekTotalExpenses || 0).toFixed(2)}</p></div>
              <div className="space-y-1"><p className="text-xs text-muted-foreground font-medium uppercase">Grand Net Profit</p><p className="text-2xl font-extrabold text-success">₦{(stats.weekProfit || 0).toFixed(2)}</p></div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button onClick={() => navigate('/products')} variant="outline" className="h-24 flex-col gap-2 border-border hover:border-primary/40"><Package className="h-8 w-8 text-primary" /><span className="font-bold">Manage Products</span></Button>
          <Button onClick={() => navigate('/sales/history')} variant="outline" className="h-24 flex-col gap-2 border-border hover:border-emerald-500/40"><TrendingUp className="h-8 w-8 text-emerald-500" /><span className="font-bold">Sales & Orders History</span></Button>
          <Button onClick={() => navigate('/expenses')} variant="outline" className="h-24 flex-col gap-2 border-border hover:border-destructive/40"><DollarSign className="h-8 w-8 text-destructive" /><span className="font-bold">Manage Expenses</span></Button>
        </div>
      </div>

      <Dialog open={Boolean(user && (!user.role || user.role === 'pending'))}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-center space-y-1">
            <DialogTitle className="text-xl font-bold">Complete Your Account Setup</DialogTitle>
            <DialogDescription>Please choose your account type to proceed.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePendingRoleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select Account Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPendingRole('customer')} className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-bold transition-all text-center ${pendingRole === 'customer' ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border text-muted-foreground hover:bg-muted/50'}`}>
                  <ShoppingCart className="h-6 w-6" /><span>Customer</span>
                </button>
                <button type="button" onClick={() => setPendingRole('business_owner')} className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-bold transition-all text-center ${pendingRole === 'business_owner' ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border text-muted-foreground hover:bg-muted/50'}`}>
                  <Building2 className="h-6 w-6" /><span>Store Admin</span>
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full py-5 font-extrabold" disabled={updatingRole}>
              {updatingRole ? 'Setting up account...' : 'Complete Setup & Continue'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
