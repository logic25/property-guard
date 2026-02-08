-- Add BIN (Building Identification Number) to properties for NYC Open Data API lookups
ALTER TABLE public.properties 
ADD COLUMN bin text;