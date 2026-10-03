import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, LocalSale, LocalProduct } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';

type TimeFilter = 'today' | 'yesterday' | 'week' | 'all';

export default function SalesHistory() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [sales, setSales] = useState<(LocalSale & { productName: string })[]>([]);
  const [filter, setFilter] = useState<TimeFilter>('today');

  useEffect(() => {
    loadSales();
  }, [storeId]);

  const loadSales = async () => {
    try {
      const localSales = await db.sales
        .where('store_id')
        .equals(storeId!)
        .reverse()
        .sortBy('sale_date');

      // Get product names
      const salesWithProducts = await Promise.all(
        localSales.map(async (sale) => {
          const product = await db.products.get(sale.product_id);
          return {
            ...sale,
            productName: product?.name || 'Unknown Product',
          };
        })
      );

      setSales(salesWithProducts);
    } catch (error) {
      console.error('Error loading sales:', error);
    }
  };

  const filteredSales = sales.filter((sale) => {
    const saleDate = new Date(sale.sale_date);
    switch (filter) {
      case 'today':
        return isToday(saleDate);
      case 'yesterday':
        return isYesterday(saleDate);
      case 'week':
        return isThisWeek(saleDate);
      case 'all':
      default:
        return true;
    }
  });

  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total_revenue, 0);
  const totalProfit = filteredSales.reduce((sum, s) => sum + s.profit, 0);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Sales History</h1>
        </div>

        <Tabs value={filter} onValueChange={(val) => setFilter(val as TimeFilter)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="yesterday">Yesterday</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-success">₦{totalRevenue.toFixed(2)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Total Profit</p>
                <p className="text-2xl font-bold text-primary">₦{totalProfit.toFixed(2)}</p>
              </Card>
            </div>

            <div className="space-y-3">
              {filteredSales.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">No sales recorded for this period</p>
                </Card>
              ) : (
                filteredSales.map((sale) => (
                  <Card key={sale.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 flex-1">
                        <p className="font-semibold text-foreground">{sale.productName}</p>
                        <p className="text-sm text-muted-foreground">
                          Quantity: {sale.quantity} derica
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(sale.sale_date), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-lg font-bold text-success">₦{sale.total_revenue.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">
                          Cost: ₦{sale.total_cost.toFixed(2)}
                        </p>
                        <p className="text-sm font-semibold text-primary">
                          Profit: ₦{sale.profit.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>

            <div className="text-center text-sm text-muted-foreground pt-4">
              {filteredSales.length} sale{filteredSales.length !== 1 ? 's' : ''} recorded
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
