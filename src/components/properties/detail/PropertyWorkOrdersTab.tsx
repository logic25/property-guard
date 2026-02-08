import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Wrench, 
  Plus,
  Loader2,
  Calendar,
  AlertTriangle,
  Link2
} from 'lucide-react';
import { toast } from 'sonner';

interface WorkOrder {
  id: string;
  scope: string;
  status: string;
  created_at: string;
  linked_violation_id: string | null;
  vendor_id: string | null;
}

interface Violation {
  id: string;
  agency: string;
  violation_number: string;
}

interface PropertyWorkOrdersTabProps {
  propertyId: string;
  workOrders: WorkOrder[];
  violations: Violation[];
  onRefresh: () => void;
}

export const PropertyWorkOrdersTab = ({ 
  propertyId, 
  workOrders, 
  violations,
  onRefresh 
}: PropertyWorkOrdersTabProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scope, setScope] = useState('');
  const [linkedViolationId, setLinkedViolationId] = useState<string>('none');

  const handleCreateWorkOrder = async () => {
    if (!scope.trim()) {
      toast.error('Please enter a scope of work');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('work_orders')
        .insert({
          property_id: propertyId,
          scope: scope,
          linked_violation_id: linkedViolationId !== 'none' ? linkedViolationId : null,
          status: 'open',
        });

      if (error) throw error;

      toast.success('Work order created');
      setIsDialogOpen(false);
      setScope('');
      setLinkedViolationId('none');
      onRefresh();
    } catch (error) {
      console.error('Error creating work order:', error);
      toast.error('Failed to create work order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: 'open' | 'in_progress' | 'awaiting_docs' | 'completed') => {
    try {
      const { error } = await supabase
        .from('work_orders')
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-500/10 text-blue-600';
      case 'in_progress': return 'bg-warning/10 text-warning';
      case 'awaiting_docs': return 'bg-purple-500/10 text-purple-600';
      case 'completed': return 'bg-success/10 text-success';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Open';
      case 'in_progress': return 'In Progress';
      case 'awaiting_docs': return 'Awaiting Docs';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  const getLinkedViolation = (violationId: string | null) => {
    if (!violationId) return null;
    return violations.find(v => v.id === violationId);
  };

  return (
    <div className="space-y-6">
      {/* Create Work Order Button */}
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="w-4 h-4" />
              Create Work Order
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Work Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Scope of Work *</Label>
                <Textarea
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  placeholder="Describe the work to be done..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Link to Violation (Optional)</Label>
                <Select value={linkedViolationId} onValueChange={setLinkedViolationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a violation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked violation</SelectItem>
                    {violations.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.agency} #{v.violation_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="hero" 
                  onClick={handleCreateWorkOrder}
                  disabled={isSubmitting || !scope.trim()}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Work Orders List */}
      {workOrders.length > 0 ? (
        <div className="space-y-4">
          {workOrders.map((workOrder) => {
            const linkedViolation = getLinkedViolation(workOrder.linked_violation_id);
            
            return (
              <div
                key={workOrder.id}
                className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Wrench className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground mb-1">
                        {workOrder.scope}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(workOrder.created_at).toLocaleDateString()}
                        </div>
                        {linkedViolation && (
                          <div className="flex items-center gap-1">
                            <Link2 className="w-3 h-3" />
                            <Badge variant="outline" className="text-xs">
                              {linkedViolation.agency} #{linkedViolation.violation_number}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <Select
                    value={workOrder.status}
                    onValueChange={(v) => updateStatus(workOrder.id, v as 'open' | 'in_progress' | 'awaiting_docs' | 'completed')}
                  >
                    <SelectTrigger className={`w-36 h-9 ${getStatusColor(workOrder.status)}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="awaiting_docs">Awaiting Docs</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Wrench className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold text-foreground mb-2">No work orders</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Create work orders to track remediation tasks for this property.
          </p>
          <Button variant="hero" onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Create Work Order
          </Button>
        </div>
      )}
    </div>
  );
};
