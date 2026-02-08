-- Create lease_conversations table for tracking chat sessions per document
CREATE TABLE public.lease_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.property_documents(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_message_at TIMESTAMP WITH TIME ZONE
);

-- Create lease_messages table for individual messages in conversations
CREATE TABLE public.lease_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.lease_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  citations JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lease_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for lease_conversations (via property ownership)
CREATE POLICY "Users can view lease conversations for their properties"
ON public.lease_conversations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM properties
  WHERE properties.id = lease_conversations.property_id
  AND properties.user_id = auth.uid()
));

CREATE POLICY "Users can insert lease conversations for their properties"
ON public.lease_conversations FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM properties
  WHERE properties.id = lease_conversations.property_id
  AND properties.user_id = auth.uid()
));

CREATE POLICY "Users can update lease conversations for their properties"
ON public.lease_conversations FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM properties
  WHERE properties.id = lease_conversations.property_id
  AND properties.user_id = auth.uid()
));

CREATE POLICY "Users can delete lease conversations for their properties"
ON public.lease_conversations FOR DELETE
USING (EXISTS (
  SELECT 1 FROM properties
  WHERE properties.id = lease_conversations.property_id
  AND properties.user_id = auth.uid()
));

-- RLS policies for lease_messages (via conversation -> property ownership)
CREATE POLICY "Users can view lease messages for their conversations"
ON public.lease_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM lease_conversations lc
  JOIN properties p ON p.id = lc.property_id
  WHERE lc.id = lease_messages.conversation_id
  AND p.user_id = auth.uid()
));

CREATE POLICY "Users can insert lease messages for their conversations"
ON public.lease_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM lease_conversations lc
  JOIN properties p ON p.id = lc.property_id
  WHERE lc.id = lease_messages.conversation_id
  AND p.user_id = auth.uid()
));

-- Create triggers for updated_at
CREATE TRIGGER update_lease_conversations_updated_at
BEFORE UPDATE ON public.lease_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_lease_conversations_property_id ON public.lease_conversations(property_id);
CREATE INDEX idx_lease_conversations_document_id ON public.lease_conversations(document_id);
CREATE INDEX idx_lease_messages_conversation_id ON public.lease_messages(conversation_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.lease_messages;