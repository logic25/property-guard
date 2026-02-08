-- Create property activity log table
CREATE TABLE public.property_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster property lookups
CREATE INDEX idx_property_activity_property_id ON public.property_activity_log(property_id);
CREATE INDEX idx_property_activity_created_at ON public.property_activity_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.property_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can view/manage activity for their properties
CREATE POLICY "Users can view activity for their properties" 
ON public.property_activity_log 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM properties 
  WHERE properties.id = property_activity_log.property_id 
  AND properties.user_id = auth.uid()
));

CREATE POLICY "Users can insert activity for their properties" 
ON public.property_activity_log 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM properties 
  WHERE properties.id = property_activity_log.property_id 
  AND properties.user_id = auth.uid()
));

CREATE POLICY "Users can delete activity for their properties" 
ON public.property_activity_log 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM properties 
  WHERE properties.id = property_activity_log.property_id 
  AND properties.user_id = auth.uid()
));