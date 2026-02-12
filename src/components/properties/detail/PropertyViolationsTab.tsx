import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { 
  AlertTriangle, 
  Search,
  Calendar,
  AlertOctagon,
  Ban,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Wrench,
  X,
  ChevronRight,
  ChevronDown,
  DollarSign,
  User,
  FileText,
  MessageSquare,
  Save,
  Loader2,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getAgencyLookupUrl, 
  getAgencyColor, 
  getStatusColor,
  isActiveViolation
} from '@/lib/violation-utils';
import { calculateViolationSeverity, getSeverityBadgeClasses } from '@/lib/violation-severity';
import { CreateWorkOrderDialog } from '@/components/violations/CreateWorkOrderDialog';
import { decodeComplaintCategory, getComplaintSeverityColor } from '@/lib/complaint-category-decoder';
import { Gavel } from 'lucide-react';
import { shouldSuppressViolation } from '@/lib/violation-aging';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OATHHearing {
  id: string;
  summons_number: string;
  hearing_date: string | null;
  hearing_status: string | null;
  disposition: string | null;
  disposition_date: string | null;
  penalty_amount: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  penalty_paid: boolean;
}

interface Violation {
  id: string;
  agency: string;
  violation_number: string;
  issued_date: string;
  status: string;
  description_raw: string | null;
  cure_due_date: string | null;
  hearing_date: string | null;
  severity: string | null;
  is_stop_work_order: boolean;
  is_vacate_order: boolean;
  penalty_amount?: number | null;
  respondent_name?: string | null;
  violation_class?: string | null;
  violation_type?: string | null;
  complaint_category?: string | null;
  oath_status?: string | null;
  notes?: string | null;
  suppressed?: boolean | null;
  suppression_reason?: string | null;
}

interface PropertyViolationsTabProps {
  violations: Violation[];
  onRefresh: () => void;
  bbl?: string | null;
  propertyId: string;
}

type SortField = 'issued_date' | 'agency' | 'status' | 'violation_number' | 'violation_type';
type SortDirection = 'asc' | 'desc';

// Display-friendly violation type labels
const VIOLATION_TYPE_LABELS: Record<string, string> = {
  elevator: 'Elevator',
  gas_piping: 'Gas Piping',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  fire_safety: 'Fire Safety',
  structural: 'Structural',
  construction: 'Construction',
  hvac: 'HVAC/Boiler',
  housing: 'Housing',
  sanitation: 'Sanitation',
  landmarks: 'Landmarks',
  environmental: 'Environmental',
  signage: 'Signage',
  zoning: 'Zoning',
  compliance: 'Compliance',
  other: 'Other',
};

const getViolationTypeLabel = (type: string | null | undefined): string => {
  if (!type) return '—';
  return VIOLATION_TYPE_LABELS[type] || type;
};

// DOB violation code decoder (client-side mirror of edge function logic)
const DOB_CODE_DESCRIPTIONS: Record<string, string> = {
  'FTC-VT-PER': 'Failure to Correct - Elevator Periodic Test',
  'FTC-VT-CAT1': 'Failure to Correct - Elevator Category 1 Test',
  'FTC-VT-CAT5': 'Failure to Correct - Elevator Category 5 Test',
  'FTF-VT-PER': 'Failure to File - Elevator Periodic Test',
  'FTF-VT-CAT1': 'Failure to File - Elevator Category 1 Test',
  'FTF-VT-CAT5': 'Failure to File - Elevator Category 5 Test',
  'FTC-EN-BENCH': 'Failure to Correct - Elevator Benchmarking',
  'FTF-EN-BENCH': 'Failure to File - Elevator Benchmarking',
  'FTC-AEU-HAZ': 'Failure to Correct - Elevator Hazardous Condition',
  'FTF-AEU-HAZ': 'Failure to File - Elevator Hazardous Condition',
  'FTF-PL-PER': 'Failure to File - Gas Piping Periodic Inspection (Local Law 152)',
  'FTC-PL-PER': 'Failure to Correct - Gas Piping Periodic Inspection (Local Law 152)',
  'FTF-PL': 'Failure to File - Plumbing Compliance',
  'FTC-PL': 'Failure to Correct - Plumbing Compliance',
  'FTF-BL-PER': 'Failure to File - Boiler Periodic Inspection',
  'FTC-BL-PER': 'Failure to Correct - Boiler Periodic Inspection',
  'FTF-SP-PER': 'Failure to File - Sprinkler Periodic Inspection',
  'FTC-SP-PER': 'Failure to Correct - Sprinkler Periodic Inspection',
  'FTF-FA-PER': 'Failure to File - Façade Periodic Inspection (LL11/FISP)',
  'FTC-FA-PER': 'Failure to Correct - Façade Periodic Inspection (LL11/FISP)',
  'FTF-RE-PER': 'Failure to File - Retaining Wall Periodic Inspection',
  'FTC-RE-PER': 'Failure to Correct - Retaining Wall Periodic Inspection',
  'FTF-CO': 'Failure to File - Certificate of Occupancy',
  'FTC-CO': 'Failure to Correct - Certificate of Occupancy',
};

