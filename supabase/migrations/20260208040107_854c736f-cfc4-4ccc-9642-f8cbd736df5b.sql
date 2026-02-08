-- =============================================
-- PHASE 1 SCHEMA UPDATES
-- =============================================

-- Add new columns to properties table
ALTER TABLE public.properties 
  ADD COLUMN IF NOT EXISTS bbl text,
  ADD COLUMN IF NOT EXISTS borough text,
  ADD COLUMN IF NOT EXISTS primary_use_group text,
  ADD COLUMN IF NOT EXISTS dwelling_units integer,
  ADD COLUMN IF NOT EXISTS applicable_agencies text[] DEFAULT ARRAY['DOB', 'ECB']::text[],
  ADD COLUMN IF NOT EXISTS co_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS co_data jsonb,
  ADD COLUMN IF NOT EXISTS compliance_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS sms_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone;

-- Update violations table with enhanced fields
ALTER TABLE public.violations
  ADD COLUMN IF NOT EXISTS severity text,
  ADD COLUMN IF NOT EXISTS violation_class text,
  ADD COLUMN IF NOT EXISTS is_stop_work_order boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vacate_order boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS certification_due_date date,
  ADD COLUMN IF NOT EXISTS penalty_amount decimal,
  ADD COLUMN IF NOT EXISTS daily_penalty_amount decimal,
  ADD COLUMN IF NOT EXISTS penalty_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS respondent_name text,
  ADD COLUMN IF NOT EXISTS respondent_address text,
  ADD COLUMN IF NOT EXISTS synced_at timestamp with time zone;

-- Create property_documents table for document management
CREATE TABLE IF NOT EXISTS public.property_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_name text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_type text,
  file_size_bytes bigint,
  metadata jsonb,
  is_current boolean DEFAULT true,
  expiration_date date,
  uploaded_by uuid,
  uploaded_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_violations_severity ON public.violations(severity);
CREATE INDEX IF NOT EXISTS idx_violations_property_status ON public.violations(property_id, status);
CREATE INDEX IF NOT EXISTS idx_property_documents_property ON public.property_documents(property_id);
CREATE INDEX IF NOT EXISTS idx_property_documents_type ON public.property_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_properties_bin ON public.properties(bin);
CREATE INDEX IF NOT EXISTS idx_properties_bbl ON public.properties(bbl);

-- Enable RLS on property_documents
ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for property_documents (users can manage docs for their properties)
CREATE POLICY "Users can view documents for their properties"
  ON public.property_documents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.properties 
    WHERE properties.id = property_documents.property_id 
    AND properties.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert documents for their properties"
  ON public.property_documents FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.properties 
    WHERE properties.id = property_documents.property_id 
    AND properties.user_id = auth.uid()
  ));

CREATE POLICY "Users can update documents for their properties"
  ON public.property_documents FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.properties 
    WHERE properties.id = property_documents.property_id 
    AND properties.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete documents for their properties"
  ON public.property_documents FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.properties 
    WHERE properties.id = property_documents.property_id 
    AND properties.user_id = auth.uid()
  ));

-- Create storage bucket for property documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('property-documents', 'property-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for property-documents bucket
CREATE POLICY "Users can view their property documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can upload property documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'property-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their property documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'property-documents' AND auth.uid() IS NOT NULL);

-- Add trigger for updated_at on property_documents
CREATE TRIGGER update_property_documents_updated_at
  BEFORE UPDATE ON public.property_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();