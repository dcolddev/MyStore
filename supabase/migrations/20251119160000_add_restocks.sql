-- Create restocks table to track inventory replenishment events
CREATE TABLE public.restocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_cost DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  restock_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.restocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view restocks in their stores"
  ON public.restocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = restocks.store_id
      AND stores.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create restocks in their stores"
  ON public.restocks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_id
      AND stores.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update restocks in their stores"
  ON public.restocks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = restocks.store_id
      AND stores.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete restocks in their stores"
  ON public.restocks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = restocks.store_id
      AND stores.owner_id = auth.uid()
    )
  );

-- Keep updated_at fresh
CREATE TRIGGER set_restocks_updated_at
  BEFORE UPDATE ON public.restocks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Automatically increase stock when a restock is recorded
CREATE OR REPLACE FUNCTION public.increase_stock_on_restock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET quantity = quantity + NEW.quantity,
      cost_price = NEW.unit_cost,
      updated_at = NOW()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_restock_created
  AFTER INSERT ON public.restocks
  FOR EACH ROW EXECUTE FUNCTION public.increase_stock_on_restock();


