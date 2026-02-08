import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Building2,
  AlertTriangle,
  FileStack,
  FileWarning,
  Download,
  Trash2,
  Save,
  StickyNote,
  Calendar,
  User,
  MapPin,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import DDReportPrintView from './DDReportPrintView';
import html2pdf from 'html2pdf.js';
import { getAgencyColor, getAgencyLookupUrl } from '@/lib/violation-utils';

interface DDReportViewerProps {
  report: {
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
    created_at: string;
  };
  onBack: () => void;
  onDelete: () => void;
}

const DDReportViewer = ({ report, onBack, onDelete }: DDReportViewerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [generalNotes, setGeneralNotes] = useState(report.general_notes || '');
  const [lineItemNotes, setLineItemNotes] = useState<Record<string, string>>(
    (report.line_item_notes || []).reduce((acc: Record<string, string>, item: any) => {
      acc[`${item.item_type}-${item.item_id}`] = item.note;
      return acc;
    }, {})
  );

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    
    setIsExporting(true);
    try {
      const element = printRef.current;
      const opt = {
        margin: 0.5,
        filename: `DD-Report-${report.address.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const }
      };
      
      await html2pdf().set(opt).from(element).save();
      toast({ title: "PDF exported successfully" });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({ title: "Failed to export PDF", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const saveNotes = useMutation({
    mutationFn: async () => {
      const formattedNotes = Object.entries(lineItemNotes).map(([key, note]) => {
        const [item_type, item_id] = key.split('-');
        return { item_type, item_id, note };
      }).filter(n => n.note.trim());

      const { error } = await supabase
        .from('dd_reports')
        .update({
          general_notes: generalNotes.trim() || null,
          line_item_notes: formattedNotes,
        })
        .eq('id', report.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dd-reports'] });
      toast({ title: "Notes saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save notes", variant: "destructive" });
    },
  });

  const violations = report.violations_data || [];
  const applications = report.applications_data || [];
  const orders = report.orders_data || { stop_work: [], vacate: [] };
  const building = report.building_data || {};

  const getSeverityVariant = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'immediately hazardous':
        return 'destructive';
      case 'major':
      case 'hazardous':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const updateLineItemNote = (itemType: string, itemId: string, note: string) => {
    setLineItemNotes(prev => ({
      ...prev,
      [`${itemType}-${itemId}`]: note,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{report.address}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                Prepared for: {report.prepared_for}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {format(new Date(report.report_date), 'MMMM d, yyyy')}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}>
            <Save className="w-4 h-4 mr-2" />
            Save Notes
          </Button>
          <Button variant="outline" onClick={handleExportPDF} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export PDF
          </Button>
          <Button variant="destructive" size="icon" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Building Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Building Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">BIN</p>
              <p className="font-mono">{report.bin || building.bin || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">BBL</p>
              <p className="font-mono">{report.bbl || building.bbl || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Year Built</p>
              <p>{building.year_built || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stories</p>
              <p>{building.stories || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Building Class</p>
              <p>{building.building_class || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Zoning</p>
              <p>{building.zoning_district || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dwelling Units</p>
              <p>{building.dwelling_units || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lot Area</p>
              <p>{building.lot_area_sqft ? `${building.lot_area_sqft.toLocaleString()} sqft` : '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Orders Alert */}
      {(orders.stop_work?.length > 0 || orders.vacate?.length > 0) && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <FileWarning className="w-5 h-5" />
              Active Orders
            </CardTitle>
            <CardDescription className="text-destructive/80">
              This property has active Stop Work or Vacate orders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {orders.stop_work?.map((order: any, idx: number) => (
              <div key={`swo-${idx}`} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="destructive">Stop Work Order</Badge>
                  <span className="text-sm">{order.issued_date}</span>
                </div>
                <p className="text-sm">{order.description || 'No description available'}</p>
                <div className="mt-2">
                  <Input
                    placeholder="Add note for this order..."
                    value={lineItemNotes[`swo-${idx}`] || ''}
                    onChange={(e) => updateLineItemNote('swo', String(idx), e.target.value)}
                    className="bg-background"
                  />
                </div>
              </div>
            ))}
            {orders.vacate?.map((order: any, idx: number) => (
              <div key={`vacate-${idx}`} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="destructive">Vacate Order</Badge>
                  <span className="text-sm">{order.issued_date}</span>
                </div>
                <p className="text-sm">{order.description || 'No description available'}</p>
                <div className="mt-2">
                  <Input
                    placeholder="Add note for this order..."
                    value={lineItemNotes[`vacate-${idx}`] || ''}
                    onChange={(e) => updateLineItemNote('vacate', String(idx), e.target.value)}
                    className="bg-background"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="violations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="violations" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Violations ({violations.length})
          </TabsTrigger>
          <TabsTrigger value="applications" className="flex items-center gap-2">
            <FileStack className="w-4 h-4" />
            Applications ({applications.length})
          </TabsTrigger>
          <TabsTrigger value="ai-analysis" className="flex items-center gap-2">
            <StickyNote className="w-4 h-4" />
            AI Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="violations">
          <Card>
            <CardHeader>
              <CardTitle>Open Violations</CardTitle>
              <CardDescription>
                All open violations from DOB, ECB, HPD, FDNY, and other agencies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {violations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No open violations found for this property.
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Violation #</TableHead>
                        <TableHead>Agency</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Issued</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {violations.map((v: any, idx: number) => (
                        <TableRow key={v.id || idx}>
                          <TableCell className="font-mono text-sm">{v.violation_number}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{v.agency}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{v.violation_type || v.description_raw}</TableCell>
                          <TableCell>
                            <Badge variant={getSeverityVariant(v.severity)}>
                              {v.severity || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>{v.issued_date}</TableCell>
                          <TableCell>
                            <Badge variant={v.status === 'open' ? 'destructive' : 'default'}>
                              {v.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="Add note..."
                              value={lineItemNotes[`violation-${v.id || idx}`] || ''}
                              onChange={(e) => updateLineItemNote('violation', v.id || String(idx), e.target.value)}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <Card>
            <CardHeader>
              <CardTitle>Permit Applications</CardTitle>
              <CardDescription>
                DOB BIS, DOB NOW, and other agency applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No applications found for this property.
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Application #</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Filed</TableHead>
                        <TableHead>Est. Cost</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications.map((app: any, idx: number) => (
                        <TableRow key={app.id || idx}>
                          <TableCell className="font-mono text-sm">{app.application_number || app.job_number}</TableCell>
                          <TableCell>{app.application_type || app.job_type}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{app.status}</Badge>
                          </TableCell>
                          <TableCell>{app.filing_date || app.filed_date}</TableCell>
                          <TableCell>
                            {app.estimated_cost ? `$${Number(app.estimated_cost).toLocaleString()}` : '—'}
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="Add note..."
                              value={lineItemNotes[`application-${app.id || idx}`] || ''}
                              onChange={(e) => updateLineItemNote('application', app.id || String(idx), e.target.value)}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-analysis">
          <Card>
            <CardHeader>
              <CardTitle>AI Analysis</CardTitle>
              <CardDescription>
                AI-generated summary and risk assessment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.ai_analysis ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <div className="whitespace-pre-wrap">{report.ai_analysis}</div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  AI analysis not available for this report.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* General Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="w-5 h-5" />
            General Notes
          </CardTitle>
          <CardDescription>
            Add any additional observations or comments about this property
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Enter general notes about this property..."
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            rows={5}
          />
        </CardContent>
      </Card>

      {/* Hidden print view for PDF export */}
      <div className="fixed -left-[9999px] -top-[9999px]">
        <div ref={printRef}>
          <DDReportPrintView report={report} />
        </div>
      </div>
    </div>
  );
};

export default DDReportViewer;