const decodeDOBCode = (code: string | null): string | null => {
  if (!code) return null;
  const upper = code.toUpperCase();
  // Try longest prefix match first
  const sortedKeys = Object.keys(DOB_CODE_DESCRIPTIONS).sort((a, b) => b.length - a.length);
  for (const prefix of sortedKeys) {
    if (upper.includes(prefix)) {
      return DOB_CODE_DESCRIPTIONS[prefix];
    }
  }
  if (upper.includes('FTF')) return 'Failure to File - Compliance Document';
  if (upper.includes('FTC')) return 'Failure to Correct - Compliance Issue';
  if (upper.includes('NOD')) return 'Notice of Deficiency';
  return null;
};

export const PropertyViolationsTab = ({ violations, onRefresh, bbl, propertyId }: PropertyViolationsTabProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [workOrderDialogOpen, setWorkOrderDialogOpen] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const [agencyFilter, setAgencyFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('issued_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<Set<string>>(new Set());
  // Active vs All toggle
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  // Show suppressed toggle
  const [showSuppressed, setShowSuppressed] = useState(false);
  // OATH hearings data
  const [oathHearings, setOathHearings] = useState<Record<string, OATHHearing>>({});

  // Fetch OATH hearings for ECB violations
  useEffect(() => {
    const ecbViolationIds = violations.filter(v => v.agency === 'ECB').map(v => v.id);
    if (ecbViolationIds.length === 0) return;
    
    const fetchOathHearings = async () => {
      const { data } = await supabase
        .from('oath_hearings')
        .select('*')
        .eq('property_id', propertyId)
        .in('violation_id', ecbViolationIds);
      
      if (data) {
        const map: Record<string, OATHHearing> = {};
        data.forEach((h: any) => { if (h.violation_id) map[h.violation_id] = h; });
        setOathHearings(map);
      }
    };
    fetchOathHearings();
  }, [violations, propertyId]);

  const agencies = useMemo(() => [...new Set(violations.map(v => v.agency))].sort(), [violations]);
  const violationTypes = useMemo(() => [...new Set(violations.map(v => v.violation_type).filter(Boolean))].sort() as string[], [violations]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const updateStatus = async (id: string, status: 'open' | 'in_progress' | 'closed') => {
    try {
      const { error } = await supabase
        .from('violations')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      toast.success('Status updated');
      onRefresh();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const saveNotes = async (id: string) => {
    const notes = editingNotes[id];
    if (notes === undefined) return;

    setSavingNotes(prev => new Set(prev).add(id));

    try {
      const { error } = await supabase
        .from('violations')
        .update({ notes })
        .eq('id', id);

      if (error) throw error;
      toast.success('Notes saved');
      onRefresh();
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1" /> 
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const openWorkOrderDialog = (violation: Violation) => {
    setSelectedViolation(violation);
    setWorkOrderDialogOpen(true);
  };

  const clearDateFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const filteredAndSortedViolations = useMemo(() => {
    // First filter by active vs all
    let base = showActiveOnly ? violations.filter(isActiveViolation) : violations;
    
    // Filter out suppressed unless toggled on
    if (!showSuppressed) {
      base = base.filter(v => !v.suppressed);
    }

    let result = base.filter(v => {
      const matchesSearch = 
        v.violation_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.description_raw?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchesAgency = agencyFilter === 'all' || v.agency === agencyFilter;
      const matchesType = typeFilter === 'all' || v.violation_type === typeFilter;
      
      // Date filtering
      const violationDate = new Date(v.issued_date);
      const matchesDateFrom = !dateFrom || violationDate >= dateFrom;
      const matchesDateTo = !dateTo || violationDate <= dateTo;
      
      return matchesSearch && matchesStatus && matchesAgency && matchesType && matchesDateFrom && matchesDateTo;
    });

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'issued_date':
          comparison = new Date(a.issued_date).getTime() - new Date(b.issued_date).getTime();
          break;
        case 'agency':
          comparison = a.agency.localeCompare(b.agency);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'violation_number':
          comparison = a.violation_number.localeCompare(b.violation_number);
          break;
        case 'violation_type':
          comparison = (a.violation_type || '').localeCompare(b.violation_type || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [violations, showActiveOnly, showSuppressed, searchQuery, statusFilter, agencyFilter, typeFilter, dateFrom, dateTo, sortField, sortDirection]);

  // Calculate counts using proper active violation filtering
  const activeViolations = violations.filter(isActiveViolation);
  const suppressedCount = violations.filter(v => v.suppressed).length;
  const openCount = activeViolations.filter(v => v.status === 'open').length;

  return (
    <div className="space-y-4">
      {/* Active / All Toggle + Summary + Export */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span><strong>{activeViolations.length}</strong> active</span>
          <span><strong>{openCount}</strong> open</span>
          <span><strong>{activeViolations.filter(v => v.status === 'in_progress').length}</strong> in progress</span>
          <span className="text-muted-foreground/60"><strong>{violations.length - activeViolations.length}</strong> resolved</span>
          {suppressedCount > 0 && (
            <span className="text-muted-foreground/60"><strong>{suppressedCount}</strong> suppressed</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Export CSV Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const headers = ['Violation #', 'Agency', 'Type', 'Issued Date', 'Deadline', 'Status', 'Description', 'OATH Status', 'Penalty', 'Notes'];
              const rows = filteredAndSortedViolations.map(v => [
                v.violation_number,
                v.agency,
                getViolationTypeLabel(v.violation_type),
                new Date(v.issued_date).toLocaleDateString(),
                v.cure_due_date ? new Date(v.cure_due_date).toLocaleDateString() : '',
                v.status,
                (v.description_raw || '').replace(/"/g, '""'),
                v.oath_status || '',
                v.penalty_amount ? `$${v.penalty_amount}` : '',
                (v.notes || '').replace(/"/g, '""'),
              ]);
              const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `violations-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success(`Exported ${filteredAndSortedViolations.length} violations`);
            }}
            className="text-xs"
          >
            <Download className="w-3 h-3 mr-1" />
            Export CSV
          </Button>

          {/* Toggle: Active / All */}
          <div className="flex items-center rounded-full border border-border p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setShowActiveOnly(true)}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                showActiveOnly
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setShowActiveOnly(false)}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                !showActiveOnly
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({violations.length})
            </button>
          </div>

          {/* Show Suppressed toggle */}
          {suppressedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowSuppressed(!showSuppressed)}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                showSuppressed
                  ? 'bg-muted text-foreground border-border'
                  : 'text-muted-foreground border-border/50 hover:text-foreground hover:border-border'
              }`}
            >
              {showSuppressed ? 'Hide' : 'Show'} Suppressed ({suppressedCount})
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search violations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agencyFilter} onValueChange={setAgencyFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Agency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agencies</SelectItem>
            {agencies.map(agency => (
              <SelectItem key={agency} value={agency}>{agency}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {violationTypes.map(type => (
              <SelectItem key={type} value={type}>{getViolationTypeLabel(type)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Filters */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-10">
              <Calendar className="w-4 h-4 mr-2" />
              {dateFrom ? format(dateFrom, 'MM/dd/yy') : 'From'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-10">
              <Calendar className="w-4 h-4 mr-2" />
              {dateTo ? format(dateTo, 'MM/dd/yy') : 'To'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={clearDateFilters} className="h-10">
            <X className="w-4 h-4 mr-1" />
            Clear dates
          </Button>
        )}
      </div>

      {/* Table */}
      {filteredAndSortedViolations.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10"></TableHead>
                <TableHead 
                  className="font-semibold cursor-pointer hover:bg-muted/80"
                  onClick={() => handleSort('violation_number')}
                >
                  <div className="flex items-center">
                    Violation {getSortIcon('violation_number')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-semibold cursor-pointer hover:bg-muted/80"
                  onClick={() => handleSort('agency')}
                >
                  <div className="flex items-center">
                    Agency {getSortIcon('agency')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-semibold cursor-pointer hover:bg-muted/80"
                  onClick={() => handleSort('issued_date')}
                >
                  <div className="flex items-center">
                    Issued {getSortIcon('issued_date')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold">Deadline</TableHead>
                <TableHead 
                  className="font-semibold cursor-pointer hover:bg-muted/80"
                  onClick={() => handleSort('violation_type')}
                >
                  <div className="flex items-center">
                    Type {getSortIcon('violation_type')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold max-w-[200px]">Description</TableHead>
                <TableHead 
                  className="font-semibold cursor-pointer hover:bg-muted/80"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedViolations.map((violation) => (
                <Collapsible key={violation.id} asChild open={expandedRows.has(violation.id)} onOpenChange={() => toggleRow(violation.id)}>
                  <>
                    <TableRow className={`hover:bg-muted/30 ${violation.suppressed ? 'opacity-60' : ''}`}>
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {expandedRows.has(violation.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const sev = calculateViolationSeverity(violation);
                            const dotColor = {
                              Critical: 'bg-red-500',
                              High: 'bg-orange-500',
                              Medium: 'bg-yellow-500',
                              Low: 'bg-blue-500',
                            }[sev.level] || 'bg-muted-foreground';
                            return (
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${sev.color}`}>
                                <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                                {sev.level}
                              </span>
                            );
                          })()}
                          {(violation.is_stop_work_order || violation.is_vacate_order) && (
                            <span className="text-destructive">
                              {violation.is_stop_work_order && <AlertOctagon className="w-4 h-4" />}
                              {violation.is_vacate_order && <Ban className="w-4 h-4" />}
                            </span>
                          )}
                          <span className="font-medium">#{violation.violation_number}</span>
                          {violation.suppressed && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Suppressed</Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs max-w-[250px]">{violation.suppression_reason || 'Age-based suppression'}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge 
                            className={`cursor-pointer ${getAgencyColor(violation.agency)}`}
                            onClick={() => setAgencyFilter(violation.agency)}
                          >
                            {violation.agency}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => window.open(getAgencyLookupUrl(violation.agency, violation.violation_number, bbl), '_blank')}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(violation.issued_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {violation.cure_due_date ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3" />
                            {new Date(violation.cure_due_date).toLocaleDateString()}
                          </div>
                        ) : violation.hearing_date ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            Hearing: {new Date(violation.hearing_date).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className="text-xs cursor-pointer"
                          onClick={() => setTypeFilter(violation.violation_type || 'other')}
                        >
                          {getViolationTypeLabel(violation.violation_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {decodeDOBCode(violation.description_raw) || violation.description_raw || 'No description'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={violation.status}
                          onValueChange={(v) => updateStatus(violation.id, v as 'open' | 'in_progress' | 'closed')}
                        >
                          <SelectTrigger className={`w-28 h-8 text-xs ${getStatusColor(violation.status)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openWorkOrderDialog(violation)}>
                              <Wrench className="w-4 h-4 mr-2" />
                              Create Work Order
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/20 hover:bg-muted/30">
                        <TableCell colSpan={9} className="py-4">
                          {(() => {
                            const sev = calculateViolationSeverity(violation);
                            const decodedDesc = decodeDOBCode(violation.description_raw);
                            return (
                              <div className="space-y-4 pl-8">
                                {/* Severity Banner */}
                                <div className={`rounded-lg border p-4 ${sev.bgColor} ${sev.borderColor}`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">{sev.icon}</span>
                                    <span className={`font-bold text-sm uppercase tracking-wide ${sev.color}`}>{sev.level} Severity</span>
                                  </div>
                                  <p className="text-sm text-foreground/80 mb-3">{sev.explanation}</p>
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs font-semibold text-muted-foreground shrink-0 mt-0.5">🎯 Recommended:</span>
                                    <p className="text-xs text-foreground/70">{sev.recommended_action}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* Left Column: Details */}
                                  <div className="space-y-4">
                                    <h4 className="font-semibold text-sm flex items-center gap-2">
                                      <FileText className="w-4 h-4" />
                                      Violation Details
                                    </h4>
                                    
                                    <div className="space-y-2 text-sm">
                                      {/* Decoded description */}
                                      {decodedDesc && (
                                        <div className="flex gap-2">
                                          <span className="text-muted-foreground w-28 shrink-0">What This Means:</span>
                                          <span className="flex-1 font-medium">{decodedDesc}</span>
                                        </div>
                                      )}

                                      <div className="flex gap-2">
                                        <span className="text-muted-foreground w-28 shrink-0">Violation Code:</span>
                                        <span className="flex-1 font-mono text-xs">{violation.description_raw || '—'}</span>
                                      </div>

                                      <div className="flex gap-2">
                                        <span className="text-muted-foreground w-28 shrink-0">Issued Date:</span>
                                        <span>{new Date(violation.issued_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                      </div>

                                      <div className="flex gap-2">
                                        <span className="text-muted-foreground w-28 shrink-0">Category:</span>
                                        <Badge variant="outline" className="text-xs">{getViolationTypeLabel(violation.violation_type)}</Badge>
                                      </div>

                                      {/* Complaint Category Decoding */}
                                      {violation.complaint_category && (() => {
                                        const decoded = decodeComplaintCategory(violation.complaint_category);
                                        return (
                                          <div className="flex gap-2">
                                            <span className="text-muted-foreground w-28 shrink-0">Complaint:</span>
                                            <div className="flex-1">
                                              {decoded ? (
                                                <div className="flex items-center gap-2">
                                                  <Badge variant="outline" className={`text-xs ${getComplaintSeverityColor(decoded.severity)}`}>
                                                    {violation.complaint_category}
                                                  </Badge>
                                                  <span className="text-sm font-medium">{decoded.name}</span>
                                                  <span className="text-xs text-muted-foreground">— {decoded.description}</span>
                                                </div>
                                              ) : (
                                                <span className="text-sm">Category {violation.complaint_category}</span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                      
                                      {violation.violation_class && (
                                        <div className="flex gap-2">
                                          <span className="text-muted-foreground w-28 shrink-0">Class/Code:</span>
                                          <span>{violation.violation_class}</span>
                                        </div>
                                      )}

                                      {/* OATH Hearing Card */}
                                      {violation.agency === 'ECB' && oathHearings[violation.id] && (() => {
                                        const oath = oathHearings[violation.id];
                                        const dispColor = oath.disposition?.toUpperCase().includes('DISMISSED') || oath.disposition?.toUpperCase().includes('NOT GUILTY')
                                          ? 'text-green-600 bg-green-500/10 border-green-200'
                                          : oath.disposition?.toUpperCase().includes('GUILTY') || oath.disposition?.toUpperCase().includes('DEFAULT')
                                          ? 'text-red-600 bg-red-500/10 border-red-200'
                                          : 'text-yellow-600 bg-yellow-500/10 border-yellow-200';
                                        return (
                                          <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
                                            <div className="flex items-center gap-2">
                                              <Gavel className="w-4 h-4 text-muted-foreground" />
                                              <span className="font-semibold text-sm">OATH Hearing</span>
                                              {oath.disposition && (
                                                <Badge variant="outline" className={`text-xs ${dispColor}`}>
                                                  {oath.disposition}
                                                </Badge>
                                              )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                              {oath.hearing_date && (
                                                <div><span className="text-muted-foreground">Hearing:</span> {new Date(oath.hearing_date).toLocaleDateString()}</div>
                                              )}
                                              {oath.hearing_status && (
                                                <div><span className="text-muted-foreground">Status:</span> {oath.hearing_status}</div>
                                              )}
                                              {oath.penalty_amount != null && (
                                                <div><span className="text-muted-foreground">Penalty:</span> <span className="text-destructive font-medium">${oath.penalty_amount.toLocaleString()}</span></div>
                                              )}
                                              {oath.amount_paid != null && (
                                                <div><span className="text-muted-foreground">Paid:</span> ${oath.amount_paid.toLocaleString()}</div>
                                              )}
                                              {oath.balance_due != null && oath.balance_due > 0 && (
                                                <div><span className="text-muted-foreground">Balance:</span> <span className="text-destructive font-medium">${oath.balance_due.toLocaleString()}</span></div>
                                              )}
                                              {oath.penalty_paid && (
                                                <div><Badge variant="outline" className="text-[10px] text-green-600 bg-green-500/10">Paid</Badge></div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })()}

                                      {violation.oath_status && !oathHearings[violation.id] && (
                                        <div className="flex gap-2">
                                          <span className="text-muted-foreground w-24">OATH Status:</span>
                                          <Badge variant="outline">{violation.oath_status}</Badge>
                                        </div>
                                      )}

                                      {violation.penalty_amount && violation.penalty_amount > 0 && (
                                        <div className="flex gap-2 items-center">
                                          <span className="text-muted-foreground w-24">Penalty:</span>
                                          <span className="flex items-center text-destructive font-medium">
                                            <DollarSign className="w-3 h-3" />
                                            {violation.penalty_amount.toLocaleString()}
                                          </span>
                                        </div>
                                      )}

                                      {violation.respondent_name && (
                                        <div className="flex gap-2 items-center">
                                          <span className="text-muted-foreground w-24">Respondent:</span>
                                          <span className="flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            {violation.respondent_name}
                                          </span>
                                        </div>
                                      )}

                                      {violation.hearing_date && (
                                        <div className="flex gap-2 items-center">
                                          <span className="text-muted-foreground w-24">Hearing Date:</span>
                                          <span>{new Date(violation.hearing_date).toLocaleDateString()}</span>
                                        </div>
                                      )}

                                      <div className="pt-2 flex gap-2">
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => window.open(getAgencyLookupUrl(violation.agency, violation.violation_number, bbl), '_blank')}
                                        >
                                          <ExternalLink className="w-3 h-3 mr-2" />
                                          View on {violation.agency} Portal
                                        </Button>
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => openWorkOrderDialog(violation)}
                                        >
                                          <Wrench className="w-3 h-3 mr-2" />
                                          Create Work Order
                                        </Button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right Column: Notes */}
                                  <div className="space-y-3">
                                    <h4 className="font-semibold text-sm flex items-center gap-2">
                                      <MessageSquare className="w-4 h-4" />
                                      Notes
                                    </h4>
                                    <Textarea
                                      placeholder="Add notes about this violation (e.g., resolution steps, payment info, contractor contact)..."
                                      value={editingNotes[violation.id] ?? violation.notes ?? ''}
                                      onChange={(e) => setEditingNotes(prev => ({ ...prev, [violation.id]: e.target.value }))}
                                      className="min-h-[100px]"
                                    />
                                    <Button 
                                      size="sm" 
                                      onClick={() => saveNotes(violation.id)}
                                      disabled={savingNotes.has(violation.id) || (editingNotes[violation.id] ?? violation.notes ?? '') === (violation.notes ?? '')}
                                    >
                                      {savingNotes.has(violation.id) ? (
                                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                      ) : (
                                        <Save className="w-3 h-3 mr-2" />
                                      )}
                                      Save Notes
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold text-foreground mb-2">No violations found</h3>
          <p className="text-muted-foreground text-sm">
            {violations.length === 0 
              ? 'This property has no violations on record.'
              : 'No violations match your filters.'}
          </p>
        </div>
      )}

      {/* Work Order Dialog */}
      {selectedViolation && (
        <CreateWorkOrderDialog
          open={workOrderDialogOpen}
          onOpenChange={setWorkOrderDialogOpen}
          propertyId={propertyId}
          violation={selectedViolation}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
};