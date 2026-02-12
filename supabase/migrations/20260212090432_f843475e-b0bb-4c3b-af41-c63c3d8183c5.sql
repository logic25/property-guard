
-- Tighten compliance_scores policies: drop the overly permissive service role policy
-- The SECURITY DEFINER function handles inserts/updates, users only need SELECT
DROP POLICY "Service role can manage compliance scores" ON public.compliance_scores;

-- Users can insert/update their own scores (for client-side recalculation calls)
CREATE POLICY "Users can insert their own compliance scores"
  ON public.compliance_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own compliance scores"
  ON public.compliance_scores FOR UPDATE
  USING (auth.uid() = user_id);
