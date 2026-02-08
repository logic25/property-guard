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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  ClipboardList, 
  Plus, 
  Search,
  Loader2,
  Building2,
  Users,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Calendar
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Property {
  id: string;
  address: string;
}

interface Vendor {
  id: string;
  name: string;
}

interface Violation {
  id: string;
  violation_number: string;
  agency: string;
}

interface WorkOrder {
  id: string;
  scope: string;
  status: 'open' | 'in_progress' | 'awaiting_docs' | 'completed';
  created_at: string;
  property: Property | null;
  vendor: Vendor | null;
  violation: Violation | null;
}

const WorkOrdersPage = () => {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
  const [formData, setFormData] = useState({
    property_id: '',
    vendor_id: '',
    linked_violation_id: '',
    scope: '',
  });

  const fetchData = async () => {
    if (!user) return;

    try {
      const [workOrdersRes, propertiesRes, vendorsRes, violationsRes] = await Promise.all([
        supabase
          .from('work_orders')
          .select(`
            *,
            property:properties(id, address),
            vendor:vendors(id, name),
            violation:violations(id, violation_number, agency)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('properties').select('id, address').order('address'),
        supabase.from('vendors').select('id, name').order('name'),
        supabase.from('violations').select('id, violation_number, agency').neq('status', 'closed'),
      ]);

      if (workOrdersRes.error) throw workOrdersRes.error;

      setWorkOrders(workOrdersRes.data as unknown as WorkOrder[] || []);
      setProperties(propertiesRes.data || []);
      setVendors(vendorsRes.data || []);
      setViolations(violationsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load work orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('work_orders').insert({
        property_id: formData.property_id,
        vendor_id: formData.vendor_id || null,
        linked_violation_id: formData.linked_violation_id || null,
        scope: formData.scope,
      });

      if (error) throw error;

      toast.success('Work order created');
      setIsDialogOpen(false);
      setFormData({
        property_id: '',
        vendor_id: '',
        linked_violation_id: '',
        scope: '',
      });
      fetchData();
    } catch (error) {
      console.error('Error creating work order:', error);
      toast.error('Failed to create work order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: WorkOrder['status']) => {
    try {
      const { error } = await supabase
        .from('work_orders')
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

  const filteredWorkOrders = workOrders.filter(wo => {
    const matchesSearch = 
      wo.scope.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.property?.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.vendor?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, string> = {
    open: 'bg-destructive/10 text-destructive border-destructive',
    in_progress: 'bg-warning/10 text-warning border-warning',
    awaiting_docs: 'bg-primary/10 text-primary border-primary',
    completed: 'bg-success/10 text-success border-success',
  };

  const getStatusBadge = (status: string) => {
    const labels: Record<string, string> = {
      open: 'Open',
      in_progress: 'In Progress',
      awaiting_docs: 'Awaiting Docs',
      completed: 'Completed',
    };
    return (
      <Badge variant="outline" className={statusColors[status] || ''}>
        {labels[status] || status}
      </Badge>
    );
  };

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
          <h1 className="font-display text-3xl font-bold text-foreground">Work Orders</h1>
          <p className="text-muted-foreground mt-1">
            Track work assignments and progress
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" disabled={properties.length === 0}>
              <Plus className="w-4 h-4" />
              Create Work Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Create Work Order</DialogTitle>
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

              <div className="space-y-2">
                <Label>Assign Vendor</Label>
                <Select
                  value={formData.vendor_id}
                  onValueChange={(v) => setFormData({ ...formData, vendor_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {violations.length > 0 && (
                <div className="space-y-2">
                  <Label>Link to Violation</Label>
                  <Select
                    value={formData.linked_violation_id}
                    onValueChange={(v) => setFormData({ ...formData, linked_violation_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select violation (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {violations.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.agency} - #{v.violation_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="scope">Scope of Work *</Label>
                <Input
                  id="scope"
                  placeholder="Describe the work to be done..."
                  value={formData.scope}
                  onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="hero" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search work orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="awaiting_docs">Awaiting Docs</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Work Orders Table */}
      {filteredWorkOrders.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10"></TableHead>
                <TableHead className="font-semibold">Scope</TableHead>
                <TableHead className="font-semibold">Property</TableHead>
                <TableHead className="font-semibold">Vendor</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkOrders.map((workOrder) => (
                <Collapsible key={workOrder.id} asChild open={expandedRows.has(workOrder.id)} onOpenChange={() => toggleRow(workOrder.id)}>
                  <>
                    <TableRow className="hover:bg-muted/30">
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {expandedRows.has(workOrder.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <ClipboardList className="w-4 h-4 text-primary" />
                          </div>
                          <span className="font-medium line-clamp-1">{workOrder.scope}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Building2 className="w-3 h-3 text-muted-foreground" />
                          <span className="line-clamp-1">{workOrder.property?.address || 'No property'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {workOrder.vendor ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            {workOrder.vendor.name}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={workOrder.status}
                          onValueChange={(v) => updateStatus(workOrder.id, v as WorkOrder['status'])}
                        >
                          <SelectTrigger className={`w-32 h-8 text-xs ${statusColors[workOrder.status]}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="awaiting_docs">Awaiting Docs</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(workOrder.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <tr className="bg-muted/20">
                        <td colSpan={6} className="p-4 border-t border-border">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Full Scope:</span>
                              <p className="font-medium">{workOrder.scope}</p>
                            </div>
                            {workOrder.violation && (
                              <div>
                                <span className="text-muted-foreground">Linked Violation:</span>
                                <p className="font-medium flex items-center gap-1 text-warning">
                                  <AlertTriangle className="w-3 h-3" />
                                  {workOrder.violation.agency} #{workOrder.violation.violation_number}
                                </p>
                              </div>
                            )}
                            <div>
                              <span className="text-muted-foreground">Created:</span>
                              <p className="font-medium">{new Date(workOrder.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <ClipboardList className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            {properties.length === 0 ? 'Add a property first' : 'No work orders yet'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {properties.length === 0 
              ? 'You need properties to create work orders'
              : 'Create work orders to track vendor assignments'}
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkOrdersPage;
