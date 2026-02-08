import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { BookOpen, MessageCircle, FileText, ArrowRight, Plus, Clock } from 'lucide-react';
import { LeaseQAChat } from './LeaseQAChat';

interface LeaseQAWidgetProps {
  propertyId: string;
}

export const LeaseQAWidget = ({ propertyId }: LeaseQAWidgetProps) => {
  const queryClient = useQueryClient();
  const [selectedDocument, setSelectedDocument] = useState<{
    id: string;
    name: string;
    content?: string;
  } | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch lease documents for this property
  const { data: leaseDocuments } = useQuery({
    queryKey: ['lease-documents', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_documents')
        .select('*')
        .eq('property_id', propertyId)
        .eq('document_type', 'lease')
        .eq('is_current', true)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch recent conversations
  const { data: recentConversations } = useQuery({
    queryKey: ['lease-conversations', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lease_conversations')
        .select(`
          *,
          property_documents!inner(document_name, extracted_text)
        `)
        .eq('property_id', propertyId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
  });

  const hasLeases = leaseDocuments && leaseDocuments.length > 0;

  const formatConversationTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const startNewConversation = () => {
    if (leaseDocuments?.[0]) {
      setSelectedDocument({
        id: leaseDocuments[0].id,
        name: leaseDocuments[0].document_name,
        content: leaseDocuments[0].extracted_text || undefined,
      });
      setSelectedConversation(null);
      setIsDialogOpen(true);
    }
  };

  const openExistingConversation = (conv: any) => {
    setSelectedDocument({
      id: conv.document_id,
      name: conv.property_documents?.document_name || 'Lease',
      content: conv.property_documents?.extracted_text || undefined,
    });
    setSelectedConversation({
      id: conv.id,
      title: conv.title || 'Lease Q&A',
    });
    setIsDialogOpen(true);
  };

  const handleTitleChange = (newTitle: string) => {
    // Invalidate the conversations query to refresh the list
    queryClient.invalidateQueries({ queryKey: ['lease-conversations', propertyId] });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          Lease Q&A
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasLeases ? (
          <div className="space-y-3">
            {/* New Chat Button */}
            <Button
              className="w-full justify-between"
              variant="outline"
              onClick={startNewConversation}
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                New conversation
              </span>
              <ArrowRight className="w-4 h-4" />
            </Button>

            {/* Recent Conversations */}
            {recentConversations && recentConversations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Recent conversations</p>
                {recentConversations.map((conv: any) => (
                  <button
                    key={conv.id}
                    className="w-full text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                    onClick={() => openExistingConversation(conv)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1">
                          {conv.title || 'Untitled conversation'}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {conv.property_documents?.document_name}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {formatConversationTime(conv.last_message_at || conv.created_at)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Lease Documents */}
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">Lease documents</p>
              {leaseDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 text-sm">
                  <FileText className="w-3 h-3 text-muted-foreground" />
                  <span className="line-clamp-1">{doc.document_name}</span>
                </div>
              ))}
            </div>

            {/* Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogContent className="max-w-2xl h-[80vh] p-0">
                <DialogHeader className="sr-only">
                  <DialogTitle>Lease Q&A</DialogTitle>
                </DialogHeader>
                {selectedDocument && (
                  <LeaseQAChat
                    propertyId={propertyId}
                    documentId={selectedDocument.id}
                    documentName={selectedDocument.name}
                    leaseContent={selectedDocument.content}
                    conversationId={selectedConversation?.id}
                    initialTitle={selectedConversation?.title}
                    onTitleChange={handleTitleChange}
                  />
                )}
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="text-center py-4">
            <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mb-3">
              Upload a lease to enable Q&A
            </p>
            <Button variant="outline" size="sm">
              Upload Lease
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
