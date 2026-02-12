
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Create user_roles table (separate from profiles per security best practices)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Create api_call_logs table
CREATE TABLE public.api_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  endpoint text NOT NULL,
  url text NOT NULL,
  status_code integer,
  response_time_ms integer,
  error_message text,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  user_id uuid
);

ALTER TABLE public.api_call_logs ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can INSERT (for logging from client-side sync)
CREATE POLICY "Authenticated users can insert api logs"
  ON public.api_call_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only admins can SELECT
CREATE POLICY "Admins can view api logs"
  ON public.api_call_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Create admin_audit_log table
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  admin_user_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert audit logs"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view audit logs"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Create index for api_call_logs queries
CREATE INDEX idx_api_call_logs_endpoint ON public.api_call_logs(endpoint);
CREATE INDEX idx_api_call_logs_created_at ON public.api_call_logs(created_at DESC);
CREATE INDEX idx_api_call_logs_status ON public.api_call_logs(status_code);

-- 8. Allow admins to read all profiles (for user management)
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
