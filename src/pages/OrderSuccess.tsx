import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2, ShoppingBag, Mail, Printer, ArrowLeft, PackageCheck } from 'lucide-react';
import { format } from 'date-fns';

export default function OrderSuccess() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId!)
        .single();

      if (!orderErr && orderData) {
        setOrder(orderData);
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', orderId!);

        setItems(itemsData || []);
        return;
      }
      throw new Error('Supabase order not found, fallback to local');
    } catch {
      const cachedStr = localStorage.getItem(`pocket_order_${orderId}`);
      if (cachedStr) {
        try {
          const cached = JSON.parse(cachedStr);
          setOrder(cached);
          setItems(cached.items || []);
        } catch (e) {
          console.error('Failed to parse cached order:', e);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading receipt...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 p-4 py-8">
      <div className="container mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success shadow-lg">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Order Confirmed!</h1>
          <p className="text-muted-foreground">
            Thank you for shopping with us. Your order has been placed and saved in Supabase.
          </p>
        </div>

        <Card className="shadow-xl border-border/80">
          <CardHeader className="border-b bg-muted/30 pb-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PackageCheck className="h-5 w-5 text-primary" />
                  Order #{orderId?.slice(0, 8)}
                </CardTitle>
                <CardDescription>
                  Placed on {order?.created_at ? format(new Date(order.created_at), 'PPP p') : 'Today'}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="h-4 w-4" />
                Print Receipt
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {/* Notification Badge */}
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-primary">Mailgun Confirmation Dispatched</p>
                <p className="text-muted-foreground">
                  An itemized confirmation email has been sent to <strong>{order?.customer_email}</strong>.
                </p>
              </div>
            </div>

            {/* Customer Information */}
            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/20 p-4 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold">Customer Name</p>
                <p className="font-medium mt-0.5">{order?.customer_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold">Payment Method</p>
                <p className="font-medium mt-0.5 capitalize">{order?.payment_method || 'Card'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground uppercase font-bold">Shipping Address</p>
                <p className="font-medium mt-0.5">{order?.shipping_address}</p>
              </div>
            </div>

            {/* Items Summary Table */}
            <div>
              <h3 className="font-semibold mb-3">Order Items</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left font-semibold">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Price</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="p-3 font-medium">{item.product_name}</td>
                        <td className="p-3 text-center">{item.quantity}</td>
                        <td className="p-3 text-right">₦{Number(item.unit_price).toFixed(2)}</td>
                        <td className="p-3 text-right font-semibold">₦{Number(item.total_price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Summary */}
            <div className="flex justify-between items-center p-4 bg-muted/40 rounded-lg text-base font-bold">
              <span>Total Paid</span>
              <span className="text-2xl text-primary">₦{Number(order?.total_amount || 0).toFixed(2)}</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button onClick={() => navigate('/')} className="flex-1 gap-2 py-5 text-base">
                <ShoppingBag className="h-5 w-5" />
                Continue Shopping
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')} className="flex-1 gap-2 py-5 text-base">
                <ArrowLeft className="h-5 w-5" />
                Shop Manager Portal
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
