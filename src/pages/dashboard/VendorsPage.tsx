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
  Users, 
  Plus, 
  Search,
  Loader2,
  Phone,
  FileCheck,
  MoreVertical,
  Pencil,
  Trash2,
  AlertCircle,
  ClipboardList,
  X,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Vendor {
  id: string;
  name: string;
  phone_number: string | null;
  trade_type: string | null;
  coi_expiration_date: string | null;
  status: string;
}

interface WorkOrder {
  id: string;
  scope: string;
  status: string;
  created_at: string;
  property?: {
    address: string;
  };
}

const TRADE_TYPES = [
  'Plumber',
  'Electrician',
  'HVAC',
  'General Contractor',
  'Roofer',
  'Mason',
  'Painter',
  'Carpenter',
  'Elevator',
  'Fire Safety',
  'Other'
];

const VendorsPage = () => {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [selectedVendorHistory, setSelectedVendorHistory] = useState<Vendor | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
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
    name: '',
    phone_number: '',
    trade_type: '',
    coi_expiration_date: '',
  });

  const fetchVendors = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkOrderHistory = async (vendorId: string) => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          id,
          scope,
          status,
          created_at,
          properties:property_id (address)
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setWorkOrders((data || []).map(wo => ({
        id: wo.id,
        scope: wo.scope,
        status: wo.status,
        created_at: wo.created_at,
        property: wo.properties as unknown as { address: string } | undefined
      })));
    } catch (error) {
      console.error('Error fetching work orders:', error);
      toast.error('Failed to load work order history');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('vendors').insert({
        user_id: user.id,
        name: formData.name,
        phone_number: formData.phone_number || null,
        trade_type: formData.trade_type || null,
        coi_expiration_date: formData.coi_expiration_date || null,
      });

      if (error) throw error;

      toast.success('Vendor added successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchVendors();
    } catch (error) {
      console.error('Error adding vendor:', error);
      toast.error('Failed to add vendor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('vendors')
        .update({
          name: formData.name,
          phone_number: formData.phone_number || null,
          trade_type: formData.trade_type || null,
          coi_expiration_date: formData.coi_expiration_date || null,
        })
        .eq('id', editingVendor.id);

      if (error) throw error;

      toast.success('Vendor updated successfully');
      setIsEditDialogOpen(false);
      setEditingVendor(null);
      resetForm();
      fetchVendors();
    } catch (error) {
      console.error('Error updating vendor:', error);
      toast.error('Failed to update vendor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return;

    try {
      const { error } = await supabase.from('vendors').delete().eq('id', id);
      if (error) throw error;
      
      toast.success('Vendor deleted');
      fetchVendors();
    } catch (error) {
      console.error('Error deleting vendor:', error);
      toast.error('Failed to delete vendor');
    }
  };

  const openEditDialog = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      phone_number: vendor.phone_number || '',
      trade_type: vendor.trade_type || '',
      coi_expiration_date: vendor.coi_expiration_date || '',
    });
    setIsEditDialogOpen(true);
  };

  const openHistoryDialog = (vendor: Vendor) => {
    setSelectedVendorHistory(vendor);
    setIsHistoryDialogOpen(true);
    fetchWorkOrderHistory(vendor.id);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone_number: '',
      trade_type: '',
      coi_expiration_date: '',
    });
  };

  const isCoiExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const expiryDate = new Date(date);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isCoiExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20">Open</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20">In Progress</Badge>;
      case 'awaiting_docs':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/20">Awaiting Docs</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.trade_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const VendorForm = ({ onSubmit, isEdit = false }: { onSubmit: (e: React.FormEvent) => void, isEdit?: boolean }) => (
    <form onSubmit={onSubmit} className="space-y-5 mt-4">
      <div className="space-y-2">
        <Label htmlFor="name">Company Name *</Label>
        <Input
          id="name"
          placeholder="ABC Plumbing Corp"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="(555) 123-4567"
            value={formData.phone_number}
            onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trade">Trade Type</Label>
          <Select 
            value={formData.trade_type} 
            onValueChange={(value) => setFormData({ ...formData, trade_type: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select trade..." />
            </SelectTrigger>
            <SelectContent>
              {TRADE_TYPES.map(trade => (
                <SelectItem key={trade} value={trade}>{trade}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="coi">COI Expiration Date</Label>
        <Input
          id="coi"
          type="date"
          value={formData.coi_expiration_date}
          onChange={(e) => setFormData({ ...formData, coi_expiration_date: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => {
            if (isEdit) {
              setIsEditDialogOpen(false);
              setEditingVendor(null);
            } else {
              setIsDialogOpen(false);
            }
            resetForm();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" variant="hero" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save Changes' : 'Add Vendor'}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Vendors</h1>
          <p className="text-muted-foreground mt-1">
            Manage your contractors and track COI compliance
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="w-4 h-4" />
              Add Vendor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Add New Vendor</DialogTitle>
            </DialogHeader>
            <VendorForm onSubmit={handleSubmit} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search vendors..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Vendors Table */}
      {filteredVendors.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10"></TableHead>
                <TableHead className="font-semibold">Company Name</TableHead>
                <TableHead className="font-semibold">Trade</TableHead>
                <TableHead className="font-semibold">Phone</TableHead>
                <TableHead className="font-semibold">COI Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVendors.map((vendor) => (
                <Collapsible key={vendor.id} asChild open={expandedRows.has(vendor.id)} onOpenChange={() => toggleRow(vendor.id)}>
                  <>
                    <TableRow className="hover:bg-muted/30">
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {expandedRows.has(vendor.id) ? (
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
                            <Users className="w-4 h-4 text-primary" />
                          </div>
                          <span className="font-medium">{vendor.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {vendor.trade_type ? (
                          <Badge variant="secondary">{vendor.trade_type}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {vendor.phone_number ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="w-3 h-3" />
                            {vendor.phone_number}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <FileCheck className={`w-4 h-4 ${
                            isCoiExpired(vendor.coi_expiration_date) ? 'text-destructive' :
                            isCoiExpiringSoon(vendor.coi_expiration_date) ? 'text-warning' :
                            vendor.coi_expiration_date ? 'text-success' : 'text-muted-foreground'
                          }`} />
                          <span className={`text-sm font-medium ${
                            isCoiExpired(vendor.coi_expiration_date) ? 'text-destructive' :
                            isCoiExpiringSoon(vendor.coi_expiration_date) ? 'text-warning' :
                            vendor.coi_expiration_date ? 'text-success' : 'text-muted-foreground'
                          }`}>
                            {isCoiExpired(vendor.coi_expiration_date) ? 'Expired' :
                             isCoiExpiringSoon(vendor.coi_expiration_date) ? 'Expiring Soon' :
                             vendor.coi_expiration_date ? new Date(vendor.coi_expiration_date).toLocaleDateString() :
                             'No COI'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openHistoryDialog(vendor)}>
                              <ClipboardList className="w-4 h-4 mr-2" />
                              Work Order History
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(vendor)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleDelete(vendor.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <tr className="bg-muted/20">
                        <td colSpan={6} className="p-4 border-t border-border">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Status:</span>
                              <p className="font-medium capitalize">{vendor.status || 'Active'}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">COI Expiration:</span>
                              <p className="font-medium">
                                {vendor.coi_expiration_date 
                                  ? new Date(vendor.coi_expiration_date).toLocaleDateString() 
                                  : 'Not on file'}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => openHistoryDialog(vendor)}
                              >
                                <ClipboardList className="w-4 h-4 mr-2" />
                                View Work Order History
                              </Button>
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
          <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            No vendors yet
          </h3>
          <p className="text-muted-foreground mb-6">
            Add your contractors to track their work and COI compliance
          </p>
          <Button variant="hero" onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Add Vendor
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setEditingVendor(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit Vendor</DialogTitle>
          </DialogHeader>
          <VendorForm onSubmit={handleEdit} isEdit />
        </DialogContent>
      </Dialog>

      {/* Work Order History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Work Order History - {selectedVendorHistory?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto mt-4">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : workOrders.length > 0 ? (
              <div className="space-y-3">
                {workOrders.map((wo) => (
                  <div 
                    key={wo.id} 
                    className="p-4 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground line-clamp-2">
                          {wo.scope}
                        </p>
                        {wo.property?.address && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {wo.property.address}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {new Date(wo.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {getStatusBadge(wo.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No work orders assigned to this vendor yet.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorsPage;