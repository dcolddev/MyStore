import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { CartDrawer } from '@/components/CartDrawer';
import { getNeonSql } from '@/lib/neon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Store, 
  ShoppingBag, 
  Search, 
  Sparkles, 
  ShieldCheck, 
  Truck, 
  Star, 
  ArrowRight,
  UserCheck,
  Package,
  LogOut
} from 'lucide-react';
import { toast } from 'sonner';

interface ProductItem {
  id: string;
  store_id: string;
  name: string;
  selling_price: number;
  cost_price?: number;
  quantity: number;
  category?: string;
  image?: string;
}

const DEMO_PRODUCTS: ProductItem[] = [
  {
    id: 'demo-1',
    store_id: 'default-store',
    name: 'Aura Wireless Headphones',
    selling_price: 45000,
    quantity: 12,
    category: 'Electronics',
    image: '/images/electronics.png',
  },
  {
    id: 'demo-2',
    store_id: 'default-store',
    name: 'Pro Smartwatch Series 9',
    selling_price: 65000,
    quantity: 8,
    category: 'Electronics',
    image: '/images/watch.png',
  },
  {
    id: 'demo-3',
    store_id: 'default-store',
    name: 'Artisanal Organic House Blend',
    selling_price: 8500,
    quantity: 25,
    category: 'Groceries',
    image: '/images/coffee.png',
  },
];

