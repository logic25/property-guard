import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, RefreshCw } from 'lucide-react';

const propertySchema = z.object({
  address: z.string().min(1, 'Address is required').max(500),
  owner_name: z.string().max(200).optional().nullable(),
  bin: z.string().max(20).optional().nullable(),
  block: z.string().max(10).optional().nullable(),
  lot: z.string().max(10).optional().nullable(),
  borough: z.string().max(1).optional().nullable(),
  stories: z.coerce.number().min(0).max(200).optional().nullable(),
  height_ft: z.coerce.number().min(0).max(2000).optional().nullable(),
  gross_sqft: z.coerce.number().min(0).max(100000000).optional().nullable(),
  dwelling_units: z.coerce.number().min(0).max(10000).optional().nullable(),
  primary_use_group: z.string().max(50).optional().nullable(),
  use_type: z.string().max(100).optional().nullable(),
  co_status: z.string().max(50).optional().nullable(),
  has_gas: z.boolean().optional().nullable(),
  has_boiler: z.boolean().optional().nullable(),
  has_elevator: z.boolean().optional().nullable(),
  has_sprinkler: z.boolean().optional().nullable(),
});

// Helper to parse BBL into block and lot (BBL format: borough + block + lot)
const parseBBL = (bbl: string | null): { block: string; lot: string } => {
  if (!bbl) return { block: '', lot: '' };
  // BBL is typically 10 digits: 1 borough + 5 block + 4 lot
  const clean = bbl.replace(/\D/g, '');
  if (clean.length >= 10) {
    return {
      block: clean.substring(1, 6).replace(/^0+/, '') || '0',
      lot: clean.substring(6, 10).replace(/^0+/, '') || '0',
    };
  }
  return { block: '', lot: '' };
};

// Helper to combine borough, block, lot into BBL
const combineToBBL = (borough: string | null, block: string | null, lot: string | null): string | null => {
  if (!borough || !block || !lot) return null;
  const paddedBlock = block.padStart(5, '0');
  const paddedLot = lot.padStart(4, '0');
  return `${borough}${paddedBlock}${paddedLot}`;
};

type PropertyFormData = z.infer<typeof propertySchema>;

interface Property {
  id: string;
  address: string;
  owner_name?: string | null;
  bin: string | null;
  bbl: string | null;
  borough: string | null;
  stories: number | null;
  height_ft: number | null;
  gross_sqft: number | null;
  dwelling_units: number | null;
  primary_use_group: string | null;
  use_type: string | null;
  co_status: string | null;
  has_gas: boolean | null;
  has_boiler: boolean | null;
  has_elevator: boolean | null;
  has_sprinkler: boolean | null;
}

