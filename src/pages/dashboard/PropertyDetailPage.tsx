import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Loader2, 
  RefreshCw,
  Building2,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { PropertyOverviewTab } from '@/components/properties/detail/PropertyOverviewTab';
import { PropertyViolationsTab } from '@/components/properties/detail/PropertyViolationsTab';
import { PropertyDocumentsTab } from '@/components/properties/detail/PropertyDocumentsTab';
import { PropertyWorkOrdersTab } from '@/components/properties/detail/PropertyWorkOrdersTab';
import { EditPropertyDialog } from '@/components/properties/EditPropertyDialog';
import { getBoroughName } from '@/lib/property-utils';
import { Badge } from '@/components/ui/badge';

interface Property {
  id: string;
  address: string;
  jurisdiction: 'NYC' | 'NON_NYC';
  bin: string | null;
  bbl: string | null;
  borough: string | null;
  stories: number | null;
  height_ft: number | null;
  gross_sqft: number | null;
  primary_use_group: string | null;
  dwelling_units: number | null;
  use_type: string | null;
  co_status: string | null;
  co_data: Record<string, unknown> | null;
  applicable_agencies: string[] | null;
  has_gas: boolean | null;
  has_boiler: boolean | null;
  has_elevator: boolean | null;
  has_sprinkler: boolean | null;
  compliance_status: string | null;
  last_synced_at: string | null;
  created_at: string;
  owner_name?: string | null;
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
  severity: string | null;
  is_stop_work_order: boolean;
  is_vacate_order: boolean;
}

interface WorkOrder {
  id: string;
  scope: string;
  status: string;
  created_at: string;
  linked_violation_id: string | null;
  vendor_id: string | null;
}

interface Document {
  id: string;
  document_type: string;
  document_name: string;
  file_url: string;
  file_type: string | null;
  file_size_bytes: number | null;
  uploaded_at: string;
  metadata: Record<string, unknown> | null;
}

const PropertyDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const fetchPropertyData = async () => {
    if (!id) return;

    try {
      // Fetch property details
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single();

      if (propertyError) throw propertyError;
      setProperty(propertyData as Property);

      // Fetch related data in parallel
      const [violationsRes, workOrdersRes, documentsRes] = await Promise.all([
        supabase
          .from('violations')
          .select('*')
          .eq('property_id', id)
          .order('issued_date', { ascending: false }),
        supabase
          .from('work_orders')
          .select('*')
          .eq('property_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('property_documents')
          .select('*')
          .eq('property_id', id)
          .order('uploaded_at', { ascending: false }),
      ]);

      if (!violationsRes.error) setViolations(violationsRes.data as Violation[] || []);
      if (!workOrdersRes.error) setWorkOrders(workOrdersRes.data as WorkOrder[] || []);
      if (!documentsRes.error) setDocuments(documentsRes.data as Document[] || []);

    } catch (error) {
      console.error('Error fetching property:', error);
      toast.error('Failed to load property');
      navigate('/dashboard/properties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPropertyData();
  }, [id]);

  const syncViolations = async () => {
    if (!property?.bin) {
      toast.error('Property needs a BIN to sync violations');
      return;
    }

    setIsSyncing(true);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-nyc-violations', {
        body: { 
          bin: property.bin, 
          property_id: property.id,
          applicable_agencies: property.applicable_agencies || ['DOB', 'ECB']
        }
      });

      if (error) throw error;

      if (data?.total_found > 0) {
        toast.success(`Found ${data.total_found} violations from NYC Open Data`);
      } else {
        toast.info('No new violations found');
      }

      await fetchPropertyData();
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Failed to sync violations');
    } finally {
      setIsSyncing(false);
    }
  };

  const getCOStatusDisplay = (status: string | null | undefined) => {
    switch (status) {
      case 'valid':
        return { icon: '🟢', label: 'Valid CO', className: 'bg-success/10 text-success border-success/20' };
      case 'temporary':
        return { icon: '🟡', label: 'Temp CO', className: 'bg-warning/10 text-warning border-warning/20' };
      case 'expired_tco':
        return { icon: '🔴', label: 'Expired TCO', className: 'bg-destructive/10 text-destructive border-destructive/20' };
      case 'missing':
        return { icon: '🔴', label: 'No CO', className: 'bg-destructive/10 text-destructive border-destructive/20' };
      case 'pre_1938':
        return { icon: '🏛️', label: 'Pre-1938', className: 'bg-muted text-muted-foreground border-muted' };
      case 'use_violation':
        return { icon: '🟡', label: 'Use Violation', className: 'bg-warning/10 text-warning border-warning/20' };
      default:
        return { icon: '❔', label: 'Unknown', className: 'bg-muted text-muted-foreground border-muted' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold">Property not found</h2>
        <Button variant="outline" onClick={() => navigate('/dashboard/properties')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Properties
        </Button>
      </div>
    );
  }

  const coStatus = getCOStatusDisplay(property.co_status);
  const openViolations = violations.filter(v => v.status === 'open').length;
  const criticalIssues = violations.filter(v => v.is_stop_work_order || v.is_vacate_order);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/dashboard/properties')}
            className="shrink-0 mt-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {property.address}
                </h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {property.borough && <span>{getBoroughName(property.borough)}</span>}
                  {property.bin && <span>• BIN: {property.bin}</span>}
                  {property.stories && <span>• {property.stories} stories</span>}
                </div>
              </div>
            </div>
            
            {/* Status Badges */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${coStatus.className}`}>
                <span>{coStatus.icon}</span>
                {coStatus.label}
              </span>
              {(property.applicable_agencies || []).map((agency) => (
                <Badge key={agency} variant="outline" className="text-xs">
                  {agency}
                </Badge>
              ))}
              {property.jurisdiction !== 'NYC' && (
                <Badge variant="secondary">Non-NYC</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setEditDialogOpen(true)}
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            onClick={syncViolations}
            disabled={isSyncing || !property.bin}
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isSyncing ? 'Syncing...' : 'Sync Violations'}
          </Button>
        </div>
      </div>

      {/* Critical Alerts */}
      {criticalIssues.length > 0 && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <h3 className="font-semibold text-destructive mb-2">⚠️ Critical Issues</h3>
          <div className="space-y-1">
            {criticalIssues.map((v) => (
              <div key={v.id} className="text-sm text-destructive">
                {v.is_stop_work_order && '🚨 Stop Work Order: '}
                {v.is_vacate_order && '⛔ Vacate Order: '}
                {v.agency} #{v.violation_number}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="violations">
            Violations {openViolations > 0 && `(${openViolations})`}
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents {documents.length > 0 && `(${documents.length})`}
          </TabsTrigger>
          <TabsTrigger value="work-orders">
            Work Orders {workOrders.length > 0 && `(${workOrders.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <PropertyOverviewTab 
            property={property} 
            violations={violations}
            documents={documents}
            workOrders={workOrders}
          />
        </TabsContent>

        <TabsContent value="violations" className="mt-6">
          <PropertyViolationsTab 
            violations={violations} 
            onRefresh={fetchPropertyData}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <PropertyDocumentsTab 
            propertyId={property.id}
            documents={documents}
            onRefresh={fetchPropertyData}
          />
        </TabsContent>

        <TabsContent value="work-orders" className="mt-6">
          <PropertyWorkOrdersTab 
            propertyId={property.id}
            workOrders={workOrders}
            violations={violations}
            onRefresh={fetchPropertyData}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Property Dialog */}
      <EditPropertyDialog
        property={property}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={fetchPropertyData}
      />
    </div>
  );
};

export default PropertyDetailPage;
