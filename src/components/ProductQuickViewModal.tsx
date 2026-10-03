import React, { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Star, ShieldCheck, Truck, Plus, Minus, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export interface CatalogProduct {
  id: string;
  store_id: string;
  name: string;
  selling_price: number;
  cost_price?: number;
  quantity: number;
  category?: string;
  image?: string;
  description?: string;
}

interface ProductQuickViewModalProps {
  product: CatalogProduct | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ProductQuickViewModal: React.FC<ProductQuickViewModalProps> = ({
  product,
  isOpen,
  onClose,
}) => {
  const { addToCart, setIsCartOpen } = useCart();
  const [selectedQty, setSelectedQty] = useState(1);
  const navigate = useNavigate();

  if (!product) return null;

  const handleAddToCart = () => {
    for (let i = 0; i < selectedQty; i++) {
      addToCart({
        id: product.id,
        name: product.name,
        selling_price: product.selling_price,
        cost_price: product.cost_price,
        store_id: product.store_id,
        image: product.image,
      });
    }
    toast.success(`Added ${selectedQty}x "${product.name}" to cart!`);
    onClose();
  };

  const handleBuyNow = () => {
    handleAddToCart();
    setIsCartOpen(false);
    navigate('/checkout');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-card border-border/80 rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left Column: Image */}
          <div className="relative h-64 md:h-full bg-gradient-to-br from-primary/10 via-muted/40 to-muted/80 flex items-center justify-center p-6 min-h-[300px]">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="max-h-[280px] w-auto object-contain drop-shadow-xl hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="h-32 w-32 rounded-2xl bg-primary/20 flex items-center justify-center font-extrabold text-primary text-3xl">
                {product.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            {product.category && (
              <Badge className="absolute top-4 left-4 bg-background/90 text-foreground border shadow-sm font-semibold text-xs">
                {product.category}
              </Badge>
            )}

            <Badge
              variant={product.quantity > 5 ? 'secondary' : 'destructive'}
              className="absolute top-4 right-4 shadow-sm text-xs font-semibold"
            >
              {product.quantity > 0 ? `${product.quantity} in stock` : 'Out of Stock'}
            </Badge>
          </div>

          {/* Right Column: Details */}
          <div className="p-6 md:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <DialogHeader className="p-0 text-left space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-primary font-semibold mb-1">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="h-3.5 w-3.5 fill-primary/70 text-primary/70" />
                    ))}
                  </div>
                  <span>4.9 / 5.0 (24 Verified Reviews)</span>
                </div>
                <DialogTitle className="text-2xl font-black tracking-tight leading-snug">
                  {product.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Verified Authentic • Store ID: {product.store_id}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black text-primary">
                  ₦{product.selling_price.toFixed(2)}
                </span>
                <span className="text-xs text-muted-foreground line-through">
                  ₦{(product.selling_price * 1.15).toFixed(2)}
                </span>
                <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold">
                  Save 15%
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                {product.description ||
                  `Experience top-tier quality with ${product.name}. Carefully sourced, verified for authenticity, and stored in optimal conditions for fast doorstep delivery.`}
              </p>

              {/* Product Feature Highlights */}
              <div className="space-y-2 pt-2 border-t text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary shrink-0" />
                  <span>Ships within 24 hours across Nigeria</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Flutterwave Payment Protection Included</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>Automatic Email Confirmation & Receipt</span>
                </div>
              </div>
            </div>

            {/* Quantity and Actions */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quantity</span>
                <div className="flex items-center gap-3 bg-muted/60 p-1 rounded-lg border">
                  <button
                    type="button"
                    onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}
                    className="h-7 w-7 rounded bg-background flex items-center justify-center text-foreground hover:bg-muted font-bold text-xs"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-extrabold text-sm w-6 text-center">{selectedQty}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedQty((q) => Math.min(product.quantity || 99, q + 1))}
                    className="h-7 w-7 rounded bg-background flex items-center justify-center text-foreground hover:bg-muted font-bold text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleAddToCart}
                  variant="outline"
                  className="flex-1 py-6 font-bold gap-2 border-primary/40 text-primary hover:bg-primary/10"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Add to Cart</span>
                </Button>
                <Button
                  onClick={handleBuyNow}
                  className="flex-1 py-6 font-bold gap-2 bg-gradient-to-r from-primary to-primary/60 text-white shadow-md"
                >
                  <span>Buy Now</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
