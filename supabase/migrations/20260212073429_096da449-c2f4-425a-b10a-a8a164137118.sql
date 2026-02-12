
-- Create oath_hearings table for detailed OATH disposition tracking
CREATE TABLE IF NOT EXISTS public.oath_hearings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summons_number TEXT NOT NULL,
  hearing_date DATE,
  hearing_status TEXT,
  disposition TEXT,
  disposition_date DATE,
  penalty_amount DECIMAL(10,2),
  amount_paid DECIMAL(10,2),
  balance_due DECIMAL(10,2),
  penalty_paid BOOLEAN DEFAULT false,
  violation_id UUID REFERENCES public.violations(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  last_synced_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(summons_number)
);

-- Enable RLS
ALTER TABLE public.oath_hearings ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view through property ownership
CREATE POLICY "Users can view oath hearings for their properties"
  ON public.oath_hearings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.properties
    WHERE properties.id = oath_hearings.property_id
    AND properties.user_id = auth.uid()
  ));

-- Service role can insert/update during sync
CREATE POLICY "Service role can insert oath hearings"
  ON public.oath_hearings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update oath hearings"
  ON public.oath_hearings FOR UPDATE
  USING (true);

-- Indexes
CREATE INDEX idx_oath_hearings_summons ON public.oath_hearings(summons_number);
CREATE INDEX idx_oath_hearings_violation ON public.oath_hearings(violation_id);
CREATE INDEX idx_oath_hearings_property ON public.oath_hearings(property_id);

-- Add trigger for updated_at
CREATE TRIGGER update_oath_hearings_updated_at
  BEFORE UPDATE ON public.oath_hearings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
