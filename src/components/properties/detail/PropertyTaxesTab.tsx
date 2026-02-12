import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, Plus, Pencil, Trash2, Scale, AlertTriangle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface PropertyTaxesTabProps {
  propertyId: string;
}

interface TaxRecord {
  id: string;
  tax_year: number;
  assessed_value: number | null;
  tax_amount: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  payment_status: string;
  due_date: string | null;
  paid_date: string | null;
  protest_status: string;
  protest_filed_date: string | null;
  protest_hearing_date: string | null;
  protest_outcome_notes: string | null;
  tenant_responsible: boolean;
  tenant_name: string | null;
  notes: string | null;
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: 'bg-success/10 text-success border-success/20',
  partial: 'bg-warning/10 text-warning border-warning/20',
  unpaid: 'bg-destructive/10 text-destructive border-destructive/20',
  exempt: 'bg-muted text-muted-foreground border-muted',
};

const PROTEST_STATUS_LABELS: Record<string, string> = {
  none: 'None',
  filed: 'Filed',
  pending_hearing: 'Pending Hearing',
  decided_favorable: 'Favorable',
  decided_unfavorable: 'Unfavorable',
  withdrawn: 'Withdrawn',
};

const PROTEST_STATUS_COLORS: Record<string, string> = {
  none: '',
  filed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  pending_hearing: 'bg-warning/10 text-warning',
  decided_favorable: 'bg-success/10 text-success',
  decided_unfavorable: 'bg-destructive/10 text-destructive',
  withdrawn: 'bg-muted text-muted-foreground',
};

const emptyForm = {
  tax_year: new Date().getFullYear(),
  assessed_value: '',
  tax_amount: '',
  amount_paid: '',
  payment_status: 'unpaid',
  due_date: '',
  paid_date: '',
  protest_status: 'none',
  protest_filed_date: '',
  protest_hearing_date: '',
  protest_outcome_notes: '',
  tenant_responsible: false,
  tenant_name: '',
  notes: '',
};

