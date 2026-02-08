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
import { Switch } from '@/components/ui/switch';
import { 
  Building2, 
  Plus, 
  Search,
  MapPin,
  Loader2,
  AlertTriangle,
  MoreVertical,
  Pencil,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface Property {
  id: string;
  address: string;
  jurisdiction: 'NYC' | 'NON_NYC';
  stories: number | null;
  use_type: string | null;
  has_gas: boolean;
  has_boiler: boolean;
  has_elevator: boolean;
  has_sprinkler: boolean;
  violations_count?: number;
}

const PropertiesPage = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    address: '',
    jurisdiction: 'NYC' as 'NYC' | 'NON_NYC',
    stories: '',
    use_type: '',
    has_gas: false,
    has_boiler: false,
    has_elevator: false,
    has_sprinkler: false,
  });

  const fetchProperties = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          violations:violations(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const propertiesWithCount = data?.map(p => ({
        ...p,
        violations_count: p.violations?.[0]?.count || 0,
      })) || [];

      setProperties(propertiesWithCount);
    } catch (error) {
      console.error('Error fetching properties:', error);
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('properties').insert({
        user_id: user.id,
        address: formData.address,
        jurisdiction: formData.jurisdiction,
        stories: formData.stories ? parseInt(formData.stories) : null,
        use_type: formData.use_type || null,
        has_gas: formData.has_gas,
        has_boiler: formData.has_boiler,
        has_elevator: formData.has_elevator,
        has_sprinkler: formData.has_sprinkler,
      });

      if (error) throw error;

      toast.success('Property added successfully');
      setIsDialogOpen(false);
      setFormData({
        address: '',
        jurisdiction: 'NYC',
        stories: '',
        use_type: '',
        has_gas: false,
        has_boiler: false,
        has_elevator: false,
        has_sprinkler: false,
      });
      fetchProperties();
    } catch (error) {
      console.error('Error adding property:', error);
      toast.error('Failed to add property');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return;

    try {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
      
      toast.success('Property deleted');
      fetchProperties();
    } catch (error) {
      console.error('Error deleting property:', error);
      toast.error('Failed to delete property');
    }
  };

  const filteredProperties = properties.filter(p =>
    p.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <h1 className="font-display text-3xl font-bold text-foreground">Properties</h1>
          <p className="text-muted-foreground mt-1">
            Manage your buildings and track compliance
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="w-4 h-4" />
              Add Property
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Add New Property</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  placeholder="123 Main Street, New York, NY 10001"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Jurisdiction</Label>
                  <Select
                    value={formData.jurisdiction}
                    onValueChange={(v) => setFormData({ ...formData, jurisdiction: v as 'NYC' | 'NON_NYC' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NYC">NYC</SelectItem>
                      <SelectItem value="NON_NYC">Non-NYC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="use_type">Use Type</Label>
                <Input
                  id="use_type"
                  placeholder="Mixed-use, Retail, Residential..."
                  value={formData.use_type}
                  onChange={(e) => setFormData({ ...formData, use_type: e.target.value })}
                />
              </div>

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
                        checked={formData[feature.key as keyof typeof formData] as boolean}
                        onCheckedChange={(checked) => setFormData({ ...formData, [feature.key]: checked })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="hero" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Property'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search properties..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Properties Grid */}
      {filteredProperties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map((property) => (
            <div
              key={property.id}
              className="bg-card rounded-xl border border-border p-6 shadow-card hover:shadow-card-hover transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => handleDelete(property.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <h3 className="font-display font-semibold text-foreground mb-1 line-clamp-2">
                {property.address}
              </h3>
              
              <div className="flex items-center gap-2 mb-4">
                <span className={`
                  px-2 py-0.5 rounded text-xs font-medium
                  ${property.jurisdiction === 'NYC' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}
                `}>
                  {property.jurisdiction}
                </span>
                {property.use_type && (
                  <span className="text-xs text-muted-foreground">{property.use_type}</span>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-1 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {property.stories ? `${property.stories} stories` : 'N/A'}
                  </span>
                </div>
                {property.violations_count && property.violations_count > 0 ? (
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-destructive/10 text-destructive text-xs font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    {property.violations_count} violation{property.violations_count > 1 ? 's' : ''}
                  </div>
                ) : (
                  <span className="text-xs text-success font-medium">Compliant</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            No properties yet
          </h3>
          <p className="text-muted-foreground mb-6">
            Add your first property to start tracking compliance
          </p>
          <Button variant="hero" onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Add Property
          </Button>
        </div>
      )}
    </div>
  );
};

export default PropertiesPage;
