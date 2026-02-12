
-- Phase 3A: Add suppression columns to violations table
ALTER TABLE public.violations ADD COLUMN IF NOT EXISTS suppressed boolean DEFAULT false;
ALTER TABLE public.violations ADD COLUMN IF NOT EXISTS suppression_reason text;
