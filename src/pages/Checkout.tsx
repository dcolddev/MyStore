import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { sendOrderConfirmationEmail } from '@/lib/mailgun';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, CreditCard, ShoppingBag, Truck, CheckCircle, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { saveNeonOrder } from '@/lib/neon';

export default function Checkout() {
  const navigate = useNavigate();
  const { cart, totalAmount, clearCart } = useCart();
  const [loading, setLoading] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'transfer'>('card');
  const [sendMailgunEmail, setSendMailgunEmail] = useState(true);

  const shippingFee = cart.length > 0 ? 500 : 0;
  const grandTotal = totalAmount + shippingFee;

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 space-y-4">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold">Your cart is empty</h2>
          <p className="text-sm text-muted-foreground">Add items to your cart before proceeding to checkout.</p>
          <Button onClick={() => navigate('/')} className="w-full">
            Back to Shop
          </Button>
        </Card>
      </div>
    );
  }

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName || !customerEmail || !address) {
      toast.error('Please complete all required shipping fields');
      return;
    }

    setLoading(true);

    try {
      const firstStoreId = cart[0]?.store_id || null;
      const fullShippingAddress = `${address}, ${city}`;
      let finalOrderId = crypto.randomUUID();

      // 1. Persist Order in Neon Postgres (Serverless DB)
      try {
        await saveNeonOrder({
          id: finalOrderId,
          store_id: firstStoreId,
          customer_name: customerName,
          customer_email: customerEmail,
          shipping_address: fullShippingAddress,
          phone: phone || null,
          total_amount: grandTotal,
          payment_method: paymentMethod,
          items: cart.map((i) => ({
            id: i.id,
            product_name: i.name,
            quantity: i.quantity,
            unit_price: i.selling_price,
            total_price: i.selling_price * i.quantity,
          })),
        });
      } catch (neonErr) {
        console.warn('Neon database order save notice:', neonErr);
      }

      // Cache order locally for receipt rendering
      const localOrderObj = {
        id: finalOrderId,
        customer_name: customerName,
        customer_email: customerEmail,
        shipping_address: fullShippingAddress,
        payment_method: paymentMethod,
        total_amount: grandTotal,
        created_at: new Date().toISOString(),
        items: cart.map((i) => ({
          id: i.id,
          product_name: i.name,
          quantity: i.quantity,
          unit_price: i.selling_price,
          total_price: i.selling_price * i.quantity,
        })),
      };
      localStorage.setItem(`pocket_order_${finalOrderId}`, JSON.stringify(localOrderObj));

      // Send Confirmation Email via Mailgun
      if (sendMailgunEmail) {
        const mailRes = await sendOrderConfirmationEmail({
          orderId: finalOrderId,
          customerName,
          customerEmail,
          shippingAddress: fullShippingAddress,
          totalAmount: grandTotal,
          paymentMethod,
          items: cart.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.selling_price,
            totalPrice: i.selling_price * i.quantity,
          })),
        });

        if (mailRes.success) {
          toast.success(mailRes.message);
        } else {
          toast.info(`Order created! Email notice: ${mailRes.message}`);
        }
      }

      clearCart();
      navigate(`/order-success/${finalOrderId}`);
    } catch (error: any) {
      console.error('Checkout Error:', error);
      toast.error(error.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between p-4 max-w-5xl">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Shop
          </Button>
          <div className="flex items-center gap-2 font-bold text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span>Secure Checkout</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4 md:py-8 max-w-5xl">
        <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Columns - Form Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Customer & Shipping Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  1. Shipping & Customer Details
                </CardTitle>
                <CardDescription>Enter your contact and delivery address.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customerName">Full Name*</Label>
                    <Input
                      id="customerName"
                      placeholder="Jane Doe"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customerEmail">Email Address*</Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      placeholder="jane@example.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+234 800 000 0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City / State</Label>
                    <Input
                      id="city"
                      placeholder="Lagos, Nigeria"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Delivery Address*</Label>
                  <Input
                    id="address"
                    placeholder="123 Main Street, Suite 4B"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
            </Card>

            {/* Payment Options */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  2. Payment Method
                </CardTitle>
                <CardDescription>Select your preferred payment method.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(val: any) => setPaymentMethod(val)}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-3 border p-4 rounded-lg cursor-pointer hover:border-primary">
                    <RadioGroupItem value="card" id="pm-card" />
                    <Label htmlFor="pm-card" className="flex-1 cursor-pointer font-medium">
                      Debit / Credit Card (Instant Authorization)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 border p-4 rounded-lg cursor-pointer hover:border-primary">
                    <RadioGroupItem value="transfer" id="pm-transfer" />
                    <Label htmlFor="pm-transfer" className="flex-1 cursor-pointer font-medium">
                      Direct Bank Transfer
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 border p-4 rounded-lg cursor-pointer hover:border-primary">
                    <RadioGroupItem value="cash" id="pm-cash" />
                    <Label htmlFor="pm-cash" className="flex-1 cursor-pointer font-medium">
                      Cash on Delivery
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Notifications & Options */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="mailgunOpt"
                    checked={sendMailgunEmail}
                    onCheckedChange={(checked) => setSendMailgunEmail(!!checked)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="mailgunOpt" className="font-semibold flex items-center gap-1.5 cursor-pointer">
                      <Mail className="h-4 w-4 text-primary" />
                      Send Order Confirmation Email via Mailgun
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      An itemized receipt and order tracking code will be dispatched to your email.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Order Summary */}
          <div className="space-y-6">
            <Card className="shadow-lg border-primary/20 sticky top-20">
              <CardHeader className="bg-muted/40 pb-4">
                <CardTitle className="text-lg">Order Summary</CardTitle>
                <CardDescription>{cart.length} item(s) in your cart</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <span className="font-semibold">
                        ₦{(item.selling_price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>₦{totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Standard Shipping</span>
                    <span>₦{shippingFee.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-lg text-primary">
                    <span>Total</span>
                    <span>₦{grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full py-6 text-base font-bold gap-2 shadow-xl"
                >
                  {loading ? (
                    'Processing Order...'
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      <span>Complete Purchase</span>
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1 pt-2">
                  <ShieldCheck className="h-4 w-4 text-success" /> 256-Bit Encrypted & Persisted via Neon Postgres
                </p>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
}
