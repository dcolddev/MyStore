import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { CartDrawer } from '@/components/CartDrawer';
import { ProductQuickViewModal, CatalogProduct } from '@/components/ProductQuickViewModal';
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
  UserCheck,
  Package,
  PackageCheck,
  LogOut,
  Eye,
  SlidersHorizontal,
  CreditCard,
  User,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

const DEMO_PRODUCTS: CatalogProduct[] = [
  {
    id: 'demo-1',
    store_id: 'default-store',
    name: 'Aura Premium Wireless Headphones',
    selling_price: 45000,
    cost_price: 32000,
    quantity: 12,
    category: 'Electronics',
    image: '/images/electronics.png',
    description: 'Active noise cancelling wireless headphones with 40-hour battery life and deep bass response.',
  },
  {
    id: 'demo-2',
    store_id: 'default-store',
    name: 'Pro Smartwatch Series 9 (AMOLED)',
    selling_price: 65000,
    cost_price: 45000,
    quantity: 8,
    category: 'Electronics',
    image: '/images/watch.png',
    description: 'Ultra-bright AMOLED display smartwatch with heart rate, SpO2, sleep tracking, and IP68 waterproofing.',
  },
  {
    id: 'demo-3',
    store_id: 'default-store',
    name: 'Artisanal Organic House Coffee Blend',
    selling_price: 8500,
    cost_price: 5000,
    quantity: 25,
    category: 'Groceries',
    image: '/images/coffee.png',
    description: 'Rich dark roasted arabica coffee beans ethically sourced from highland micro-farms.',
  },
  {
    id: 'demo-4',
    store_id: 'default-store',
    name: 'Luxury Italian Leather Sneakers',
    selling_price: 38000,
    cost_price: 26000,
    quantity: 15,
    category: 'Fashion',
    image: '/images/electronics.png',
    description: 'Handcrafted genuine leather sneakers engineered for supreme cushioning and modern style.',
  },
  {
    id: 'demo-5',
    store_id: 'default-store',
    name: 'Ergonomic Executive Desk Chair',
    selling_price: 89000,
    cost_price: 65000,
    quantity: 6,
    category: 'Accessories',
    image: '/images/watch.png',
    description: 'Adjustable lumbar support ergonomic mesh chair designed for 12+ hour daily comfort.',
  },
  {
    id: 'demo-6',
    store_id: 'default-store',
    name: 'Stainless Steel Insulated Smart Flask',
    selling_price: 12500,
    cost_price: 7500,
    quantity: 20,
    category: 'Accessories',
    image: '/images/coffee.png',
    description: 'Double-walled vacuum insulated flask with LED temperature display lid. Keeps drinks cold for 24h.',
  },
];

