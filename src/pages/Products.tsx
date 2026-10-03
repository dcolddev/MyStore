import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, LocalProduct } from '@/lib/db';
import { getNeonSql } from '@/lib/neon';
import { syncWithServer } from '@/lib/sync';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Plus, Package, Trash2, PackagePlus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const Products = () => {
  const navigate = useNavigate();
  const { storeId } = useParams();
  const { user } = useAuth();
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string>(storeId || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadStores();
    }
  }, [storeId, user]);

  useEffect(() => {
    if (activeStoreId) {
      loadProducts(activeStoreId);
    }
  }, [activeStoreId]);

  const loadStores = async () => {
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
          console.warn('Neon stores query error:', err);
        }
      }
      if (storeList.length === 0) {
        storeList = await db.stores.toArray();
      }

      setStores(storeList);
      if (storeList.length > 0) {
        const currentId = storeId || storeList[0].id;
        setActiveStoreId(currentId);
      }
    } catch {
      const localStores = await db.stores.toArray();
      setStores(localStores);
      if (localStores.length > 0) setActiveStoreId(storeId || localStores[0].id);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (sId: string) => {
    try {
      const sql = getNeonSql();
      if (navigator.onLine && sql) {
        try {
          const data = await sql`SELECT * FROM products WHERE store_id = ${sId} ORDER BY created_at DESC`;
          if (data && data.length > 0) {
            setProducts(data as any);
            return;
          }
        } catch (err) {
          console.warn('Neon products query error:', err);
        }
      }
      const localProducts = await db.products.where('store_id').equals(sId).toArray();
      setProducts(localProducts);
    } catch {
      const localProducts = await db.products.where('store_id').equals(sId).toArray();
      setProducts(localProducts);
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      const sql = getNeonSql();
      if (sql) {
        await sql`DELETE FROM products WHERE id = ${productId}`;
      }

      await db.products.delete(productId);
      toast.success('Product deleted successfully');
      loadProducts(activeStoreId);
    } catch (error: any) {
      await db.products.delete(productId);
      await db.syncQueue.add({
        table: 'products',
        operation: 'delete',
        data: { id: productId },
        timestamp: new Date().toISOString(),
      });

      if (navigator.onLine) {
        await syncWithServer();
      }

      toast.success('Product deleted (will sync when online)');
      loadProducts(activeStoreId);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading products...</div>;
  }

  if (!activeStoreId && stores.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md text-center p-6 space-y-4">
          <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Create a store first to manage products</p>
          <Button onClick={() => navigate('/stores/new')}>Create Store</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(activeStoreId ? `/stores/${activeStoreId}` : '/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">Products</h1>
          </div>
          <Button onClick={() => navigate(activeStoreId ? `/stores/${activeStoreId}/products/new` : '/products/new')} size="sm">
            <Plus className="mr-1 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-4xl">
        {products.length === 0 ? (
          <Card className="text-center p-8 space-y-4">
            <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No products in this store catalog yet</p>
            <Button onClick={() => navigate(activeStoreId ? `/stores/${activeStoreId}/products/new` : '/products/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Product
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <Card key={product.id} className="p-4 shadow-sm border-border/80">
                <div className="flex justify-between items-center gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground text-base">{product.name}</p>
                      {product.quantity <= product.reorder_level && (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs gap-1">
                          <AlertCircle className="h-3 w-3" /> Low Stock
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Stock: <strong className="text-foreground">{product.quantity}</strong></span>
                      <span>Cost: ₦{Number(product.cost_price).toFixed(2)}</span>
                      <span>Price: <strong className="text-primary">₦{Number(product.selling_price).toFixed(2)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeStoreId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/stores/${activeStoreId}/products/${product.id}/restock`)}
                        className="gap-1"
                      >
                        <PackagePlus className="h-4 w-4" />
                        <span className="hidden sm:inline">Restock</span>
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Product?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{product.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(product.id)} className="bg-destructive text-destructive-foreground">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;
