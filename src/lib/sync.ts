import { getNeonSql, initNeonDatabase } from './neon';
import { db } from './db';

export const hydrateLocalDatabase = async () => {
  if (typeof window === 'undefined' || !navigator.onLine) return;

  const sql = getNeonSql();
  if (!sql) return;

  try {
    await initNeonDatabase();

    const stores = await sql`SELECT * FROM stores ORDER BY created_at DESC`;
    if (stores && stores.length > 0) {
      await db.stores.bulkPut(stores.map((s: any) => ({ ...s, synced: true })));
    }

    const products = await sql`SELECT * FROM products ORDER BY created_at DESC`;
    if (products && products.length > 0) {
      await db.products.bulkPut(
        products.map((p: any) => ({
          ...p,
          cost_price: Number(p.cost_price),
          selling_price: Number(p.selling_price),
          quantity: Number(p.quantity),
          synced: true,
        }))
      );
    }

    const sales = await sql`SELECT * FROM sales ORDER BY sale_date DESC`;
    if (sales && sales.length > 0) {
      await db.sales.bulkPut(
        sales.map((s: any) => ({
          ...s,
          total_revenue: Number(s.total_revenue),
          total_cost: Number(s.total_cost),
          profit: Number(s.profit),
          synced: true,
        }))
      );
    }

    const expenses = await sql`SELECT * FROM expenses ORDER BY expense_date DESC`;
    if (expenses && expenses.length > 0) {
      await db.expenses.bulkPut(
        expenses.map((e: any) => ({
          ...e,
          amount: Number(e.amount),
          synced: true,
        }))
      );
    }

    const debts = await sql`SELECT * FROM customer_debts ORDER BY created_at DESC`;
    if (debts && debts.length > 0) {
      await db.debts.bulkPut(
        debts.map((d: any) => ({
          ...d,
          amount: Number(d.amount),
          synced: true,
        }))
      );
    }
  } catch (err) {
    console.error('Error hydrating local DB from Neon:', err);
  }
};

export const syncWithServer = async () => {
  const sql = getNeonSql();
  if (!sql) return { success: false, synced: 0 };

  try {
    await initNeonDatabase();
    const operations = await db.syncQueue.toArray();
    
    if (operations.length === 0) {
      await hydrateLocalDatabase();
      return { success: true, synced: 0 };
    }

    console.log(`[Neon Sync] Syncing ${operations.length} operations...`);

    for (const op of operations) {
      try {
        const payload = { ...op.data } as any;
        delete payload.synced;

        if (op.operation === 'create') {
          if (op.table === 'stores') {
            await sql`
              INSERT INTO stores (id, owner_id, name, location)
              VALUES (${payload.id}, ${payload.owner_id}, ${payload.name}, ${payload.location || null})
              ON CONFLICT (id) DO NOTHING
            `;
          } else if (op.table === 'products') {
            await sql`
              INSERT INTO products (id, store_id, name, cost_price, selling_price, quantity, reorder_level, dericas_per_bag, dericas_per_paint, unit_type)
              VALUES (${payload.id}, ${payload.store_id}, ${payload.name}, ${payload.cost_price}, ${payload.selling_price}, ${payload.quantity}, ${payload.reorder_level || 5}, ${payload.dericas_per_bag || 100}, ${payload.dericas_per_paint || 5}, ${payload.unit_type || 'derica'})
              ON CONFLICT (id) DO NOTHING
            `;
          } else if (op.table === 'sales') {
            await sql`
              INSERT INTO sales (id, store_id, product_id, quantity, total_revenue, total_cost, profit)
              VALUES (${payload.id}, ${payload.store_id}, ${payload.product_id}, ${payload.quantity}, ${payload.total_revenue}, ${payload.total_cost}, ${payload.profit})
              ON CONFLICT (id) DO NOTHING
            `;
          } else if (op.table === 'expenses') {
            await sql`
              INSERT INTO expenses (id, store_id, amount, category, description)
              VALUES (${payload.id}, ${payload.store_id}, ${payload.amount}, ${payload.category}, ${payload.description || null})
              ON CONFLICT (id) DO NOTHING
            `;
          } else if (op.table === 'debts') {
            await sql`
              INSERT INTO customer_debts (id, store_id, customer_name, amount, description, is_paid)
              VALUES (${payload.id}, ${payload.store_id}, ${payload.customer_name}, ${payload.amount}, ${payload.description || null}, ${payload.is_paid || false})
              ON CONFLICT (id) DO NOTHING
            `;
          }
        } else if (op.operation === 'update') {
          if (op.table === 'products') {
            await sql`
              UPDATE products
              SET quantity = ${payload.quantity}, cost_price = ${payload.cost_price}, selling_price = ${payload.selling_price}, updated_at = CURRENT_TIMESTAMP
              WHERE id = ${payload.id}
            `;
          } else if (op.table === 'stores') {
            await sql`
              UPDATE stores
              SET name = ${payload.name}, location = ${payload.location}, updated_at = CURRENT_TIMESTAMP
              WHERE id = ${payload.id}
            `;
          }
        } else if (op.operation === 'delete') {
          if (op.table === 'stores') {
            await sql`DELETE FROM stores WHERE id = ${payload.id}`;
          } else if (op.table === 'products') {
            await sql`DELETE FROM products WHERE id = ${payload.id}`;
          } else if (op.table === 'sales') {
            await sql`DELETE FROM sales WHERE id = ${payload.id}`;
          } else if (op.table === 'expenses') {
            await sql`DELETE FROM expenses WHERE id = ${payload.id}`;
          } else if (op.table === 'debts') {
            await sql`DELETE FROM customer_debts WHERE id = ${payload.id}`;
          }
        }

        // Mark as synced locally & clean queue
        const localTable = db[op.table as keyof typeof db] as any;
        if (localTable && op.data.id) {
          await localTable.update(op.data.id, { synced: true });
        }
        await db.syncQueue.delete(op.id!);
      } catch (error) {
        console.error(`[Neon Sync] Error syncing operation ${op.id}:`, error);
      }
    }

    await hydrateLocalDatabase();
    return { success: true, synced: operations.length };
  } catch (error) {
    console.error('Neon Sync error:', error);
    return { success: false, synced: 0, error };
  }
};

// Auto-sync when online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Back online, syncing with Neon Postgres...');
    syncWithServer();
  });
}



