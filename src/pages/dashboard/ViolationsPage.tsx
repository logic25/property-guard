import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  AlertTriangle, 
  Plus, 
  Search,
  Loader2,
  Calendar,
  Building2,
  RefreshCw,
  ArrowUpDown,
  ExternalLink,
  DollarSign,
  Gavel
} from 'lucide-react';
import { toast } from 'sonner';
import { isActiveViolation, getAgencyColor, getAgencyLookupUrl } from '@/lib/violation-utils';

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
  penalty_amount: number | null;
  respondent_name: string | null;
  is_stop_work_order: boolean | null;
  is_vacate_order: boolean | null;
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

  const [formData, setFormData] = useState({
    property_id: '',
    agency: '' as string,
    violation_number: '',
    issued_date: '',
    hearing_date: '',
    cure_due_date: '',
    description_raw: '',
    notes: '',
  });

  const fetchData = async () => {
    if (!user) return;
    try {
      const [violationsRes, propertiesRes] = await Promise.all([
        supabase
          .from('violations')
          .select('*, property:properties(id, address, bin, bbl)')
          .order('created_at', { ascending: false }),
        supabase
          .from('properties')
          .select('id, address, bin, bbl')
          .order('address'),
      ]);
      if (violationsRes.error) throw violationsRes.error;
      if (propertiesRes.error) throw propertiesRes.error;
      setViolations(violationsRes.data as unknown as Violation[] || []);
      setProperties(propertiesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load violations');
    } finally {
      setLoading(false);
    }
  };

  const syncViolations = async () => {
    const propertiesWithBin = properties.filter(p => p.bin);
    if (propertiesWithBin.length === 0) {
      toast.error('No properties have a BIN. Add BIN to your properties to sync from NYC Open Data.');
      return;
    }
    setIsSyncing(true);
    let totalNew = 0;
    let errors = 0;
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

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const getDaysUntil = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const today = new Date();
    return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Get unique agencies for filter
  const agencies = useMemo(() => {
    const set = new Set(violations.map(v => v.agency));
    return Array.from(set).sort();
  }, [violations]);

  // Summary stats
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

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'issued_date':
          cmp = new Date(a.issued_date).getTime() - new Date(b.issued_date).getTime();
          break;
        case 'agency':
          cmp = a.agency.localeCompare(b.agency);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'hearing_date':
          cmp = (a.hearing_date || '').localeCompare(b.hearing_date || '');
          break;
        case 'penalty_amount':
          cmp = (a.penalty_amount || 0) - (b.penalty_amount || 0);
          break;
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
    if (v.status === 'open') return 'hover:bg-muted/50';
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
          <p className="text-muted-foreground mt-1">
            Track and manage NYC violations across your properties
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={syncViolations} disabled={isSyncing || properties.length === 0}>
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {isSyncing ? 'Syncing...' : 'Sync from NYC'}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" disabled={properties.length === 0}>
                <Plus className="w-4 h-4" />
                Log Violation
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
                        <SelectItem value="DOB">DOB</SelectItem>
                        <SelectItem value="ECB">ECB</SelectItem>
                        <SelectItem value="FDNY">FDNY</SelectItem>
                        <SelectItem value="HPD">HPD</SelectItem>
                        <SelectItem value="DEP">DEP</SelectItem>
                        <SelectItem value="DOT">DOT</SelectItem>
                        <SelectItem value="DSNY">DSNY</SelectItem>
                        <SelectItem value="LPC">LPC</SelectItem>
                        <SelectItem value="DOF">DOF</SelectItem>
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
                <SortableHeader field="issued_date">Issued</SortableHeader>
                <TableHead>Address</TableHead>
                <TableHead>Violation #</TableHead>
                <SortableHeader field="agency">Agency</SortableHeader>
                <TableHead>Description</TableHead>
                <SortableHeader field="status">Status</SortableHeader>
                <SortableHeader field="hearing_date">Hearing</SortableHeader>
                <SortableHeader field="penalty_amount">Fines</SortableHeader>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredViolations.map((v) => {
                const daysUntilHearing = getDaysUntil(v.hearing_date);
                const isCritical = v.is_stop_work_order || v.is_vacate_order;
                
                return (
                  <TableRow key={v.id} className={`${getRowColor(v)} transition-colors`}>
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">
                      {new Date(v.issued_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <Link to={`/dashboard/properties/${v.property?.id}`} className="text-sm font-medium text-foreground hover:text-accent hover:underline truncate block">
                        {v.property?.address || 'Unknown'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm font-mono whitespace-nowrap">{v.violation_number}</TableCell>
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
                      <Select value={v.status} onValueChange={(s) => updateStatus(v.id, s)}>
                        <SelectTrigger className={`w-28 h-7 text-[11px] font-medium border ${
                          v.status === 'open' ? 'border-destructive/50 text-destructive' :
                          v.status === 'in_progress' ? 'border-warning/50 text-warning' :
                          'border-success/50 text-success'
                        }`}>
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
                    <TableCell>
                      <a 
                        href={getAgencyLookupUrl(v.agency, v.violation_number, v.property?.bbl)}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-accent transition-colors"
                        title="View on NYC portal"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </TableCell>
                  </TableRow>
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
            {properties.length === 0 
              ? 'You need to add a property before logging violations'
              : 'Your properties are in good standing!'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ViolationsPage;