interface EditPropertyDialogProps {
  property: Property;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export const EditPropertyDialog = ({ 
  property, 
  open, 
  onOpenChange, 
  onSave 
}: EditPropertyDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { block: initialBlock, lot: initialLot } = parseBBL(property.bbl);
  
  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      address: property.address,
      owner_name: property.owner_name || '',
      bin: property.bin || '',
      block: initialBlock,
      lot: initialLot,
      borough: property.borough || '',
      stories: property.stories || undefined,
      height_ft: property.height_ft || undefined,
      gross_sqft: property.gross_sqft || undefined,
      dwelling_units: property.dwelling_units || undefined,
      primary_use_group: property.primary_use_group || '',
      use_type: property.use_type || '',
      co_status: property.co_status || '',
      has_gas: property.has_gas || false,
      has_boiler: property.has_boiler || false,
      has_elevator: property.has_elevator || false,
      has_sprinkler: property.has_sprinkler || false,
    },
  });

  // Reset form when property changes
  useEffect(() => {
    const { block, lot } = parseBBL(property.bbl);
    form.reset({
      address: property.address,
      owner_name: property.owner_name || '',
      bin: property.bin || '',
      block,
      lot,
      borough: property.borough || '',
      stories: property.stories || undefined,
      height_ft: property.height_ft || undefined,
      gross_sqft: property.gross_sqft || undefined,
      dwelling_units: property.dwelling_units || undefined,
      primary_use_group: property.primary_use_group || '',
      use_type: property.use_type || '',
      co_status: property.co_status || '',
      has_gas: property.has_gas || false,
      has_boiler: property.has_boiler || false,
      has_elevator: property.has_elevator || false,
      has_sprinkler: property.has_sprinkler || false,
    });
  }, [property, form]);

  // Sync building data from NYC BIS
  const handleSyncBuildingData = async () => {
    const address = form.getValues('address');
    if (!address) {
      toast.error('Please enter an address first');
      return;
    }

    setIsSyncing(true);
    try {
      // Parse address into house number and street
      const parts = address.split(',')[0].trim().split(/\s+/);
      const houseNumber = parts[0];
      const streetQuery = parts.slice(1).join(' ').toUpperCase();

      // NYC DOB BIS-style dataset uses house__ / bin__ / existingno_of_stories, etc.
      const url = new URL('https://data.cityofnewyork.us/resource/ic3t-wcy2.json');

      if (streetQuery) {
        url.searchParams.set(
          '$where',
          `house__ LIKE '%${houseNumber}%' AND upper(street_name) LIKE '%${streetQuery}%'`
        );
      } else {
        url.searchParams.set('$where', `house__ LIKE '%${houseNumber}%'`);
      }
      url.searchParams.set('$limit', '5');

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Failed to fetch building data (${response.status})`);
      }

      const results = await response.json();

      if (!Array.isArray(results) || results.length === 0) {
        toast.error('No building found for this address in NYC BIS');
        return;
      }

      const building = results[0] as Record<string, any>;

      // Update form with fetched data
      form.setValue('bin', building.bin__ || '');
      form.setValue('borough', building.borough || '');
      form.setValue('block', (building.block || '').toString().replace(/^0+/, '') || '0');
      form.setValue('lot', (building.lot || '').toString().replace(/^0+/, '') || '0');
      form.setValue('stories', building.existingno_of_stories ? parseInt(building.existingno_of_stories) : undefined);
      form.setValue('height_ft', building.existing_height ? parseFloat(building.existing_height) : undefined);
      form.setValue('gross_sqft', building.existing_zoning_sqft ? parseFloat(building.existing_zoning_sqft) : undefined);
      form.setValue('dwelling_units', building.existing_dwelling_units ? parseInt(building.existing_dwelling_units) : undefined);
      form.setValue('primary_use_group', building.existing_occupancy || '');

      toast.success(`Synced data for BIN ${building.bin__ || ''}`);
    } catch (error) {
      console.error('Error syncing building data:', error);
      toast.error('Failed to sync building data from NYC BIS');
    } finally {
      setIsSyncing(false);
    }
  };

  const onSubmit = async (data: PropertyFormData) => {
    setIsSubmitting(true);
    
    try {
      // Combine borough, block, lot into BBL
      const bbl = combineToBBL(data.borough, data.block, data.lot);
      
      const updateData = {
        address: data.address,
        owner_name: data.owner_name || null,
        bin: data.bin || null,
        bbl,
        borough: data.borough || null,
        stories: data.stories || null,
        height_ft: data.height_ft || null,
        gross_sqft: data.gross_sqft || null,
        dwelling_units: data.dwelling_units || null,
        primary_use_group: data.primary_use_group || null,
        use_type: data.use_type || null,
        co_status: data.co_status || null,
        has_gas: data.has_gas || false,
        has_boiler: data.has_boiler || false,
        has_elevator: data.has_elevator || false,
        has_sprinkler: data.has_sprinkler || false,
      };

      const { error } = await supabase
        .from('properties')
        .update(updateData)
        .eq('id', property.id);

      if (error) throw error;

      toast.success('Property updated successfully');
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating property:', error);
      toast.error('Failed to update property');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Edit Property</DialogTitle>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={handleSyncBuildingData}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync NYC BIS Data
            </Button>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">Basic Information</h3>
              
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter property address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="owner_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner / Entity Name</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value || ''} 
                        placeholder="e.g., Empire State Realty Trust" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>BIN</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} placeholder="Building ID Number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="block"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Block</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} placeholder="e.g., 835" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lot"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lot</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} placeholder="e.g., 32" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="borough"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Borough</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select borough" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">Manhattan</SelectItem>
                        <SelectItem value="2">Bronx</SelectItem>
                        <SelectItem value="3">Brooklyn</SelectItem>
                        <SelectItem value="4">Queens</SelectItem>
                        <SelectItem value="5">Staten Island</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Building Dimensions */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">Building Dimensions</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="gross_sqft"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Square Feet</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          value={field.value || ''} 
                          placeholder="e.g., 50000" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="height_ft"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Height (ft)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          value={field.value || ''} 
                          placeholder="e.g., 150" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stories"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stories</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          value={field.value || ''} 
                          placeholder="e.g., 10" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dwelling_units"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dwelling Units</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          value={field.value || ''} 
                          placeholder="e.g., 24" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Use & Occupancy */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">Use & Occupancy</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="primary_use_group"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Use Group</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ''} 
                          placeholder="e.g., R-2, B, M" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="use_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Use Type</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ''} 
                          placeholder="e.g., Residential, Commercial" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="co_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CO Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select CO status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="valid">Valid CO</SelectItem>
                        <SelectItem value="temporary">Temporary CO</SelectItem>
                        <SelectItem value="expired_tco">Expired TCO</SelectItem>
                        <SelectItem value="missing">No CO</SelectItem>
                        <SelectItem value="pre_1938">Pre-1938 (Not Required)</SelectItem>
                        <SelectItem value="use_violation">Use Violation</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Building Features */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">Building Features</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="has_gas"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel className="text-sm font-normal">Gas Service</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value || false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="has_boiler"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel className="text-sm font-normal">Boiler</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value || false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="has_elevator"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel className="text-sm font-normal">Elevator</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value || false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="has_sprinkler"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel className="text-sm font-normal">Sprinkler System</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value || false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
