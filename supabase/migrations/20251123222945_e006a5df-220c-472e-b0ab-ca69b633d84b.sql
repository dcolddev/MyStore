-- Add unit conversion fields to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS dericas_per_bag integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS dericas_per_paint integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS unit_type text DEFAULT 'derica';

-- Add comment for clarity
COMMENT ON COLUMN public.products.dericas_per_bag IS 'Number of dericas in one bag for this product';
COMMENT ON COLUMN public.products.dericas_per_paint IS 'Number of dericas in one paint for this product';
COMMENT ON COLUMN public.products.unit_type IS 'Preferred display unit: bag, paint, derica, or kg';

-- Update existing products with default values based on common products
-- These are just defaults, users can edit them
UPDATE public.products 
SET dericas_per_bag = 100, 
    dericas_per_paint = 5,
    unit_type = 'derica'
WHERE dericas_per_bag IS NULL;