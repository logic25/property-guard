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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
  ExternalLink,
  ChevronDown,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import DDReportPrintView from './DDReportPrintView';
import ExpandableViolationRow from './ExpandableViolationRow';
import ExpandableApplicationRow from './ExpandableApplicationRow';
import html2pdf from 'html2pdf.js';
import { getAgencyColor, getAgencyLookupUrl } from '@/lib/violation-utils';

// Format BBL as Borough-Block-Lot
const formatBBL = (bbl: string | null | undefined): string => {
  if (!bbl) return '—';
  const clean = bbl.replace(/\D/g, '');
  if (clean.length < 10) return bbl;
  const borough = clean.slice(0, 1);
  const block = clean.slice(1, 6).replace(/^0+/, '') || '0';
  const lot = clean.slice(6, 10).replace(/^0+/, '') || '0';
  return `${borough}-${block}-${lot}`;
};

// Safe date formatter - handles various NYC Open Data date formats
const safeFormatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    // Handle YYYYMMDD format (common in NYC Open Data)
    if (/^\d{8}$/.test(dateStr)) {
      const year = parseInt(dateStr.slice(0, 4));
      const month = parseInt(dateStr.slice(4, 6)) - 1; // 0-indexed
      const day = parseInt(dateStr.slice(6, 8));
      const date = new Date(year, month, day);
      if (isNaN(date.getTime())) return dateStr;
      return format(date, 'MMM d, yyyy');
    }
    
    // Handle ISO or other standard formats
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return format(date, 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
};

interface UserProfile {
  email: string | null;
  display_name: string | null;
  company_name: string | null;
  phone: string | null;
  license_id: string | null;
}

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
  onRegenerate?: (reportId: string, address: string) => void;
  isRegenerating?: boolean;
  userProfile?: UserProfile;
}

const DDReportViewer = ({ report, onBack, onDelete, onRegenerate, isRegenerating = false, userProfile }: DDReportViewerProps) => {
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
  const [violationsOpen, setViolationsOpen] = useState(true);
  const [applicationsOpen, setApplicationsOpen] = useState(true);
  const [applicationFilter, setApplicationFilter] = useState<string>('all');
  const [violationFilter, setViolationFilter] = useState<string>('all');
  const [criticalOrdersOpen, setCriticalOrdersOpen] = useState(false);

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
  const orders = report.orders_data || { stop_work: [], partial_stop_work: [], vacate: [] };
  const building = report.building_data || {};

  // Calculate application stats by source
  const bisApplications = applications.filter((a: any) => a.source === 'BIS');
  const dobNowApplications = applications.filter((a: any) => a.source === 'DOB_NOW');
  
  // Calculate violation stats by agency
  const dobViolations = violations.filter((v: any) => v.agency === 'DOB');
  const ecbViolations = violations.filter((v: any) => v.agency === 'ECB');
  const hpdViolations = violations.filter((v: any) => v.agency === 'HPD');
  
  // Check for critical orders
  const hasStopWorkOrder = (orders.stop_work?.length || 0) > 0;
  const hasPartialStopWork = (orders.partial_stop_work?.length || 0) > 0;
  const hasVacateOrder = (orders.vacate?.length || 0) > 0;
  const hasCriticalOrders = hasStopWorkOrder || hasPartialStopWork || hasVacateOrder;

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
          <Button 
            variant="outline" 
            onClick={() => onRegenerate?.(report.id, report.address)} 
            disabled={isRegenerating || !onRegenerate}
          >
            {isRegenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleExportPDF} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export PDF
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Report</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this DD report for "{report.address}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
              <p className="text-sm text-muted-foreground">BBL (Borough-Block-Lot)</p>
              <p className="font-mono">{formatBBL(report.bbl || building.bbl)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Year Built</p>
              <p>{building.year_built || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dwelling Units</p>
              <p>{building.dwelling_units || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Zoning</p>
              <p>{building.zoning_district || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Landmark Status</p>
              <p>{building.is_landmark ? 'Yes - Landmarked' : building.historic_district ? `Historic District: ${building.historic_district}` : 'No'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Owner</p>
              <p className="truncate">{building.owner_name || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Building Area</p>
              <p>{building.building_area_sqft ? `${building.building_area_sqft.toLocaleString()} sqft` : '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileStack className="w-5 h-5" />
            Compliance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Violations Summary */}
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <p className="text-2xl font-bold text-foreground">{violations.length}</p>
              <p className="text-sm text-muted-foreground">Open Violations</p>
              <div className="text-xs text-muted-foreground mt-1">
                <span>DOB: {dobViolations.length}</span>
                <span className="mx-1">•</span>
                <span>ECB: {ecbViolations.length}</span>
                <span className="mx-1">•</span>
                <span>HPD: {hpdViolations.length}</span>
              </div>
            </div>
            
            {/* Applications Summary */}
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <p className="text-2xl font-bold text-foreground">{applications.length}</p>
              <p className="text-sm text-muted-foreground">Active Applications</p>
              <div className="text-xs text-muted-foreground mt-1">
                <span>BIS: {bisApplications.length}</span>
                <span className="mx-1">•</span>
                <span>DOB NOW: {dobNowApplications.length}</span>
              </div>
            </div>
            
            {/* Critical Orders - Combined Card */}
            <div 
              className={`p-4 rounded-lg border col-span-2 cursor-pointer transition-colors ${
                hasCriticalOrders 
                  ? 'bg-destructive/10 border-destructive/30 hover:bg-destructive/20' 
                  : 'bg-secondary/50 border-border hover:bg-secondary/70'
              }`}
              onClick={() => {
                if (hasCriticalOrders) {
                  // Open the collapsible and scroll to it
                  setCriticalOrdersOpen(true);
                  setTimeout(() => {
                    document.getElementById('critical-orders-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-2xl font-bold ${hasCriticalOrders ? 'text-destructive' : 'text-foreground'}`}>
                    {(orders.stop_work?.length || 0) + (orders.partial_stop_work?.length || 0) + (orders.vacate?.length || 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Critical Orders</p>
                </div>
                <div className="text-right text-sm">
                  {hasStopWorkOrder && (
                    <div className="text-destructive">⚠ {orders.stop_work?.length} Full SWO</div>
                  )}
                  {hasPartialStopWork && (
                    <div className="text-warning">⚠ {orders.partial_stop_work?.length} Partial SWO</div>
                  )}
                  {hasVacateOrder && (
                    <div className="text-destructive">⚠ {orders.vacate?.length} Vacate</div>
                  )}
                  {!hasCriticalOrders && (
                    <div className="text-muted-foreground">None detected</div>
                  )}
                </div>
              </div>
              {hasCriticalOrders && (
                <p className="text-xs text-destructive/80 mt-2">Click to view details ↓</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Orders Alert - Collapsible */}
      {hasCriticalOrders && (
        <Card id="critical-orders-section" className="border-destructive bg-destructive/5">
          <Collapsible open={criticalOrdersOpen} onOpenChange={setCriticalOrdersOpen}>
            <CardHeader 
              className="cursor-pointer" 
              onClick={() => setCriticalOrdersOpen(!criticalOrdersOpen)}
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between w-full">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      {criticalOrdersOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <FileWarning className="w-5 h-5" />
                      Active Orders ({(orders.stop_work?.length || 0) + (orders.partial_stop_work?.length || 0) + (orders.vacate?.length || 0)})
                    </CardTitle>
                    <CardDescription className="text-destructive/80 mt-1">
                      {hasStopWorkOrder && <span className="mr-2">⚠ {orders.stop_work?.length} Full SWO</span>}
                      {hasPartialStopWork && <span className="mr-2">⚠ {orders.partial_stop_work?.length} Partial SWO</span>}
                      {hasVacateOrder && <span>⚠ {orders.vacate?.length} Vacate</span>}
                    </CardDescription>
                  </div>
                  <Badge variant="destructive" className="mr-2">Click to {criticalOrdersOpen ? 'collapse' : 'expand'}</Badge>
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                {orders.stop_work?.map((order: any, idx: number) => {
                  const formattedDate = safeFormatDate(order.issued_date);
                  const identifier = order.violation_number || order.id || `SWO-${idx + 1}`;
                  return (
                    <div key={`swo-${idx}`} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">Full Stop Work Order</Badge>
                          <span className="font-mono text-sm text-muted-foreground">#{identifier}</span>
                        </div>
                        <span className="text-sm font-medium">{formattedDate}</span>
                      </div>
                      <p className="text-sm">{order.description_raw || order.violation_type || 'No description available'}</p>
                      <div className="mt-2">
                        <Input
                          placeholder="Add note for this order..."
                          value={lineItemNotes[`swo-${idx}`] || ''}
                          onChange={(e) => updateLineItemNote('swo', String(idx), e.target.value)}
                          className="bg-background"
                        />
                      </div>
                    </div>
                  );
                })}
                {orders.partial_stop_work?.map((order: any, idx: number) => {
                  const formattedDate = safeFormatDate(order.issued_date);
                  const identifier = order.violation_number || order.id || `PSWO-${idx + 1}`;
                  return (
                    <div key={`pswo-${idx}`} className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30">Partial Stop Work Order</Badge>
                          <span className="font-mono text-sm text-muted-foreground">#{identifier}</span>
                        </div>
                        <span className="text-sm font-medium">{formattedDate}</span>
                      </div>
                      <p className="text-sm">{order.description_raw || order.violation_type || 'No description available'}</p>
                      <div className="mt-2">
                        <Input
                          placeholder="Add note for this order..."
                          value={lineItemNotes[`pswo-${idx}`] || ''}
                          onChange={(e) => updateLineItemNote('pswo', String(idx), e.target.value)}
                          className="bg-background"
                        />
                      </div>
                    </div>
                  );
                })}
                {orders.vacate?.map((order: any, idx: number) => {
                  const formattedDate = safeFormatDate(order.issued_date);
                  const identifier = order.violation_number || order.id || `VAC-${idx + 1}`;
                  return (
                    <div key={`vacate-${idx}`} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">Vacate Order</Badge>
                          <span className="font-mono text-sm text-muted-foreground">#{identifier}</span>
                        </div>
                        <span className="text-sm font-medium">{formattedDate}</span>
                      </div>
                      <p className="text-sm">{order.description_raw || order.violation_type || 'No description available'}</p>
                      <div className="mt-2">
                        <Input
                          placeholder="Add note for this order..."
                          value={lineItemNotes[`vacate-${idx}`] || ''}
                          onChange={(e) => updateLineItemNote('vacate', String(idx), e.target.value)}
                          className="bg-background"
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
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
            Applications ({bisApplications.length} BIS, {dobNowApplications.length} Build)
          </TabsTrigger>
          <TabsTrigger value="ai-analysis" className="flex items-center gap-2">
            <StickyNote className="w-4 h-4" />
            AI Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="violations">
          <Card>
            <Collapsible open={violationsOpen} onOpenChange={setViolationsOpen}>
              <CardHeader className="cursor-pointer" onClick={() => setViolationsOpen(!violationsOpen)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {violationsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        Open Violations ({violations.length})
                      </CardTitle>
                      <CardDescription className="mt-1">
                        All open violations from DOB, ECB, HPD, FDNY, and other agencies
                      </CardDescription>
                    </div>
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  {/* Agency Filter Buttons */}
                  <div className="flex flex-wrap gap-2 mb-4" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant={violationFilter === 'all' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setViolationFilter('all')}
                    >
                      All ({violations.length})
                    </Button>
                    <Button 
                      variant={violationFilter === 'DOB' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setViolationFilter('DOB')}
                      className={violationFilter !== 'DOB' ? 'border-orange-300 text-orange-600 hover:bg-orange-50' : ''}
                    >
                      DOB ({dobViolations.length})
                    </Button>
                    <Button 
                      variant={violationFilter === 'ECB' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setViolationFilter('ECB')}
                      className={violationFilter !== 'ECB' ? 'border-blue-300 text-blue-600 hover:bg-blue-50' : ''}
                    >
                      ECB ({ecbViolations.length})
                    </Button>
                    <Button 
                      variant={violationFilter === 'HPD' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setViolationFilter('HPD')}
                      className={violationFilter !== 'HPD' ? 'border-purple-300 text-purple-600 hover:bg-purple-50' : ''}
                    >
                      HPD ({hpdViolations.length})
                    </Button>
                  </div>
                  
                  {violations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No open violations found for this property.
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8"></TableHead>
                            <TableHead>Violation #</TableHead>
                            <TableHead>Agency</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Severity</TableHead>
                            <TableHead>Issued</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {violations
                            .filter((v: any) => violationFilter === 'all' || v.agency === violationFilter)
                            .map((v: any, idx: number) => (
                              <ExpandableViolationRow
                                key={v.id || idx}
                                violation={v}
                                index={idx}
                                note={lineItemNotes[`violation-${v.id || idx}`] || ''}
                                onNoteChange={(note) => updateLineItemNote('violation', v.id || String(idx), note)}
                                bbl={report.bbl || building.bbl}
                              />
                            ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <Card>
            <Collapsible open={applicationsOpen} onOpenChange={setApplicationsOpen}>
              <CardHeader className="cursor-pointer" onClick={() => setApplicationsOpen(!applicationsOpen)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {applicationsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        Permit Applications ({bisApplications.length} BIS, {dobNowApplications.length} Build)
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {bisApplications.length} legacy BIS applications, {dobNowApplications.length} DOB NOW Build applications
                      </CardDescription>
                    </div>
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  {/* Filter Buttons - Based on DOB Status Codes */}
                  <div className="flex flex-wrap gap-2 mb-4" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant={applicationFilter === 'all' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApplicationFilter('all');
                      }}
                    >
                      All ({applications.length})
                    </Button>
                    <Button 
                      variant={applicationFilter === 'R' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApplicationFilter('R');
                      }}
                    >
                      R - Permit Entire ({applications.filter((a: any) => {
                        const s = (a.status || '').toUpperCase();
                        return s === 'R' || s.includes('PERMIT ENTIRE') || s.includes('PERMIT - ENTIRE');
                      }).length})
                    </Button>
                    <Button 
                      variant={applicationFilter === 'Q' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApplicationFilter('Q');
                      }}
                    >
                      Q - Permit Partial ({applications.filter((a: any) => {
                        const s = (a.status || '').toUpperCase();
                        return s === 'Q' || s.includes('PERMIT PARTIAL') || s.includes('PERMIT-PARTIAL');
                      }).length})
                    </Button>
                    <Button 
                      variant={applicationFilter === 'P' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApplicationFilter('P');
                      }}
                    >
                      P - Approved ({applications.filter((a: any) => {
                        const s = (a.status || '').toUpperCase();
                        return s === 'P' || (s.includes('APPROVED') && !s.includes('DISAPPROVED'));
                      }).length})
                    </Button>
                    <Button 
                      variant={applicationFilter === 'J' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApplicationFilter('J');
                      }}
                    >
                      J - Disapproved ({applications.filter((a: any) => {
                        const s = (a.status || '').toUpperCase();
                        return s === 'J' || s.includes('DISAPPROVED') || s.includes('P/E DISAPP');
                      }).length})
                    </Button>
                    <Button 
                      variant={applicationFilter === 'in_process' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApplicationFilter('in_process');
                      }}
                    >
                      In Process ({applications.filter((a: any) => {
                        const s = (a.status || '').toUpperCase();
                        return s === 'A' || s === 'B' || s === 'C' || s === 'D' || s === 'E' || s === 'F' || s === 'G' || s === 'H' || s === 'K' || s === 'L' || s === 'M' ||
                          s.includes('PRE-FILED') || s.includes('A/P') || s.includes('ASSIGNED') || s.includes('IN PROCESS') || s.includes('FILED') || s.includes('PLAN EXAM');
                      }).length})
                    </Button>
                  </div>
                  
                  {applications.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No applications found for this property.
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8"></TableHead>
                            <TableHead>Job #</TableHead>
                            <TableHead>Job Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Filed</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Floor/Apt</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {applications
                            .filter((app: any) => {
                              if (applicationFilter === 'all') return true;
                              const s = (app.status || '').toUpperCase();
                              switch (applicationFilter) {
                                case 'R': // Permit Entire
                                  return s === 'R' || s.includes('PERMIT ENTIRE') || s.includes('PERMIT - ENTIRE');
                                case 'Q': // Permit Partial
                                  return s === 'Q' || s.includes('PERMIT PARTIAL') || s.includes('PERMIT-PARTIAL');
                                case 'P': // Approved
                                  return s === 'P' || (s.includes('APPROVED') && !s.includes('DISAPPROVED'));
                                case 'J': // Disapproved
                                  return s === 'J' || s.includes('DISAPPROVED') || s.includes('P/E DISAPP');
                                case 'in_process': // All in-progress statuses (A-H, K-M)
                                  return s === 'A' || s === 'B' || s === 'C' || s === 'D' || s === 'E' || s === 'F' || s === 'G' || s === 'H' || s === 'K' || s === 'L' || s === 'M' ||
                                    s.includes('PRE-FILED') || s.includes('A/P') || s.includes('ASSIGNED') || s.includes('IN PROCESS') || s.includes('FILED') || s.includes('PLAN EXAM');
                                default:
                                  return true;
                              }
                            })
                            .map((app: any, idx: number) => {
                              const appKey = `${app.source || 'BIS'}-${app.id || app.application_number || idx}`;

                              return (
                                <ExpandableApplicationRow
                                  key={appKey}
                                  application={app}
                                  index={idx}
                                  note={lineItemNotes[`application-${appKey}`] || ''}
                                  onNoteChange={(note) => updateLineItemNote('application', appKey, note)}
                                />
                              );
                            })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
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
          <DDReportPrintView report={report} userProfile={userProfile} />
        </div>
      </div>
    </div>
  );
};

export default DDReportViewer;
