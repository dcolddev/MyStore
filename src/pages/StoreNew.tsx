import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Store } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getNeonSql, generateAccessCode } from '@/lib/neon';
import { db } from '@/lib/db';
import { toast } from 'sonner';

const StoreNew = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && user.role === 'cashier') {
      toast.error('Only Business Owners can create new store branches.');
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    const accessCode = generateAccessCode();
    const storeId = crypto.randomUUID();
    const storeData = {
      id: storeId,
      owner_id: user.id,
      name,
      location: location || null,
      access_code: accessCode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const sql = getNeonSql();
      if (sql) {
        await sql`
          INSERT INTO stores (id, owner_id, name, location, access_code)
          VALUES (${storeId}, ${user.id}, ${name}, ${location || null}, ${accessCode})
        `;
      }

      await db.stores.add({
        ...storeData,
        synced: true,
      });

      toast.success(`Branch "${name}" created! Access Code: ${accessCode}`);
      navigate(`/stores/${storeId}`);
    } catch (error: any) {
      await db.stores.add({
        ...storeData,
        synced: false,
      });

      await db.syncQueue.add({
        table: 'stores',
        operation: 'create',
        data: storeData,
        timestamp: new Date().toISOString(),
      });

      toast.success('Store created (will sync when online)');
      navigate(`/stores/${storeId}`);
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
            <CardTitle className="text-center">Create New Store Branch</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Store / Branch Name*</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g. Lagos Central Branch"
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
                  placeholder="Main Street, Downtown, Lagos"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full font-bold" disabled={loading}>
                {loading ? 'Creating...' : 'Create Branch'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StoreNew;

