import { neon } from '@neondatabase/serverless';

const DATABASE_URL = import.meta.env.VITE_NEON_DATABASE_URL || import.meta.env.DATABASE_URL || import.meta.env.DATABASE_POSTGRES_URL || '';

export const getNeonSql = () => {
  if (!DATABASE_URL) return null;
  try {
    return neon(DATABASE_URL);
  } catch (err) {
    console.error('Neon SQL init error:', err);
    return null;
  }
};

export const initNeonDatabase = async () => {
  const sql = getNeonSql();
  if (!sql) return { success: false, message: 'VITE_NEON_DATABASE_URL is not set' };

  try {
    // 1. Stores Table
    await sql`
      CREATE TABLE IF NOT EXISTS stores (
        id VARCHAR(64) PRIMARY KEY,
        owner_id VARCHAR(64),
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 2. Products Table
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(64) PRIMARY KEY,
        store_id VARCHAR(64) REFERENCES stores(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        cost_price NUMERIC(10, 2) DEFAULT 0,
        selling_price NUMERIC(10, 2) DEFAULT 0,
        quantity INTEGER DEFAULT 0,
        reorder_level INTEGER DEFAULT 5,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 3. Orders Table
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(64) PRIMARY KEY,
        store_id VARCHAR(64),
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        shipping_address TEXT NOT NULL,
        phone VARCHAR(64),
        total_amount NUMERIC(10, 2) NOT NULL,
        payment_method VARCHAR(64) DEFAULT 'card',
        payment_status VARCHAR(64) DEFAULT 'paid',
        order_status VARCHAR(64) DEFAULT 'completed',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 4. Order Items Table
    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id VARCHAR(64) PRIMARY KEY,
        order_id VARCHAR(64) REFERENCES orders(id) ON DELETE CASCADE,
        product_id VARCHAR(64),
        product_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price NUMERIC(10, 2) NOT NULL,
        total_price NUMERIC(10, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 5. Sales Table
    await sql`
      CREATE TABLE IF NOT EXISTS sales (
        id VARCHAR(64) PRIMARY KEY,
        store_id VARCHAR(64),
        product_id VARCHAR(64),
        quantity INTEGER NOT NULL,
        total_revenue NUMERIC(10, 2) NOT NULL,
        total_cost NUMERIC(10, 2) NOT NULL,
        profit NUMERIC(10, 2) NOT NULL,
        sale_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 6. Expenses Table
    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(64) PRIMARY KEY,
        store_id VARCHAR(64),
        amount NUMERIC(10, 2) NOT NULL,
        category VARCHAR(255) NOT NULL,
        description TEXT,
        expense_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 7. Customer Debts Table
    await sql`
      CREATE TABLE IF NOT EXISTS customer_debts (
        id VARCHAR(64) PRIMARY KEY,
        store_id VARCHAR(64),
        customer_name VARCHAR(255) NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        description TEXT,
        is_paid BOOLEAN DEFAULT FALSE,
        debt_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        paid_date TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    console.log('[Neon Postgres] Database initialized successfully!');
    return { success: true, message: 'Neon Postgres database initialized successfully' };
  } catch (err: any) {
    console.error('[Neon Postgres] Initialization error:', err);
    return { success: false, message: err.message };
  }
};

export const saveNeonOrder = async (orderPayload: {
  id: string;
  store_id: string | null;
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  phone?: string | null;
  total_amount: number;
  payment_method: string;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}) => {
  const sql = getNeonSql();
  if (!sql) return null;

  try {
    await initNeonDatabase();

    // 1. Insert Order
    await sql`
      INSERT INTO orders (id, store_id, customer_name, customer_email, shipping_address, phone, total_amount, payment_method, payment_status, order_status)
      VALUES (${orderPayload.id}, ${orderPayload.store_id}, ${orderPayload.customer_name}, ${orderPayload.customer_email}, ${orderPayload.shipping_address}, ${orderPayload.phone || null}, ${orderPayload.total_amount}, ${orderPayload.payment_method}, 'paid', 'completed')
    `;

    // 2. Insert Order Items & Record Sales
    for (const item of orderPayload.items) {
      const itemId = crypto.randomUUID();
      await sql`
        INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, total_price)
        VALUES (${itemId}, ${orderPayload.id}, ${item.id}, ${item.product_name}, ${item.quantity}, ${item.unit_price}, ${item.total_price})
      `;

      // Update product quantity if exists
      if (item.id) {
        await sql`
          UPDATE products
          SET quantity = GREATEST(0, quantity - ${item.quantity})
          WHERE id = ${item.id}
        `;
      }

      // Insert Sales Analytics
      const saleId = crypto.randomUUID();
      const unitCost = item.unit_price * 0.7;
      const profit = item.total_price - (unitCost * item.quantity);
      await sql`
        INSERT INTO sales (id, store_id, product_id, quantity, total_revenue, total_cost, profit)
        VALUES (${saleId}, ${orderPayload.store_id}, ${item.id}, ${item.quantity}, ${item.total_price}, ${unitCost * item.quantity}, ${profit})
      `;
    }

    return { success: true, id: orderPayload.id };
  } catch (err: any) {
    console.error('Neon saveOrder error:', err);
    return null;
  }
};
