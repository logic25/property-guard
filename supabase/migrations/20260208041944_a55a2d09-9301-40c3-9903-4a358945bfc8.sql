-- Add owner/entity name field to properties table
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS owner_name text;