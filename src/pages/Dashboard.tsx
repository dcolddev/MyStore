import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getNeonSql, 
  getStoreCashiersNeon, 
  removeCashierFromStoreNeon, 
  deleteStoreBranchNeon, 
  generateAccessCode 
} from '@/lib/neon';
import { db } from '@/lib/db';
import { syncWithServer } from '@/lib/sync';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Store, 
  Package, 
  ShoppingCart, 
  DollarSign, 
  AlertCircle,
  TrendingUp,
  LogOut,
  Plus,
  Copy,
  Users,
  Building2,
  KeyRound,
  Trash2,
  UserCheck,
  Globe,
  Layers,
  UserX,
  UserMinus
} from 'lucide-react';
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
  access_code?: string | null;
  created_at?: string;
  updated_at?: string | null;
}

interface CashierRecord {
  id: string;
  email: string;
  full_name?: string;
  created_at?: string;
}

const Dashboard = () => {
  const { user, signOut, joinBranchWithCode, deleteAccount, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { storeId } = useParams();

  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreRecord | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'all_branches'>('single');
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalExpenses: 0,
    profit: 0,
    transactionCount: 0,
    lowStockCount: 0,
  });
  const [cashiers, setCashiers] = useState<CashierRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Cashier Branch Join Modal
  const [isJoinBranchOpen, setIsJoinBranchOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joiningBranch, setJoiningBranch] = useState(false);

  // Account Deletion Dialog
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const loadStores = useCallback(async () => {
    if (!user) return;

    try {
      let storeList: StoreRecord[] = [];
      const sql = getNeonSql();

      if (navigator.onLine && sql) {
        try {
          if (user.role === 'cashier') {
            if (user.store_id) {
              const res = await sql`SELECT * FROM stores WHERE id = ${user.store_id}`;
              storeList = res as StoreRecord[];
            } else {
              const res = await sql`
                SELECT s.* FROM stores s
                INNER JOIN store_cashiers sc ON sc.store_id = s.id
                WHERE sc.cashier_id = ${user.id}
              `;
              storeList = res as StoreRecord[];
            }
          } else {
            // Business Owner: load all owned stores
            const res = await sql`SELECT * FROM stores WHERE owner_id = ${user.id} ORDER BY created_at DESC`;
            storeList = res as StoreRecord[];

            // Ensure access code exists for all stores
            for (const st of storeList) {
              if (!st.access_code) {
                const newCode = generateAccessCode();
                await sql`UPDATE stores SET access_code = ${newCode} WHERE id = ${st.id}`;
                st.access_code = newCode;
              }
            }
          }
        } catch (err) {
          console.warn('Neon stores query notice, fallback to local DB:', err);
        }
      }

      if (storeList.length === 0) {
        storeList = (await db.stores.toArray()) as StoreRecord[];
      }

      setStores(storeList);

      if (storeList.length > 0) {
        const matched = storeId ? storeList.find((s) => s.id === storeId) : storeList[0];
        setSelectedStore(matched || storeList[0]);
      } else if (user.role === 'cashier') {
        setIsJoinBranchOpen(true);
      }
    } catch (error: any) {
      console.error('Error loading stores:', error);
      const localStores = (await db.stores.toArray()) as StoreRecord[];
      setStores(localStores);
      if (localStores.length > 0) setSelectedStore(localStores[0]);
    } finally {
      setLoading(false);
    }
  }, [user, storeId]);

  const loadDashboardStats = useCallback(async () => {
    if (!user) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      let targetStoreIds: string[] = [];
      if (viewMode === 'all_branches' && user.role === 'business_owner') {
        targetStoreIds = stores.map((s) => s.id);
      } else if (selectedStore) {
        targetStoreIds = [selectedStore.id];
      }

      if (targetStoreIds.length === 0) return;

      const sql = getNeonSql();
      let salesData: any[] = [];
      let expensesData: any[] = [];
      let productsData: any[] = [];

      if (navigator.onLine && sql) {
        try {
          salesData = await sql`
            SELECT * FROM sales
            WHERE store_id = ANY(${targetStoreIds})
            ORDER BY sale_date DESC
          `;
          expensesData = await sql`
            SELECT * FROM expenses
            WHERE store_id = ANY(${targetStoreIds})
            ORDER BY expense_date DESC
          `;
          productsData = await sql`
            SELECT * FROM products
            WHERE store_id = ANY(${targetStoreIds}) AND quantity <= reorder_level
          `;
        } catch (err) {
          console.warn('Neon stats query fallback:', err);
        }
      }

      if (salesData.length === 0 && expensesData.length === 0) {
        const localSales = await db.sales.toArray();
        const localExpenses = await db.expenses.toArray();
        const localProducts = await db.products.toArray();

        salesData = localSales.filter((s) => targetStoreIds.includes(s.store_id));
        expensesData = localExpenses.filter((e) => targetStoreIds.includes(e.store_id));
        productsData = localProducts.filter((p) => targetStoreIds.includes(p.store_id) && p.quantity <= (p.reorder_level || 5));
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

      // Load Cashiers if single store view
      if (selectedStore && viewMode === 'single') {
        const cList = await getStoreCashiersNeon(selectedStore.id);
        setCashiers(cList as any[]);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [user, stores, selectedStore, viewMode]);

  useEffect(() => {
    if (user) {
      loadStores();
      syncWithServer(user);
    }
  }, [user]);

  useEffect(() => {
    if (stores.length > 0) {
      loadDashboardStats();
    }
  }, [stores, selectedStore, viewMode, loadDashboardStats]);

  const handleCopyAccessCode = (code?: string | null) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast.success(`Access Code ${code} copied to clipboard! Share with your branch cashier.`);
  };

  const handleJoinBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;

    setJoiningBranch(true);
    const res = await joinBranchWithCode(joinCodeInput.trim());
    setJoiningBranch(false);

    if (res.success) {
      toast.success(`Joined branch "${res.store?.name}" successfully!`);
      setIsJoinBranchOpen(false);
      loadStores();
    } else {
      toast.error(res.error || 'Failed to join branch with access code');
    }
  };

  const handleRemoveCashier = async (cashierId: string) => {
    const res = await removeCashierFromStoreNeon(cashierId);
    if (res.success) {
      toast.success('Cashier removed from store branch.');
      if (selectedStore) {
        const updated = await getStoreCashiersNeon(selectedStore.id);
        setCashiers(updated as any[]);
      }
    } else {
      toast.error('Failed to remove cashier.');
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (!user) return;
    const res = await deleteStoreBranchNeon(branchId, user.id);
    if (res.success) {
      await db.stores.delete(branchId);
      toast.success('Store branch deleted.');
      const remaining = stores.filter((s) => s.id !== branchId);
      setStores(remaining);
      if (remaining.length > 0) {
        setSelectedStore(remaining[0]);
        navigate(`/stores/${remaining[0].id}`);
      } else {
        setSelectedStore(null);
        navigate('/dashboard');
      }
    } else {
      toast.error('Failed to delete store branch.');
    }
  };

  const handleCreateStore = () => {
    navigate('/stores/new');
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground font-medium">Loading store manager...</div>
      </div>
    );
  }

  if (!selectedStore && stores.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full shadow-xl border-border/80">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-7 w-7" />
            </div>
            <CardTitle className="text-xl font-bold">Welcome to Pocket Shop Manager</CardTitle>
            <CardDescription>
              {user?.role === 'cashier'
                ? 'Join a store branch using the Access Code provided by your Business Owner.'
                : 'Create your first store branch to start managing products, POS sales, and grand total profits.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {user?.role === 'cashier' ? (
              <Button onClick={() => setIsJoinBranchOpen(true)} className="w-full font-bold gap-2 py-5">
                <KeyRound className="h-4 w-4" />
                <span>Enter Branch Access Code</span>
              </Button>
            ) : (
              <Button onClick={handleCreateStore} className="w-full font-bold gap-2 py-5">
                <Plus className="h-4 w-4" />
                <span>Create First Branch</span>
              </Button>
            )}

            <Button variant="ghost" onClick={signOut} className="w-full text-xs text-muted-foreground">
              Logout
            </Button>
          </CardContent>
        </Card>

        {/* Join Branch Dialog for Cashier */}
        <Dialog open={isJoinBranchOpen} onOpenChange={setIsJoinBranchOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Join Store Branch
              </DialogTitle>
              <DialogDescription>
                Ask your Business Owner for the 5-character Branch Access Code (e.g. BR-8X92K).
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleJoinBranchSubmit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="code">Branch Access Code</Label>
                <Input
                  id="code"
                  placeholder="BR-8X92K"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  className="font-mono uppercase font-bold tracking-widest text-center text-lg"
                  required
                />
              </div>
              <Button type="submit" className="w-full font-bold" disabled={joiningBranch}>
                {joiningBranch ? 'Connecting...' : 'Join Store Branch'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Bar */}
      <header className="border-b bg-card sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto flex items-center justify-between p-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight">
                  {viewMode === 'all_branches' ? 'All Branches Overview' : selectedStore?.name}
                </h1>
                {user?.role === 'business_owner' ? (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                    👔 Owner
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold">
                    💳 Cashier
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {viewMode === 'all_branches' ? `${stores.length} Global Branch(es)` : selectedStore?.location || 'Main Location'}
              </p>
            </div>

            {/* Branch Selector Dropdown for Owner */}
            {user?.role === 'business_owner' && stores.length > 0 && (
              <div className="flex items-center gap-2 pl-3 border-l border-border/80">
                <select
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={viewMode === 'all_branches' ? 'all_branches' : selectedStore?.id}
                  onChange={(e) => {
                    if (e.target.value === 'all_branches') {
                      setViewMode('all_branches');
                    } else {
                      setViewMode('single');
                      const found = stores.find((s) => s.id === e.target.value);
                      if (found) {
                        setSelectedStore(found);
                        navigate(`/stores/${found.id}`);
                      }
                    }
                  }}
                >
                  <option value="all_branches">🌐 ALL BRANCHES GRAND TOTAL ({stores.length})</option>
                  <optgroup label="Select Specific Branch">
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        📍 {store.name} ({store.location || 'Branch'})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Create Branch button (Owner Only) */}
            {user?.role === 'business_owner' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleCreateStore}
                className="font-semibold text-xs gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>New Branch</span>
              </Button>
            )}

            {/* Join Branch with Code (Cashier) */}
            {user?.role === 'cashier' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsJoinBranchOpen(true)}
                className="font-semibold text-xs gap-1.5"
              >
                <KeyRound className="h-4 w-4" />
                <span>Switch Branch Code</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="text-destructive hover:bg-destructive/10 border-destructive/20 gap-1.5 font-medium text-xs"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-6xl space-y-6">
        {/* Banner for Cashier vs Owner Overview */}
        {viewMode === 'all_branches' ? (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center md:text-left">
              <Badge className="bg-amber-400 text-slate-950 font-black text-xs mb-1">GLOBAL GRAND TOTAL</Badge>
              <h2 className="text-2xl font-black tracking-tight flex items-center justify-center md:justify-start gap-2">
                <Globe className="h-6 w-6 text-blue-400" />
                Business Owner Aggregated Dashboard
              </h2>
              <p className="text-xs text-blue-100 font-medium">
                Viewing grand total profits, revenue, expenses, and activity metrics across all {stores.length} store branches.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (stores.length > 0) {
                    setViewMode('single');
                    setSelectedStore(stores[0]);
                  }
                }}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold"
              >
                View Individual Branch
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <ShoppingCart className="h-6 w-6" />
                  {selectedStore?.name} POS Counter
                </h2>
              </div>
              <p className="text-xs text-blue-100 font-medium">
                Checkout customers, select payment method (Cash/Card/Transfer), calculate change, and print receipts.
              </p>
              {/* Access Code display for owner */}
              {user?.role === 'business_owner' && selectedStore?.access_code && (
                <div className="pt-2 flex items-center justify-center sm:justify-start gap-2">
                  <span className="text-xs bg-white/20 px-2.5 py-1 rounded-md font-mono font-bold tracking-wider flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" />
                    Branch Code: {selectedStore.access_code}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopyAccessCode(selectedStore.access_code)}
                    className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white px-2"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Code
                  </Button>
                </div>
              )}
            </div>
            <Button
              onClick={() => navigate(selectedStore ? `/stores/${selectedStore.id}/checkout` : '/checkout')}
              size="lg"
              className="bg-white text-blue-600 hover:bg-slate-100 font-black shadow-lg gap-2 text-base px-6 py-6"
            >
              <ShoppingCart className="h-5 w-5" />
              <span>OPEN POS COUNTER</span>
            </Button>
          </div>
        )}

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs uppercase font-bold text-muted-foreground">
                <ShoppingCart className="h-4 w-4 text-emerald-500" />
                Sales Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-success">
                ₦{stats.totalSales.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">{stats.transactionCount} transactions today</p>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs uppercase font-bold text-muted-foreground">
                <DollarSign className="h-4 w-4 text-destructive" />
                Expenses Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-destructive">
                ₦{stats.totalExpenses.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Today's branch costs</p>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs uppercase font-bold text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                Net Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-extrabold ${stats.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                ₦{stats.profit.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Net today (Revenue - Cost - Expense)</p>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs uppercase font-bold text-muted-foreground">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Low Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-amber-500">
                {stats.lowStockCount}
              </div>
              <p className="text-xs text-muted-foreground">Items needing restock</p>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Summary Card */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              This Week's Performance (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase">Weekly Total Sales</p>
                <p className="text-2xl font-extrabold text-foreground">₦{(stats.weekTotalSales || 0).toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase">Weekly Expenses</p>
                <p className="text-2xl font-extrabold text-destructive">₦{(stats.weekTotalExpenses || 0).toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase">Grand Net Profit</p>
                <p className="text-2xl font-extrabold text-success">₦{(stats.weekProfit || 0).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grand Total All Branches Breakdown Table for Business Owner */}
        {viewMode === 'all_branches' && user?.role === 'business_owner' && (
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">Global Branch Portfolio</CardTitle>
                  <CardDescription>
                    Summary breakdown of all {stores.length} store branches managed under your owner account.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={handleCreateStore} className="font-bold gap-1">
                  <Plus className="h-4 w-4" />
                  Add Branch
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border border rounded-xl overflow-hidden">
                {stores.map((branch) => (
                  <div key={branch.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/40 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-foreground">{branch.name}</span>
                        <Badge variant="outline" className="font-mono text-[10px] bg-primary/10 text-primary border-primary/20">
                          {branch.access_code || 'N/A'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{branch.location || 'Main Location'}</p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyAccessCode(branch.access_code)}
                        className="text-xs gap-1"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy Code
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setViewMode('single');
                          setSelectedStore(branch);
                          navigate(`/stores/${branch.id}`);
                        }}
                        className="text-xs font-bold gap-1"
                      >
                        Open Branch
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Store Branch?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete branch "{branch.name}"? All products and sales history for this branch will be disassociated.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteBranch(branch.id)} className="bg-destructive text-destructive-foreground">
                              Delete Branch
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Individual Branch Quick Actions & Staff Management */}
        {viewMode === 'single' && selectedStore && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                Branch Operations & Inventory
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Button
                  onClick={() => navigate(`/stores/${selectedStore.id}/checkout`)}
                  className="h-20 flex-col gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black shadow-md col-span-2 sm:col-span-1"
                >
                  <ShoppingCart className="h-6 w-6" />
                  <span className="text-xs">POS Counter</span>
                </Button>
                <Button
                  onClick={() => navigate(`/stores/${selectedStore.id}/products`)}
                  variant="outline"
                  className="h-20 flex-col gap-1.5 border-border hover:border-primary/40"
                >
                  <Package className="h-6 w-6 text-primary" />
                  <span className="text-xs font-bold">Products</span>
                </Button>
                <Button
                  onClick={() => navigate(`/stores/${selectedStore.id}/sales/history`)}
                  variant="outline"
                  className="h-20 flex-col gap-1.5 border-border hover:border-emerald-500/40"
                >
                  <TrendingUp className="h-6 w-6 text-emerald-500" />
                  <span className="text-xs font-bold">Sales History</span>
                </Button>
                <Button
                  onClick={() => navigate(`/stores/${selectedStore.id}/expenses`)}
                  variant="outline"
                  className="h-20 flex-col gap-1.5 border-border hover:border-destructive/40"
                >
                  <DollarSign className="h-6 w-6 text-destructive" />
                  <span className="text-xs font-bold">Expenses</span>
                </Button>
                <Button
                  onClick={() => navigate(`/stores/${selectedStore.id}/debts`)}
                  variant="outline"
                  className="h-20 flex-col gap-1.5 border-border hover:border-amber-500/40"
                >
                  <TrendingUp className="h-6 w-6 text-amber-500" />
                  <span className="text-xs font-bold">Debts</span>
                </Button>
              </div>
            </div>

            {/* Cashiers & Staff Management for Business Owner */}
            {user?.role === 'business_owner' && (
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Branch Cashiers & Staff Management
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Cashiers assigned to this branch ({cashiers.length}). Share Branch Access Code: <strong>{selectedStore.access_code}</strong>
                      </CardDescription>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyAccessCode(selectedStore.access_code)}
                      className="text-xs gap-1.5 font-bold"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy Access Code
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {cashiers.length === 0 ? (
                    <div className="p-6 text-center border border-dashed rounded-xl bg-muted/30 space-y-2">
                      <UserCheck className="h-8 w-8 text-muted-foreground mx-auto" />
                      <p className="text-xs text-muted-foreground font-medium">No cashiers currently assigned to this branch.</p>
                      <p className="text-[11px] text-muted-foreground">
                        Give your cashiers code <strong className="text-primary font-mono">{selectedStore.access_code}</strong> when they register to attach them to this branch.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border border rounded-xl overflow-hidden">
                      {cashiers.map((cashier) => (
                        <div key={cashier.id} className="p-3 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-foreground">{cashier.full_name || cashier.email}</p>
                            <p className="text-[11px] text-muted-foreground">{cashier.email}</p>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 text-xs gap-1">
                                <UserMinus className="h-3.5 w-3.5" />
                                <span>Remove</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Cashier?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove cashier "{cashier.full_name || cashier.email}" from this branch?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemoveCashier(cashier.id)} className="bg-destructive text-destructive-foreground">
                                  Remove Cashier
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Branch Deletion Button */}
                  <div className="pt-4 flex justify-end">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs gap-1.5">
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete Branch</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Store Branch?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{selectedStore.name}"? This action disassociates the branch and cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteBranch(selectedStore.id)} className="bg-destructive text-destructive-foreground">
                            Delete Branch
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Account Deletion Footer Section */}
        <div className="pt-8 pb-4 text-center border-t border-border/60">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDeleteAccountOpen(true)}
            className="text-xs text-destructive hover:bg-destructive/10 gap-1.5"
          >
            <UserX className="h-3.5 w-3.5" />
            <span>Delete My Account</span>
          </Button>
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={isDeleteAccountOpen} onOpenChange={setIsDeleteAccountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <UserX className="h-5 w-5" />
              Delete Account Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your account ({user?.email})? All your user profile credentials and branch memberships will be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAccount} className="bg-destructive text-destructive-foreground font-bold">
              Permanently Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Join Branch Dialog for Cashier */}
      <Dialog open={isJoinBranchOpen} onOpenChange={setIsJoinBranchOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Join Store Branch
            </DialogTitle>
            <DialogDescription>
              Enter the 5-character Branch Access Code provided by your Business Owner (e.g. BR-8X92K).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleJoinBranchSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="code2">Branch Access Code</Label>
              <Input
                id="code2"
                placeholder="BR-8X92K"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                className="font-mono uppercase font-bold tracking-widest text-center text-lg"
                required
              />
            </div>
            <Button type="submit" className="w-full font-bold" disabled={joiningBranch}>
              {joiningBranch ? 'Connecting...' : 'Join Store Branch'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;

