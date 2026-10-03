import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, LocalProduct } from '@/lib/db';
import { getNeonSql, saveNeonOrder } from '@/lib/neon';
import { syncWithServer } from '@/lib/sync';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Printer, 
  CreditCard, 
  Banknote, 
  ArrowLeft, 
  CheckCircle2, 
  Store, 
  Sparkles,
  Calculator,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

export interface BillItem {
  id: string;
  name: string;
  unit_price: number;
  cost_price: number;
  quantity: number;
  unit_type: string;
  is_custom?: boolean;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { storeId: routeStoreId } = useParams();
  const { user } = useAuth();

  const [stores, setStores] = useState<any[]>([]);
  const [activeStore, setActiveStore] = useState<any>(null);
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [billItems, setBillItems] = useState<BillItem[]>([]);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Walk-in Customer');

  // Custom Item Form
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');

  // Processing & Receipt Modal
  const [loading, setLoading] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<any | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  useEffect(() => {
    loadStoresAndProducts();
  }, [routeStoreId]);

  const loadStoresAndProducts = async () => {
    if (!user) return;
    try {
      let storeList: any[] = [];
      const sql = getNeonSql();
      if (navigator.onLine && sql) {
        try {
          if (user.role === 'cashier') {
            if (user.store_id) {
              storeList = await sql`SELECT * FROM stores WHERE id = ${user.store_id}`;
            } else {
              storeList = await sql`
                SELECT s.* FROM stores s
                INNER JOIN store_cashiers sc ON sc.store_id = s.id
                WHERE sc.cashier_id = ${user.id}
              `;
            }
          } else {
            storeList = await sql`SELECT * FROM stores WHERE owner_id = ${user.id} ORDER BY created_at DESC`;
          }
        } catch (err) {
          console.warn('Neon stores query notice:', err);
        }
      }
      if (storeList.length === 0) {
        storeList = await db.stores.toArray();
      }

      setStores(storeList);

      let selected = storeList[0];
      if (routeStoreId) {
        const found = storeList.find((s) => s.id === routeStoreId);
        if (found) selected = found;
      }
      setActiveStore(selected || null);

      if (selected) {
        loadStoreProducts(selected.id);
      }
    } catch (err) {
      console.error('Error initializing POS:', err);
    }
  };

