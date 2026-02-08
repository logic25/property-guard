import { useState } from 'react';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Check, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { SmartAddressAutocomplete } from './SmartAddressAutocomplete';
import { determineApplicableAgencies, getBoroughName, type Agency } from '@/lib/property-utils';
import { Checkbox } from '@/components/ui/checkbox';

interface AddPropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// All agencies that can be tracked
const ALL_AGENCIES: Agency[] = ['DOB', 'ECB', 'HPD', 'FDNY', 'DOT', 'DSNY'];

interface FormData {
  address: string;
  jurisdiction: 'NYC' | 'NON_NYC';
  bin: string;
  bbl: string;
  borough: string;
  block: string;
  lot: string;
  stories: string;
  height_ft: string;
  gross_sqft: string;
  primary_use_group: string;
  dwelling_units: string;
  use_type: string;
  has_gas: boolean;
  has_boiler: boolean;
  has_elevator: boolean;
  has_sprinkler: boolean;
  owner_name: string;
  owner_phone: string;
  sms_enabled: boolean;
  selected_agencies: Agency[];
}

const initialFormData: FormData = {
  address: '',
  jurisdiction: 'NYC',
  bin: '',
  bbl: '',
  borough: '',
  block: '',
  lot: '',
  stories: '',
  height_ft: '',
  gross_sqft: '',
  primary_use_group: '',
  dwelling_units: '',
  use_type: '',
  has_gas: false,
  has_boiler: false,
  has_elevator: false,
  has_sprinkler: false,
  owner_name: '',
  owner_phone: '',
  sms_enabled: false,
  selected_agencies: ['DOB', 'ECB'], // Default agencies
};

