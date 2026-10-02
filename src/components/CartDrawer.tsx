import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight } from 'lucide-react';

export const CartDrawer = () => {
  const { cart, removeFromCart, updateQuantity, totalAmount, itemCount, isCartOpen, setIsCartOpen } = useCart();
  const navigate = useNavigate();

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    navigate('/checkout');
  };

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col justify-between p-6">
        <div>
          <SheetHeader className="border-b pb-4 mb-4">
            <SheetTitle className="flex items-center gap-2 text-xl font-bold">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Your Shopping Cart ({itemCount})
            </SheetTitle>
          </SheetHeader>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <ShoppingBag className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <p className="text-base font-medium">Your cart is currently empty</p>
              <p className="text-sm">Browse our shop catalog and add items to your cart.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-card/60 shadow-sm"
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-14 w-14 rounded-md object-cover border"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-md bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                      {item.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">{item.name}</h4>
                    <p className="text-sm font-medium text-primary mt-0.5">
                      ₦{item.selling_price.toFixed(2)}
                    </p>

                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6 rounded"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-xs font-semibold w-4 text-center">
                        {item.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6 rounded"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="font-bold text-sm">
                      ₦{(item.selling_price * item.quantity).toFixed(2)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <SheetFooter className="border-t pt-4 flex-col space-y-4 sm:flex-col">
            <div className="flex items-center justify-between text-base font-semibold w-full">
              <span>Subtotal</span>
              <span className="text-xl font-bold text-primary">₦{totalAmount.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Shipping & taxes calculated at checkout.
            </p>
            <Button
              className="w-full py-6 text-base font-semibold gap-2 shadow-lg"
              onClick={handleProceedToCheckout}
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="h-5 w-5" />
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};
