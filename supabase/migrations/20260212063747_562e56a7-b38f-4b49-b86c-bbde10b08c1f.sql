-- Change tracking table for daily summary emails
CREATE TABLE public.change_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'violation' or 'application'
  entity_id UUID NOT NULL,
  change_type TEXT NOT NULL, -- 'new', 'status_change', 'updated'
  previous_value TEXT,
  new_value TEXT,
  entity_label TEXT, -- violation_number or application_number
  description TEXT, -- human-readable summary
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.change_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own change logs"
ON public.change_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert change logs"
ON public.change_log FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update change logs"
ON public.change_log FOR UPDATE
USING (true);

-- Index for efficient querying
CREATE INDEX idx_change_log_user_notified ON public.change_log(user_id, notified, created_at DESC);
CREATE INDEX idx_change_log_property ON public.change_log(property_id, created_at DESC);