export const AddPropertyDialog = ({ open, onOpenChange, onSuccess }: AddPropertyDialogProps) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoPopulated, setAutoPopulated] = useState(false);

  // Suggested agencies based on property type (for showing "Recommended" labels)
  const suggestedAgencies = determineApplicableAgencies(
    formData.primary_use_group,
    formData.dwelling_units ? parseInt(formData.dwelling_units) : null
  );

  const toggleAgency = (agency: Agency) => {
    setFormData(prev => ({
      ...prev,
      selected_agencies: prev.selected_agencies.includes(agency)
        ? prev.selected_agencies.filter(a => a !== agency)
        : [...prev.selected_agencies, agency],
    }));
  };

  const handleAddressSelect = (result: {
    bin: string;
    address: string;
    borough: string;
    bbl: string;
    block: string;
    lot: string;
    stories: number | null;
    heightFt: number | null;
    grossSqft: number | null;
    primaryUseGroup: string | null;
    dwellingUnits: number | null;
  }) => {
    // Calculate agencies based on the building data
    const agencies = determineApplicableAgencies(
      result.primaryUseGroup,
      result.dwellingUnits
    );

    setFormData(prev => ({
      ...prev,
      address: result.address,
      bin: result.bin || '',
      bbl: result.bbl || '',
      borough: result.borough || '',
      block: result.block || '',
      lot: result.lot || '',
      stories: result.stories?.toString() || '',
      height_ft: result.heightFt?.toString() || '',
      gross_sqft: result.grossSqft?.toString() || '',
      primary_use_group: result.primaryUseGroup || '',
      dwelling_units: result.dwellingUnits?.toString() || '',
      selected_agencies: agencies,
    }));
    setAutoPopulated(true);
    toast.success('Building data loaded from NYC DOB', {
      description: `BIN: ${result.bin}`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('properties').insert({
        user_id: user.id,
        address: formData.address,
        jurisdiction: formData.jurisdiction,
        bin: formData.bin || null,
        bbl: formData.bbl || null,
        borough: formData.borough || null,
        stories: formData.stories ? parseInt(formData.stories) : null,
        height_ft: formData.height_ft ? parseInt(formData.height_ft) : null,
        gross_sqft: formData.gross_sqft ? parseInt(formData.gross_sqft) : null,
        primary_use_group: formData.primary_use_group || null,
        dwelling_units: formData.dwelling_units ? parseInt(formData.dwelling_units) : null,
        use_type: formData.use_type || formData.primary_use_group || null,
        has_gas: formData.has_gas,
        has_boiler: formData.has_boiler,
        has_elevator: formData.has_elevator,
        has_sprinkler: formData.has_sprinkler,
        applicable_agencies: formData.selected_agencies,
        owner_name: formData.owner_name || null,
        owner_phone: formData.owner_phone || null,
        sms_enabled: formData.sms_enabled,
      });

      if (error) throw error;

      toast.success('Property added successfully');
      onOpenChange(false);
      setFormData(initialFormData);
      setAutoPopulated(false);
      onSuccess();
    } catch (error) {
      console.error('Error adding property:', error);
      toast.error('Failed to add property');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData(initialFormData);
    setAutoPopulated(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Add New Property
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Jurisdiction Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
            <div>
              <Label className="text-base font-medium">Property Location</Label>
              <p className="text-sm text-muted-foreground">
                NYC properties get automatic address lookup
              </p>
            </div>
            <Select
              value={formData.jurisdiction}
              onValueChange={(v) => {
                setFormData({ ...initialFormData, jurisdiction: v as 'NYC' | 'NON_NYC' });
                setAutoPopulated(false);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NYC">NYC</SelectItem>
                <SelectItem value="NON_NYC">Non-NYC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Address Input */}
          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            {formData.jurisdiction === 'NYC' ? (
              <SmartAddressAutocomplete
                value={formData.address}
                onChange={(v) => setFormData({ ...formData, address: v })}
                onSelect={handleAddressSelect}
                placeholder="Start typing a NYC address..."
              />
            ) : (
              <Input
                id="address"
                placeholder="123 Main Street, City, State ZIP"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            )}
          </div>

          {/* Auto-populated indicator */}
          {autoPopulated && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 text-success text-sm">
              <Check className="w-4 h-4" />
              Building data auto-populated from NYC DOB
            </div>
          )}

          {/* Building Identifiers */}
          {formData.jurisdiction === 'NYC' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bin">BIN</Label>
                <Input
                  id="bin"
                  placeholder="Building ID"
                  value={formData.bin}
                  onChange={(e) => setFormData({ ...formData, bin: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="borough">Borough</Label>
                <Input
                  id="borough"
                  placeholder="Borough"
                  value={formData.borough ? getBoroughName(formData.borough) : ''}
                  onChange={(e) => setFormData({ ...formData, borough: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="block">Block</Label>
                <Input
                  id="block"
                  placeholder="Block #"
                  value={formData.block}
                  onChange={(e) => setFormData({ ...formData, block: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lot">Lot</Label>
                <Input
                  id="lot"
                  placeholder="Lot #"
                  value={formData.lot}
                  onChange={(e) => setFormData({ ...formData, lot: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Building Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stories">Stories</Label>
              <Input
                id="stories"
                type="number"
                placeholder="4"
                value={formData.stories}
                onChange={(e) => setFormData({ ...formData, stories: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height_ft">Height (ft)</Label>
              <Input
                id="height_ft"
                type="number"
                placeholder="45"
                value={formData.height_ft}
                onChange={(e) => setFormData({ ...formData, height_ft: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gross_sqft">Gross Sqft</Label>
              <Input
                id="gross_sqft"
                type="number"
                placeholder="5000"
                value={formData.gross_sqft}
                onChange={(e) => setFormData({ ...formData, gross_sqft: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dwelling_units">Units</Label>
              <Input
                id="dwelling_units"
                type="number"
                placeholder="8"
                value={formData.dwelling_units}
                onChange={(e) => setFormData({ ...formData, dwelling_units: e.target.value })}
              />
            </div>
          </div>

          {/* Owner Information */}
          <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Owner & Contact</span>
              <span className="text-xs text-muted-foreground">(receives SMS alerts)</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner_name">Owner Name</Label>
                <Input
                  id="owner_name"
                  placeholder="ABC Realty LLC"
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner_phone">Owner Phone</Label>
                <Input
                  id="owner_phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={formData.owner_phone}
                  onChange={(e) => setFormData({ ...formData, owner_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Enable SMS Alerts</span>
                <p className="text-xs text-muted-foreground">
                  Get text messages when new violations are detected
                </p>
              </div>
              <Switch
                checked={formData.sms_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, sms_enabled: checked })}
                disabled={!formData.owner_phone}
              />
            </div>
          </div>

          {/* Property Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary_use_group">Use Group</Label>
              <Input
                id="primary_use_group"
                placeholder="R-2, M, B..."
                value={formData.primary_use_group}
                onChange={(e) => setFormData({ ...formData, primary_use_group: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="use_type">Property Type</Label>
              <Input
                id="use_type"
                placeholder="Mixed-use, Retail, Residential..."
                value={formData.use_type}
                onChange={(e) => setFormData({ ...formData, use_type: e.target.value })}
              />
            </div>
          </div>

          {/* Agencies to Track - Always show for NYC */}
          {formData.jurisdiction === 'NYC' && (
            <div className="space-y-3">
              <div>
                <Label>Agencies to Track</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Select which agencies to monitor for violations
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {ALL_AGENCIES.map((agency) => {
                  const isChecked = formData.selected_agencies.includes(agency);
                  const isSuggested = suggestedAgencies.includes(agency);
                  return (
                    <div
                      key={agency}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isChecked 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-muted-foreground/50'
                      }`}
                      onClick={() => toggleAgency(agency)}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleAgency(agency)}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{agency}</span>
                        {isSuggested && (
                          <span className="text-xs text-muted-foreground">Recommended</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Building Features */}
          <div className="space-y-3">
            <Label>Building Features</Label>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'has_gas', label: 'Has Gas' },
                { key: 'has_boiler', label: 'Has Boiler' },
                { key: 'has_elevator', label: 'Has Elevator' },
                { key: 'has_sprinkler', label: 'Has Sprinkler' },
              ].map((feature) => (
                <div key={feature.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <span className="text-sm font-medium">{feature.label}</span>
                  <Switch
                    checked={formData[feature.key as keyof FormData] as boolean}
                    onCheckedChange={(checked) => setFormData({ ...formData, [feature.key]: checked })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="hero" disabled={isSubmitting || !formData.address}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Property'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
