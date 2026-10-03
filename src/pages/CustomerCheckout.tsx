import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { saveNeonOrder } from '@/lib/neon';
import { payWithFlutterwave } from '@/lib/flutterwave';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  ShoppingBag, 
  CreditCard, 
  Banknote, 
  ShieldCheck, 
  ArrowLeft, 
  CheckCircle2, 
  Truck, 
  Lock, 
  Tag, 
  Sparkles,
  Building,
  User,
  Mail,
  Phone,
  MapPin,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerCheckout() {
  const navigate = useNavigate();
  const { cart, totalAmount, clearCart, itemCount } = useCart();
  const { user } = useAuth();

  // Shipping Form State
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Lagos');
  const [state, setState] = useState('Lagos');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Promo Code State
  const [promoCode, setPromoCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [appliedCode, setAppliedCode] = useState('');

  // Payment Method State
  const [paymentMethod, setPaymentMethod] = useState<'flutterwave' | 'card' | 'transfer' | 'cod'>('flutterwave');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      if (!fullName) setFullName(user.full_name || '');
      if (!email) setEmail(user.email || '');
    }
  }, [user]);

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
          <ShoppingBag className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-black mb-2">Your Cart is Empty</h1>
        <p className="text-muted-foreground max-w-md mb-6">
          Looks like you haven't added any products to your cart yet. Visit our shop catalog to find top products!
        </p>
        <Button onClick={() => navigate('/')} className="gap-2 px-6 py-6 text-base font-bold shadow-lg">
          <ArrowLeft className="h-5 w-5" />
          <span>Return to Store Catalog</span>
        </Button>
      </div>
    );
  }

  // Calculations
  const discountAmount = (totalAmount * discountPercent) / 100;
  const shippingFee = totalAmount > 50000 ? 0 : 1500;
  const grandTotal = Math.max(0, totalAmount - discountAmount + shippingFee);

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = promoCode.trim().toUpperCase();
    if (clean === 'WELCOME10' || clean === 'POCKET10' || clean === 'SAVE10') {
      setDiscountPercent(10);
      setAppliedCode(clean);
      toast.success('Promo code applied! 10% discount applied to cart.');
    } else if (clean === 'SUPER20') {
      setDiscountPercent(20);
      setAppliedCode(clean);
      toast.success('Promo code applied! 20% discount applied to cart.');
    } else {
      toast.error('Invalid or expired promo code. Try "POCKET10".');
    }
  };

  const processOrderCompletion = async (payMethod: string, payRef?: string) => {
    setLoading(true);
    const orderId = crypto.randomUUID();
    const primaryStoreId = cart[0]?.store_id || 'default-store';
    const fullShippingAddress = `${address}, ${city}, ${state}. ${deliveryNotes ? `(Notes: ${deliveryNotes})` : ''}`;

    try {
      // 1. Save order to Neon Postgres Database
      await saveNeonOrder({
        id: orderId,
        store_id: primaryStoreId,
        customer_name: fullName,
        customer_email: email,
        shipping_address: fullShippingAddress,
        phone,
        total_amount: grandTotal,
        payment_method: payMethod,
        items: cart.map((item) => ({
          id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.selling_price,
          total_price: item.selling_price * item.quantity,
        })),
      });

      // Cache locally for instant loading on receipt page
      localStorage.setItem(
        `pocket_order_${orderId}`,
        JSON.stringify({
          id: orderId,
          customer_name: fullName,
          customer_email: email,
          shipping_address: fullShippingAddress,
          phone,
          total_amount: grandTotal,
          payment_method: payMethod,
          payment_reference: payRef || `REF_${Date.now()}`,
          created_at: new Date().toISOString(),
          items: cart.map((i) => ({
            id: i.id,
            product_name: i.name,
            quantity: i.quantity,
            unit_price: i.selling_price,
            total_price: i.selling_price * i.quantity,
          })),
        })
      );

      // 2. Dispatch Email Confirmation Notice via Mailgun Service API
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            subject: `Order Receipt #${orderId.slice(0, 8)} - Pocket Shop`,
            customerName: fullName,
            totalAmount: grandTotal,
            orderId,
            items: cart,
          }),
        }).catch(() => console.log('Mailgun client call recorded'));
      } catch (err) {
        console.warn('Mailgun notice:', err);
      }

      clearCart();
      toast.success('Order placed successfully!');
      navigate(`/order-success/${orderId}`);
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error('Failed to submit order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !address.trim() || !phone.trim()) {
      toast.error('Please fill in all required contact and delivery details.');
      return;
    }

    if (paymentMethod === 'flutterwave') {
      setLoading(true);
      try {
        await payWithFlutterwave({
          email,
          amount: grandTotal,
          customerName: fullName,
          phone,
          title: 'Pocket Shop Checkout',
          description: `Payment for ${itemCount} order item(s)`,
          onSuccess: (response) => {
            toast.success('Flutterwave payment verified!');
            processOrderCompletion('flutterwave', response.transaction_id || response.tx_ref);
          },
          onClose: () => {
            setLoading(false);
            toast.info('Flutterwave checkout closed. Your order was not placed.');
          },
        });
      } catch (err: any) {
        setLoading(false);
        toast.error(
          err?.message?.includes('VITE_FLUTTERWAVE_PUBLIC_KEY')
            ? 'Flutterwave is not configured — add your real Public Key to .env and restart the dev server.'
            : 'Could not open Flutterwave. Check your internet connection and try again.',
          { duration: 8000 }
        );
        console.error('[Flutterwave init error]', err?.message);
      }
      return;
    }

    // Direct process for card / bank transfer / COD
    processOrderCompletion(paymentMethod);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      {/* Top Header */}
      <header className="border-b bg-card/90 backdrop-blur-md sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 max-w-6xl flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="gap-2 font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Shop</span>
          </Button>

          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Flutterwave 256-Bit Encrypted Checkout
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8 text-center sm:text-left">
          <h1 className="text-3xl font-black tracking-tight">Checkout & Order Review</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete your delivery information and select your payment method to finalize order
          </p>
        </div>

        <form onSubmit={handleSubmitCheckout} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Side: Delivery Details & Payment Method (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Customer Contact & Shipping Address */}
            <Card className="shadow-md border-border/70">
              <CardHeader className="p-5 pb-3 border-b bg-muted/20">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Step 1: Contact & Delivery Address
                </CardTitle>
                <CardDescription className="text-xs">
                  Where should we deliver your order?
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs font-semibold flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-muted-foreground" /> Full Name *
                    </Label>
                    <Input
                      id="fullName"
                      placeholder="e.g. Chukwuma Adebayo"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email Address *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Phone Number *
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="08012345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="state" className="text-xs font-semibold">State / Region *</Label>
                    <Input
                      id="state"
                      placeholder="Lagos, Abuja, Rivers..."
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      required
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="address" className="text-xs font-semibold">Street Delivery Address *</Label>
                  <Input
                    id="address"
                    placeholder="House/Plot number, Street Name, Estate/Landmark"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="deliveryNotes" className="text-xs font-semibold">Delivery Notes / Landmark (Optional)</Label>
                  <Input
                    id="deliveryNotes"
                    placeholder="e.g. Leave with security guard at gate"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    className="bg-background"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Payment Method */}
            <Card className="shadow-md border-border/70">
              <CardHeader className="p-5 pb-3 border-b bg-muted/20">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Step 2: Select Payment Method
                </CardTitle>
                <CardDescription className="text-xs">
                  Pay securely via Flutterwave, Card, Bank Transfer, or Cash on Delivery
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <Tabs value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)} className="space-y-4">
                  <TabsList className="grid grid-cols-2 sm:grid-cols-4 h-auto p-1 bg-muted">
                    <TabsTrigger value="flutterwave" className="py-2.5 text-xs font-bold gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      Flutterwave
                    </TabsTrigger>
                    <TabsTrigger value="card" className="py-2.5 text-xs font-bold gap-1.5">
                      <CreditCard className="h-3.5 w-3.5" />
                      Card
                    </TabsTrigger>
                    <TabsTrigger value="transfer" className="py-2.5 text-xs font-bold gap-1.5">
                      <Building className="h-3.5 w-3.5" />
                      Transfer
                    </TabsTrigger>
                    <TabsTrigger value="cod" className="py-2.5 text-xs font-bold gap-1.5">
                      <Banknote className="h-3.5 w-3.5" />
                      Pay on Delivery
                    </TabsTrigger>
                  </TabsList>

                  {/* Flutterwave Content */}
                  <TabsContent value="flutterwave" className="space-y-3 pt-2">
                    <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/30 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-primary text-sm flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" /> Flutterwave Payment Gateway
                        </span>
                        <Badge className="bg-primary text-white font-bold text-[10px]">Instant Authorization</Badge>
                      </div>
                      <p className="text-muted-foreground">
                        Supports Debit/Credit Cards, Bank Transfer, USSD (*737#, *901#), Mobile Money, M-Pesa, and Barter.
                      </p>
                    </div>
                  </TabsContent>

                  {/* Card Content */}
                  <TabsContent value="card" className="space-y-3 pt-2">
                    <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                      <p className="text-xs text-muted-foreground font-medium">
                        Instant Card Checkout (Flutterwave Card Channel):
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <Input placeholder="Card Number (4111 ....)" className="col-span-2 text-xs bg-background" />
                        <Input placeholder="MM / YY" className="text-xs bg-background" />
                        <Input placeholder="CVV (123)" className="text-xs bg-background" />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Bank Transfer Content */}
                  <TabsContent value="transfer" className="space-y-3 pt-2">
                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-2">
                      <p className="font-bold text-blue-600 text-sm">Store Bank Account Details:</p>
                      <div className="space-y-1 bg-background/80 p-3 rounded-lg border font-mono">
                        <p>Bank: <strong className="text-foreground">Guaranty Trust Bank (GTBank)</strong></p>
                        <p>Account Number: <strong className="text-foreground text-sm">0123456789</strong></p>
                        <p>Account Name: <strong className="text-foreground">Pocket Shop Retail Ltd</strong></p>
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        Please use your Full Name as transfer reference. Order completes once payment is confirmed.
                      </p>
                    </div>
                  </TabsContent>

                  {/* Pay on Delivery Content */}
                  <TabsContent value="cod" className="space-y-3 pt-2">
                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-xs space-y-1">
                      <p className="font-bold text-primary text-sm">Cash or POS on Delivery</p>
                      <p className="text-muted-foreground">
                        Pay with Cash or POS terminal when your order arrives at your doorstep.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right Side: Order Summary & Coupon (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="shadow-lg border-border/80 sticky top-24">
              <CardHeader className="p-5 pb-3 border-b bg-muted/20">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span>Order Summary</span>
                  <Badge variant="secondary" className="font-bold">{itemCount} item(s)</Badge>
                </CardTitle>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                {/* Cart Items List */}
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 divide-y">
                  {cart.map((item) => (
                    <div key={item.id} className="pt-3 first:pt-0 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-10 w-10 rounded object-cover border" />
                        ) : (
                          <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                            {item.name.slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <p className="font-bold line-clamp-1">{item.name}</p>
                          <p className="text-muted-foreground">Qty: {item.quantity} × ₦{item.selling_price.toFixed(2)}</p>
                        </div>
                      </div>
                      <span className="font-extrabold text-foreground">
                        ₦{(item.selling_price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Promo Code Input */}
                <div className="pt-3 border-t">
                  <form onSubmit={handleApplyPromo} className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Promo code (e.g. POCKET10)"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        className="pl-8 text-xs uppercase h-9 bg-background"
                      />
                    </div>
                    <Button type="submit" size="sm" variant="outline" className="h-9 font-semibold text-xs">
                      Apply
                    </Button>
                  </form>
                  {appliedCode && (
                    <p className="text-[11px] text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Code "{appliedCode}" applied (-{discountPercent}%)
                    </p>
                  )}
                </div>

                {/* Totals Breakdown */}
                <div className="space-y-2 text-xs pt-3 border-t">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-semibold text-foreground">₦{totalAmount.toFixed(2)}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Discount ({discountPercent}%)</span>
                      <span>-₦{discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Truck className="h-3.5 w-3.5 text-primary" /> Delivery Fee
                    </span>
                    <span className="font-semibold text-foreground">
                      {shippingFee === 0 ? <span className="text-emerald-600 font-bold">FREE</span> : `₦${shippingFee.toFixed(2)}`}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline pt-3 border-t text-sm font-black">
                    <span>Grand Total</span>
                    <span className="text-2xl text-primary font-black">₦{grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Submit Order Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full py-7 text-base font-extrabold tracking-wide gap-2 bg-gradient-to-r from-primary via-primary/80 to-primary text-white shadow-xl rounded-xl"
                >
                  {loading ? (
                    'Processing Order...'
                  ) : paymentMethod === 'flutterwave' ? (
                    <>
                      <Zap className="h-5 w-5 text-yellow-200" />
                      <span>PAY ₦{grandTotal.toFixed(2)} WITH FLUTTERWAVE</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-5 w-5" />
                      <span>PLACE ORDER (₦{grandTotal.toFixed(2)})</span>
                    </>
                  )}
                </Button>

                <p className="text-[11px] text-center text-muted-foreground">
                  By clicking Place Order, you agree to Pocket Shop terms and Mailgun email notification delivery.
                </p>
              </CardContent>
            </Card>
          </div>
        </form>
      </main>
    </div>
  );
}