export const PropertyTaxesTab = ({ propertyId }: PropertyTaxesTabProps) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: taxes, isLoading } = useQuery({
    queryKey: ['property-taxes', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_taxes')
        .select('*')
        .eq('property_id', propertyId)
        .order('tax_year', { ascending: false });
      if (error) throw error;
      return data as TaxRecord[];
    },
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (tax: TaxRecord) => {
    setEditingId(tax.id);
    setForm({
      tax_year: tax.tax_year,
      assessed_value: tax.assessed_value?.toString() || '',
      tax_amount: tax.tax_amount?.toString() || '',
      amount_paid: tax.amount_paid?.toString() || '',
      payment_status: tax.payment_status,
      due_date: tax.due_date || '',
      paid_date: tax.paid_date || '',
      protest_status: tax.protest_status,
      protest_filed_date: tax.protest_filed_date || '',
      protest_hearing_date: tax.protest_hearing_date || '',
      protest_outcome_notes: tax.protest_outcome_notes || '',
      tenant_responsible: tax.tenant_responsible,
      tenant_name: tax.tenant_name || '',
      notes: tax.notes || '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      property_id: propertyId,
      tax_year: form.tax_year,
      assessed_value: form.assessed_value ? parseFloat(form.assessed_value) : null,
      tax_amount: form.tax_amount ? parseFloat(form.tax_amount) : null,
      amount_paid: form.amount_paid ? parseFloat(form.amount_paid) : 0,
      payment_status: form.payment_status,
      due_date: form.due_date || null,
      paid_date: form.paid_date || null,
      protest_status: form.protest_status,
      protest_filed_date: form.protest_filed_date || null,
      protest_hearing_date: form.protest_hearing_date || null,
      protest_outcome_notes: form.protest_outcome_notes || null,
      tenant_responsible: form.tenant_responsible,
      tenant_name: form.tenant_name || null,
      notes: form.notes || null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('property_taxes').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('property_taxes').insert(payload));
    }

    setSaving(false);
    if (error) {
      if (error.code === '23505') {
        toast.error(`Tax year ${form.tax_year} already exists for this property`);
      } else {
        toast.error('Failed to save tax record');
      }
      return;
    }

    toast.success(editingId ? 'Tax record updated' : 'Tax record added');
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['property-taxes', propertyId] });
  };

  const deleteTax = async (id: string) => {
    const { error } = await supabase.from('property_taxes').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
      return;
    }
    toast.success('Tax record deleted');
    queryClient.invalidateQueries({ queryKey: ['property-taxes', propertyId] });
  };

  // Summary stats
  const totalBalance = (taxes || []).reduce((sum, t) => sum + (t.balance_due || 0), 0);
  const overdueCount = (taxes || []).filter(t => t.payment_status === 'unpaid' && t.due_date && new Date(t.due_date) < new Date()).length;
  const activeProtests = (taxes || []).filter(t => ['filed', 'pending_hearing'].includes(t.protest_status)).length;

  if (isLoading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xl font-display font-bold">${totalBalance.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Balance Due</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-xl font-display font-bold">{overdueCount}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Scale className="w-5 h-5 text-blue-700 dark:text-blue-300" />
          </div>
          <div>
            <p className="text-xl font-display font-bold">{activeProtests}</p>
            <p className="text-xs text-muted-foreground">Active Protests</p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground"><strong>{taxes?.length || 0}</strong> tax records</p>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1" /> Add Tax Year
        </Button>
      </div>

      {/* Table */}
      {(taxes || []).length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Year</TableHead>
                <TableHead className="font-semibold">Assessed Value</TableHead>
                <TableHead className="font-semibold">Tax Amount</TableHead>
                <TableHead className="font-semibold">Paid</TableHead>
                <TableHead className="font-semibold">Balance</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Due Date</TableHead>
                <TableHead className="font-semibold">Protest</TableHead>
                <TableHead className="font-semibold">Tenant</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(taxes || []).map(tax => (
                <TableRow key={tax.id}>
                  <TableCell className="font-medium">{tax.tax_year}</TableCell>
                  <TableCell className="text-sm">{tax.assessed_value ? `$${tax.assessed_value.toLocaleString()}` : '—'}</TableCell>
                  <TableCell className="text-sm">{tax.tax_amount ? `$${tax.tax_amount.toLocaleString()}` : '—'}</TableCell>
                  <TableCell className="text-sm">{tax.amount_paid ? `$${tax.amount_paid.toLocaleString()}` : '—'}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {tax.balance_due != null && tax.balance_due > 0 ? (
                      <span className="text-destructive">${tax.balance_due.toLocaleString()}</span>
                    ) : (
                      <span className="text-success">$0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={PAYMENT_STATUS_COLORS[tax.payment_status] || ''}>
                      {tax.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tax.due_date ? format(new Date(tax.due_date), 'MM/dd/yy') : '—'}
                  </TableCell>
                  <TableCell>
                    {tax.protest_status !== 'none' && (
                      <Badge variant="outline" className={PROTEST_STATUS_COLORS[tax.protest_status] || ''}>
                        {PROTEST_STATUS_LABELS[tax.protest_status]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[120px]">
                    {tax.tenant_responsible ? (tax.tenant_name || 'Yes') : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tax)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTax(tax.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No tax records</h3>
          <p className="text-muted-foreground text-sm mb-4">Add annual tax records to track payments and protests.</p>
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" /> Add Tax Year
          </Button>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Tax Record' : 'Add Tax Year'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tax Year</Label>
                <Input type="number" value={form.tax_year} onChange={e => setForm({ ...form, tax_year: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Assessed Value</Label>
                <Input type="number" placeholder="0" value={form.assessed_value} onChange={e => setForm({ ...form, assessed_value: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tax Amount</Label>
                <Input type="number" placeholder="0" value={form.tax_amount} onChange={e => setForm({ ...form, tax_amount: e.target.value })} />
              </div>
              <div>
                <Label>Amount Paid</Label>
                <Input type="number" placeholder="0" value={form.amount_paid} onChange={e => setForm({ ...form, amount_paid: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Status</Label>
                <Select value={form.payment_status} onValueChange={v => setForm({ ...form, payment_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="exempt">Exempt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Paid Date</Label>
              <Input type="date" value={form.paid_date} onChange={e => setForm({ ...form, paid_date: e.target.value })} />
            </div>

            {/* Protest Section */}
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                <Scale className="w-4 h-4" /> Tax Protest
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Protest Status</Label>
                  <Select value={form.protest_status} onValueChange={v => setForm({ ...form, protest_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="filed">Filed</SelectItem>
                      <SelectItem value="pending_hearing">Pending Hearing</SelectItem>
                      <SelectItem value="decided_favorable">Decided – Favorable</SelectItem>
                      <SelectItem value="decided_unfavorable">Decided – Unfavorable</SelectItem>
                      <SelectItem value="withdrawn">Withdrawn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Filed Date</Label>
                  <Input type="date" value={form.protest_filed_date} onChange={e => setForm({ ...form, protest_filed_date: e.target.value })} />
                </div>
              </div>
              <div className="mt-3">
                <Label>Hearing Date</Label>
                <Input type="date" value={form.protest_hearing_date} onChange={e => setForm({ ...form, protest_hearing_date: e.target.value })} />
              </div>
              <div className="mt-3">
                <Label>Outcome Notes</Label>
                <Textarea placeholder="Protest outcome details..." value={form.protest_outcome_notes} onChange={e => setForm({ ...form, protest_outcome_notes: e.target.value })} />
              </div>
            </div>

            {/* Tenant Section */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="flex items-center gap-1.5">Tenant Responsible</Label>
                <Switch checked={form.tenant_responsible} onCheckedChange={v => setForm({ ...form, tenant_responsible: v })} />
              </div>
              {form.tenant_responsible && (
                <div>
                  <Label>Tenant Name</Label>
                  <Input placeholder="Tenant name" value={form.tenant_name} onChange={e => setForm({ ...form, tenant_name: e.target.value })} />
                </div>
              )}
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>

            <Button className="w-full" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update Record' : 'Add Record'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
