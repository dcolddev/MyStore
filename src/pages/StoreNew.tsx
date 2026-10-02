import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Store } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/db';
import { toast } from 'sonner';

const StoreNew = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    const storeData = {
      owner_id: user.id,
      name,
      location: location || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      // Try to save to server first
      const { data, error } = await supabase
        .from('stores')
        .insert(storeData)
        .select()
        .single();

      if (error) throw error;

      // Save to local DB
      await db.stores.add({
        ...data,
        synced: true,
      });

      toast.success('Store created successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      // If offline, save to local DB and queue for sync
      const localId = crypto.randomUUID();
      await db.stores.add({
        id: localId,
        ...storeData,
        synced: false,
      });

      await db.syncQueue.add({
        table: 'stores',
        operation: 'create',
        data: { id: localId, ...storeData },
        timestamp: new Date().toISOString(),
      });

      toast.success('Store created (will sync when online)');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-md">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Store className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-center">Create New Store</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Store Name*</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="My Shop"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location (Optional)</Label>
                <Input
                  id="location"
                  type="text"
                  placeholder="Main Street, Downtown"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating...' : 'Create Store'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StoreNew;
