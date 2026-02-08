-- Create portfolios table for grouping properties
CREATE TABLE public.portfolios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add portfolio_id to properties table
ALTER TABLE public.properties 
ADD COLUMN portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE SET NULL;

-- Enable RLS on portfolios
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

-- RLS policies for portfolios
CREATE POLICY "Users can view their own portfolios" 
ON public.portfolios FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own portfolios" 
ON public.portfolios FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own portfolios" 
ON public.portfolios FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own portfolios" 
ON public.portfolios FOR DELETE 
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_portfolios_updated_at
BEFORE UPDATE ON public.portfolios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update agency_type enum to include new agencies
ALTER TYPE public.agency_type ADD VALUE IF NOT EXISTS 'HPD';
ALTER TYPE public.agency_type ADD VALUE IF NOT EXISTS 'DEP';
ALTER TYPE public.agency_type ADD VALUE IF NOT EXISTS 'DOT';
ALTER TYPE public.agency_type ADD VALUE IF NOT EXISTS 'DSNY';
ALTER TYPE public.agency_type ADD VALUE IF NOT EXISTS 'LPC';
ALTER TYPE public.agency_type ADD VALUE IF NOT EXISTS 'DOF';

-- Create index for portfolio lookups
CREATE INDEX idx_properties_portfolio_id ON public.properties(portfolio_id);