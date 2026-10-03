import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, LocalDebt } from '@/lib/db';
import { syncWithServer } from '@/lib/sync';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function Debts() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [debts, setDebts] = useState<LocalDebt[]>([]);

  useEffect(() => {
    loadDebts();
  }, [storeId]);

  const loadDebts = async () => {
    try {
      const localDebts = await db.debts
        .where('store_id')
        .equals(storeId!)
        .reverse()
        .sortBy('debt_date');
      setDebts(localDebts);
    } catch (error) {
      console.error('Error loading debts:', error);
    }
  };

  const markAsPaid = async (debt: LocalDebt) => {
    try {
      await db.debts.update(debt.id, {
        is_paid: true,
        paid_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        synced: false,
      });

      await db.syncQueue.add({
        table: 'debts',
        operation: 'update',
        data: {
          id: debt.id,
          is_paid: true,
          paid_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });

      if (navigator.onLine) {
        await syncWithServer();
      }

      toast({ title: 'Debt marked as paid' });
      loadDebts();
    } catch (error) {
      console.error('Error marking debt as paid:', error);
      toast({ title: 'Failed to update debt', variant: 'destructive' });
    }
  };

  const unpaidDebts = debts.filter(d => !d.is_paid);
  const totalUnpaid = unpaidDebts.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Customer Debts</h1>
          </div>
          <Button onClick={() => navigate('/debts/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>

        <Card className="p-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total Unpaid</p>
            <p className="text-3xl font-bold text-warning">₦{totalUnpaid.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{unpaidDebts.length} unpaid debts</p>
          </div>
        </Card>

        <div className="space-y-3">
          {debts.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No customer debts recorded</p>
            </Card>
          ) : (
            debts.map((debt) => (
              <Card key={debt.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{debt.customer_name}</p>
                      {debt.is_paid ? (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">Paid</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Unpaid</Badge>
                      )}
                    </div>
                    {debt.description && (
                      <p className="text-sm text-muted-foreground">{debt.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(debt.debt_date), 'MMM dd, yyyy')}
                      {debt.is_paid && debt.paid_date && ` • Paid ${format(new Date(debt.paid_date), 'MMM dd')}`}
                    </p>
                  </div>
                  <div className="text-right space-y-2">
                    <p className="text-lg font-bold text-warning">₦{debt.amount.toFixed(2)}</p>
                    {!debt.is_paid && (
                      <Button size="sm" variant="outline" onClick={() => markAsPaid(debt)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Paid
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
