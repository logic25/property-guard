
-- Fix: restrict email_log INSERT to authenticated users inserting their own rows
DROP POLICY "Service role can insert email logs" ON public.email_log;
CREATE POLICY "Users can insert own email logs"
  ON public.email_log FOR INSERT WITH CHECK (auth.uid() = user_id);
