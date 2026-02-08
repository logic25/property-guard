-- Create property_members table for multi-user access
CREATE TABLE public.property_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'manager', 'super', 'viewer')),
  invited_by UUID,
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'removed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(property_id, email)
);

-- Enable RLS
ALTER TABLE public.property_members ENABLE ROW LEVEL SECURITY;

-- Property owners can manage members
CREATE POLICY "Property owners can view members"
ON public.property_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM properties 
    WHERE properties.id = property_members.property_id 
    AND properties.user_id = auth.uid()
  )
  OR user_id = auth.uid()
);

CREATE POLICY "Property owners can insert members"
ON public.property_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM properties 
    WHERE properties.id = property_members.property_id 
    AND properties.user_id = auth.uid()
  )
);

CREATE POLICY "Property owners can update members"
ON public.property_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM properties 
    WHERE properties.id = property_members.property_id 
    AND properties.user_id = auth.uid()
  )
);

CREATE POLICY "Property owners can delete members"
ON public.property_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM properties 
    WHERE properties.id = property_members.property_id 
    AND properties.user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_property_members_updated_at
BEFORE UPDATE ON public.property_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();