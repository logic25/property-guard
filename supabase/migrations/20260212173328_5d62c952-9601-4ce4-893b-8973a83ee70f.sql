
-- Track AI usage per user per month
CREATE TABLE public.ai_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month TEXT NOT NULL, -- e.g. '2026-02'
  question_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage"
ON public.ai_usage FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage"
ON public.ai_usage FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage"
ON public.ai_usage FOR UPDATE
USING (auth.uid() = user_id);
