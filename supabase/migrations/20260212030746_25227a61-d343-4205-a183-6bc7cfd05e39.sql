
-- Add monitoring columns to properties
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

-- Add missing violation columns for financial tracking and complaints
ALTER TABLE public.violations ADD COLUMN IF NOT EXISTS balance_due DECIMAL(10,2);
ALTER TABLE public.violations ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2);
ALTER TABLE public.violations ADD COLUMN IF NOT EXISTS disposition_comments TEXT;
ALTER TABLE public.violations ADD COLUMN IF NOT EXISTS violation_category TEXT;

-- Add complaint-specific columns
ALTER TABLE public.violations ADD COLUMN IF NOT EXISTS complaint_number TEXT;
ALTER TABLE public.violations ADD COLUMN IF NOT EXISTS complaint_category TEXT;
ALTER TABLE public.violations ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE public.violations ADD COLUMN IF NOT EXISTS disposition_code TEXT;

-- Add indexes for monitoring queries
CREATE INDEX IF NOT EXISTS idx_violations_severity ON public.violations(severity);
CREATE INDEX IF NOT EXISTS idx_violations_hearing_date ON public.violations(hearing_date);
CREATE INDEX IF NOT EXISTS idx_properties_monitoring ON public.properties(monitoring_enabled) WHERE monitoring_enabled = true;
