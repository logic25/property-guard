import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  FileText, 
  Wrench, 
  Calendar,
  Building2,
  Flame,
  Droplets,
  Cog,
  Shield
} from 'lucide-react';
import { getBoroughName } from '@/lib/property-utils';

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
}

interface Violation {
  id: string;
  status: string;
  cure_due_date: string | null;
  hearing_date: string | null;
  is_stop_work_order: boolean;
  is_vacate_order: boolean;
}

interface Document {
  id: string;
  document_type: string;
}

interface WorkOrder {
  id: string;
  status: string;
}

interface PropertyOverviewTabProps {
  property: Property;
  violations: Violation[];
  documents: Document[];
  workOrders: WorkOrder[];
}

export const PropertyOverviewTab = ({ 
  property, 
  violations, 
  documents, 
  workOrders 
}: PropertyOverviewTabProps) => {
  const openViolations = violations.filter(v => v.status === 'open').length;
  const inProgressViolations = violations.filter(v => v.status === 'in_progress').length;
  const activeWorkOrders = workOrders.filter(w => w.status !== 'completed').length;

  // Find next deadline
  const upcomingDeadlines = violations
    .filter(v => v.cure_due_date && new Date(v.cure_due_date) > new Date())
    .sort((a, b) => new Date(a.cure_due_date!).getTime() - new Date(b.cure_due_date!).getTime());
  
  const nextDeadline = upcomingDeadlines[0];
  const daysUntilDeadline = nextDeadline 
    ? Math.ceil((new Date(nextDeadline.cure_due_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // Calculate compliance score (simple heuristic)
  const criticalIssues = violations.filter(v => v.is_stop_work_order || v.is_vacate_order).length;
  const complianceScore = Math.max(0, 100 - (openViolations * 5) - (criticalIssues * 25));

  const getCOStatusDisplay = (status: string | null | undefined) => {
    switch (status) {
      case 'valid':
        return { icon: '🟢', label: 'Valid Certificate of Occupancy', sublabel: '', className: 'border-success/30 bg-success/5' };
      case 'temporary':
        return { icon: '🟡', label: 'Temporary Certificate of Occupancy', sublabel: 'Check expiration date', className: 'border-warning/30 bg-warning/5' };
      case 'expired_tco':
        return { icon: '🔴', label: 'Expired Temporary CO', sublabel: 'Immediate action required', className: 'border-destructive/30 bg-destructive/5' };
      case 'missing':
        return { icon: '🔴', label: 'No Certificate of Occupancy', sublabel: 'Critical compliance issue', className: 'border-destructive/30 bg-destructive/5' };
      case 'pre_1938':
        return { icon: '🏛️', label: 'Pre-1938 Building', sublabel: 'CO not required', className: 'border-muted bg-muted/30' };
      case 'use_violation':
        return { icon: '🟡', label: 'Use Violation Detected', sublabel: 'Building use differs from CO', className: 'border-warning/30 bg-warning/5' };
      default:
        return { icon: '❔', label: 'CO Status Unknown', sublabel: 'Sync to fetch CO data', className: 'border-muted bg-muted/30' };
    }
  };

  const coStatus = getCOStatusDisplay(property.co_status);

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{openViolations}</p>
                <p className="text-sm text-muted-foreground">Open Violations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {daysUntilDeadline !== null ? `${daysUntilDeadline}d` : '-'}
                </p>
                <p className="text-sm text-muted-foreground">Next Deadline</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{documents.length}</p>
                <p className="text-sm text-muted-foreground">Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{complianceScore}</p>
                <p className="text-sm text-muted-foreground">Compliance Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* CO Status Card */}
        <Card className={`border-2 ${coStatus.className}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-2xl">{coStatus.icon}</span>
              Certificate of Occupancy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-foreground">{coStatus.label}</p>
            {coStatus.sublabel && (
              <p className="text-sm text-muted-foreground mt-1">{coStatus.sublabel}</p>
            )}
            {property.co_data && (
              <div className="mt-4 space-y-2 text-sm">
                {property.co_data.co_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CO Number:</span>
                    <span className="font-medium">{property.co_data.co_number as string}</span>
                  </div>
                )}
                {property.co_data.occupancy_classification && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Occupancy:</span>
                    <span className="font-medium">{property.co_data.occupancy_classification as string}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Building Info Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Building Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {property.borough && (
                <div>
                  <p className="text-muted-foreground">Borough</p>
                  <p className="font-medium">{getBoroughName(property.borough)}</p>
                </div>
              )}
              {property.bin && (
                <div>
                  <p className="text-muted-foreground">BIN</p>
                  <p className="font-medium">{property.bin}</p>
                </div>
              )}
              {property.bbl && (
                <div>
                  <p className="text-muted-foreground">BBL</p>
                  <p className="font-medium">{property.bbl}</p>
                </div>
              )}
              {property.stories && (
                <div>
                  <p className="text-muted-foreground">Stories</p>
                  <p className="font-medium">{property.stories}</p>
                </div>
              )}
              {property.height_ft && (
                <div>
                  <p className="text-muted-foreground">Height</p>
                  <p className="font-medium">{property.height_ft} ft</p>
                </div>
              )}
              {property.gross_sqft && (
                <div>
                  <p className="text-muted-foreground">Gross Sqft</p>
                  <p className="font-medium">{property.gross_sqft.toLocaleString()}</p>
                </div>
              )}
              {property.dwelling_units && (
                <div>
                  <p className="text-muted-foreground">Dwelling Units</p>
                  <p className="font-medium">{property.dwelling_units}</p>
                </div>
              )}
              {property.primary_use_group && (
                <div>
                  <p className="text-muted-foreground">Use Group</p>
                  <p className="font-medium">{property.primary_use_group}</p>
                </div>
              )}
            </div>

            {/* Building Features */}
            <div className="pt-3 border-t border-border">
              <p className="text-sm text-muted-foreground mb-2">Building Features</p>
              <div className="flex flex-wrap gap-2">
                {property.has_gas && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Flame className="w-3 h-3" /> Gas
                  </Badge>
                )}
                {property.has_boiler && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Droplets className="w-3 h-3" /> Boiler
                  </Badge>
                )}
                {property.has_elevator && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Cog className="w-3 h-3" /> Elevator
                  </Badge>
                )}
                {property.has_sprinkler && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Shield className="w-3 h-3" /> Sprinkler
                  </Badge>
                )}
                {!property.has_gas && !property.has_boiler && !property.has_elevator && !property.has_sprinkler && (
                  <span className="text-sm text-muted-foreground">None specified</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Activity Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">Total Violations</p>
              <p className="text-xl font-bold">{violations.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">In Progress</p>
              <p className="text-xl font-bold">{inProgressViolations}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">Active Work Orders</p>
              <p className="text-xl font-bold">{activeWorkOrders}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">Last Synced</p>
              <p className="text-sm font-medium">
                {property.last_synced_at 
                  ? new Date(property.last_synced_at).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
