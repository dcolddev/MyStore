import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getNeonSql } from '@/lib/neon';
import { db } from '@/lib/db';
import { syncWithServer } from '@/lib/sync';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Store, 
  Package, 
  ShoppingCart, 
  DollarSign, 
  AlertCircle,
  TrendingUp,
  LogOut,
  Plus
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
  created_at?: string;
  updated_at?: string | null;
}

const Dashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { storeId } = useParams();
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreRecord | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalExpenses: 0,
    profit: 0,
    transactionCount: 0,
    lowStockCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const loadStores = useCallback(async () => {
    try {
      let storeList: StoreRecord[] = [];
      const sql = getNeonSql();
      if (navigator.onLine && sql) {
        try {
          const res = await sql`SELECT * FROM stores ORDER BY created_at DESC`;
          storeList = res as StoreRecord[];
        } catch (err) {
          console.warn('Neon stores query error, falling back to local DB:', err);
        }
      }
      if (storeList.length === 0) {
        storeList = await db.stores.toArray() as StoreRecord[];
      }

      setStores(storeList);
      if (storeList.length > 0) {
        const matched = storeId ? storeList.find((s) => s.id === storeId) : storeList[0];
        setSelectedStore(matched || storeList[0]);
      }
    } catch (error: any) {
      const localStores = await db.stores.toArray() as StoreRecord[];
      setStores(localStores);
      if (localStores.length > 0) setSelectedStore(localStores[0]);
    } finally {
      setLoading(false);
    }
  }, [selectedStore, storeId]);

  const loadDashboardStats = useCallback(async () => {
    if (!selectedStore) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const sql = getNeonSql();
      let todaySales: any[] = [];
      let weekSales: any[] = [];
      let todayExpenses: any[] = [];
      let weekExpenses: any[] = [];
      let productsData: any[] = [];

      if (navigator.onLine && sql) {
        try {
          todaySales = await sql`SELECT * FROM sales WHERE store_id = ${selectedStore.id} AND sale_date >= ${today.toISOString()}`;
          weekSales = await sql`SELECT * FROM sales WHERE store_id = ${selectedStore.id} AND sale_date >= ${weekAgo.toISOString()}`;
          todayExpenses = await sql`SELECT * FROM expenses WHERE store_id = ${selectedStore.id} AND expense_date >= ${today.toISOString()}`;
          weekExpenses = await sql`SELECT * FROM expenses WHERE store_id = ${selectedStore.id} AND expense_date >= ${weekAgo.toISOString()}`;
          productsData = await sql`SELECT * FROM products WHERE store_id = ${selectedStore.id} AND quantity <= reorder_level`;
        } catch (err) {
          console.warn('Neon stats query error, falling back to local DB:', err);
        }
      }

      if (todaySales.length === 0 && weekSales.length === 0) {
        const localSales = await db.sales.where('store_id').equals(selectedStore.id).toArray();
        const localExpenses = await db.expenses.where('store_id').equals(selectedStore.id).toArray();
        const localProducts = await db.products.where('store_id').equals(selectedStore.id).toArray();

        todaySales = localSales.filter((s) => new Date(s.sale_date) >= today);
        weekSales = localSales.filter((s) => new Date(s.sale_date) >= weekAgo);
        todayExpenses = localExpenses.filter((e) => new Date(e.expense_date) >= today);
        weekExpenses = localExpenses.filter((e) => new Date(e.expense_date) >= weekAgo);
        productsData = localProducts.filter((p) => p.quantity <= (p.reorder_level || 5));
      }

      const todayTotalSales = todaySales?.reduce((sum, sale) => sum + Number(sale.total_revenue), 0) || 0;
      const todayTotalExpenses = todayExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;
      const todayProfit = todaySales?.reduce((sum, sale) => sum + Number(sale.profit), 0) || 0;

      const weekTotalSales = weekSales?.reduce((sum, sale) => sum + Number(sale.total_revenue), 0) || 0;
      const weekTotalExpenses = weekExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;
      const weekProfit = weekSales?.reduce((sum, sale) => sum + Number(sale.profit), 0) || 0;

      setStats({
        totalSales: todayTotalSales,
        totalExpenses: todayTotalExpenses,
        profit: todayProfit - todayTotalExpenses,
        transactionCount: todaySales?.length || 0,
        lowStockCount: productsData?.length || 0,
        weekTotalSales,
        weekTotalExpenses,
        weekProfit: weekProfit - weekTotalExpenses,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [selectedStore]);

  useEffect(() => {
    if (user) {
      loadStores();

      syncWithServer().finally(() => {
        loadStores();
      });
    }
  }, [user, loadStores]);

  useEffect(() => {
    if (selectedStore) {
      loadDashboardStats();
    }
  }, [selectedStore, loadDashboardStats]);

  const handleCreateStore = () => {
    navigate('/stores/new');
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!selectedStore && stores.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center">Welcome to Your Store Manager</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Create your first store to get started with managing your business.
            </p>
            <Button onClick={handleCreateStore} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Create Store
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Store className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{selectedStore?.name || 'Store'}</h1>
              <p className="text-xs text-muted-foreground">{selectedStore?.location}</p>
            </div>
            {stores.length > 1 && (
              <select
                className="ml-4 rounded-md border border-border bg-background px-2 py-1 text-xs"
                value={selectedStore?.id}
                onChange={(e) => {
                  const newStore = stores.find((s) => s.id === e.target.value);
                  if (newStore) {
                    setSelectedStore(newStore);
                    navigate(`/stores/${newStore.id}`);
                  }
                }}
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCreateStore}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Store
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto p-4">
        <div className="mb-6 grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ShoppingCart className="h-4 w-4" />
                Sales Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                ₦{stats.totalSales.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">{stats.transactionCount} transactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                ₦{stats.totalExpenses.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Today's costs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                ₦{stats.profit.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Net today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                Low Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {stats.lowStockCount}
              </div>
              <p className="text-xs text-muted-foreground">Items need restock</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">This Week's Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold text-foreground">₦{(stats.weekTotalSales || 0).toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold text-destructive">₦{(stats.weekTotalExpenses || 0).toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className="text-2xl font-bold text-success">₦{(stats.weekProfit || 0).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => navigate(`/stores/${selectedStore.id}/products`)}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              <Package className="h-6 w-6" />
              <span className="text-sm">Products</span>
            </Button>
            <Button
              onClick={() => navigate(`/stores/${selectedStore.id}/sales/new`)}
              className="h-20 flex-col gap-2"
            >
              <ShoppingCart className="h-6 w-6" />
              <span className="text-sm">Record Sale</span>
            </Button>
            <Button
              onClick={() => navigate(`/stores/${selectedStore.id}/sales/history`)}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              <TrendingUp className="h-6 w-6" />
              <span className="text-sm">Sales History</span>
            </Button>
            <Button
              onClick={() => navigate(`/stores/${selectedStore.id}/expenses`)}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              <DollarSign className="h-6 w-6" />
              <span className="text-sm">Expenses</span>
            </Button>
            <Button
              onClick={() => navigate(`/stores/${selectedStore.id}/debts`)}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              <TrendingUp className="h-6 w-6" />
              <span className="text-sm">Debts</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
