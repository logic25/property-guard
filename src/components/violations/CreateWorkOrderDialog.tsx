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
import { Loader2, Mail, MessageSquare, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

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

const TRADE_TYPES = [
  'General Contractor',
  'Electrician',
  'Plumber',
  'HVAC',
  'Roofer',
  'Mason',
  'Carpenter',
  'Painter',
  'Fire Safety',
  'Elevator',
  'Expeditor',
  'Other',
];

export const CreateWorkOrderDialog = ({
  open,
  onOpenChange,
  propertyId,
  violation,
  onSuccess,
}: CreateWorkOrderDialogProps) => {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [selectedVendorId, setSelectedVendorId] = useState<string>('none');
  const [scope, setScope] = useState('');
  const [sendSms, setSendSms] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  // New vendor form
  const [showNewVendorForm, setShowNewVendorForm] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');
  const [newVendorTrade, setNewVendorTrade] = useState('');
  const [creatingVendor, setCreatingVendor] = useState(false);

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

  const handleCreateVendor = async () => {
    if (!newVendorName.trim() || !user) {
      toast.error('Vendor name is required');
      return;
    }

    setCreatingVendor(true);
    try {
      const { data, error } = await supabase
        .from('vendors')
        .insert({
          name: newVendorName.trim(),
          phone_number: newVendorPhone.trim() || null,
          trade_type: newVendorTrade || null,
          user_id: user.id,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Vendor created');
      setVendors(prev => [...prev, data]);
      setSelectedVendorId(data.id);
      setShowNewVendorForm(false);
      setNewVendorName('');
      setNewVendorPhone('');
      setNewVendorTrade('');
    } catch (error) {
      console.error('Error creating vendor:', error);
      toast.error('Failed to create vendor');
    } finally {
      setCreatingVendor(false);
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
        const selectedVendor = vendors.find(v => v.id === selectedVendorId);
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

  const selectedVendor = selectedVendorId !== 'none' ? vendors.find(v => v.id === selectedVendorId) : null;

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
            {!showNewVendorForm ? (
              <div className="flex gap-2">
                <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                  <SelectTrigger className="flex-1">
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
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewVendorForm(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-3 p-3 border rounded-lg bg-secondary/30">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">New Vendor</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNewVendorForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
                <Input
                  placeholder="Vendor name *"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                />
                <Input
                  placeholder="Phone number"
                  type="tel"
                  value={newVendorPhone}
                  onChange={(e) => setNewVendorPhone(e.target.value)}
                />
                <Select value={newVendorTrade} onValueChange={setNewVendorTrade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Trade type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADE_TYPES.map((trade) => (
                      <SelectItem key={trade} value={trade}>
                        {trade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={handleCreateVendor}
                  disabled={creatingVendor || !newVendorName.trim()}
                  className="w-full"
                >
                  {creatingVendor && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Vendor
                </Button>
              </div>
            )}
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
          {selectedVendorId !== 'none' && selectedVendor && (
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
