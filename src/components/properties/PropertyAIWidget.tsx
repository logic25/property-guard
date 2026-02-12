import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Sparkles, MessageCircle, Send, Bot, User, Loader2, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/hooks/useAuth';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface PropertyData {
  address: string;
  borough?: string | null;
  bin?: string | null;
  bbl?: string | null;
  stories?: number | null;
  dwelling_units?: number | null;
  year_built?: number | null;
  zoning_district?: string | null;
  building_class?: string | null;
  co_status?: string | null;
}

interface Violation {
  id: string;
  status: string;
  oath_status?: string | null;
  cure_due_date: string | null;
  hearing_date: string | null;
  is_stop_work_order: boolean;
  is_vacate_order: boolean;
}

interface Document {
  id: string;
  document_type: string;
  document_name?: string;
}

interface WorkOrder {
  id: string;
  status: string;
}

interface PropertyAIWidgetProps {
  propertyId: string;
  propertyData: PropertyData;
  violations: Violation[];
  documents: Document[];
  workOrders: WorkOrder[];
}

export const PropertyAIWidget = ({ 
  propertyId, 
  propertyData, 
  violations, 
  documents, 
  workOrders 
}: PropertyAIWidgetProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isDialogOpenRef = useRef(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // Refetch messages when dialog opens (catches Telegram messages)
  const handleDialogOpen = (open: boolean) => {
    setIsDialogOpen(open);
    isDialogOpenRef.current = open;
    if (open) {
      setUnreadCount(0);
      queryClient.invalidateQueries({ queryKey: ['property-ai-conversation', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property-ai-messages'] });
    }
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch existing conversation and messages
  const { data: existingConversation, isLoading: isLoadingConversation } = useQuery({
    queryKey: ['property-ai-conversation', propertyId],
    queryFn: async () => {
      if (!user) return null;
      
      const { data: conversation, error } = await supabase
        .from('property_ai_conversations')
        .select('id')
        .eq('property_id', propertyId)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return conversation;
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
  });

  // Fetch messages for the conversation
  const { data: existingMessages } = useQuery({
    queryKey: ['property-ai-messages', existingConversation?.id],
    queryFn: async () => {
      if (!existingConversation?.id) return [];
      
      const { data, error } = await supabase
        .from('property_ai_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', existingConversation.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data?.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })) || [];
    },
    enabled: !!existingConversation?.id,
    refetchOnWindowFocus: true,
  });

  // Load messages when conversation is fetched
  useEffect(() => {
    if (existingConversation?.id) {
      setConversationId(existingConversation.id);
    }
  }, [existingConversation?.id]);

  useEffect(() => {
    if (existingMessages && existingMessages.length > 0) {
      // Always sync from DB to pick up Telegram messages
      setMessages(prev => {
        // If DB has more messages, use DB version
        if (existingMessages.length >= prev.length) {
          return existingMessages;
        }
        // If local has more (mid-streaming), keep local
        return prev;
      });
    }
  }, [existingMessages]);

  // Realtime subscription for new messages (e.g. from Telegram)
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`property-ai-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'property_ai_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as { id: string; role: string; content: string };
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, { id: newMsg.id, role: newMsg.role as 'user' | 'assistant', content: newMsg.content }];
          });
          // Track unread when dialog is closed (use ref to avoid stale closure)
          if (!isDialogOpenRef.current) {
            setUnreadCount(prev => prev + 1);
          }
          queryClient.invalidateQueries({ queryKey: ['property-ai-messages', conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  // Fetch all documents with extracted text for context
  const { data: allDocuments } = useQuery({
    queryKey: ['property-documents-ai', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_documents')
        .select('id, document_type, document_name, metadata, extracted_text')
        .eq('property_id', propertyId)
        .eq('is_current', true);

      if (error) throw error;
      return data || [];
    },
  });

  // Create conversation mutation
  const createConversation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('property_ai_conversations')
        .insert({
          property_id: propertyId,
          user_id: user.id,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setConversationId(data.id);
      queryClient.invalidateQueries({ queryKey: ['property-ai-conversation', propertyId] });
    },
  });

  // Save message mutation
  const saveMessage = useMutation({
    mutationFn: async ({ conversationId, role, content }: { conversationId: string; role: 'user' | 'assistant'; content: string }) => {
      const { error } = await supabase
        .from('property_ai_messages')
        .insert({
          conversation_id: conversationId,
          role,
          content,
        });

      if (error) throw error;
    },
  });

  // Clear conversation mutation
  const clearConversation = useMutation({
    mutationFn: async () => {
      if (!conversationId) return;
      
      const { error } = await supabase
        .from('property_ai_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      setMessages([]);
      setConversationId(null);
      queryClient.invalidateQueries({ queryKey: ['property-ai-conversation', propertyId] });
      toast.success('Conversation cleared');
    },
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputValue.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Please log in to use Property AI');
        setMessages(prev => prev.filter(m => m.id !== userMessage.id));
        setIsLoading(false);
        return;
      }

      // Ensure we have a conversation
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        const newConversation = await createConversation.mutateAsync();
        currentConversationId = newConversation.id;
      }

      // Save user message to database
      await saveMessage.mutateAsync({
        conversationId: currentConversationId,
        role: 'user',
        content: userMessage.content,
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/property-ai`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage].map(m => ({
              role: m.role,
              content: m.content,
            })),
            propertyId,
            propertyData,
            violationsSummary: {
              total: violations.length,
              open: violations.filter(v => v.status === 'open').length,
              inProgress: violations.filter(v => v.status === 'in_progress').length,
              hasCritical: violations.some(v => v.is_stop_work_order || v.is_vacate_order),
            },
            documentContents: (allDocuments || []).map(d => ({
              type: d.document_type,
              name: d.document_name,
              content: d.extracted_text || null,
            })),
            workOrdersSummary: {
              total: workOrders.length,
              active: workOrders.filter(w => w.status !== 'completed').length,
            },
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          toast.error('Rate limit exceeded. Please try again later.');
          setMessages(prev => prev.filter(m => m.id !== userMessage.id));
          return;
        }
        if (response.status === 402) {
          toast.error('AI credits depleted. Please add funds.');
          setMessages(prev => prev.filter(m => m.id !== userMessage.id));
          return;
        }
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
      }

      // Stream the response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let assistantMessage = '';
      const assistantId = crypto.randomUUID();

      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantMessage += content;
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId ? { ...m, content: assistantMessage } : m
                )
              );
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Save assistant message to database
      if (assistantMessage && currentConversationId) {
        await saveMessage.mutateAsync({
          conversationId: currentConversationId,
          role: 'assistant',
          content: assistantMessage,
        });

        // Update conversation timestamp
        await supabase
          .from('property_ai_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', currentConversationId);
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
      setMessages(prev => prev.filter(m => m.content !== ''));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [inputValue, isLoading, messages, conversationId, createConversation, saveMessage, propertyId, propertyData, violations, allDocuments, workOrders]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedQuestions = [
    "What are the open violations?",
    "What's the zoning for this property?",
    "Any upcoming deadlines?",
    "Who's responsible for repairs?",
  ];

  const hasDocuments = (allDocuments || documents).length > 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Property AI
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Chat preview - shows recent messages or empty state */}
        <div className="px-4 pb-3">
          {isLoadingConversation ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length > 0 ? (
            <div className="space-y-2 mb-3">
              {/* Show last 2 messages as preview */}
              {messages.slice(-2).map((msg) => (
                <div 
                  key={msg.id} 
                  className={`text-xs p-2 rounded-lg ${
                    msg.role === 'user' 
                      ? 'bg-primary/10 text-foreground ml-6' 
                      : 'bg-muted text-muted-foreground mr-6'
                  }`}
                >
                  <span className="font-medium">{msg.role === 'user' ? 'You: ' : 'AI: '}</span>
                  <span className="line-clamp-2">{msg.content.replace(/\*\*/g, '')}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mb-3">
              Ask about violations, lease terms, deadlines, or zoning.
            </p>
          )}
          
          {/* Quick Q&A Button */}
          <Dialog open={isDialogOpen} onOpenChange={handleDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="w-full justify-between"
                variant={messages.length > 0 ? "default" : "outline"}
                size="sm"
              >
                <span className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  {messages.length > 0 ? 'Continue conversation' : 'Ask about this property'}
                </span>
                <Sparkles className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl h-[80vh] p-0">
              <DialogHeader className="sr-only">
                <DialogTitle>Property AI</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col h-full bg-card rounded-xl overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-border bg-secondary/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Property AI</span>
                    <span className="text-xs text-muted-foreground">• {propertyData.address}</span>
                  </div>
                  {messages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => clearConversation.mutate()}
                      disabled={clearConversation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
                  {messages.length === 0 ? (
                    <div className="text-center py-8">
                      <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="font-medium text-foreground mb-2">Ask about this property</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        Get answers about violations, deadlines, documents, zoning, and more.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {suggestedQuestions.map((q, i) => (
                          <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setInputValue(q);
                              inputRef.current?.focus();
                            }}
                          >
                            {q}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => {
                        const isTelegram = message.content.startsWith('[via Telegram]');
                        const displayContent = isTelegram ? message.content.replace('[via Telegram] ', '') : message.content;
                        return (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {message.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Bot className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                              message.role === 'user'
                                ? 'bg-primary text-primary-foreground rounded-tr-none'
                                : 'bg-secondary text-secondary-foreground rounded-tl-none'
                            }`}
                          >
                            {isTelegram && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 mb-1">
                                📱 Telegram
                              </span>
                            )}
                            {message.role === 'assistant' ? (
                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown>{displayContent || '...'}</ReactMarkdown>
                              </div>
                            ) : (
                              <p className="text-sm">{displayContent}</p>
                            )}
                          </div>
                          {message.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        );
                      })}
                      {isLoading && messages[messages.length - 1]?.role === 'user' && (
                        <div className="flex gap-3 justify-start">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4 text-primary" />
                          </div>
                          <div className="px-4 py-3 rounded-2xl bg-secondary rounded-tl-none">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about violations, documents, zoning..."
                      disabled={isLoading}
                      className="flex-1"
                    />
                    <Button onClick={sendMessage} disabled={!inputValue.trim() || isLoading} size="icon">
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Only answers questions about this property. Not legal or financial advice.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Document count footer */}
        {hasDocuments && (
          <div className="px-4 pb-3 pt-2 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
            <FileText className="w-3 h-3" />
            {(allDocuments || documents).length} documents available for Q&A
          </div>
        )}
      </CardContent>
    </Card>
  );
};