  const loadStoreProducts = async (sId: string) => {
    try {
      const sql = getNeonSql();
      if (navigator.onLine && sql) {
        try {
          const res = await sql`SELECT * FROM products WHERE store_id = ${sId} ORDER BY name ASC`;
          if (res && res.length > 0) {
            setProducts(res as any);
            return;
          }
        } catch (err) {
          console.warn('Neon products notice:', err);
        }
      }
      const local = await db.products.where('store_id').equals(sId).toArray();
      setProducts(local);
    } catch {
      const local = await db.products.where('store_id').equals(sId).toArray();
      setProducts(local);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Add inventory item to bill
  const handleAddItemToBill = (product: LocalProduct) => {
    setBillItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          unit_price: Number(product.selling_price),
          cost_price: Number(product.cost_price),
          quantity: 1,
          unit_type: product.unit_type || 'pcs',
        },
      ];
    });
  };

  // Add custom manual item to bill
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName || !customPrice) {
      toast.error('Enter custom item name and price');
      return;
    }
    const priceNum = parseFloat(customPrice);
    const qtyNum = parseFloat(customQty) || 1;

    const customId = `custom-${crypto.randomUUID()}`;
    setBillItems((prev) => [
      ...prev,
      {
        id: customId,
        name: customName,
        unit_price: priceNum,
        cost_price: priceNum * 0.7,
        quantity: qtyNum,
        unit_type: 'pcs',
        is_custom: true,
      },
    ]);

    setCustomName('');
    setCustomPrice('');
    setCustomQty('1');
    toast.success(`Added "${customName}" to counter bill`);
  };

  const updateQuantity = (id: string, delta: number) => {
    setBillItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as BillItem[]
    );
  };

  const removeItem = (id: string) => {
    setBillItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearBill = () => {
    setBillItems([]);
    setCashTendered('');
    setCustomerName('Walk-in Customer');
  };

  // Calculations
  const grandTotal = billItems.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  const tenderedAmount = parseFloat(cashTendered) || 0;
  const changeDue = paymentMethod === 'cash' ? Math.max(0, tenderedAmount - grandTotal) : 0;

  // Complete Sale & Print Receipt
  const handleCompleteSale = async () => {
    if (billItems.length === 0) {
      toast.error('Add items to the counter bill before completing sale');
      return;
    }

    if (paymentMethod === 'cash' && cashTendered && tenderedAmount < grandTotal) {
      toast.error(`Cash tendered (₦${tenderedAmount}) is less than Total (₦${grandTotal})`);
      return;
    }

    setLoading(true);
    const orderId = crypto.randomUUID();
    const currentStoreId = activeStore?.id || routeStoreId || 'default-store';

    try {
      // 1. Save Order into Neon Postgres & Local DB
      await saveNeonOrder({
        id: orderId,
        store_id: currentStoreId,
        customer_name: customerName || 'Walk-in Customer',
        customer_email: 'walkin@store.local',
        shipping_address: 'In-Store Checkout Counter',
        total_amount: grandTotal,
        payment_method: paymentMethod,
        items: billItems.map((i) => ({
          id: i.id.startsWith('custom-') ? '' : i.id,
          product_name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total_price: i.unit_price * i.quantity,
        })),
      });

      // 2. Decrement Product Stock Locally & Queue Sync
      for (const item of billItems) {
        if (!item.is_custom && !item.id.startsWith('custom-')) {
          const localProd = products.find((p) => p.id === item.id);
          if (localProd) {
            const updatedQty = Math.max(0, localProd.quantity - item.quantity);
            await db.products.update(item.id, {
              quantity: updatedQty,
              synced: false,
            });

            await db.syncQueue.add({
              table: 'products',
              operation: 'update',
              data: { id: item.id, quantity: updatedQty },
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      if (navigator.onLine) {
        syncWithServer();
      }

      // Prepare receipt data
      const receiptData = {
        orderId,
        storeName: activeStore?.name || 'Supermarket POS',
        storeLocation: activeStore?.location || 'Main Counter',
        cashierName: user?.full_name || user?.email || 'Cashier',
        customerName: customerName || 'Walk-in Customer',
        date: new Date().toLocaleString(),
        items: [...billItems],
        totalAmount: grandTotal,
        paymentMethod,
        cashTendered: paymentMethod === 'cash' ? (tenderedAmount > 0 ? tenderedAmount : grandTotal) : grandTotal,
        changeDue: paymentMethod === 'cash' ? changeDue : 0,
      };

      setCompletedReceipt(receiptData);
      setIsReceiptOpen(true);
      toast.success('Sale marked as PAID!');
    } catch (err: any) {
      console.error('POS Checkout error:', err);
      toast.error('Failed to complete sale');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col font-sans">
      {/* Top Cashier POS Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-3 sticky top-0 z-40">
        <div className="mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(activeStore ? `/stores/${activeStore.id}` : '/dashboard')}
              className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Dashboard</span>
            </Button>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-bold shadow">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-extrabold text-base tracking-tight leading-tight text-white">
                  {activeStore?.name || 'Supermarket POS Counter'}
                </h1>
                <p className="text-[11px] text-slate-400 font-medium">
                  {activeStore?.location || 'Checkout Terminal #1'}
                </p>
              </div>
            </div>

            {stores.length > 1 && (
              <select
                className="ml-2 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none"
                value={activeStore?.id}
                onChange={(e) => {
                  const s = stores.find((st) => st.id === e.target.value);
                  if (s) {
                    setActiveStore(s);
                    loadStoreProducts(s.id);
                  }
                }}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700/60">
              <Sparkles className="h-3.5 w-3.5 text-primary/70" />
              <span>Cashier: <strong className="text-slate-200">{user?.full_name || user?.email || 'Operator'}</strong></span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => activeStore && loadStoreProducts(activeStore.id)}
              className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh Stock</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Counter Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* Left Section: Catalog & Inventory Search (7 Cols) */}
        <div className="lg:col-span-7 border-r border-slate-800 p-4 md:p-6 flex flex-col space-y-4 bg-slate-900/50 overflow-y-auto">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search product by name to add to customer bill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-5 bg-slate-800/90 border-slate-700 text-slate-100 placeholder:text-slate-400 rounded-xl font-medium focus-visible:ring-blue-500"
            />
          </div>

          {/* Custom Manual Item Quick Entry */}
          <Card className="bg-slate-900 border-slate-800 shadow-sm">
            <CardHeader className="p-3.5 pb-2">
              <CardTitle className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5 text-blue-400" />
                Quick Custom / Manual Item Entry
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
              <form onSubmit={handleAddCustomItem} className="flex flex-wrap sm:flex-nowrap gap-2 items-end">
                <div className="flex-1 min-w-[140px]">
                  <Label className="text-[11px] text-slate-400">Item Description</Label>
                  <Input
                    placeholder="e.g. Unlisted Good, Bread..."
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="h-9 bg-slate-800 border-slate-700 text-xs text-slate-100"
                  />
                </div>
                <div className="w-24">
                  <Label className="text-[11px] text-slate-400">Price (₦)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="h-9 bg-slate-800 border-slate-700 text-xs text-slate-100 font-semibold"
                  />
                </div>
                <div className="w-16">
                  <Label className="text-[11px] text-slate-400">Qty</Label>
                  <Input
                    type="number"
                    value={customQty}
                    onChange={(e) => setCustomQty(e.target.value)}
                    className="h-9 bg-slate-800 border-slate-700 text-xs text-slate-100 text-center font-bold"
                  />
                </div>
                <Button type="submit" size="sm" className="h-9 bg-blue-600 hover:bg-blue-500 font-semibold text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Product Grid / List */}
          <div className="space-y-2 flex-1">
            <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
              Store Catalog ({filteredProducts.length})
            </h3>

            {filteredProducts.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
                <ShoppingCart className="h-10 w-10 text-slate-600 mx-auto" />
                <p className="text-slate-400 text-sm">No inventory products found.</p>
                <Button variant="outline" size="sm" onClick={() => navigate(`/stores/${activeStore?.id}/products/new`)} className="border-slate-700 text-slate-300">
                  + Add Product to Store Catalog
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleAddItemToBill(p)}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/80 hover:bg-slate-800/80 cursor-pointer transition-all flex justify-between items-center group shadow-sm"
                  >
                    <div className="space-y-1 pr-2">
                      <p className="font-bold text-sm text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1">
                        {p.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-extrabold text-emerald-400">
                          ₦{Number(p.selling_price).toFixed(2)}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 border ${
                            p.quantity <= (p.reorder_level || 5)
                              ? 'bg-red-500/10 text-red-400 border-red-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          Stock: {p.quantity}
                        </Badge>
                      </div>
                    </div>
                    <Button size="sm" className="bg-slate-800 group-hover:bg-blue-600 text-slate-200 group-hover:text-white rounded-lg h-8 px-2.5">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Active Cashier Basket / Counter Bill (5 Cols) */}
        <div className="lg:col-span-5 p-4 md:p-6 bg-slate-950 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="font-black text-lg tracking-tight text-white flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-blue-500" />
                  Current Customer Bill
                </h2>
                <p className="text-xs text-slate-400">{billItems.length} item(s) selected</p>
              </div>

              {billItems.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearBill} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1">
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear</span>
                </Button>
              )}
            </div>

            {/* Customer Name Input */}
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-400">Customer Reference (Optional)</Label>
              <Input
                placeholder="Walk-in Customer / Table #"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="h-8 bg-slate-900 border-slate-800 text-xs text-slate-200"
              />
            </div>

            {/* Bill Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/80">
              {billItems.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs space-y-1">
                  <p className="font-semibold">No items added to current bill.</p>
                  <p>Click items on the left or type a custom item to add.</p>
                </div>
              ) : (
                <div className="max-h-[260px] overflow-y-auto divide-y divide-slate-800/60">
                  {billItems.map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between text-xs gap-2">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-bold text-slate-200 truncate">{item.name}</p>
                        <p className="text-[11px] text-slate-400">
                          ₦{item.unit_price.toFixed(2)} each
                        </p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg p-1 border border-slate-700">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="h-5 w-5 rounded bg-slate-700 flex items-center justify-center text-slate-300 hover:bg-slate-600"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="font-extrabold text-white w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="h-5 w-5 rounded bg-slate-700 flex items-center justify-center text-slate-300 hover:bg-slate-600"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <span className="font-black text-emerald-400 text-sm w-20 text-right">
                        ₦{(item.unit_price * item.quantity).toFixed(2)}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-slate-500 hover:text-red-400 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Payment & Calculation Footer */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            {/* Grand Total Display */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400 block">Total Due</span>
                <span className="text-xs text-slate-500">{billItems.length} items</span>
              </div>
              <span className="text-3xl font-black text-blue-400 tracking-tight">
                ₦{grandTotal.toFixed(2)}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-300">Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('cash')}
                  className={`h-11 font-bold text-xs gap-1.5 ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'border-slate-800 bg-slate-900 text-slate-300'
                  }`}
                >
                  <Banknote className="h-4 w-4" />
                  <span>Cash</span>
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('card')}
                  className={`h-11 font-bold text-xs gap-1.5 ${
                    paymentMethod === 'card'
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'border-slate-800 bg-slate-900 text-slate-300'
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Card / POS</span>
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'transfer' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('transfer')}
                  className={`h-11 font-bold text-xs gap-1.5 ${
                    paymentMethod === 'transfer'
                      ? 'bg-purple-600 hover:bg-purple-500 text-white'
                      : 'border-slate-800 bg-slate-900 text-slate-300'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Transfer</span>
                </Button>
              </div>
            </div>

            {/* Cash Tendered & Change Calculation */}
            {paymentMethod === 'cash' && (
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <Label className="text-[11px] font-bold text-emerald-300">Cash Received from Customer (₦)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 5000"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="h-10 bg-slate-900 border-emerald-700/60 text-emerald-200 font-extrabold text-base focus-visible:ring-emerald-500"
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-emerald-400 block uppercase">Change Due</span>
                    <span className="text-2xl font-black text-emerald-400">
                      ₦{changeDue.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Complete & Print Action Button */}
            <Button
              type="button"
              disabled={loading || billItems.length === 0}
              onClick={handleCompleteSale}
              className="w-full py-7 text-base font-black tracking-wide gap-2 bg-gradient-to-r from-blue-600 to-primary hover:from-blue-500 hover:to-emerald-500 text-white shadow-xl rounded-xl"
            >
              {loading ? (
                'Processing Sale...'
              ) : (
                <>
                  <Printer className="h-5 w-5" />
                  <span>MARK AS PAID & PRINT RECEIPT</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Printable Supermarket Receipt Dialog */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="max-w-md bg-white text-slate-900 border-slate-300 font-mono p-6">
          <DialogHeader className="text-center space-y-1 border-b border-dashed border-slate-300 pb-4">
            <DialogTitle className="text-xl font-extrabold uppercase text-slate-900 tracking-wider">
              {completedReceipt?.storeName}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 font-sans">
              {completedReceipt?.storeLocation}
            </DialogDescription>
            <p className="text-[11px] text-slate-500 pt-1 font-sans">
              Receipt #{completedReceipt?.orderId?.slice(0, 8)} • {completedReceipt?.date}
            </p>
          </DialogHeader>

          <div className="py-4 space-y-4 text-xs">
            <div className="flex justify-between text-slate-600 font-sans">
              <span>Cashier: <strong>{completedReceipt?.cashierName}</strong></span>
              <span>Customer: <strong>{completedReceipt?.customerName}</strong></span>
            </div>

            {/* Itemized Table */}
            <div className="border-t border-b border-dashed border-slate-300 py-3">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 uppercase text-[10px] text-slate-500 font-bold">
                    <th className="pb-1">Qty Item</th>
                    <th className="pb-1 text-right">Price</th>
                    <th className="pb-1 text-right">Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completedReceipt?.items?.map((item: any) => (
                    <tr key={item.id} className="py-1">
                      <td className="py-1 font-medium pr-1">
                        {item.quantity}x {item.name}
                      </td>
                      <td className="py-1 text-right text-slate-600">
                        ₦{item.unit_price.toFixed(2)}
                      </td>
                      <td className="py-1 text-right font-bold text-slate-900">
                        ₦{(item.unit_price * item.quantity).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-right">
              <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200">
                <span>TOTAL PAID</span>
                <span>₦{completedReceipt?.totalAmount?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 font-sans">
                <span>Payment Method</span>
                <span className="uppercase font-bold">{completedReceipt?.paymentMethod}</span>
              </div>
              {completedReceipt?.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between text-xs text-slate-600 font-sans">
                    <span>Cash Tendered</span>
                    <span>₦{completedReceipt?.cashTendered?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-emerald-700 font-sans">
                    <span>Change Returned</span>
                    <span>₦{completedReceipt?.changeDue?.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="text-center pt-4 border-t border-dashed border-slate-300 text-[11px] text-slate-500 font-sans space-y-1">
              <p className="font-bold text-slate-800">Thank you for shopping with us!</p>
              <p>Please keep this receipt for return or exchange.</p>
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-200 font-sans">
            <Button
              onClick={handlePrintReceipt}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2"
            >
              <Printer className="h-4 w-4" />
              <span>Print Thermal Receipt</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsReceiptOpen(false);
                clearBill();
              }}
              className="border-slate-300"
            >
              New Sale
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
