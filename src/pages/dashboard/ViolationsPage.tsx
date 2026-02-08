import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  AlertTriangle, 
  Plus, 
  Search,
  Loader2,
  Calendar,
  Building2,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface Property {
  id: string;
  address: string;
  bin: string | null;
}

interface Violation {
  id: string;
  agency: 'DOB' | 'ECB' | 'FDNY';
  violation_number: string;
  issued_date: string;
  hearing_date: string | null;
  cure_due_date: string | null;
  description_raw: string | null;
  status: 'open' | 'in_progress' | 'closed';
  property: Property | null;
}

const ViolationsPage = () => {
  const { user } = useAuth();
  const [violations, setViolations] = useState<Violation[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [formData, setFormData] = useState({
    property_id: '',
    agency: '' as 'DOB' | 'ECB' | 'FDNY' | '',
    violation_number: '',
    issued_date: '',
    hearing_date: '',
    cure_due_date: '',
    description_raw: '',
  });

  const fetchData = async () => {
    if (!user) return;

    try {
      const [violationsRes, propertiesRes] = await Promise.all([
        supabase
          .from('violations')
          .select(`
            *,
            property:properties(id, address)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('properties')
          .select('id, address, bin')
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
      toast.error('No properties have a BIN (Building Identification Number). Add BIN to your properties to sync violations from NYC Open Data.');
      return;
    }

    setIsSyncing(true);
    let totalNew = 0;
    let errors = 0;

    try {
      for (const property of propertiesWithBin) {
        try {
          console.log(`Syncing violations for ${property.address} (BIN: ${property.bin})`);
          
          const { data, error } = await supabase.functions.invoke('fetch-nyc-violations', {
            body: { bin: property.bin, property_id: property.id }
          });

          if (error) {
            console.error(`Error syncing ${property.address}:`, error);
            errors++;
          } else if (data?.total_found) {
            totalNew += data.total_found;
          }
        } catch (err) {
          console.error(`Failed to sync ${property.address}:`, err);
          errors++;
        }
      }

      if (errors > 0) {
        toast.warning(`Sync completed with ${errors} error(s). Found ${totalNew} violations.`);
      } else if (totalNew > 0) {
        toast.success(`Sync complete! Found ${totalNew} violations from NYC Open Data.`);
      } else {
        toast.info('No new violations found from NYC Open Data.');
      }

      // Refresh data after sync
      await fetchData();
    } catch (error) {
      console.error('Error during sync:', error);
      toast.error('Failed to sync violations');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.agency) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('violations').insert({
        property_id: formData.property_id,
        agency: formData.agency,
        violation_number: formData.violation_number,
        issued_date: formData.issued_date,
        hearing_date: formData.hearing_date || null,
        cure_due_date: formData.cure_due_date || null,
        description_raw: formData.description_raw || null,
      });

      if (error) throw error;

      toast.success('Violation logged successfully');
      setIsDialogOpen(false);
      setFormData({
        property_id: '',
        agency: '',
        violation_number: '',
        issued_date: '',
        hearing_date: '',
        cure_due_date: '',
        description_raw: '',
      });
      fetchData();
    } catch (error) {
      console.error('Error adding violation:', error);
      toast.error('Failed to log violation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: 'open' | 'in_progress' | 'closed') => {
    try {
      const { error } = await supabase
        .from('violations')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      toast.success('Status updated');
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const filteredViolations = violations.filter(v => {
    const matchesSearch = 
      v.violation_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description_raw?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.property?.address.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Violations</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage NYC violations across your properties
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={syncViolations}
            disabled={isSyncing || properties.length === 0}
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
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
                <Select
                  value={formData.property_id}
                  onValueChange={(v) => setFormData({ ...formData, property_id: v })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Agency *</Label>
                  <Select
                    value={formData.agency}
                    onValueChange={(v) => setFormData({ ...formData, agency: v as 'DOB' | 'ECB' | 'FDNY' })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select agency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DOB">DOB</SelectItem>
                      <SelectItem value="ECB">ECB</SelectItem>
                      <SelectItem value="FDNY">FDNY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="violation_number">Violation # *</Label>
                  <Input
                    id="violation_number"
                    placeholder="ECB-123456"
                    value={formData.violation_number}
                    onChange={(e) => setFormData({ ...formData, violation_number: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issued_date">Issued Date *</Label>
                  <Input
                    id="issued_date"
                    type="date"
                    value={formData.issued_date}
                    onChange={(e) => setFormData({ ...formData, issued_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hearing_date">Hearing Date</Label>
                  <Input
                    id="hearing_date"
                    type="date"
                    value={formData.hearing_date}
                    onChange={(e) => setFormData({ ...formData, hearing_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cure_due_date">Cure Due Date</Label>
                  <Input
                    id="cure_due_date"
                    type="date"
                    value={formData.cure_due_date}
                    onChange={(e) => setFormData({ ...formData, cure_due_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Describe the violation..."
                  value={formData.description_raw}
                  onChange={(e) => setFormData({ ...formData, description_raw: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="hero" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Violation'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search violations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Violations List */}
      {filteredViolations.length > 0 ? (
        <div className="space-y-4">
          {filteredViolations.map((violation) => (
            <div
              key={violation.id}
              className="bg-card rounded-xl border border-border p-6 shadow-card"
            >
              <div className="flex items-start gap-4">
                <div className={`
                  w-12 h-12 rounded-xl flex items-center justify-center shrink-0
                  ${violation.agency === 'FDNY' ? 'bg-destructive/10' : ''}
                  ${violation.agency === 'DOB' ? 'bg-warning/10' : ''}
                  ${violation.agency === 'ECB' ? 'bg-primary/10' : ''}
                `}>
                  <AlertTriangle className={`
                    w-6 h-6
                    ${violation.agency === 'FDNY' ? 'text-destructive' : ''}
                    ${violation.agency === 'DOB' ? 'text-warning' : ''}
                    ${violation.agency === 'ECB' ? 'text-primary' : ''}
                  `} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`
                          px-2 py-0.5 rounded text-xs font-bold
                          ${violation.agency === 'FDNY' ? 'bg-destructive/10 text-destructive' : ''}
                          ${violation.agency === 'DOB' ? 'bg-warning/10 text-warning' : ''}
                          ${violation.agency === 'ECB' ? 'bg-primary/10 text-primary' : ''}
                        `}>
                          {violation.agency}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          #{violation.violation_number}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {violation.description_raw || 'No description provided'}
                      </p>
                    </div>
                    <Select
                      value={violation.status}
                      onValueChange={(v) => updateStatus(violation.id, v as 'open' | 'in_progress' | 'closed')}
                    >
                      <SelectTrigger className={`
                        w-32 h-8 text-xs
                        ${violation.status === 'open' ? 'border-destructive text-destructive' : ''}
                        ${violation.status === 'in_progress' ? 'border-warning text-warning' : ''}
                        ${violation.status === 'closed' ? 'border-success text-success' : ''}
                      `}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-6 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {violation.property?.address || 'Unknown property'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Issued: {new Date(violation.issued_date).toLocaleDateString()}
                    </div>
                    {violation.cure_due_date && (
                      <div className="flex items-center gap-1 text-warning">
                        <Calendar className="w-3 h-3" />
                        Due: {new Date(violation.cure_due_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
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
