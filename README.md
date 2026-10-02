# Pocket Shop Manager & E-Commerce Storefront

A modern, production-ready **Shop Website & Point-of-Sale (POS) Management System** built with React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL with RLS), and Dexie.js (IndexedDB).

---

## Features

### 🛒 Customer Storefront & Checkout
- **Public Shop Website**: Modern, vibrant product catalog with hero section, search bar, and category filters.
- **Interactive Cart**: Slide-over cart drawer with real-time quantity adjustments, subtotal calculation, and local persistence.
- **Full Checkout Flow**: Shipping details form, payment method selector (Card, Cash on Delivery, Bank Transfer), tax calculation, and order processing.
- **Persisted Orders**: Saves orders and itemized lists to Supabase `orders` and `order_items` tables, while auto-deducting stock in `products`.
- **Order Success Page**: Printable digital receipt with order tracking ID and summary.

### ✉️ Mailgun Email Confirmations
- Integrated email notification service via Mailgun REST API.
- Automatically dispatches HTML-formatted order receipts with itemized pricing, shipping address, and order totals.
- Smart fallback mode: Logs formatted email previews in the console when credentials are in simulation mode.

### 🔑 Google Authentication
- Dual sign-in support: Traditional Email/Password + Google Cloud OAuth.
- Powered by Supabase Auth with Row Level Security (RLS) ensuring strict user data isolation.

### 🏬 Store Management Dashboard
- **Multi-Store Management**: Create and switch between multiple shop locations.
- **Inventory & Stock Alerts**: Monitor stock levels, cost price, selling price, and reorder levels with low-stock warnings.
- **Sales & Expense Tracking**: Record sales, log operational expenses by category, and track net profit automatically.
- **Customer Debt Ledger**: Track credit sales, unpaid customer balances, and record payments.
- **Offline & Hydration Sync**: Local IndexedDB caching via Dexie.js with automatic bidirectional server hydration when online.

---

## Tech Stack

| Component | Technology |
| :--- | :--- |
| **Framework** | [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL + RLS + OAuth) |
| **Offline Cache** | [Dexie.js](https://dexie.org/) (IndexedDB) |
| **Email Service** | [Mailgun API](https://www.mailgun.com/) |
| **Icons** | [Lucide React](https://lucide.dev/) |

---

## Environment Variables Setup

Create a `.env` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_PROJECT_ID="zjrnzwedbqisyiqqfaet"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
VITE_SUPABASE_URL="https://zjrnzwedbqisyiqqfaet.supabase.co"

# Mailgun Configuration (Optional for live email dispatch)
VITE_MAILGUN_API_KEY="your-mailgun-api-key"
VITE_MAILGUN_DOMAIN="mg.yourdomain.com"
VITE_MAILGUN_SENDER_EMAIL="orders@yourdomain.com"
```

---

## Setting up Google Auth with Google Cloud Console

To enable **Sign in with Google**:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new Project or select an existing one.
3. Navigate to **APIs & Services > OAuth consent screen**:
   - Choose User Type (**External** or **Internal**).
   - Fill in App name ("Pocket Shop"), User support email, and Developer contact information.
4. Navigate to **APIs & Services > Credentials**:
   - Click **Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Pocket Shop OAuth`.
   - **Authorized JavaScript origins**: `https://<your-supabase-project>.supabase.co` and `http://localhost:8080`.
   - **Authorized redirect URIs**: `https://<your-supabase-project>.supabase.co/auth/v1/callback`.
5. Copy your **Client ID** and **Client Secret**.
6. Open your [Supabase Dashboard](https://supabase.com/dashboard):
   - Go to **Authentication > Providers > Google**.
   - Toggle **Enable Google provider**.
   - Paste your **Client ID** and **Client Secret**, then save.

---

## Database Migrations (Supabase)

Run the SQL migration scripts located in `supabase/migrations/`:
1. `20251119152808_4f22e82f-59cd-4ae7-a04d-a56eebdb2e31.sql` (Core tables & RLS policies)
2. `20251119152820_c9677268-7782-4fa3-93e0-58680b676510.sql` (Functions & Triggers)
3. `20251119160000_add_restocks.sql` (Restocks schema)
4. `20251119180000_create_orders_schema.sql` (Customer orders & order items)

---

## Getting Started Locally

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

# 3. Build for production
npm run build
```
