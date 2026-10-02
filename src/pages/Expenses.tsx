import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, LocalExpense } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Plus } from 'lucide-react';
import { format } from 'date-fns';

export default function Expenses() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);

  useEffect(() => {
    loadExpenses();
  }, [storeId]);

  const loadExpenses = async () => {
    try {
      const localExpenses = await db.expenses
        .where('store_id')
        .equals(storeId!)
        .reverse()
        .sortBy('expense_date');
      setExpenses(localExpenses);
    } catch (error) {
      console.error('Error loading expenses:', error);
    }
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/stores/${storeId}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
          </div>
          <Button onClick={() => navigate(`/stores/${storeId}/expenses/new`)}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>

        <Card className="p-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-3xl font-bold text-destructive">₦{totalExpenses.toFixed(2)}</p>
          </div>
        </Card>

        <div className="space-y-3">
          {expenses.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No expenses recorded yet</p>
            </Card>
          ) : (
            expenses.map((expense) => (
              <Card key={expense.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{expense.category}</p>
                    {expense.description && (
                      <p className="text-sm text-muted-foreground">{expense.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(expense.expense_date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-destructive">₦{expense.amount.toFixed(2)}</p>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
