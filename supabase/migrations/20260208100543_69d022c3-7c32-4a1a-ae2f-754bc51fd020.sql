-- Create applications table for tracking NYC agency applications
CREATE TABLE public.applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  application_number TEXT NOT NULL,
  application_type TEXT NOT NULL,
  agency TEXT NOT NULL DEFAULT 'DOB',
  source TEXT NOT NULL DEFAULT 'BIS', -- BIS, DOB_NOW, etc.
  status TEXT DEFAULT 'open',
  filing_date DATE,
  approval_date DATE,
  expiration_date DATE,
  job_type TEXT,
  work_type TEXT,
  description TEXT,
  applicant_name TEXT,
  owner_name TEXT,
  estimated_cost NUMERIC,
  floor_area NUMERIC,
  stories INTEGER,
  dwelling_units INTEGER,
  notes TEXT,
  raw_data JSONB,
  synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(property_id, application_number, agency)
);

-- Enable RLS
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- RLS policies for applications
CREATE POLICY "Users can view applications for their properties"
  ON public.applications FOR SELECT
  USING (EXISTS (SELECT 1 FROM properties WHERE properties.id = applications.property_id AND properties.user_id = auth.uid()));

CREATE POLICY "Users can insert applications for their properties"
  ON public.applications FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM properties WHERE properties.id = applications.property_id AND properties.user_id = auth.uid()));

CREATE POLICY "Users can update applications for their properties"
  ON public.applications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM properties WHERE properties.id = applications.property_id AND properties.user_id = auth.uid()));

CREATE POLICY "Users can delete applications for their properties"
  ON public.applications FOR DELETE
  USING (EXISTS (SELECT 1 FROM properties WHERE properties.id = applications.property_id AND properties.user_id = auth.uid()));

-- Create DD reports table
CREATE TABLE public.dd_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  address TEXT NOT NULL,
  bin TEXT,
  bbl TEXT,
  prepared_for TEXT NOT NULL,
  prepared_by TEXT,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, generating, completed, error
  building_data JSONB,
  violations_data JSONB,
  applications_data JSONB,
  orders_data JSONB, -- SWO, vacate orders
  line_item_notes JSONB DEFAULT '[]'::jsonb, -- [{item_id, item_type, note}]
  general_notes TEXT,
  ai_analysis TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dd_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for DD reports
CREATE POLICY "Users can view their own DD reports"
  ON public.dd_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own DD reports"
  ON public.dd_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own DD reports"
  ON public.dd_reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own DD reports"
  ON public.dd_reports FOR DELETE
  USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_applications_property_id ON public.applications(property_id);
CREATE INDEX idx_applications_agency ON public.applications(agency);
CREATE INDEX idx_applications_status ON public.applications(status);
CREATE INDEX idx_dd_reports_user_id ON public.dd_reports(user_id);
CREATE INDEX idx_dd_reports_status ON public.dd_reports(status);

-- Add updated_at trigger for applications
CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for dd_reports
CREATE TRIGGER update_dd_reports_updated_at
  BEFORE UPDATE ON public.dd_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();