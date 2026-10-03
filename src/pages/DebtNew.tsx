import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '@/lib/db';
import { syncWithServer } from '@/lib/sync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

export default function DebtNew() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    amount: '',
    description: '',
    debt_date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const debtData = {
        id: crypto.randomUUID(),
        store_id: storeId!,
        customer_name: formData.customer_name,
        amount: parseFloat(formData.amount),
        description: formData.description || undefined,
        is_paid: false,
        debt_date: new Date(formData.debt_date).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        synced: false,
      };

      await db.debts.add(debtData);

      await db.syncQueue.add({
        table: 'debts',
        operation: 'create',
        data: debtData,
        timestamp: new Date().toISOString(),
      });

      if (navigator.onLine) {
        await syncWithServer();
      }

      toast({ title: 'Customer debt recorded' });
      navigate('/debts');
    } catch (error) {
      console.error('Error recording debt:', error);
      toast({ title: 'Failed to record debt', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/debts')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Record Debt</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 rounded-xl border border-border">
          <div className="space-y-2">
            <Label htmlFor="customer_name">Customer Name</Label>
            <Input
              id="customer_name"
              type="text"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount Owed (₦)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="debt_date">Date</Label>
            <Input
              id="debt_date"
              type="date"
              value={formData.debt_date}
              onChange={(e) => setFormData({ ...formData, debt_date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What items did they take on credit?"
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !formData.customer_name || !formData.amount}>
            {loading ? 'Saving...' : 'Record Debt'}
          </Button>
        </form>
      </div>
    </div>
  );
}
