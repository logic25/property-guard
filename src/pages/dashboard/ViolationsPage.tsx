import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  AlertTriangle, Plus, Search, Loader2, Calendar, Building2, RefreshCw,
  ArrowUpDown, ExternalLink, DollarSign, Gavel, ChevronRight, ChevronDown,
  FileText, User, MessageSquare, Save, MoreHorizontal, Wrench, Scale
} from 'lucide-react';
import { toast } from 'sonner';
import { isActiveViolation, getAgencyColor, getAgencyLookupUrl, getStatusColor } from '@/lib/violation-utils';
import { calculateViolationSeverity } from '@/lib/violation-severity';
import { decodeComplaintCategory, getComplaintSeverityColor } from '@/lib/complaint-category-decoder';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Property {
  id: string;
  address: string;
  bin: string | null;
  bbl: string | null;
}

interface Violation {
  id: string;
  agency: string;
  violation_number: string;
  issued_date: string;
  hearing_date: string | null;
  cure_due_date: string | null;
  description_raw: string | null;
  status: string;
  oath_status: string | null;
  violation_class: string | null;
  violation_type: string | null;
  complaint_category: string | null;
  severity: string | null;
  penalty_amount: number | null;
  respondent_name: string | null;
  is_stop_work_order: boolean | null;
  is_vacate_order: boolean | null;
  notes: string | null;
  suppressed: boolean | null;
  suppression_reason: string | null;
  property: Property | null;
}

type SortField = 'issued_date' | 'agency' | 'status' | 'hearing_date' | 'penalty_amount';
type SortDir = 'asc' | 'desc';

const ViolationsPage = () => {
  const { user } = useAuth();
  const [violations, setViolations] = useState<Violation[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agencyFilter, setAgencyFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('issued_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<Set<string>>(new Set());
  const [oathHearings, setOathHearings] = useState<Record<string, any>>({});

  const [formData, setFormData] = useState({
    property_id: '', agency: '' as string, violation_number: '', issued_date: '',
    hearing_date: '', cure_due_date: '', description_raw: '', notes: '',
  });


  const fetchData = async () => {
    if (!user) return;
    try {
      const [violationsRes, propertiesRes] = await Promise.all([
        supabase.from('violations').select('*, property:properties(id, address, bin, bbl)').order('created_at', { ascending: false }),
        supabase.from('properties').select('id, address, bin, bbl').order('address'),
      ]);
      if (violationsRes.error) throw violationsRes.error;
      if (propertiesRes.error) throw propertiesRes.error;
      setViolations(violationsRes.data as unknown as Violation[] || []);
      setProperties(propertiesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load violations');
    } finally { setLoading(false); }
  };

  const syncViolations = async () => {
    const propertiesWithBin = properties.filter(p => p.bin);
    if (propertiesWithBin.length === 0) {
      toast.error('No properties have a BIN. Add BIN to your properties to sync from NYC Open Data.');
      return;
    }
    setIsSyncing(true);
    let totalNew = 0; let errors = 0;
    try {
      for (const property of propertiesWithBin) {
        try {
          const { data, error } = await supabase.functions.invoke('fetch-nyc-violations', {
            body: { bin: property.bin, property_id: property.id }
          });
          if (error) { errors++; } else if (data?.total_found) { totalNew += data.total_found; }
        } catch { errors++; }
      }
      if (errors > 0) toast.warning(`Sync completed with ${errors} error(s). Found ${totalNew} violations.`);
      else if (totalNew > 0) toast.success(`Found ${totalNew} violations from NYC Open Data.`);
      else toast.info('No new violations found.');
      await fetchData();
    } catch { toast.error('Failed to sync violations'); } finally { setIsSyncing(false); }
  };

  useEffect(() => { fetchData(); }, [user]);

  // Fetch OATH hearings for ECB violations
  useEffect(() => {
    const ecbViolations = violations.filter(v => v.agency === 'ECB');
    if (ecbViolations.length === 0) return;
    
    const fetchOath = async () => {
      const ecbIds = ecbViolations.map(v => v.id);
      const { data } = await supabase
        .from('oath_hearings')
        .select('*')
        .in('violation_id', ecbIds);
      
      if (data) {
        const map: Record<string, any> = {};
        data.forEach((h: any) => { if (h.violation_id) map[h.violation_id] = h; });
        setOathHearings(map);
      }
    };
    fetchOath();
  }, [violations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.agency) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('violations').insert({
        property_id: formData.property_id,
        agency: formData.agency as any,
        violation_number: formData.violation_number,
        issued_date: formData.issued_date,
        hearing_date: formData.hearing_date || null,
        cure_due_date: formData.cure_due_date || null,
        description_raw: formData.description_raw || null,
        notes: formData.notes || null,
      });
      if (error) throw error;
      toast.success('Violation logged successfully');
      setIsDialogOpen(false);
      setFormData({ property_id: '', agency: '', violation_number: '', issued_date: '', hearing_date: '', cure_due_date: '', description_raw: '', notes: '' });
      fetchData();
    } catch (error) {
      console.error('Error adding violation:', error);
      toast.error('Failed to log violation');
    } finally { setIsSubmitting(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from('violations').update({ status: status as any }).eq('id', id);
      if (error) throw error;
      toast.success('Status updated');
      fetchData();
    } catch { toast.error('Failed to update status'); }
  };

  const saveNotes = async (id: string) => {
    const notes = editingNotes[id];
    if (notes === undefined) return;
    setSavingNotes(prev => new Set(prev).add(id));
    try {
      const { error } = await supabase.from('violations').update({ notes }).eq('id', id);
      if (error) throw error;
      toast.success('Notes saved');
      fetchData();
    } catch { toast.error('Failed to save notes'); }
    finally { setSavingNotes(prev => { const s = new Set(prev); s.delete(id); return s; }); }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getDaysUntil = (dateStr: string | null) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  };

  const agencies = useMemo(() => [...new Set(violations.map(v => v.agency))].sort(), [violations]);

  const summaryStats = useMemo(() => {
    const active = violations.filter(isActiveViolation);
    const totalPenalties = active.reduce((s, v) => s + (v.penalty_amount || 0), 0);
    const today = new Date();
    const thirtyDays = new Date(); thirtyDays.setDate(thirtyDays.getDate() + 30);
    const upcomingHearings = active.filter(v => {
      if (!v.hearing_date) return false;
      const d = new Date(v.hearing_date);
      return d >= today && d <= thirtyDays;
    }).length;
    return { active: active.length, totalPenalties, upcomingHearings };
  }, [violations]);

  const filteredViolations = useMemo(() => {
    let filtered = violations.filter(v => {
      const matchesSearch = 
        v.violation_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.description_raw?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.property?.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.respondent_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchesAgency = agencyFilter === 'all' || v.agency === agencyFilter;
      return matchesSearch && matchesStatus && matchesAgency;
    });
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'issued_date': cmp = new Date(a.issued_date).getTime() - new Date(b.issued_date).getTime(); break;
        case 'agency': cmp = a.agency.localeCompare(b.agency); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'hearing_date': cmp = (a.hearing_date || '').localeCompare(b.hearing_date || ''); break;
        case 'penalty_amount': cmp = (a.penalty_amount || 0) - (b.penalty_amount || 0); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return filtered;
  }, [violations, searchQuery, statusFilter, agencyFilter, sortField, sortDir]);

  const getRowColor = (v: Violation) => {
    if (v.is_stop_work_order || v.is_vacate_order) return 'bg-destructive/5 hover:bg-destructive/10';
    const daysUntilHearing = getDaysUntil(v.hearing_date);
    if (daysUntilHearing !== null && daysUntilHearing >= 0 && daysUntilHearing <= 7) return 'bg-destructive/5 hover:bg-destructive/10';
    if (daysUntilHearing !== null && daysUntilHearing > 7 && daysUntilHearing <= 14) return 'bg-warning/5 hover:bg-warning/10';
    if (v.status === 'closed' || !isActiveViolation(v)) return 'bg-success/5 hover:bg-success/10';
    return 'hover:bg-muted/50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-foreground' : 'text-muted-foreground/50'}`} />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Violations</h1>
          <p className="text-muted-foreground mt-1">Track and manage NYC violations across your properties</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={syncViolations} disabled={isSyncing || properties.length === 0}>
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {isSyncing ? 'Syncing...' : 'Sync from NYC'}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" disabled={properties.length === 0}>
                <Plus className="w-4 h-4" /> Log Violation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">Log New Violation</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                <div className="space-y-2">
                  <Label>Property *</Label>
                  <Select value={formData.property_id} onValueChange={(v) => setFormData({ ...formData, property_id: v })} required>
                    <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (<SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Agency *</Label>
                    <Select value={formData.agency} onValueChange={(v) => setFormData({ ...formData, agency: v })} required>
                      <SelectTrigger><SelectValue placeholder="Select agency" /></SelectTrigger>
                      <SelectContent>
                        {['DOB','ECB','FDNY','HPD','DEP','DOT','DSNY','LPC','DOF'].map(a => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="violation_number">Violation # *</Label>
                    <Input id="violation_number" placeholder="34883000N" value={formData.violation_number} onChange={(e) => setFormData({ ...formData, violation_number: e.target.value })} required />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="issued_date">Issued Date *</Label>
                    <Input id="issued_date" type="date" value={formData.issued_date} onChange={(e) => setFormData({ ...formData, issued_date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hearing_date">Hearing Date</Label>
                    <Input id="hearing_date" type="date" value={formData.hearing_date} onChange={(e) => setFormData({ ...formData, hearing_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cure_due_date">Cure Due Date</Label>
                    <Input id="cure_due_date" type="date" value={formData.cure_due_date} onChange={(e) => setFormData({ ...formData, cure_due_date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" placeholder="Describe the violation..." value={formData.description_raw} onChange={(e) => setFormData({ ...formData, description_raw: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <textarea id="notes" placeholder="Internal notes..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" variant="hero" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Violation'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 shadow-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Active Violations</p>
            <p className="text-2xl font-display font-bold text-foreground tabular-nums">{summaryStats.active}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <Gavel className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Upcoming Hearings</p>
            <p className="text-2xl font-display font-bold text-foreground tabular-nums">{summaryStats.upcomingHearings}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Penalties</p>
            <p className="text-2xl font-display font-bold text-foreground tabular-nums">${summaryStats.totalPenalties.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search violations, addresses, respondents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agencyFilter} onValueChange={setAgencyFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Agency" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agencies</SelectItem>
            {agencies.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto tabular-nums">
          {filteredViolations.length} of {violations.length} violations
        </span>
      </div>

      {/* Color Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-destructive/20 border border-destructive/30" /> Hearing ≤7 days / Critical</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-warning/20 border border-warning/30" /> Hearing 8–14 days</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-success/20 border border-success/30" /> Resolved / Closed</span>
      </div>

      {/* Violations Table */}
      {filteredViolations.length > 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-10"></TableHead>
                <SortableHeader field="issued_date">Issued</SortableHeader>
                <TableHead>Address</TableHead>
                <TableHead>Violation #</TableHead>
                <SortableHeader field="agency">Agency</SortableHeader>
                <TableHead>Description</TableHead>
                <SortableHeader field="status">Status</SortableHeader>
                <SortableHeader field="hearing_date">Hearing</SortableHeader>
                <SortableHeader field="penalty_amount">Fines</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredViolations.map((v) => {
                const daysUntilHearing = getDaysUntil(v.hearing_date);
                const isCritical = v.is_stop_work_order || v.is_vacate_order;
                const isExpanded = expandedRows.has(v.id);
                const sev = calculateViolationSeverity(v);
                const dotColor = { Critical: 'bg-red-500', High: 'bg-orange-500', Medium: 'bg-yellow-500', Low: 'bg-blue-500' }[sev.level] || 'bg-muted-foreground';
                
                return (
                  <Collapsible key={v.id} asChild open={isExpanded} onOpenChange={() => toggleRow(v.id)}>
                    <>
                      <TableRow className={`${getRowColor(v)} transition-colors cursor-pointer ${v.suppressed ? 'opacity-60' : ''}`} onClick={() => toggleRow(v.id)}>
                        <TableCell className="px-2">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums whitespace-nowrap">
                          {new Date(v.issued_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}
                        </TableCell>
                        <TableCell className="max-w-[180px]">
                          <Link to={`/dashboard/properties/${v.property?.id}`} className="text-sm font-medium text-foreground hover:text-accent hover:underline truncate block" onClick={(e) => e.stopPropagation()}>
                            {v.property?.address || 'Unknown'}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${sev.color}`}>
                              <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                              {sev.level}
                            </span>
                            <span className="text-sm font-mono whitespace-nowrap">{v.violation_number}</span>
                            {v.suppressed && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Suppressed</Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs max-w-[250px]">{v.suppression_reason || 'Age-based suppression'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${getAgencyColor(v.agency)} text-[10px] font-bold`}>
                            {v.agency}
                          </Badge>
                          {isCritical && (
                            <Badge variant="destructive" className="ml-1 text-[10px]">
                              {v.is_stop_work_order ? 'SWO' : 'Vacate'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[250px]">
                          <p className="text-xs text-muted-foreground truncate">{v.description_raw || '—'}</p>
                        </TableCell>
                        <TableCell>
                          <Select value={v.status} onValueChange={(s) => { updateStatus(v.id, s); }} >
                            <SelectTrigger className={`w-28 h-7 text-[11px] font-medium border ${getStatusColor(v.status)}`} onClick={(e) => e.stopPropagation()}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {v.hearing_date ? (
                            <div className="flex flex-col">
                              <span className="tabular-nums">{new Date(v.hearing_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}</span>
                              {daysUntilHearing !== null && daysUntilHearing >= 0 && (
                                <span className={`text-[10px] font-semibold ${daysUntilHearing <= 7 ? 'text-destructive' : daysUntilHearing <= 14 ? 'text-warning' : 'text-muted-foreground'}`}>
                                  {daysUntilHearing === 0 ? 'Today' : daysUntilHearing === 1 ? 'Tomorrow' : `${daysUntilHearing}d away`}
                                </span>
                              )}
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums font-medium whitespace-nowrap">
                          {v.penalty_amount && v.penalty_amount > 0 
                            ? <span className="text-destructive">${v.penalty_amount.toLocaleString()}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={9} className="py-4 px-6">
                            <div className="space-y-4">
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
                                {/* Details */}
                                <div className="space-y-3">
                                  <h4 className="font-semibold text-sm flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Violation Details
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex gap-2">
                                      <span className="text-muted-foreground w-28 shrink-0">Violation Code:</span>
                                      <span className="flex-1 font-mono text-xs">{v.description_raw || '—'}</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <span className="text-muted-foreground w-28 shrink-0">Issued Date:</span>
                                      <span>{new Date(v.issued_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                    </div>
                                    {v.violation_class && (
                                      <div className="flex gap-2">
                                        <span className="text-muted-foreground w-28 shrink-0">Class/Code:</span>
                                        <span>{v.violation_class}</span>
                                      </div>
                                    )}
                                    {/* Complaint Category Decoding */}
                                    {v.complaint_category && (() => {
                                      const decoded = decodeComplaintCategory(v.complaint_category);
                                      return (
                                        <div className="flex gap-2">
                                          <span className="text-muted-foreground w-28 shrink-0">Complaint:</span>
                                          <div className="flex-1">
                                            {decoded ? (
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className={`text-xs ${getComplaintSeverityColor(decoded.severity)}`}>
                                                  {v.complaint_category}
                                                </Badge>
                                                <span className="text-sm font-medium">{decoded.name}</span>
                                                <span className="text-xs text-muted-foreground">— {decoded.description}</span>
                                              </div>
                                            ) : (
                                              <span className="text-sm">Category {v.complaint_category}</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                    {/* OATH Hearing Card */}
                                    {v.agency === 'ECB' && oathHearings[v.id] && (() => {
                                      const oath = oathHearings[v.id];
                                      const dispColor = oath.disposition?.toUpperCase().includes('DISMISSED') || oath.disposition?.toUpperCase().includes('NOT GUILTY')
                                        ? 'text-green-600 bg-green-500/10 border-green-200'
                                        : oath.disposition?.toUpperCase().includes('GUILTY') || oath.disposition?.toUpperCase().includes('DEFAULT')
                                        ? 'text-red-600 bg-red-500/10 border-red-200'
                                        : 'text-yellow-600 bg-yellow-500/10 border-yellow-200';
                                      return (
                                        <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
                                          <div className="flex items-center gap-2">
                                            <Scale className="w-4 h-4 text-muted-foreground" />
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
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {v.oath_status && !oathHearings[v.id] && (
                                      <div className="flex gap-2">
                                        <span className="text-muted-foreground w-28 shrink-0">OATH Status:</span>
                                        <Badge variant="outline">{v.oath_status}</Badge>
                                      </div>
                                    )}
                                    {v.penalty_amount && v.penalty_amount > 0 && (
                                      <div className="flex gap-2 items-center">
                                        <span className="text-muted-foreground w-28 shrink-0">Penalty:</span>
                                        <span className="text-destructive font-medium flex items-center">
                                          <DollarSign className="w-3 h-3" />{v.penalty_amount.toLocaleString()}
                                        </span>
                                      </div>
                                    )}
                                    {v.respondent_name && (
                                      <div className="flex gap-2 items-center">
                                        <span className="text-muted-foreground w-28 shrink-0">Respondent:</span>
                                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{v.respondent_name}</span>
                                      </div>
                                    )}
                                    {v.hearing_date && (
                                      <div className="flex gap-2">
                                        <span className="text-muted-foreground w-28 shrink-0">Hearing Date:</span>
                                        <span>{new Date(v.hearing_date).toLocaleDateString()}</span>
                                      </div>
                                    )}
                                    <div className="pt-2">
                                      <Button
                                        variant="outline" size="sm"
                                        onClick={() => window.open(getAgencyLookupUrl(v.agency, v.violation_number, v.property?.bbl), '_blank')}
                                      >
                                        <ExternalLink className="w-3 h-3 mr-2" /> View on {v.agency} Portal
                                      </Button>
                                    </div>
                                  </div>
                                </div>

                                {/* Notes */}
                                <div className="space-y-3">
                                  <h4 className="font-semibold text-sm flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" /> Notes
                                  </h4>
                                  <Textarea
                                    placeholder="Add notes about this violation..."
                                    value={editingNotes[v.id] ?? v.notes ?? ''}
                                    onChange={(e) => setEditingNotes(prev => ({ ...prev, [v.id]: e.target.value }))}
                                    className="min-h-[100px]"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <Button 
                                    size="sm" onClick={() => saveNotes(v.id)}
                                    disabled={savingNotes.has(v.id) || (editingNotes[v.id] ?? v.notes ?? '') === (v.notes ?? '')}
                                  >
                                    {savingNotes.has(v.id) ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Save className="w-3 h-3 mr-2" />}
                                    Save Notes
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            {properties.length === 0 ? 'Add a property first' : 'No violations found'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {properties.length === 0 ? 'You need to add a property before logging violations' : 'Your properties are in good standing!'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ViolationsPage;
