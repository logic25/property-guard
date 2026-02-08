import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Loader2, 
  Building2,
  Plus,
  FolderOpen,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { PortfolioViolationsView } from '@/components/portfolios/PortfolioViolationsView';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { CreatePortfolioDialog } from '@/components/portfolios/CreatePortfolioDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface Property {
  id: string;
  address: string;
  borough: string | null;
  stories: number | null;
  portfolio_id: string | null;
}

interface Violation {
  id: string;
  agency: string;
  violation_number: string;
  issued_date: string;
  status: string;
  description_raw: string | null;
  cure_due_date: string | null;
  hearing_date: string | null;
  is_stop_work_order: boolean;
  is_vacate_order: boolean;
  property_id: string;
}

const PortfolioDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [violations, setViolations] = useState<(Violation & { property_address?: string })[]>([]);
  const [availableProperties, setAvailableProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('violations');
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const fetchData = async () => {
    if (!id) return;

    try {
      // Fetch portfolio
      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolios')
        .select('*')
        .eq('id', id)
        .single();

      if (portfolioError) throw portfolioError;
      setPortfolio(portfolioData);

      // Fetch properties in this portfolio
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('id, address, borough, stories, portfolio_id')
        .eq('portfolio_id', id)
        .order('address');

      if (propertiesError) throw propertiesError;
      setProperties(propertiesData || []);

      // Fetch available properties (not in any portfolio)
      const { data: availableData } = await supabase
        .from('properties')
        .select('id, address, borough, stories, portfolio_id')
        .is('portfolio_id', null)
        .order('address');

      setAvailableProperties(availableData || []);

      // Fetch all violations for properties in this portfolio
      if (propertiesData && propertiesData.length > 0) {
        const propertyIds = propertiesData.map(p => p.id);
        const { data: violationsData, error: violationsError } = await supabase
          .from('violations')
          .select('*')
          .in('property_id', propertyIds)
          .order('issued_date', { ascending: false });

        if (violationsError) throw violationsError;

        // Add property address to each violation
        const violationsWithAddress = (violationsData || []).map(v => ({
          ...v,
          property_address: propertiesData.find(p => p.id === v.property_id)?.address,
        }));

        setViolations(violationsWithAddress);
      } else {
        setViolations([]);
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      toast.error('Failed to load portfolio');
      navigate('/dashboard/portfolios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const addPropertyToPortfolio = async (propertyId: string) => {
    try {
      const { error } = await supabase
        .from('properties')
        .update({ portfolio_id: id })
        .eq('id', propertyId);

      if (error) throw error;

      toast.success('Property added to portfolio');
      fetchData();
    } catch (error) {
      console.error('Error adding property:', error);
      toast.error('Failed to add property');
    }
  };

  const removePropertyFromPortfolio = async (propertyId: string) => {
    try {
      const { error } = await supabase
        .from('properties')
        .update({ portfolio_id: null })
        .eq('id', propertyId);

      if (error) throw error;

      toast.success('Property removed from portfolio');
      fetchData();
    } catch (error) {
      console.error('Error removing property:', error);
      toast.error('Failed to remove property');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold">Portfolio not found</h2>
        <Button variant="outline" onClick={() => navigate('/dashboard/portfolios')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Portfolios
        </Button>
      </div>
    );
  }

  const openViolations = violations.filter(v => v.status === 'open').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/dashboard/portfolios')}
            className="shrink-0 mt-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {portfolio.name}
                </h1>
                {portfolio.description && (
                  <p className="text-sm text-muted-foreground">{portfolio.description}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="secondary">
                <Building2 className="w-3 h-3 mr-1" />
                {properties.length} Properties
              </Badge>
              {openViolations > 0 && (
                <Badge variant="destructive">
                  {openViolations} Open Violations
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Button variant="outline" size="icon" onClick={() => setEditDialogOpen(true)}>
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="violations">
            All Violations {violations.length > 0 && `(${violations.length})`}
          </TabsTrigger>
          <TabsTrigger value="properties">
            Properties {properties.length > 0 && `(${properties.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="violations" className="mt-6">
          <PortfolioViolationsView 
            violations={violations} 
            portfolioName={portfolio.name}
          />
        </TabsContent>

        <TabsContent value="properties" className="mt-6">
          <div className="space-y-4">
            {/* Add Property */}
            {availableProperties.length > 0 && (
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <Plus className="w-5 h-5 text-muted-foreground" />
                <Select onValueChange={addPropertyToPortfolio}>
                  <SelectTrigger className="flex-1 max-w-md">
                    <SelectValue placeholder="Add property to portfolio..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProperties.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Property List */}
            {properties.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {properties.map(property => (
                  <div key={property.id} className="relative group">
                    <div 
                      className="bg-card rounded-xl border border-border p-6 shadow-card hover:shadow-card-hover transition-shadow cursor-pointer"
                      onClick={() => navigate(`/dashboard/properties/${property.id}`)}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{property.address}</h3>
                          <p className="text-sm text-muted-foreground">
                            {property.borough && `${property.borough} • `}
                            {property.stories ? `${property.stories} stories` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {violations.filter(v => v.property_id === property.id).length} violations
                        </Badge>
                        {violations.filter(v => v.property_id === property.id && v.status === 'open').length > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {violations.filter(v => v.property_id === property.id && v.status === 'open').length} open
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePropertyFromPortfolio(property.id);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold text-foreground mb-2">No properties in this portfolio</h3>
                <p className="text-muted-foreground text-sm">
                  Add properties from the dropdown above to include them in this portfolio.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <CreatePortfolioDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchData}
        editPortfolio={portfolio}
      />
    </div>
  );
};

export default PortfolioDetailPage;
