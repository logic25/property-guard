
-- Create compliance_requirements table for Local Law tracking
CREATE TABLE public.compliance_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  local_law TEXT NOT NULL,
  requirement_name TEXT NOT NULL,
  description TEXT,
  cycle_year INTEGER,
  due_date DATE,
  filing_deadline DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  last_filed_date DATE,
  next_due_date DATE,
  penalty_amount NUMERIC,
  penalty_description TEXT,
  applicability_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(property_id, local_law, cycle_year)
);

-- Enable RLS
ALTER TABLE public.compliance_requirements ENABLE ROW LEVEL SECURITY;

-- RLS policies scoped through properties.user_id
CREATE POLICY "Users can view compliance for their properties"
ON public.compliance_requirements FOR SELECT
USING (EXISTS (
  SELECT 1 FROM properties
  WHERE properties.id = compliance_requirements.property_id
  AND properties.user_id = auth.uid()
));

CREATE POLICY "Users can insert compliance for their properties"
ON public.compliance_requirements FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM properties
  WHERE properties.id = compliance_requirements.property_id
  AND properties.user_id = auth.uid()
));

CREATE POLICY "Users can update compliance for their properties"
ON public.compliance_requirements FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM properties
  WHERE properties.id = compliance_requirements.property_id
  AND properties.user_id = auth.uid()
));

CREATE POLICY "Users can delete compliance for their properties"
ON public.compliance_requirements FOR DELETE
USING (EXISTS (
  SELECT 1 FROM properties
  WHERE properties.id = compliance_requirements.property_id
  AND properties.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_compliance_requirements_updated_at
BEFORE UPDATE ON public.compliance_requirements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast property lookups
CREATE INDEX idx_compliance_requirements_property_id ON public.compliance_requirements(property_id);
CREATE INDEX idx_compliance_requirements_status ON public.compliance_requirements(status);
