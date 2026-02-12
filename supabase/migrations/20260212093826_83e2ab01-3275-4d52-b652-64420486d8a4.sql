
-- Function to generate deadline reminder notifications
-- Called by scheduled sync or cron job
CREATE OR REPLACE FUNCTION public.generate_deadline_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_days_until INTEGER;
  v_reminder_label TEXT;
  v_priority TEXT;
  v_user_id UUID;
  v_notification_exists BOOLEAN;
BEGIN
  -- Process violation deadlines (hearing_date, cure_due_date, certification_due_date)
  FOR v_record IN
    SELECT 
      v.id as violation_id,
      v.violation_number,
      v.agency,
      v.property_id,
      p.address as property_address,
      p.user_id,
      unnest(ARRAY[
        CASE WHEN v.hearing_date IS NOT NULL THEN v.hearing_date END,
        CASE WHEN v.cure_due_date IS NOT NULL THEN v.cure_due_date END,
        CASE WHEN v.certification_due_date IS NOT NULL THEN v.certification_due_date END
      ]) as deadline_date,
      unnest(ARRAY[
        CASE WHEN v.hearing_date IS NOT NULL THEN 'Hearing' END,
        CASE WHEN v.cure_due_date IS NOT NULL THEN 'Cure Deadline' END,
        CASE WHEN v.certification_due_date IS NOT NULL THEN 'Certification' END
      ]) as deadline_type
    FROM violations v
    JOIN properties p ON p.id = v.property_id
    WHERE v.status != 'closed'
      AND (v.hearing_date IS NOT NULL OR v.cure_due_date IS NOT NULL OR v.certification_due_date IS NOT NULL)
  LOOP
    -- Skip nulls from unnest
    IF v_record.deadline_date IS NULL OR v_record.deadline_type IS NULL THEN
      CONTINUE;
    END IF;

    v_days_until := (v_record.deadline_date::date - CURRENT_DATE);
    
    -- Only create reminders for 7, 3, or 1 day(s) before
    IF v_days_until NOT IN (7, 3, 1) THEN
      CONTINUE;
    END IF;

    -- Set reminder label and priority
    IF v_days_until = 1 THEN
      v_reminder_label := 'Tomorrow';
      v_priority := 'critical';
    ELSIF v_days_until = 3 THEN
      v_reminder_label := 'In 3 days';
      v_priority := 'high';
    ELSE
      v_reminder_label := 'In 7 days';
      v_priority := 'normal';
    END IF;

    -- Check if notification already exists for this deadline + reminder window
    SELECT EXISTS(
      SELECT 1 FROM notifications 
      WHERE entity_id = v_record.violation_id::text
        AND entity_type = 'violation'
        AND category = 'deadline_reminder'
        AND user_id = v_record.user_id
        AND metadata->>'deadline_type' = v_record.deadline_type
        AND metadata->>'days_until' = v_days_until::text
        AND created_at > CURRENT_DATE - INTERVAL '1 day'
    ) INTO v_notification_exists;

    IF v_notification_exists THEN
      CONTINUE;
    END IF;

    -- Insert notification
    INSERT INTO notifications (
      user_id, title, message, category, priority,
      property_id, entity_id, entity_type, metadata
    ) VALUES (
      v_record.user_id,
      v_record.deadline_type || ' ' || v_reminder_label,
      v_record.agency || ' #' || v_record.violation_number || ' at ' || v_record.property_address || ' — ' || v_record.deadline_type || ' due ' || to_char(v_record.deadline_date, 'Mon DD, YYYY'),
      'deadline_reminder',
      v_priority::notification_priority,
      v_record.property_id,
      v_record.violation_id::text,
      'violation',
      jsonb_build_object(
        'deadline_type', v_record.deadline_type,
        'deadline_date', v_record.deadline_date,
        'days_until', v_days_until,
        'agency', v_record.agency,
        'violation_number', v_record.violation_number
      )
    );
  END LOOP;

  -- Process document expirations
  FOR v_record IN
    SELECT 
      d.id as document_id,
      d.document_name,
      d.document_type,
      d.expiration_date,
      d.property_id,
      p.address as property_address,
      p.user_id
    FROM property_documents d
    JOIN properties p ON p.id = d.property_id
    WHERE d.expiration_date IS NOT NULL
      AND (d.is_current IS NULL OR d.is_current = true)
  LOOP
    v_days_until := (v_record.expiration_date::date - CURRENT_DATE);
    
    IF v_days_until NOT IN (7, 3, 1) THEN
      CONTINUE;
    END IF;

    IF v_days_until = 1 THEN
      v_reminder_label := 'Tomorrow';
      v_priority := 'critical';
    ELSIF v_days_until = 3 THEN
      v_reminder_label := 'In 3 days';
      v_priority := 'high';
    ELSE
      v_reminder_label := 'In 7 days';
      v_priority := 'normal';
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM notifications 
      WHERE entity_id = v_record.document_id::text
        AND entity_type = 'document'
        AND category = 'deadline_reminder'
        AND user_id = v_record.user_id
        AND metadata->>'days_until' = v_days_until::text
        AND created_at > CURRENT_DATE - INTERVAL '1 day'
    ) INTO v_notification_exists;

    IF v_notification_exists THEN
      CONTINUE;
    END IF;

    INSERT INTO notifications (
      user_id, title, message, category, priority,
      property_id, entity_id, entity_type, metadata
    ) VALUES (
      v_record.user_id,
      v_record.document_type || ' Expires ' || v_reminder_label,
      v_record.document_name || ' at ' || v_record.property_address || ' expires ' || to_char(v_record.expiration_date, 'Mon DD, YYYY'),
      'deadline_reminder',
      v_priority::notification_priority,
      v_record.property_id,
      v_record.document_id::text,
      'document',
      jsonb_build_object(
        'deadline_type', 'Document Expiration',
        'deadline_date', v_record.expiration_date,
        'days_until', v_days_until,
        'document_type', v_record.document_type,
        'document_name', v_record.document_name
      )
    );
  END LOOP;
END;
$$;
