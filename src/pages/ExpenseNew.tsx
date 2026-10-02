import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '@/lib/db';
import { syncWithServer } from '@/lib/sync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Purchase of Goods',
  'Transport',
  'Electricity',
  'Rent',
  'Salaries',
  'Repairs',
  'Miscellaneous',
];

export default function ExpenseNew() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    category: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const expenseData = {
        id: crypto.randomUUID(),
        store_id: storeId!,
        amount: parseFloat(formData.amount),
        category: formData.category,
        description: formData.description || undefined,
        expense_date: new Date(formData.expense_date).toISOString(),
        created_at: new Date().toISOString(),
        synced: false,
      };

      await db.expenses.add(expenseData);

      await db.syncQueue.add({
        table: 'expenses',
        operation: 'create',
        data: expenseData,
        timestamp: new Date().toISOString(),
      });

      if (navigator.onLine) {
        await syncWithServer();
      }

      toast({ title: 'Expense added successfully' });
      navigate(`/stores/${storeId}/expenses`);
    } catch (error) {
      console.error('Error adding expense:', error);
      toast({ title: 'Failed to add expense', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/stores/${storeId}/expenses`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Add Expense</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 rounded-xl border border-border">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₦)</Label>
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
            <Label htmlFor="expense_date">Date</Label>
            <Input
              id="expense_date"
              type="date"
              value={formData.expense_date}
              onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !formData.category || !formData.amount}>
            {loading ? 'Saving...' : 'Add Expense'}
          </Button>
        </form>
      </div>
    </div>
  );
}
