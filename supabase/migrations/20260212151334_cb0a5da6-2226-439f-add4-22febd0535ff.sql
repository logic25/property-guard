
-- Create telegram_users table linking Telegram chat_id to app user_id
CREATE TABLE public.telegram_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chat_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  linked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;

-- Users can view their own telegram link
CREATE POLICY "Users can view own telegram link"
ON public.telegram_users FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own telegram link
CREATE POLICY "Users can insert own telegram link"
ON public.telegram_users FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own telegram link
CREATE POLICY "Users can update own telegram link"
ON public.telegram_users FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own telegram link
CREATE POLICY "Users can delete own telegram link"
ON public.telegram_users FOR DELETE
USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_telegram_users_updated_at
BEFORE UPDATE ON public.telegram_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookup by chat_id (used by webhook)
CREATE INDEX idx_telegram_users_chat_id ON public.telegram_users(chat_id);
CREATE INDEX idx_telegram_users_user_id ON public.telegram_users(user_id);
