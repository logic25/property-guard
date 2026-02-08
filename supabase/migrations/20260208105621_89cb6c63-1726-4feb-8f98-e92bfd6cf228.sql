-- Add license_id field to profiles table for expediter license number
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS license_id text;