export default function Index() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { addToCart, itemCount, setIsCartOpen } = useCart();

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'name'>('featured');
  const [loading, setLoading] = useState(true);

  // Quick View Modal State
  const [quickViewProduct, setQuickViewProduct] = useState<CatalogProduct | null>(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const sql = getNeonSql();
      if (sql) {
        const data = await sql`SELECT * FROM products ORDER BY created_at DESC`;
        if (data && data.length > 0) {
          const formatted: CatalogProduct[] = data.map((p: any, idx: number) => ({
            id: p.id,
            store_id: p.store_id,
            name: p.name,
            selling_price: Number(p.selling_price),
            cost_price: Number(p.cost_price),
            quantity: Number(p.quantity),
            category: p.category || (idx % 2 === 0 ? 'Electronics' : 'Groceries'),
            image: p.image || (idx === 0 ? '/images/electronics.png' : idx === 1 ? '/images/watch.png' : '/images/coffee.png'),
            description: p.description,
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

  let filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (sortBy === 'price-low') {
    filteredProducts = [...filteredProducts].sort((a, b) => a.selling_price - b.selling_price);
  } else if (sortBy === 'price-high') {
    filteredProducts = [...filteredProducts].sort((a, b) => b.selling_price - a.selling_price);
  } else if (sortBy === 'name') {
    filteredProducts = [...filteredProducts].sort((a, b) => a.name.localeCompare(b.name));
  }

  const handleAddToCart = (product: CatalogProduct, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

  const openQuickView = (product: CatalogProduct, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setQuickViewProduct(product);
    setIsQuickViewOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Banner Notice */}
      <div className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 px-4 py-2 text-center text-xs font-bold text-white flex items-center justify-center gap-2 shadow-sm">
        <Zap className="h-3.5 w-3.5 text-primary-foreground animate-pulse" />
        <span>Flutterwave Payment Gateway Active • Free Shipping on Orders Over ₦50,000 • Mailgun Email Confirmation Enabled</span>
      </div>

      {/* Main Header / Navbar */}
      <header className="border-b bg-card/85 backdrop-blur-md sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto flex items-center justify-between p-4 max-w-7xl">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-primary/60 shadow-md">
              <Store className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                Pocket Shop
              </span>
              <span className="block text-[10px] text-muted-foreground uppercase font-extrabold tracking-wider">
                E-Commerce Storefront
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex items-center relative w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products in catalog..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-5 rounded-full bg-muted/60 border-border/80 focus-visible:ring-primary text-sm font-medium"
            />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/account')}
                  className="gap-2 font-semibold border-border/80"
                >
                  <User className="h-4 w-4 text-primary" />
                  <span className="hidden sm:inline">My Orders</span>
                </Button>

                {(user.role === 'business_owner' || user.role === 'cashier') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/dashboard')}
                    className="gap-1.5 font-semibold bg-primary/10 text-primary border-primary/30"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span className="hidden sm:inline">Manager POS</span>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={signOut}
                  className="text-destructive hover:bg-destructive/10 h-9 w-9"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/auth')}
                className="gap-2 font-semibold border-border/80"
              >
                <User className="h-4 w-4 text-primary" />
                <span>Customer Sign In</span>
              </Button>
            )}

            <Button
              onClick={() => setIsCartOpen(true)}
              className="relative gap-2 px-4 py-5 shadow-lg bg-gradient-to-r from-primary to-primary/60 text-white font-bold"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline font-extrabold">Cart</span>
              {itemCount > 0 && (
                <Badge className="bg-yellow-300 text-slate-950 font-black px-1.5 py-0.5 rounded-full text-xs animate-bounce">
                  {itemCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>

      <CartDrawer />

      <ProductQuickViewModal
        product={quickViewProduct}
        isOpen={isQuickViewOpen}
        onClose={() => {
          setIsQuickViewOpen(false);
          setQuickViewProduct(null);
        }}
      />

      {/* Dynamic Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-primary/5 to-background py-12 md:py-20 border-b">
        <div className="container mx-auto px-4 max-w-7xl relative z-10 text-center">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider">
            <Zap className="mr-1.5 h-3.5 w-3.5 text-primary" /> Flutterwave Integrated E-Commerce Storefront
          </Badge>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 max-w-4xl mx-auto leading-tight">
            Shop Premium Products & Enjoy Instant <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">Flutterwave Checkout</span>
          </h1>

          <p className="text-base md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto font-normal">
            Order directly with verified security, live order tracking, door-to-door nationwide delivery, and automatic email receipt notifications.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs md:text-sm font-extrabold text-muted-foreground">
            <div className="flex items-center gap-2 bg-card/60 px-4 py-2 rounded-full border shadow-sm">
              <CreditCard className="h-4 w-4 text-primary" />
              <span>Flutterwave Secured Payments</span>
            </div>
            <div className="flex items-center gap-2 bg-card/60 px-4 py-2 rounded-full border shadow-sm">
              <Truck className="h-4 w-4 text-primary" />
              <span>Fast 24H Delivery</span>
            </div>
            <div className="flex items-center gap-2 bg-card/60 px-4 py-2 rounded-full border shadow-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>100% Guaranteed Authentic</span>
            </div>
            <div className="flex items-center gap-2 bg-card/60 px-4 py-2 rounded-full border shadow-sm">
              <Star className="h-4 w-4 text-primary fill-primary" />
              <span>4.9 / 5.0 Rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Search Input */}
      <div className="md:hidden p-4 bg-card border-b">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search catalog..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 rounded-full bg-muted/60"
          />
        </div>
      </div>

      {/* Main Catalog Section */}
      <main className="container mx-auto px-4 py-10 max-w-7xl flex-1 space-y-8">
        {/* Filter & Sort Control Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <div>
            <h2 className="text-2xl font-black tracking-tight">Shop Catalog</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Explore our wide selection of items ready for immediate dispatch</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Categories */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="rounded-full text-xs font-bold px-3.5 h-8"
                >
                  {cat}
                </Button>
              ))}
            </div>

            {/* Sorting */}
            <div className="flex items-center gap-2 border-l pl-3">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-card border text-xs font-bold rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none"
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-80 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border p-8 space-y-4">
            <Package className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-bold">No products match your criteria</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Try adjusting your search keywords or switching category filters.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setSortBy('featured');
              }}
              className="font-bold"
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                onClick={() => openQuickView(product)}
                className="overflow-hidden group hover:shadow-2xl transition-all duration-300 border-border/70 flex flex-col justify-between cursor-pointer bg-card"
              >
                <div>
                  {/* Image Header */}
                  <div className="relative h-52 w-full bg-gradient-to-tr from-muted/30 to-muted/80 overflow-hidden flex items-center justify-center p-4">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-auto max-h-[170px] object-contain group-hover:scale-105 transition-transform duration-500 drop-shadow-md"
                      />
                    ) : (
                      <div className="h-24 w-24 rounded-2xl bg-primary/10 flex items-center justify-center font-extrabold text-primary text-xl">
                        {product.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    {product.quantity <= 5 && product.quantity > 0 && (
                      <Badge variant="destructive" className="absolute top-3 right-3 shadow-md text-[10px] font-bold">
                        Only {product.quantity} left
                      </Badge>
                    )}

                    {product.category && (
                      <Badge variant="secondary" className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm shadow-sm text-[10px] font-bold">
                        {product.category}
                      </Badge>
                    )}

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => openQuickView(product, e)}
                      className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs font-bold gap-1 shadow-md bg-background/90"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Quick View</span>
                    </Button>
                  </div>

                  {/* Body Content */}
                  <CardContent className="p-5 space-y-2">
                    <h3 className="font-extrabold text-base line-clamp-1 group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>

                    <div className="flex items-center gap-1 text-xs text-primary font-medium">
                      <Star className="h-3.5 w-3.5 fill-primary/70 text-primary/70" />
                      <Star className="h-3.5 w-3.5 fill-primary/70 text-primary/70" />
                      <Star className="h-3.5 w-3.5 fill-primary/70 text-primary/70" />
                      <Star className="h-3.5 w-3.5 fill-primary/70 text-primary/70" />
                      <Star className="h-3.5 w-3.5 fill-primary/70 text-primary/70" />
                      <span className="text-muted-foreground ml-1 text-[11px] font-semibold">(4.9)</span>
                    </div>

                    <div className="pt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-primary">
                        ₦{product.selling_price.toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </div>

                {/* Footer Action */}
                <div className="p-5 pt-0">
                  <Button
                    onClick={(e) => handleAddToCart(product, e)}
                    className="w-full gap-2 font-bold shadow-md bg-gradient-to-r from-primary to-primary/60 text-white"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>Add to Cart</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-12 mt-16">
        <div className="container mx-auto px-4 max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-black text-sm">
              PS
            </div>
            <div>
              <p className="font-extrabold text-foreground text-sm">Pocket Shop E-Commerce Storefront</p>
              <p className="text-xs">Powered by Flutterwave Payments • Neon Postgres • Mailgun Email Notices</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-semibold">
            <Button variant="link" size="sm" onClick={() => navigate('/account')}>
              <PackageCheck className="h-4 w-4 mr-1 text-primary" /> My Orders & Profile
            </Button>
            <Button variant="link" size="sm" onClick={() => navigate('/dashboard')}>
              <Store className="h-4 w-4 mr-1 text-primary" /> Manager / POS Portal
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
