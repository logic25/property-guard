
-- ============================================
-- Sprint 5: Tax & Protest Tracking + Tenant Tagging
-- ============================================

-- 1. Property Taxes table
CREATE TABLE public.property_taxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tax_year INTEGER NOT NULL,
  assessed_value NUMERIC,
  tax_amount NUMERIC,
  amount_paid NUMERIC DEFAULT 0,
  balance_due NUMERIC GENERATED ALWAYS AS (COALESCE(tax_amount, 0) - COALESCE(amount_paid, 0)) STORED,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'partial', 'unpaid', 'exempt')),
  due_date DATE,
  paid_date DATE,
  protest_status TEXT DEFAULT 'none' CHECK (protest_status IN ('none', 'filed', 'pending_hearing', 'decided_favorable', 'decided_unfavorable', 'withdrawn')),
  protest_filed_date DATE,
  protest_hearing_date DATE,
  protest_outcome_notes TEXT,
  tenant_responsible BOOLEAN DEFAULT false,
  tenant_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, tax_year)
);

-- Enable RLS
ALTER TABLE public.property_taxes ENABLE ROW LEVEL SECURITY;

-- RLS policies (user owns the property)
CREATE POLICY "Users can view taxes for their properties"
  ON public.property_taxes FOR SELECT
  USING (property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert taxes for their properties"
  ON public.property_taxes FOR INSERT
  WITH CHECK (property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()));

CREATE POLICY "Users can update taxes for their properties"
  ON public.property_taxes FOR UPDATE
  USING (property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete taxes for their properties"
  ON public.property_taxes FOR DELETE
  USING (property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_property_taxes_updated_at
  BEFORE UPDATE ON public.property_taxes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add tenant tagging columns to applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS tenant_name TEXT,
  ADD COLUMN IF NOT EXISTS tenant_notes TEXT;

-- 3. Notification trigger for overdue taxes
CREATE OR REPLACE FUNCTION public.notify_overdue_tax()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_address text;
BEGIN
  -- Only fire when payment_status changes to unpaid/partial and due_date is past
  IF NEW.payment_status IN ('unpaid', 'partial') AND NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE THEN
    SELECT user_id, address INTO v_user_id, v_address
    FROM properties WHERE id = NEW.property_id;

    IF v_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, property_id, title, message, priority, category, entity_type, entity_id)
      VALUES (
        v_user_id, NEW.property_id,
        'Tax Payment Overdue',
        'Tax Year ' || NEW.tax_year || ' for ' || v_address || ' has $' || COALESCE(NEW.tax_amount - COALESCE(NEW.amount_paid, 0), 0)::TEXT || ' balance due',
        'high',
        'taxes',
        'property_tax',
        NEW.id::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_overdue_tax
  AFTER INSERT OR UPDATE ON public.property_taxes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_overdue_tax();
