-- Add notes column to violations table for user comments
ALTER TABLE public.violations 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS oath_status TEXT;