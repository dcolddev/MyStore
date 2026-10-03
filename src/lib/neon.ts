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


export const generateAccessCode = (prefix = 'BR'): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${code}`;
};

export const initNeonDatabase = async () => {
  const sql = getNeonSql();
  if (!sql) return { success: false, message: 'VITE_NEON_DATABASE_URL or DATABASE_URL is not set' };

  try {
    // 0. Users Table (Auth)
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(64) DEFAULT 'business_owner',
        store_id VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Ensure users columns
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(64) DEFAULT 'business_owner'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS store_id VARCHAR(64)`;

    // 1. Stores Table
    await sql`
      CREATE TABLE IF NOT EXISTS stores (
        id VARCHAR(64) PRIMARY KEY,
        owner_id VARCHAR(64),
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        access_code VARCHAR(64) UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Ensure stores access_code column
    await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS access_code VARCHAR(64)`;

    // 2. Store Cashiers Table
    await sql`
      CREATE TABLE IF NOT EXISTS store_cashiers (
        id VARCHAR(64) PRIMARY KEY,
        store_id VARCHAR(64) REFERENCES stores(id) ON DELETE CASCADE,
        cashier_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        cashier_email VARCHAR(255),
        cashier_name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 3. Products Table
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(64) PRIMARY KEY,
        store_id VARCHAR(64) REFERENCES stores(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        cost_price NUMERIC(10, 2) DEFAULT 0,
        selling_price NUMERIC(10, 2) DEFAULT 0,
        quantity NUMERIC(10, 2) DEFAULT 0,
        reorder_level INTEGER DEFAULT 5,
        dericas_per_bag NUMERIC(10, 2) DEFAULT 100,
        dericas_per_paint NUMERIC(10, 2) DEFAULT 5,
        unit_type VARCHAR(64) DEFAULT 'derica',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 4. Orders Table
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

    // 5. Order Items Table
    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id VARCHAR(64) PRIMARY KEY,
        order_id VARCHAR(64) REFERENCES orders(id) ON DELETE CASCADE,
        product_id VARCHAR(64),
        product_name VARCHAR(255) NOT NULL,
        quantity NUMERIC(10, 2) NOT NULL,
        unit_price NUMERIC(10, 2) NOT NULL,
        total_price NUMERIC(10, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 6. Sales Table
    await sql`
      CREATE TABLE IF NOT EXISTS sales (
        id VARCHAR(64) PRIMARY KEY,
        store_id VARCHAR(64),
        product_id VARCHAR(64),
        quantity NUMERIC(10, 2) NOT NULL,
        total_revenue NUMERIC(10, 2) NOT NULL,
        total_cost NUMERIC(10, 2) NOT NULL,
        profit NUMERIC(10, 2) NOT NULL,
        sale_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 7. Expenses Table
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

    // 8. Customer Debts Table
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

// --- AUTH FUNCTIONS WITH NEON ---

export const signUpNeon = async (
  email: string,
  password_hash: string,
  fullName: string,
  role: 'business_owner' | 'cashier' = 'business_owner',
  branchAccessCode?: string
) => {
  const sql = getNeonSql();
  const userId = crypto.randomUUID();
  let assignedStoreId: string | null = null;

  if (role === 'cashier') {
    if (!branchAccessCode || !branchAccessCode.trim()) {
      return { user: null, error: new Error('Branch Access Code is required for cashier sign up.') };
    }

    if (sql) {
      try {
        await initNeonDatabase();
        const matchedStores = await sql`
          SELECT id, name FROM stores
          WHERE LOWER(access_code) = LOWER(${branchAccessCode.trim()})
          LIMIT 1
        `;
        if (!matchedStores || matchedStores.length === 0) {
          return { user: null, error: new Error('Invalid Branch Access Code. Please verify with your business owner.') };
        }
        assignedStoreId = matchedStores[0].id;
      } catch (err: any) {
        console.error('Error validating access code:', err);
      }
    }
  }

  const user = {
    id: userId,
    email,
    full_name: fullName,
    role,
    store_id: assignedStoreId,
    created_at: new Date().toISOString(),
  };

  if (sql) {
    try {
      await initNeonDatabase();

      // Check if email already exists
      const existingUser = await sql`
        SELECT id FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
      `;
      if (existingUser && existingUser.length > 0) {
        return { user: null, error: new Error('An account with this email already exists.') };
      }

      await sql`
        INSERT INTO users (id, email, password_hash, full_name, role, store_id)
        VALUES (${userId}, ${email}, ${password_hash}, ${fullName}, ${role}, ${assignedStoreId})
      `;

      if (role === 'cashier' && assignedStoreId) {
        const scId = crypto.randomUUID();
        await sql`
          INSERT INTO store_cashiers (id, store_id, cashier_id, cashier_email, cashier_name)
          VALUES (${scId}, ${assignedStoreId}, ${userId}, ${email}, ${fullName})
          ON CONFLICT DO NOTHING
        `;
      }

      localStorage.setItem('mystore_user', JSON.stringify(user));
      return { user, error: null };
    } catch (err: any) {
      console.error('Neon DB signup error:', err);
      if (err.message && (err.message.includes('unique') || err.message.includes('duplicate'))) {
        return { user: null, error: new Error('An account with this email already exists.') };
      }
      return { user: null, error: new Error('Sign up failed. Please check your connection and try again.') };
    }
  }

  return { user: null, error: new Error('Database is unavailable. Please try again later.') };
};

export const signInNeon = async (
  email: string,
  password_hash: string,
  fullName?: string,
  preRole?: 'business_owner' | 'cashier' | null,
  branchAccessCode?: string
) => {
  const sql = getNeonSql();

  if (sql) {
    try {
      await initNeonDatabase();

      // Verify both email AND password hash together
      const users = await sql`
        SELECT id, email, full_name, role, store_id, created_at FROM users
        WHERE LOWER(email) = LOWER(${email})
          AND password_hash = ${password_hash}
        LIMIT 1
      `;

      if (users && users.length > 0) {
        const user = users[0];
        localStorage.setItem('mystore_user', JSON.stringify(user));
        return { user, error: null };
      }

      // Check if the email exists at all — to return the right error message
      const emailExists = await sql`
        SELECT id FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
      `;

      if (emailExists && emailExists.length > 0) {
        // Email found but password wrong
        return { user: null, error: new Error('Incorrect password. Please try again.') };
      }

      // If user not found but fullName provided (Google auth path), create user with chosen or pending role
      if (fullName) {
        const newUserId = crypto.randomUUID();
        let assignedRole: string = preRole || 'pending';
        let assignedStoreId: string | null = null;

        if (preRole === 'cashier' && branchAccessCode) {
          const matchedStores = await sql`
            SELECT id FROM stores
            WHERE LOWER(access_code) = LOWER(${branchAccessCode.trim()})
            LIMIT 1
          `;
          if (matchedStores && matchedStores.length > 0) {
            assignedStoreId = matchedStores[0].id;
          } else {
            assignedRole = 'pending';
          }
        }

        await sql`
          INSERT INTO users (id, email, password_hash, full_name, role, store_id)
          VALUES (${newUserId}, ${email}, ${password_hash}, ${fullName}, ${assignedRole}, ${assignedStoreId})
          ON CONFLICT (email) DO NOTHING
        `;

        if (assignedRole === 'cashier' && assignedStoreId) {
          const scId = crypto.randomUUID();
          await sql`
            INSERT INTO store_cashiers (id, store_id, cashier_id, cashier_email, cashier_name)
            VALUES (${scId}, ${assignedStoreId}, ${newUserId}, ${email}, ${fullName})
            ON CONFLICT DO NOTHING
          `;
        }

        const newUser = {
          id: newUserId,
          email,
          full_name: fullName,
          role: assignedRole,
          store_id: assignedStoreId,
          created_at: new Date().toISOString(),
        };
        localStorage.setItem('mystore_user', JSON.stringify(newUser));
        return { user: newUser, error: null };
      }

      // No account found with this email (manual login path — do NOT auto-create)
      return { user: null, error: new Error('No account found with this email. Please sign up first.') };

    } catch (err: any) {
      console.warn('Neon DB signin error:', err);
      return { user: null, error: new Error('Sign in failed. Please check your connection and try again.') };
    }
  }

  // DB not configured — refuse sign-in rather than creating a ghost session
  return { user: null, error: new Error('Database is unavailable. Please try again later.') };
};

export const updateUserRoleNeon = async (
  userId: string,
  role: 'business_owner' | 'cashier',
  branchAccessCode?: string
) => {
  const sql = getNeonSql();
  const currentUser = getCurrentUserNeon();
  let assignedStoreId: string | null = null;

  if (role === 'cashier') {
    if (!branchAccessCode || !branchAccessCode.trim()) {
      return { success: false, error: 'Branch Access Code is required for cashier account.' };
    }

    if (sql) {
      try {
        await initNeonDatabase();
        const stores = await sql`
          SELECT id, name FROM stores
          WHERE LOWER(access_code) = LOWER(${branchAccessCode.trim()})
          LIMIT 1
        `;
        if (!stores || stores.length === 0) {
          return { success: false, error: 'Invalid Branch Access Code. Please check with your business owner.' };
        }
        assignedStoreId = stores[0].id;
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  }

  if (sql) {
    try {
      await sql`
        UPDATE users
        SET role = ${role}, store_id = ${assignedStoreId}
        WHERE id = ${userId}
      `;

      if (role === 'cashier' && assignedStoreId) {
        const scId = crypto.randomUUID();
        await sql`
          INSERT INTO store_cashiers (id, store_id, cashier_id, cashier_email, cashier_name)
          VALUES (${scId}, ${assignedStoreId}, ${userId}, ${currentUser?.email || ''}, ${currentUser?.full_name || 'Cashier'})
          ON CONFLICT DO NOTHING
        `;
      }
    } catch (err: any) {
      console.error('Error updating user role in Neon:', err);
    }
  }

  const updatedUser = {
    ...currentUser,
    role,
    store_id: assignedStoreId,
  };
  localStorage.setItem('mystore_user', JSON.stringify(updatedUser));
  return { success: true, user: updatedUser };
};

export const joinBranchWithCodeNeon = async (userId: string, accessCode: string) => {
  const sql = getNeonSql();
  if (!sql) return { success: false, error: 'Database connection offline' };

  try {
    await initNeonDatabase();
    const stores = await sql`
      SELECT id, name, location FROM stores
      WHERE LOWER(access_code) = LOWER(${accessCode.trim()})
      LIMIT 1
    `;

    if (!stores || stores.length === 0) {
      return { success: false, error: 'Invalid Branch Access Code' };
    }

    const store = stores[0];
    const currentUser = getCurrentUserNeon();

    await sql`
      UPDATE users
      SET role = 'cashier', store_id = ${store.id}
      WHERE id = ${userId}
    `;

    const scId = crypto.randomUUID();
    await sql`
      INSERT INTO store_cashiers (id, store_id, cashier_id, cashier_email, cashier_name)
      VALUES (${scId}, ${store.id}, ${userId}, ${currentUser?.email || ''}, ${currentUser?.full_name || 'Cashier'})
      ON CONFLICT DO NOTHING
    `;

    const updatedUser = { ...currentUser, role: 'cashier', store_id: store.id };
    localStorage.setItem('mystore_user', JSON.stringify(updatedUser));

    return { success: true, store };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const getStoreCashiersNeon = async (storeId: string) => {
  const sql = getNeonSql();
  if (!sql) return [];

  try {
    const cashiers = await sql`
      SELECT u.id, u.email, u.full_name, u.created_at
      FROM users u
      LEFT JOIN store_cashiers sc ON sc.cashier_id = u.id
      WHERE u.store_id = ${storeId} OR sc.store_id = ${storeId}
    `;
    return cashiers || [];
  } catch (err) {
    console.error('Error fetching store cashiers:', err);
    return [];
  }
};

export const removeCashierFromStoreNeon = async (cashierId: string) => {
  const sql = getNeonSql();
  if (!sql) return { success: false };

  try {
    await sql`UPDATE users SET store_id = NULL WHERE id = ${cashierId}`;
    await sql`DELETE FROM store_cashiers WHERE cashier_id = ${cashierId}`;
    return { success: true };
  } catch (err: any) {
    console.error('Error removing cashier:', err);
    return { success: false, error: err.message };
  }
};

export const deleteStoreBranchNeon = async (storeId: string, ownerId: string) => {
  const sql = getNeonSql();
  if (!sql) return { success: false };

  try {
    await sql`DELETE FROM stores WHERE id = ${storeId} AND owner_id = ${ownerId}`;
    await sql`UPDATE users SET store_id = NULL WHERE store_id = ${storeId}`;
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting store branch:', err);
    return { success: false, error: err.message };
  }
};

export const deleteUserAccountNeon = async (userId: string) => {
  const sql = getNeonSql();
  try {
    if (sql) {
      await sql`DELETE FROM store_cashiers WHERE cashier_id = ${userId}`;
      await sql`UPDATE stores SET owner_id = NULL WHERE owner_id = ${userId}`;
      await sql`DELETE FROM users WHERE id = ${userId}`;
    }
  } catch (err) {
    console.error('Error deleting user account from Neon:', err);
  } finally {
    localStorage.removeItem('mystore_user');
  }
  return { success: true };
};

export const signOutNeon = async () => {
  localStorage.removeItem('mystore_user');
};

export const getCurrentUserNeon = () => {
  const stored = localStorage.getItem('mystore_user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

// --- ORDER SAVING WITH NEON ---

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


