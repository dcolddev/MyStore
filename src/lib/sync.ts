import { supabase } from '@/integrations/supabase/client';
import { db } from './db';

export const hydrateLocalDatabase = async () => {
  if (typeof window === 'undefined' || !navigator.onLine) return;

  try {
    const { data: stores } = await supabase.from('stores').select('*');
    if (stores && stores.length > 0) {
      await db.stores.bulkPut(stores.map((s) => ({ ...s, synced: true })));
    }

    const { data: products } = await supabase.from('products').select('*');
    if (products && products.length > 0) {
      await db.products.bulkPut(
        products.map((p) => ({
          ...p,
          cost_price: Number(p.cost_price),
          selling_price: Number(p.selling_price),
          synced: true,
        }))
      );
    }

    const { data: sales } = await supabase.from('sales').select('*');
    if (sales && sales.length > 0) {
      await db.sales.bulkPut(
        sales.map((s) => ({
          ...s,
          total_revenue: Number(s.total_revenue),
          total_cost: Number(s.total_cost),
          profit: Number(s.profit),
          synced: true,
        }))
      );
    }

    const { data: expenses } = await supabase.from('expenses').select('*');
    if (expenses && expenses.length > 0) {
      await db.expenses.bulkPut(
        expenses.map((e) => ({
          ...e,
          amount: Number(e.amount),
          synced: true,
        }))
      );
    }

    const { data: debts } = await supabase.from('customer_debts').select('*');
    if (debts && debts.length > 0) {
      await db.debts.bulkPut(
        debts.map((d) => ({
          ...d,
          amount: Number(d.amount),
          synced: true,
        }))
      );
    }
  } catch (err) {
    console.error('Error hydrating local DB:', err);
  }
};

export const syncWithServer = async () => {
  try {
    const operations = await db.syncQueue.toArray();
    
    if (operations.length === 0) {
      await hydrateLocalDatabase();
      return { success: true, synced: 0 };
    }

    console.log(`Syncing ${operations.length} operations...`);

    for (const op of operations) {
      try {
        // Strip local-only fields before sending to backend
        const payload = { ...op.data } as any;
        delete payload.synced;

        if (op.operation === 'create') {
          let error: any;
          if (op.table === 'stores') {
            const result = await supabase.from('stores').insert(payload);
            error = result.error;
          } else if (op.table === 'products') {
            const result = await supabase.from('products').insert(payload);
            error = result.error;
          } else if (op.table === 'sales') {
            const result = await supabase.from('sales').insert(payload);
            error = result.error;
          } else if (op.table === 'expenses') {
            const result = await supabase.from('expenses').insert(payload);
            error = result.error;
          } else if (op.table === 'debts') {
            const result = await supabase.from('customer_debts').insert(payload);
            error = result.error;
          }
          if (error) throw error;
        } else if (op.operation === 'update') {
          let error: any;
          if (op.table === 'stores') {
            const result = await supabase.from('stores').update(payload).eq('id', payload.id);
            error = result.error;
          } else if (op.table === 'products') {
            const result = await supabase.from('products').update(payload).eq('id', payload.id);
            error = result.error;
          } else if (op.table === 'sales') {
            const result = await supabase.from('sales').update(payload).eq('id', payload.id);
            error = result.error;
          } else if (op.table === 'expenses') {
            const result = await supabase.from('expenses').update(payload).eq('id', payload.id);
            error = result.error;
          } else if (op.table === 'debts') {
            const result = await supabase.from('customer_debts').update(payload).eq('id', payload.id);
            error = result.error;
          }
          if (error) throw error;
        } else if (op.operation === 'delete') {
          let error: any;
          if (op.table === 'stores') {
            const result = await supabase.from('stores').delete().eq('id', payload.id);
            error = result.error;
          } else if (op.table === 'products') {
            const result = await supabase.from('products').delete().eq('id', payload.id);
            error = result.error;
          } else if (op.table === 'sales') {
            const result = await supabase.from('sales').delete().eq('id', payload.id);
            error = result.error;
          } else if (op.table === 'expenses') {
            const result = await supabase.from('expenses').delete().eq('id', payload.id);
            error = result.error;
          } else if (op.table === 'debts') {
            const result = await supabase.from('customer_debts').delete().eq('id', payload.id);
            error = result.error;
          }
          if (error) throw error;
        }

        // Mark as synced in local DB
        const localTable = db[op.table as keyof typeof db] as any;
        if (localTable && op.data.id) {
          await localTable.update(op.data.id, { synced: true });
        }

        // Remove from sync queue
        await db.syncQueue.delete(op.id!);
      } catch (error) {
        console.error(`Error syncing operation ${op.id}:`, error);
      }
    }

    await hydrateLocalDatabase();
    return { success: true, synced: operations.length };
  } catch (error) {
    console.error('Sync error:', error);
    return { success: false, synced: 0, error };
  }
};

// Auto-sync when online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Back online, syncing...');
    syncWithServer();
  });
}


