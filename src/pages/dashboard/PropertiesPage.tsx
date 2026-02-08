import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Building2, 
  Plus, 
  Search,
  Loader2,
  AlertTriangle,
  LayoutGrid,
  TableIcon,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { AddPropertyDialog } from '@/components/properties/AddPropertyDialog';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { getBoroughName } from '@/lib/property-utils';

interface Property {
  id: string;
  address: string;
  jurisdiction: 'NYC' | 'NON_NYC';
  stories: number | null;
  use_type: string | null;
  bin: string | null;
  bbl: string | null;
  borough: string | null;
  primary_use_group: string | null;
  dwelling_units: number | null;
  co_status: string | null;
  applicable_agencies: string[] | null;
  has_gas: boolean;
  has_boiler: boolean;
  has_elevator: boolean;
  has_sprinkler: boolean;
  violations_count?: number;
  last_synced_at?: string | null;
}

type ViewMode = 'table' | 'cards';

const PropertiesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('propertiesViewMode') as ViewMode) || 'table';
  });

  const fetchProperties = async () => {
    if (!user) return;

    try {
      // First fetch properties
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (propertiesError) throw propertiesError;

      // Then fetch open violation counts for each property
      const propertyIds = propertiesData?.map(p => p.id) || [];
      
      let violationCounts: Record<string, number> = {};
      
      if (propertyIds.length > 0) {
        const { data: violationsData, error: violationsError } = await supabase
          .from('violations')
          .select('property_id')
          .in('property_id', propertyIds)
          .neq('status', 'closed'); // Only count non-closed violations
        
        if (!violationsError && violationsData) {
          // Count violations per property
          violationsData.forEach(v => {
            violationCounts[v.property_id] = (violationCounts[v.property_id] || 0) + 1;
          });
        }
      }

      const propertiesWithCount = propertiesData?.map(p => ({
        ...p,
        violations_count: violationCounts[p.id] || 0,
      })) || [];

      setProperties(propertiesWithCount as unknown as Property[]);
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

  useEffect(() => {
    localStorage.setItem('propertiesViewMode', viewMode);
  }, [viewMode]);

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

  const syncAllViolations = async () => {
    const propertiesWithBin = properties.filter(p => p.bin && p.jurisdiction === 'NYC');
    
    if (propertiesWithBin.length === 0) {
      toast.error('No NYC properties have a BIN. Add BIN to properties to sync violations.');
      return;
    }

    setIsSyncing(true);
    let totalNew = 0;
    let errors = 0;

    try {
      for (const property of propertiesWithBin) {
        try {
          const { data, error } = await supabase.functions.invoke('fetch-nyc-violations', {
            body: { 
              bin: property.bin, 
              property_id: property.id,
              applicable_agencies: property.applicable_agencies || ['DOB', 'ECB']
            }
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
        toast.success(`Found ${totalNew} violations from NYC Open Data.`);
      } else {
        toast.info('No new violations found.');
      }

      await fetchProperties();
    } catch (error) {
      console.error('Error during sync:', error);
      toast.error('Failed to sync violations');
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredProperties = properties.filter(p =>
    p.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.borough?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.bin?.includes(searchQuery)
  );

  const getCOStatusDisplay = (status: string | null | undefined) => {
    switch (status) {
      case 'valid':
        return { icon: '🟢', label: 'Valid CO', className: 'bg-success/10 text-success' };
      case 'temporary':
        return { icon: '🟡', label: 'Temp CO', className: 'bg-warning/10 text-warning' };
      case 'expired_tco':
        return { icon: '🔴', label: 'Expired', className: 'bg-destructive/10 text-destructive' };
      case 'missing':
        return { icon: '🔴', label: 'No CO', className: 'bg-destructive/10 text-destructive' };
      case 'pre_1938':
        return { icon: '🏛️', label: 'Pre-1938', className: 'bg-muted text-muted-foreground' };
      case 'use_violation':
        return { icon: '🟡', label: 'Use Viol.', className: 'bg-warning/10 text-warning' };
      default:
        return { icon: '❔', label: 'Unknown', className: 'bg-muted text-muted-foreground' };
    }
  };

  const getPropertyTypeDisplay = (property: Property) => {
    const useGroup = property.primary_use_group || '';
    const units = property.dwelling_units;
    const stories = property.stories;
    
    // Show use group with units if residential
    if (useGroup.includes('R-2') || useGroup.includes('R-1')) {
      return `${useGroup}${units ? ` (${units} units)` : ''}`;
    }
    if (useGroup) return useGroup;
    if (property.use_type) return property.use_type;
    // Fallback to stories if available
    if (stories) return `${stories}-story building`;
    return '-';
  };

  const formatLastSynced = (date: string | null | undefined) => {
    if (!date) return '-';
    const syncDate = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return syncDate.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Properties</h1>
          <p className="text-muted-foreground mt-1">
            Manage your buildings and track compliance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={syncAllViolations}
            disabled={isSyncing || properties.length === 0}
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isSyncing ? 'Syncing...' : 'Sync All'}
          </Button>
          <Button variant="hero" onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Add Property
          </Button>
        </div>
      </div>

      {/* Search and View Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by address, borough, or BIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-muted/30">
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="h-8 px-3"
          >
            <TableIcon className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('cards')}
            className="h-8 px-3"
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Properties Display */}
      {filteredProperties.length > 0 ? (
        viewMode === 'table' ? (
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Address</TableHead>
                  <TableHead className="font-semibold">Borough</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">CO Status</TableHead>
                  <TableHead className="font-semibold">Agencies</TableHead>
                  <TableHead className="font-semibold text-center">Violations</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Last Synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProperties.map((property) => {
                  const coStatus = getCOStatusDisplay(property.co_status);
                  const violationsCount = property.violations_count || 0;
                  
                  return (
                    <TableRow 
                      key={property.id} 
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/dashboard/properties/${property.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground line-clamp-1">
                              {property.address}
                            </div>
                            {property.bin && (
                              <div className="text-xs text-muted-foreground">
                                BIN: {property.bin}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {property.jurisdiction === 'NYC' ? (
                          <span className="text-sm">
                            {property.borough ? getBoroughName(property.borough) : 'NYC'}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Non-NYC</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getPropertyTypeDisplay(property)}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${coStatus.className}`}>
                          <span>{coStatus.icon}</span>
                          {coStatus.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(property.applicable_agencies || []).slice(0, 3).map((agency) => (
                            <Badge key={agency} variant="outline" className="text-[10px] px-1.5 py-0">
                              {agency}
                            </Badge>
                          ))}
                          {(property.applicable_agencies || []).length > 3 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              +{(property.applicable_agencies || []).length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {violationsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-destructive/10 text-destructive text-xs font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            {violationsCount}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {violationsCount > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            Issues
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs bg-success/10 text-success border-0">
                            Compliant
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatLastSynced(property.last_synced_at)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProperties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )
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

      <AddPropertyDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={fetchProperties}
      />
    </div>
  );
};

export default PropertiesPage;
