
-- Email preferences table
CREATE TABLE public.email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT,
  digest_frequency TEXT NOT NULL DEFAULT 'none', -- 'weekly', 'daily', 'none'
  digest_day TEXT NOT NULL DEFAULT 'monday',
  notify_new_violations BOOLEAN NOT NULL DEFAULT true,
  notify_status_changes BOOLEAN NOT NULL DEFAULT true,
  notify_expirations BOOLEAN NOT NULL DEFAULT true,
  notify_new_applications BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email preferences"
  ON public.email_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own email preferences"
  ON public.email_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own email preferences"
  ON public.email_preferences FOR UPDATE USING (auth.uid() = user_id);

-- Email log table
CREATE TABLE public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email_type TEXT NOT NULL, -- 'digest', 'alert', 'notification'
  subject TEXT NOT NULL,
  recipient_email TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email logs"
  ON public.email_log FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert logs from edge functions
CREATE POLICY "Service role can insert email logs"
  ON public.email_log FOR INSERT WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_email_preferences_updated_at
  BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
