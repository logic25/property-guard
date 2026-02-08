-- Create table for property AI conversations
CREATE TABLE public.property_ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for property AI messages
CREATE TABLE public.property_ai_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.property_ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.property_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_ai_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversations
CREATE POLICY "Users can view their own property AI conversations"
ON public.property_ai_conversations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own property AI conversations"
ON public.property_ai_conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own property AI conversations"
ON public.property_ai_conversations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own property AI conversations"
ON public.property_ai_conversations FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for messages (via conversation ownership)
CREATE POLICY "Users can view messages in their conversations"
ON public.property_ai_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.property_ai_conversations c
  WHERE c.id = conversation_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can create messages in their conversations"
ON public.property_ai_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.property_ai_conversations c
  WHERE c.id = conversation_id AND c.user_id = auth.uid()
));

-- Create indexes for performance
CREATE INDEX idx_property_ai_conversations_property ON public.property_ai_conversations(property_id);
CREATE INDEX idx_property_ai_conversations_user ON public.property_ai_conversations(user_id);
CREATE INDEX idx_property_ai_messages_conversation ON public.property_ai_messages(conversation_id);

-- Add trigger for updated_at
CREATE TRIGGER update_property_ai_conversations_updated_at
BEFORE UPDATE ON public.property_ai_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();