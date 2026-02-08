-- Add extracted_text column to property_documents for storing parsed document content
ALTER TABLE public.property_documents 
ADD COLUMN IF NOT EXISTS extracted_text TEXT DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.property_documents.extracted_text IS 'Extracted text content from PDF/document for AI analysis';