export default function Index() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { addToCart, itemCount, setIsCartOpen } = useCart();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const sql = getNeonSql();
      if (sql) {
        const data = await sql`SELECT * FROM products ORDER BY created_at DESC`;
        if (data && data.length > 0) {
          const formatted: ProductItem[] = data.map((p: any, idx: number) => ({
            id: p.id,
            store_id: p.store_id,
            name: p.name,
            selling_price: Number(p.selling_price),
            cost_price: Number(p.cost_price),
            quantity: Number(p.quantity),
            category: idx % 2 === 0 ? 'Electronics' : 'Groceries',
            image: idx === 0 ? '/images/electronics.png' : idx === 1 ? '/images/watch.png' : '/images/coffee.png',
          }));
          setProducts(formatted);
          return;
        }
      }
      setProducts(DEMO_PRODUCTS);
    } catch {
      setProducts(DEMO_PRODUCTS);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', 'Electronics', 'Groceries', 'Fashion', 'Accessories'];

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddToCart = (product: ProductItem) => {
    addToCart({
      id: product.id,
      name: product.name,
      selling_price: product.selling_price,
      cost_price: product.cost_price,
      store_id: product.store_id,
      image: product.image,
    });
    toast.success(`Added "${product.name}" to cart!`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Banner Notice */}
      <div className="bg-primary px-4 py-2 text-center text-xs font-semibold text-primary-foreground flex items-center justify-center gap-2">
        <Sparkles className="h-3.5 w-3.5" />
        <span>Welcome to Pocket Shop • Instant Order Processing & Delivery • Mailgun Email Notices Enabled</span>
      </div>

      {/* Main Header / Navbar */}
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto flex items-center justify-between p-4 max-w-7xl">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-600 shadow-md">
              <Store className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
                Pocket Shop
              </span>
              <span className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                Storefront & Catalog
              </span>
            </div>
          </div>

          {/* Search Bar - Hidden on small mobile */}
          <div className="hidden md:flex items-center relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products in shop..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 rounded-full bg-muted/50 border-border/60 focus-visible:ring-primary"
            />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(user ? '/dashboard' : '/auth')}
              className="gap-2 font-medium border-border/80"
            >
              {user ? (
                <>
                  <UserCheck className="h-4 w-4 text-success" />
                  <span className="hidden sm:inline">Manager Portal</span>
                </>
              ) : (
                <>
                  <Store className="h-4 w-4 text-primary" />
                  <span>Shop Login</span>
                </>
              )}
            </Button>

            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="text-destructive hover:bg-destructive/10 border-destructive/20 gap-1.5 font-medium"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            )}

            <Button
              onClick={() => setIsCartOpen(true)}
              className="relative gap-2 px-4 shadow-md bg-gradient-to-r from-primary to-indigo-600 text-white"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline font-semibold">Cart</span>
              {itemCount > 0 && (
                <Badge className="bg-amber-400 text-slate-950 font-bold px-1.5 py-0.5 rounded-full text-xs animate-pulse">
                  {itemCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>

      <CartDrawer />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-primary/5 to-background py-12 md:py-20 border-b">
        <div className="container mx-auto px-4 max-w-7xl relative z-10 text-center">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 px-3 py-1 text-sm font-medium">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Premium Online Retail & POS Storefront
          </Badge>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 max-w-3xl mx-auto leading-tight">
            Discover Top Quality Products at <span className="bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">Pocket Shop</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Shop directly from our verified inventory. Enjoy instant checkout, live database tracking, and automatic Mailgun confirmation receipts.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-muted-foreground">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              <span>Fast Doorstep Delivery</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-success" />
              <span>Supabase Database Secured</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
              <span>4.9/5 Rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Search Bar */}
      <div className="md:hidden p-4 bg-card border-b">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 rounded-full"
          />
        </div>
      </div>

      {/* Main Catalog Section */}
      <main className="container mx-auto px-4 py-10 max-w-7xl flex-1">
        {/* Category Filter Pills */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Product Catalog</h2>
            <p className="text-sm text-muted-foreground">Select an item to add to your cart and checkout</p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className="rounded-full text-xs font-semibold"
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-80 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border p-8 space-y-4">
            <Package className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-bold">No products found</h3>
            <p className="text-sm text-muted-foreground">Try clearing your search query or selecting a different category.</p>
            <Button variant="outline" onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}>
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden group hover:shadow-xl transition-all duration-300 border-border/60 flex flex-col justify-between">
                <div>
                  <div className="relative h-48 w-full bg-muted/30 overflow-hidden">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-gradient-to-tr from-primary/10 to-indigo-500/10 font-bold text-xl text-primary">
                        {product.name}
                      </div>
                    )}
                    {product.quantity <= 5 && product.quantity > 0 && (
                      <Badge variant="destructive" className="absolute top-3 right-3 shadow-md">
                        Only {product.quantity} left
                      </Badge>
                    )}
                    {product.category && (
                      <Badge variant="secondary" className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm shadow-sm text-xs font-semibold">
                        {product.category}
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-5 space-y-2">
                    <h3 className="font-bold text-base line-clamp-1 group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-amber-500">
                      <Star className="h-3.5 w-3.5 fill-amber-500" />
                      <Star className="h-3.5 w-3.5 fill-amber-500" />
                      <Star className="h-3.5 w-3.5 fill-amber-500" />
                      <Star className="h-3.5 w-3.5 fill-amber-500" />
                      <Star className="h-3.5 w-3.5 fill-amber-500" />
                      <span className="text-muted-foreground ml-1 font-medium">(4.9)</span>
                    </div>

                    <div className="pt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-primary">
                        ₦{product.selling_price.toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </div>

                <div className="p-5 pt-0">
                  <Button
                    onClick={() => handleAddToCart(product)}
                    className="w-full gap-2 font-semibold shadow-md group/btn"
                  >
                    <ShoppingBag className="h-4 w-4 group-hover/btn:scale-110 transition-transform" />
                    <span>Add to Cart</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-10 mt-12">
        <div className="container mx-auto px-4 max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              PS
            </div>
            <div>
              <p className="font-bold text-foreground">Pocket Shop Manager & Storefront</p>
              <p className="text-xs">Persisted via Supabase • Mailgun Confirmation Service Enabled</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Button variant="link" size="sm" onClick={() => navigate('/dashboard')}>
              Dashboard Portal
            </Button>
            <Button variant="link" size="sm" onClick={() => navigate('/auth')}>
              Sign In / Sign Up
            </Button>
            <Button variant="link" size="sm" onClick={() => setIsCartOpen(true)}>
              Cart ({itemCount})
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
