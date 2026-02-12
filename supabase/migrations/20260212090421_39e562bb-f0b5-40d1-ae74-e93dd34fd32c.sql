
-- ============================================================
-- PART 1: Auto-notification triggers for violations & compliance
-- ============================================================

-- Function: create notification when a new violation is inserted
CREATE OR REPLACE FUNCTION public.notify_new_violation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_address text;
  v_priority notification_priority;
  v_title text;
  v_message text;
BEGIN
  -- Get the property owner and address
  SELECT user_id, address INTO v_user_id, v_address
  FROM properties WHERE id = NEW.property_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine priority based on violation characteristics
  IF NEW.is_stop_work_order = true OR NEW.is_vacate_order = true THEN
    v_priority := 'critical';
    v_title := CASE
      WHEN NEW.is_stop_work_order THEN 'Stop Work Order Issued'
      ELSE 'Vacate Order Issued'
    END;
  ELSIF NEW.severity = 'critical' OR NEW.violation_class = 'I' THEN
    v_priority := 'critical';
    v_title := 'Critical Violation Issued';
  ELSIF NEW.severity = 'high' OR NEW.violation_class IN ('II', 'A') THEN
    v_priority := 'high';
    v_title := 'New ' || NEW.agency || ' Violation';
  ELSE
    v_priority := 'normal';
    v_title := 'New ' || NEW.agency || ' Violation';
  END IF;

  v_message := NEW.agency || ' violation #' || NEW.violation_number
    || ' issued for ' || v_address;

  IF NEW.description_raw IS NOT NULL AND length(NEW.description_raw) > 0 THEN
    v_message := v_message || ': ' || left(NEW.description_raw, 120);
  END IF;

  INSERT INTO notifications (user_id, property_id, title, message, priority, category, entity_type, entity_id)
  VALUES (v_user_id, NEW.property_id, v_title, v_message, v_priority, 'violations', 'violation', NEW.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_violation
  AFTER INSERT ON public.violations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_violation();

-- Function: create notification when compliance requirement status changes or deadline approaches
CREATE OR REPLACE FUNCTION public.notify_compliance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_address text;
  v_priority notification_priority;
BEGIN
  SELECT user_id, address INTO v_user_id, v_address
  FROM properties WHERE id = NEW.property_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Notify when status changes to overdue
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'overdue' THEN
    INSERT INTO notifications (user_id, property_id, title, message, priority, category, entity_type, entity_id)
    VALUES (
      v_user_id, NEW.property_id,
      'Compliance Filing Overdue',
      NEW.requirement_name || ' (' || NEW.local_law || ') is now overdue for ' || v_address,
      'high', 'compliance', 'compliance', NEW.id
    );
  END IF;

  -- Notify when a new requirement with an upcoming deadline is created
  IF TG_OP = 'INSERT' AND NEW.due_date IS NOT NULL AND NEW.due_date <= (CURRENT_DATE + interval '30 days') THEN
    v_priority := CASE
      WHEN NEW.due_date <= CURRENT_DATE THEN 'critical'
      WHEN NEW.due_date <= (CURRENT_DATE + interval '7 days') THEN 'high'
      ELSE 'normal'
    END;

    INSERT INTO notifications (user_id, property_id, title, message, priority, category, entity_type, entity_id)
    VALUES (
      v_user_id, NEW.property_id,
      'Compliance Deadline Approaching',
      NEW.requirement_name || ' (' || NEW.local_law || ') is due ' || to_char(NEW.due_date, 'Mon DD, YYYY') || ' for ' || v_address,
      v_priority, 'compliance', 'compliance', NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_compliance_change
  AFTER INSERT OR UPDATE ON public.compliance_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_compliance_change();

-- ============================================================
-- PART 2: Compliance scoring table and calculation function
-- ============================================================

CREATE TABLE public.compliance_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 100 CHECK (score >= 0 AND score <= 100),
  grade text NOT NULL DEFAULT 'A',
  violation_score integer NOT NULL DEFAULT 40,
  compliance_score integer NOT NULL DEFAULT 40,
  resolution_score integer NOT NULL DEFAULT 20,
  violation_details jsonb DEFAULT '{}'::jsonb,
  compliance_details jsonb DEFAULT '{}'::jsonb,
  resolution_details jsonb DEFAULT '{}'::jsonb,
  calculated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(property_id)
);

ALTER TABLE public.compliance_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own compliance scores"
  ON public.compliance_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage compliance scores"
  ON public.compliance_scores FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_compliance_scores_updated_at
  BEFORE UPDATE ON public.compliance_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate compliance score for a property
CREATE OR REPLACE FUNCTION public.calculate_compliance_score(p_property_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_violation_score integer := 40;
  v_compliance_score integer := 40;
  v_resolution_score integer := 20;
  v_total integer;
  v_grade text;
  v_critical_count integer;
  v_high_count integer;
  v_normal_count integer;
  v_overdue_count integer;
  v_pending_count integer;
  v_total_violations integer;
  v_closed_violations integer;
  v_avg_days_to_close numeric;
  v_violation_details jsonb;
  v_compliance_details jsonb;
  v_resolution_details jsonb;
BEGIN
  SELECT user_id INTO v_user_id FROM properties WHERE id = p_property_id;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Property not found');
  END IF;

  -- === Violation Score (40 points max) ===
  -- Count open violations by severity (exclude suppressed)
  SELECT
    COALESCE(SUM(CASE WHEN severity = 'critical' OR is_stop_work_order OR is_vacate_order THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN severity = 'high' AND NOT COALESCE(is_stop_work_order, false) AND NOT COALESCE(is_vacate_order, false) THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(severity, 'normal') NOT IN ('critical', 'high') AND NOT COALESCE(is_stop_work_order, false) AND NOT COALESCE(is_vacate_order, false) THEN 1 ELSE 0 END), 0)
  INTO v_critical_count, v_high_count, v_normal_count
  FROM violations
  WHERE property_id = p_property_id
    AND status = 'open'
    AND COALESCE(suppressed, false) = false;

  -- Deductions: critical = -10 each (max 40), high = -5 each, normal = -2 each
  v_violation_score := GREATEST(0, 40
    - LEAST(40, v_critical_count * 10)
    - LEAST(20, v_high_count * 5)
    - LEAST(10, v_normal_count * 2));

  v_violation_details := jsonb_build_object(
    'critical_open', v_critical_count,
    'high_open', v_high_count,
    'normal_open', v_normal_count
  );

  -- === Compliance Score (40 points max) ===
  SELECT
    COALESCE(SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0)
  INTO v_overdue_count, v_pending_count
  FROM compliance_requirements
  WHERE property_id = p_property_id;

  -- Deductions: overdue = -15 each (max 40), pending near due = -5 each
  v_compliance_score := GREATEST(0, 40
    - LEAST(40, v_overdue_count * 15)
    - LEAST(10, v_pending_count * 5));

  v_compliance_details := jsonb_build_object(
    'overdue_count', v_overdue_count,
    'pending_count', v_pending_count
  );

  -- === Resolution Score (20 points max) ===
  SELECT COUNT(*), COALESCE(SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END), 0)
  INTO v_total_violations, v_closed_violations
  FROM violations
  WHERE property_id = p_property_id
    AND COALESCE(suppressed, false) = false;

  IF v_total_violations > 0 AND v_closed_violations > 0 THEN
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400), 90)
    INTO v_avg_days_to_close
    FROM violations
    WHERE property_id = p_property_id
      AND status = 'closed'
      AND COALESCE(suppressed, false) = false;

    -- < 30 days avg = 20pts, 30-60 = 15pts, 60-90 = 10pts, 90-180 = 5pts, >180 = 0pts
    v_resolution_score := CASE
      WHEN v_avg_days_to_close < 30 THEN 20
      WHEN v_avg_days_to_close < 60 THEN 15
      WHEN v_avg_days_to_close < 90 THEN 10
      WHEN v_avg_days_to_close < 180 THEN 5
      ELSE 0
    END;
  ELSIF v_total_violations = 0 THEN
    v_resolution_score := 20; -- No violations = perfect resolution
  ELSE
    v_resolution_score := 5; -- All open, none closed
  END IF;

  v_resolution_details := jsonb_build_object(
    'total_violations', v_total_violations,
    'closed_violations', v_closed_violations,
    'avg_days_to_close', COALESCE(round(v_avg_days_to_close, 1), 0)
  );

  -- === Total & Grade ===
  v_total := v_violation_score + v_compliance_score + v_resolution_score;
  v_grade := CASE
    WHEN v_total >= 90 THEN 'A'
    WHEN v_total >= 80 THEN 'B'
    WHEN v_total >= 70 THEN 'C'
    WHEN v_total >= 60 THEN 'D'
    ELSE 'F'
  END;

  -- Upsert the score
  INSERT INTO compliance_scores (property_id, user_id, score, grade, violation_score, compliance_score, resolution_score, violation_details, compliance_details, resolution_details, calculated_at)
  VALUES (p_property_id, v_user_id, v_total, v_grade, v_violation_score, v_compliance_score, v_resolution_score, v_violation_details, v_compliance_details, v_resolution_details, now())
  ON CONFLICT (property_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    score = EXCLUDED.score,
    grade = EXCLUDED.grade,
    violation_score = EXCLUDED.violation_score,
    compliance_score = EXCLUDED.compliance_score,
    resolution_score = EXCLUDED.resolution_score,
    violation_details = EXCLUDED.violation_details,
    compliance_details = EXCLUDED.compliance_details,
    resolution_details = EXCLUDED.resolution_details,
    calculated_at = EXCLUDED.calculated_at;

  RETURN jsonb_build_object(
    'score', v_total,
    'grade', v_grade,
    'violation_score', v_violation_score,
    'compliance_score', v_compliance_score,
    'resolution_score', v_resolution_score
  );
END;
$$;
