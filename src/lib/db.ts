import Dexie, { Table } from 'dexie';

// Define types for offline database
export interface LocalStore {
  id: string;
  owner_id: string;
  name: string;
  location?: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface LocalProduct {
  id: string;
  store_id: string;
  name: string;
  cost_price: number;
  selling_price: number;
  quantity: number;
  reorder_level: number;
  dericas_per_bag: number;
  dericas_per_paint: number;
  unit_type: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface LocalSale {
  id: string;
  store_id: string;
  product_id: string;
  quantity: number;
  total_revenue: number;
  total_cost: number;
  profit: number;
  sale_date: string;
  created_at: string;
  synced: boolean;
}

export interface LocalExpense {
  id: string;
  store_id: string;
  amount: number;
  category: string;
  description?: string;
  expense_date: string;
  created_at: string;
  synced: boolean;
}

export interface LocalDebt {
  id: string;
  store_id: string;
  customer_name: string;
  amount: number;
  description?: string;
  is_paid: boolean;
  debt_date: string;
  paid_date?: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface SyncOperation {
  id?: number;
  table: string;
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: string;
}

// Dexie database
export class StoreDatabase extends Dexie {
  stores!: Table<LocalStore>;
  products!: Table<LocalProduct>;
  sales!: Table<LocalSale>;
  expenses!: Table<LocalExpense>;
  debts!: Table<LocalDebt>;
  syncQueue!: Table<SyncOperation>;

  constructor() {
    super('StoreManagementDB');
    this.version(1).stores({
      stores: 'id, owner_id, synced',
      products: 'id, store_id, synced',
      sales: 'id, store_id, product_id, sale_date, synced',
      expenses: 'id, store_id, expense_date, synced',
      debts: 'id, store_id, is_paid, synced',
      syncQueue: '++id, table, timestamp',
    });
  }
}

export const db = new StoreDatabase();
