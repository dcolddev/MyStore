import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import { db, LocalProduct } from '@/lib/db';
import { getNeonSql } from '@/lib/neon';
import { syncWithServer } from '@/lib/sync';
import { toast } from 'sonner';

const ProductRestock = () => {
  const navigate = useNavigate();
  const { storeId, productId } = useParams();
  const [product, setProduct] = useState<LocalProduct | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<'bag' | 'paint' | 'derica' | 'kg'>('derica');
  const [costPrice, setCostPrice] = useState('');
  const [costPriceUnit, setCostPriceUnit] = useState<'derica' | 'bag'>('derica');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    if (!productId) return;
    const prod = await db.products.get(productId);
    if (prod) {
      setProduct(prod);
      setCostPrice(prod.cost_price.toString());
      setUnit(prod.unit_type as any);
    }
  };

  const convertToDerica = (qty: number, fromUnit: string): number => {
    if (!product) return qty;
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

  const convertPriceToPerDerica = (price: number, fromUnit: string): number => {
    if (!product) return price;
    switch (fromUnit) {
      case 'bag':
        return price / product.dericas_per_bag;
      case 'paint':
        return price / product.dericas_per_paint;
      case 'kg':
        return price; // kg pricing is stored as-is
      default:
        return price;
    }
  };

  const convertCostPriceToPerDerica = (price: number, fromUnit: 'derica' | 'bag'): number => {
    if (!product) return price;
    if (fromUnit === 'bag') {
      return price / product.dericas_per_bag;
    }
    return price; // Already per derica
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !storeId) return;

    setLoading(true);

    const qtyInDerica = convertToDerica(parseFloat(quantity), unit);
    const newQuantity = product.quantity + qtyInDerica;
    const costPerDerica = convertCostPriceToPerDerica(parseFloat(costPrice), costPriceUnit);
    const expenseAmount = costPerDerica * qtyInDerica;

    try {
      const sql = getNeonSql();
      const expenseId = crypto.randomUUID();
      const expenseData = {
        id: expenseId,
        store_id: storeId,
        amount: expenseAmount,
        category: 'Restock',
        description: `Restocked ${quantity} ${unit} of ${product.name}`,
        expense_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      if (sql) {
        await sql`
          UPDATE products
          SET quantity = ${newQuantity}, cost_price = ${costPerDerica}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${product.id}
        `;

        await sql`
          INSERT INTO expenses (id, store_id, amount, category, description)
          VALUES (${expenseId}, ${storeId}, ${expenseAmount}, 'Restock', ${`Restocked ${quantity} ${unit} of ${product.name}`})
        `;
      }

      // Update local DB
      await db.products.update(product.id, {
        quantity: newQuantity,
        cost_price: costPerDerica,
        updated_at: new Date().toISOString(),
        synced: true,
      });

      await db.expenses.add({
        ...expenseData,
        synced: true,
      });

      toast.success('Product restocked successfully!');
      navigate(`/stores/${storeId}/products`);
    } catch (error: any) {
      // Offline mode
      await db.products.update(product.id, {
        quantity: newQuantity,
        cost_price: costPerDerica,
        updated_at: new Date().toISOString(),
        synced: false,
      });

      const expenseId = crypto.randomUUID();
      const expenseData = {
        id: expenseId,
        store_id: storeId,
        amount: expenseAmount,
        category: 'Restock',
        description: `Restocked ${quantity} ${unit} of ${product.name}`,
        expense_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      await db.expenses.add({
        ...expenseData,
        synced: false,
      });

      await db.syncQueue.add({
        table: 'products',
        operation: 'update',
        data: {
          id: product.id,
          quantity: newQuantity,
          cost_price: costPerDerica,
          updated_at: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });

      await db.syncQueue.add({
        table: 'expenses',
        operation: 'create',
        data: expenseData,
        timestamp: new Date().toISOString(),
      });

      if (navigator.onLine) {
        await syncWithServer();
      }

      toast.success('Product restocked (will sync when online)');
      navigate(`/stores/${storeId}/products`);
    } finally {
      setLoading(false);
    }
  };

  if (!product) {
    return <div className="min-h-screen bg-background p-4">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-md">
        <Button
          variant="ghost"
          onClick={() => navigate(`/stores/${storeId}/products`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <PackagePlus className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-center">Restock Product</CardTitle>
            <p className="text-center text-sm text-muted-foreground">{product.name}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity to Add*</Label>
                <div className="flex gap-2">
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
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

              <div className="space-y-2">
                <Label htmlFor="costPrice">New Cost Price*</Label>
                <div className="flex gap-2">
                  <Input
                    id="costPrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    required
                    className="flex-1"
                  />
                  <Select value={costPriceUnit} onValueChange={(val) => setCostPriceUnit(val as 'derica' | 'bag')}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="derica">per Derica</SelectItem>
                      <SelectItem value="bag">per Bag</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg bg-muted p-4 space-y-1">
                <p className="text-sm text-muted-foreground">
                  Current Stock: {product.quantity} derica
                </p>
                {quantity && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Adding: {convertToDerica(parseFloat(quantity), unit)} derica
                    </p>
                    <p className="text-sm font-semibold">
                      New Stock: {product.quantity + convertToDerica(parseFloat(quantity), unit)} derica
                    </p>
                    <p className="text-sm font-semibold text-destructive">
                      Expense: ₦{(convertCostPriceToPerDerica(parseFloat(costPrice), costPriceUnit) * convertToDerica(parseFloat(quantity), unit) || 0).toFixed(2)}
                    </p>
                  </>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Restocking...' : 'Restock Product'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProductRestock;
