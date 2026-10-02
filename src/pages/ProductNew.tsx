import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/db';
import { toast } from 'sonner';

const ProductNew = () => {
  const navigate = useNavigate();
  const { storeId } = useParams();
  const [name, setName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<'bag' | 'paint' | 'derica' | 'kg'>('derica');
  const [costPriceUnit, setCostPriceUnit] = useState<'derica' | 'bag'>('derica');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [dericasPerBag, setDericasPerBag] = useState('100');
  const [dericasPerPaint, setDericasPerPaint] = useState('5');
  const [loading, setLoading] = useState(false);

  const convertToDerica = (qty: number, fromUnit: string): number => {
    switch (fromUnit) {
      case 'bag':
        return qty * parseFloat(dericasPerBag);
      case 'paint':
        return qty * parseFloat(dericasPerPaint);
      case 'kg':
        return qty; // kg is stored as-is
      default:
        return qty;
    }
  };

  const convertCostPriceToPerDerica = (price: number, fromUnit: 'derica' | 'bag'): number => {
    if (fromUnit === 'bag') {
      return price / parseFloat(dericasPerBag);
    }
    return price; // Already per derica
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) {
      toast.error('No store selected');
      return;
    }

    setLoading(true);

    const qtyInDerica = convertToDerica(parseFloat(quantity), unit);
    const costPerDerica = convertCostPriceToPerDerica(parseFloat(costPrice), costPriceUnit);
    const sellingPerDerica = parseFloat(sellingPrice); // Already per derica

    const productData = {
      store_id: storeId,
      name,
      cost_price: costPerDerica,
      selling_price: sellingPerDerica,
      quantity: qtyInDerica,
      reorder_level: parseInt(reorderLevel),
      dericas_per_bag: parseFloat(dericasPerBag),
      dericas_per_paint: parseFloat(dericasPerPaint),
      unit_type: unit,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (error) throw error;

      await db.products.add({
        ...data,
        synced: true,
      });

      toast.success('Product added successfully!');
      navigate(`/stores/${storeId}/products`);
    } catch (error: any) {
      const localId = crypto.randomUUID();
      await db.products.add({
        id: localId,
        ...productData,
        synced: false,
      });

      await db.syncQueue.add({
        table: 'products',
        operation: 'create',
        data: { id: localId, ...productData },
        timestamp: new Date().toISOString(),
      });

      toast.success('Product added (will sync when online)');
      navigate(`/stores/${storeId}/products`);
    } finally {
      setLoading(false);
    }
  };

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
              <Package className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-center">Add Product</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name*</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Rice, Oil, etc."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity*</Label>
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

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="costPrice">Cost Price*</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="sellingPrice">Selling Price (per derica)*</Label>
                  <Input
                    id="sellingPrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-3">
                <Label className="text-sm font-semibold">Unit Conversion Settings</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dericasPerBag" className="text-xs">Derica per Bag</Label>
                    <Input
                      id="dericasPerBag"
                      type="number"
                      step="0.01"
                      value={dericasPerBag}
                      onChange={(e) => setDericasPerBag(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dericasPerPaint" className="text-xs">Derica per Paint</Label>
                    <Select value={dericasPerPaint} onValueChange={setDericasPerPaint}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="5.25">5.25</SelectItem>
                        <SelectItem value="6">6</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Prices will be stored per derica. Common: Garri (5 per paint, 100 per bag), Rice (5 per paint, 64 per bag)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reorderLevel">Low Stock Alert Level*</Label>
                <Input
                  id="reorderLevel"
                  type="number"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Alert when stock falls to this level (in derica)
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Adding...' : 'Add Product'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProductNew;
