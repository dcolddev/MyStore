import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, LocalProduct } from '@/lib/db';
import { syncWithServer } from '@/lib/sync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

export default function SaleNew() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [unit, setUnit] = useState<'bag' | 'paint' | 'derica' | 'kg'>('derica');
  const [formData, setFormData] = useState({
    product_id: '',
    quantity: 1,
  });

  useEffect(() => {
    loadProducts();
  }, [storeId]);

  const loadProducts = async () => {
    try {
      const localProducts = await db.products.where('store_id').equals(storeId!).toArray();
      setProducts(localProducts);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const convertToDerica = (qty: number, fromUnit: string, product: LocalProduct): number => {
    switch (fromUnit) {
      case 'bag':
        return qty * product.dericas_per_bag;
      case 'paint':
        return qty * product.dericas_per_paint;
      case 'kg':
        return qty; // kg is stored as-is
      default:
        return qty;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const product = products.find(p => p.id === formData.product_id);
      if (!product) {
        toast({ title: 'Product not found', variant: 'destructive' });
        return;
      }

      // Convert quantity to dericas for stock checking and calculation
      const qtyInDerica = convertToDerica(formData.quantity, unit, product);

      if (product.quantity < qtyInDerica) {
        toast({ title: 'Insufficient stock', variant: 'destructive' });
        return;
      }

      // Prices are stored per derica, so multiply by dericas
      const totalRevenue = product.selling_price * qtyInDerica;
      const totalCost = product.cost_price * qtyInDerica;
      const profit = totalRevenue - totalCost;

      const saleData = {
        id: crypto.randomUUID(),
        store_id: storeId!,
        product_id: formData.product_id,
        quantity: qtyInDerica,
        total_revenue: totalRevenue,
        total_cost: totalCost,
        profit: profit,
        sale_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        synced: false,
      };

      await db.sales.add(saleData);
      await db.products.update(product.id, {
        quantity: product.quantity - qtyInDerica,
        synced: false,
      });

      await db.syncQueue.add({
        table: 'sales',
        operation: 'create',
        data: saleData,
        timestamp: new Date().toISOString(),
      });

      await db.syncQueue.add({
        table: 'products',
        operation: 'update',
        data: { id: product.id, quantity: product.quantity - qtyInDerica },
        timestamp: new Date().toISOString(),
      });

      if (navigator.onLine) {
        await syncWithServer();
      }

      toast({ title: 'Sale recorded successfully' });
      navigate(`/stores/${storeId}`);
    } catch (error) {
      console.error('Error recording sale:', error);
      toast({ title: 'Failed to record sale', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find(p => p.id === formData.product_id);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/stores/${storeId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Record Sale</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 rounded-xl border border-border">
          <div className="space-y-2">
            <Label htmlFor="product_id">Product</Label>
            <Select value={formData.product_id} onValueChange={(value) => setFormData({ ...formData, product_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} (Stock: {product.quantity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <div className="flex gap-2">
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 1 })}
                required
                className="flex-1"
              />
              <Select value={unit} onValueChange={(val) => setUnit(val as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bag">Bag</SelectItem>
                  <SelectItem value="paint">Paint</SelectItem>
                  <SelectItem value="derica">Derica</SelectItem>
                  <SelectItem value="kg">Kg</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedProduct && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price per Derica:</span>
                <span className="font-semibold text-foreground">₦{selectedProduct.selling_price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quantity in Derica:</span>
                <span className="font-semibold text-foreground">
                  {(() => {
                    switch (unit) {
                      case 'bag':
                        return (formData.quantity * selectedProduct.dericas_per_bag).toFixed(2);
                      case 'paint':
                        return (formData.quantity * selectedProduct.dericas_per_paint).toFixed(2);
                      case 'kg':
                        return formData.quantity.toFixed(2);
                      default:
                        return formData.quantity.toFixed(2);
                    }
                  })()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-bold text-lg text-primary">
                  ₦{(() => {
                    const qtyInDerica = (() => {
                      switch (unit) {
                        case 'bag':
                          return formData.quantity * selectedProduct.dericas_per_bag;
                        case 'paint':
                          return formData.quantity * selectedProduct.dericas_per_paint;
                        case 'kg':
                          return formData.quantity;
                        default:
                          return formData.quantity;
                      }
                    })();
                    return (selectedProduct.selling_price * qtyInDerica).toFixed(2);
                  })()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Profit:</span>
                <span className="font-semibold text-success">
                  ₦{(() => {
                    const qtyInDerica = (() => {
                      switch (unit) {
                        case 'bag':
                          return formData.quantity * selectedProduct.dericas_per_bag;
                        case 'paint':
                          return formData.quantity * selectedProduct.dericas_per_paint;
                        case 'kg':
                          return formData.quantity;
                        default:
                          return formData.quantity;
                      }
                    })();
                    return ((selectedProduct.selling_price - selectedProduct.cost_price) * qtyInDerica).toFixed(2);
                  })()}
                </span>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading || !formData.product_id}>
            {loading ? 'Recording...' : 'Record Sale'}
          </Button>
        </form>
      </div>
    </div>
  );
}
