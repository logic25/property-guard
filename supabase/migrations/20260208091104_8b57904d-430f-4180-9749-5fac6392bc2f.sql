-- Add violation_type column to categorize violations
ALTER TABLE public.violations 
ADD COLUMN violation_type text;

-- Add comment for documentation
COMMENT ON COLUMN public.violations.violation_type IS 'Type of violation: elevator, plumbing, construction, electrical, fire_safety, structural, etc.';