import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { BookOpen, MessageCircle, FileText, ArrowRight } from 'lucide-react';
import { LeaseQAChat } from './LeaseQAChat';

interface LeaseQAWidgetProps {
  propertyId: string;
}

export const LeaseQAWidget = ({ propertyId }: LeaseQAWidgetProps) => {
  const [selectedDocument, setSelectedDocument] = useState<{
    id: string;
    name: string;
    content?: string;
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
          property_documents!inner(document_name),
          lease_messages(content, role, created_at)
        `)
        .eq('property_id', propertyId)
        .order('last_message_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      return data || [];
    },
  });

  const hasLeases = leaseDocuments && leaseDocuments.length > 0;

  // Mock lease content for demo purposes
  const mockLeaseContent = `
COMMERCIAL LEASE AGREEMENT

ARTICLE 1 - PARTIES AND PREMISES
Section 1.1 - This lease is entered between Landlord ("Owner") and Tenant ("Lessee").
Section 1.2 - The demised premises is located at the property address.

ARTICLE 2 - TERM
Section 2.1 - The initial term shall be five (5) years commencing on January 1, 2024.
Section 2.2 - Tenant has two (2) renewal options of five (5) years each.

ARTICLE 3 - RENT
Section 3.1 - Base rent: $45.00 per square foot annually.
Section 3.2 - Rent Escalation: 3% annual increase on each anniversary date.
Section 3.3 - Additional rent includes proportionate share of CAM, taxes, and insurance.

ARTICLE 4 - MAINTENANCE AND REPAIRS
Section 4.1 - Tenant Responsibilities: All interior repairs, HVAC maintenance, plumbing fixtures.
Section 4.2 - Landlord Responsibilities: Structural repairs, roof, exterior walls, common areas.
Section 4.3 - Sprinkler System: Tenant shall maintain and inspect all fire suppression equipment within the demised premises on an annual basis.

ARTICLE 5 - INSURANCE
Section 5.1 - Tenant shall maintain general liability insurance of $2,000,000 minimum.
Section 5.2 - Tenant shall name Landlord as additional insured.

ARTICLE 6 - SUBLETTING AND ASSIGNMENT
Section 6.1 - Tenant may not sublet or assign without prior written consent of Landlord.
Section 6.2 - Landlord's consent shall not be unreasonably withheld.

ARTICLE 7 - DEFAULT AND REMEDIES
Section 7.1 - Events of Default: Non-payment of rent within 10 days of due date.
Section 7.2 - Cure Period: Tenant has 30 days to cure non-monetary defaults after notice.

ARTICLE 8 - TERMINATION
Section 8.1 - Either party may terminate with 180 days written notice for material breach.
Section 8.2 - Early Termination Fee: 6 months base rent if terminated before natural expiration.
`;

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
            {/* Quick Q&A Button */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="w-full justify-between"
                  variant="outline"
                  onClick={() => {
                    if (leaseDocuments?.[0]) {
                      setSelectedDocument({
                        id: leaseDocuments[0].id,
                        name: leaseDocuments[0].document_name,
                        content: mockLeaseContent, // In production, fetch actual content
                      });
                    }
                  }}
                >
                  <span className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Ask your lease
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </DialogTrigger>
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
                  />
                )}
              </DialogContent>
            </Dialog>

            {/* Recent Conversations */}
            {recentConversations && recentConversations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Recent conversations</p>
                {recentConversations.slice(0, 2).map((conv: any) => {
                  const lastMessage = conv.lease_messages?.[conv.lease_messages.length - 1];
                  return (
                    <button
                      key={conv.id}
                      className="w-full text-left p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      onClick={() => {
                        setSelectedDocument({
                          id: conv.document_id,
                          name: conv.property_documents?.document_name || 'Lease',
                          content: mockLeaseContent,
                        });
                        setIsDialogOpen(true);
                      }}
                    >
                      <p className="text-sm font-medium line-clamp-1">
                        {conv.title || 'Lease Q&A'}
                      </p>
                      {lastMessage && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {lastMessage.content}
                        </p>
                      )}
                    </button>
                  );
                })}
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
