-- Add phone number and verification fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

-- Create index on phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);