import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  Plus, 
  Search, 
  Building2, 
  AlertTriangle, 
  FileStack,
  FileWarning,
  Loader2,
  Download,
  Eye,
  Trash2,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import DDReportViewer from '@/components/dd-reports/DDReportViewer';
import CreateDDReportDialog from '@/components/dd-reports/CreateDDReportDialog';

interface DDReport {
  id: string;
  address: string;
  bin: string | null;
  bbl: string | null;
  prepared_for: string;
  prepared_by: string | null;
  report_date: string;
  status: string;
  building_data: any;
  violations_data: any;
  applications_data: any;
  orders_data: any;
  line_item_notes: any[];
  general_notes: string | null;
  ai_analysis: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

const DDReportsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: reports, isLoading } = useQuery({
    queryKey: ['dd-reports', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dd_reports')
        .select('id, address, prepared_for, report_date, status, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch full report when one is selected
  const { data: selectedReport, isLoading: isLoadingReport } = useQuery({
    queryKey: ['dd-report', selectedReportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dd_reports')
        .select('*')
        .eq('id', selectedReportId)
        .single();

      if (error) throw error;
      return data as DDReport;
    },
    enabled: !!selectedReportId,
  });

  const deleteReport = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from('dd_reports')
        .delete()
        .eq('id', reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dd-reports'] });
      toast({ title: "Report deleted successfully" });
      if (selectedReportId) setSelectedReportId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete report", variant: "destructive" });
    },
  });

  const filteredReports = reports?.filter(report => 
    searchQuery === '' || 
    report.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.prepared_for.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'generating': return 'secondary';
      case 'draft': return 'outline';
      case 'error': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <FileText className="w-4 h-4" />;
      case 'generating': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'draft': return <Clock className="w-4 h-4" />;
      case 'error': return <AlertTriangle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  if (isLoadingReport && selectedReportId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedReport && selectedReportId) {
    return (
      <DDReportViewer 
        report={selectedReport} 
        onBack={() => setSelectedReportId(null)}
        onDelete={() => deleteReport.mutate(selectedReport.id)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">DD Reports</h1>
          <p className="text-muted-foreground mt-1">
            Generate comprehensive due diligence reports for any NYC property
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Report
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by address or recipient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Your Reports ({filteredReports?.length || 0})
          </CardTitle>
          <CardDescription>
            Due diligence reports you've generated
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !filteredReports?.length ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No reports yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first due diligence report to get started.
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Report
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedReportId(report.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {getStatusIcon(report.status)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-foreground">{report.address}</h3>
                        <Badge variant={getStatusVariant(report.status)}>
                          {report.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Prepared for: {report.prepared_for}</span>
                        <span>•</span>
                        <span>{format(new Date(report.report_date), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteReport.mutate(report.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateDDReportDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
        onSuccess={(report) => {
          setSelectedReportId(report.id);
          setCreateDialogOpen(false);
        }}
      />
    </div>
  );
};

export default DDReportsPage;
