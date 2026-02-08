import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Mail, MessageSquare } from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  phone_number: string | null;
  trade_type: string | null;
}

interface Violation {
  id: string;
  agency: string;
  violation_number: string;
  description_raw: string | null;
}

interface CreateWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  violation: Violation;
  onSuccess: () => void;
}

export const CreateWorkOrderDialog = ({
  open,
  onOpenChange,
  propertyId,
  violation,
  onSuccess,
}: CreateWorkOrderDialogProps) => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [selectedVendorId, setSelectedVendorId] = useState<string>('none');
  const [scope, setScope] = useState('');
  const [sendSms, setSendSms] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  useEffect(() => {
    if (open) {
      fetchVendors();
      // Pre-fill scope with violation details
      setScope(
        `Resolve ${violation.agency} violation #${violation.violation_number}${
          violation.description_raw ? `\n\nDescription: ${violation.description_raw}` : ''
        }`
      );
    }
  }, [open, violation]);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, phone_number, trade_type')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!scope.trim()) {
      toast.error('Please enter a scope of work');
      return;
    }

    setSubmitting(true);
    try {
      // Create work order
      const { data: workOrder, error: workOrderError } = await supabase
        .from('work_orders')
        .insert({
          property_id: propertyId,
          linked_violation_id: violation.id,
          scope: scope.trim(),
          vendor_id: selectedVendorId === 'none' ? null : selectedVendorId,
          status: 'open',
        })
        .select()
        .single();

      if (workOrderError) throw workOrderError;

      // Update violation status to in_progress
      const { error: violationError } = await supabase
        .from('violations')
        .update({ status: 'in_progress' })
        .eq('id', violation.id);

      if (violationError) throw violationError;

      // Send SMS if selected and vendor has phone
      if (sendSms && selectedVendorId && selectedVendorId !== 'none') {
  const selectedVendor = selectedVendorId !== 'none' ? vendors.find(v => v.id === selectedVendorId) : null;
        if (selectedVendor?.phone_number) {
          try {
            const { error: smsError } = await supabase.functions.invoke('send-sms', {
              body: {
                to: selectedVendor.phone_number,
                message: `New Work Order: ${scope.substring(0, 160)}...`,
              },
            });
            if (smsError) {
              console.error('SMS error:', smsError);
              toast.warning('Work order created but SMS failed to send');
            } else {
              toast.success('SMS sent to vendor');
            }
          } catch (smsErr) {
            console.error('SMS error:', smsErr);
          }
        }
      }

      // TODO: Send email if selected (requires email integration)
      if (sendEmail) {
        toast.info('Email sending coming soon');
      }

      toast.success('Work order created successfully');
      onOpenChange(false);
      onSuccess();
      
      // Reset form
      setSelectedVendorId('none');
      setScope('');
      setSendSms(false);
      setSendEmail(false);
    } catch (error) {
      console.error('Error creating work order:', error);
      toast.error('Failed to create work order');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedVendor = vendors.find(v => v.id === selectedVendorId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Work Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Violation Info */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="font-medium">
              {violation.agency} Violation #{violation.violation_number}
            </div>
            {violation.description_raw && (
              <p className="text-muted-foreground mt-1 line-clamp-2">
                {violation.description_raw}
              </p>
            )}
          </div>

          {/* Vendor Selection */}
          <div className="space-y-2">
            <Label>Assign Vendor (Optional)</Label>
            <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a vendor..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No vendor</SelectItem>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name} {vendor.trade_type && `(${vendor.trade_type})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loading && <p className="text-xs text-muted-foreground">Loading vendors...</p>}
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <Label htmlFor="scope">Scope of Work</Label>
            <Textarea
              id="scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Describe the work to be done..."
              rows={4}
            />
          </div>

          {/* Notification Options */}
          {selectedVendorId && selectedVendor && (
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-sm font-medium">Notify Vendor</Label>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendSms"
                  checked={sendSms}
                  onCheckedChange={(checked) => setSendSms(checked === true)}
                  disabled={!selectedVendor.phone_number}
                />
                <label
                  htmlFor="sendSms"
                  className="text-sm flex items-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  Send SMS
                  {!selectedVendor.phone_number && (
                    <span className="text-muted-foreground">(no phone on file)</span>
                  )}
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendEmail"
                  checked={sendEmail}
                  onCheckedChange={(checked) => setSendEmail(checked === true)}
                  disabled
                />
                <label
                  htmlFor="sendEmail"
                  className="text-sm flex items-center gap-2 cursor-pointer text-muted-foreground"
                >
                  <Mail className="w-4 h-4" />
                  Send Email (coming soon)
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Work Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
