import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Sparkles, MessageCircle, Send, Bot, User, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
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
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/property-ai`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
            // Include document types and extracted text for AI context
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

      // Add empty assistant message
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process line-by-line
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
            // Incomplete JSON, wait for more data
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
      setMessages(prev => prev.filter(m => m.content !== ''));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Property AI
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Quick Q&A Button */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="w-full justify-between"
                variant="outline"
              >
                <span className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Ask about this property
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
                <div className="px-4 py-3 border-b border-border bg-secondary/50 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Property AI</span>
                  <span className="text-xs text-muted-foreground">• {propertyData.address}</span>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
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
                      {messages.map((message) => (
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
                            {message.role === 'assistant' ? (
                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
                              </div>
                            ) : (
                              <p className="text-sm">{message.content}</p>
                            )}
                          </div>
                          {message.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      ))}
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
                </ScrollArea>

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

          {/* Document count */}
          {hasDocuments && (
            <div className="pt-2 border-t text-xs text-muted-foreground flex items-center gap-2">
              <FileText className="w-3 h-3" />
              {(allDocuments || documents).length} documents available for Q&A
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
