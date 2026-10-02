-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create stores table (multi-store support)
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create sales table
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  total_revenue DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  profit DECIMAL(10, 2) NOT NULL,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  expense_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create customer_debts table
CREATE TABLE public.customer_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  debt_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_debts ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Stores policies
CREATE POLICY "Users can view own stores"
  ON public.stores FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can create own stores"
  ON public.stores FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own stores"
  ON public.stores FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own stores"
  ON public.stores FOR DELETE
  USING (auth.uid() = owner_id);

-- Products policies
CREATE POLICY "Users can view products in their stores"
  ON public.products FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = products.store_id 
    AND stores.owner_id = auth.uid()
  ));

CREATE POLICY "Users can create products in their stores"
  ON public.products FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = store_id 
    AND stores.owner_id = auth.uid()
  ));

CREATE POLICY "Users can update products in their stores"
  ON public.products FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = products.store_id 
    AND stores.owner_id = auth.uid()
  ));

CREATE POLICY "Users can delete products in their stores"
  ON public.products FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = products.store_id 
    AND stores.owner_id = auth.uid()
  ));

-- Sales policies
CREATE POLICY "Users can view sales in their stores"
  ON public.sales FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = sales.store_id 
    AND stores.owner_id = auth.uid()
  ));

CREATE POLICY "Users can create sales in their stores"
  ON public.sales FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = store_id 
    AND stores.owner_id = auth.uid()
  ));

-- Expenses policies
CREATE POLICY "Users can view expenses in their stores"
  ON public.expenses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = expenses.store_id 
    AND stores.owner_id = auth.uid()
  ));

CREATE POLICY "Users can create expenses in their stores"
  ON public.expenses FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = store_id 
    AND stores.owner_id = auth.uid()
  ));

CREATE POLICY "Users can update expenses in their stores"
  ON public.expenses FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = expenses.store_id 
    AND stores.owner_id = auth.uid()
  ));

CREATE POLICY "Users can delete expenses in their stores"
  ON public.expenses FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = expenses.store_id 
    AND stores.owner_id = auth.uid()
  ));

-- Customer debts policies
CREATE POLICY "Users can view debts in their stores"
  ON public.customer_debts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = customer_debts.store_id 
    AND stores.owner_id = auth.uid()
  ));

CREATE POLICY "Users can create debts in their stores"
  ON public.customer_debts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = store_id 
    AND stores.owner_id = auth.uid()
  ));

CREATE POLICY "Users can update debts in their stores"
  ON public.customer_debts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = customer_debts.store_id 
    AND stores.owner_id = auth.uid()
  ));

CREATE POLICY "Users can delete debts in their stores"
  ON public.customer_debts FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = customer_debts.store_id 
    AND stores.owner_id = auth.uid()
  ));

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_customer_debts_updated_at
  BEFORE UPDATE ON public.customer_debts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to reduce stock on sale
CREATE OR REPLACE FUNCTION public.reduce_stock_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.products
  SET quantity = quantity - NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_sale_created
  AFTER INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.reduce_stock_on_sale();