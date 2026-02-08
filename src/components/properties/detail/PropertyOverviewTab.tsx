import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  AlertTriangle, 
  FileText, 
  Wrench, 
  Calendar,
  Building2,
  Flame,
  Droplets,
  Cog,
  Shield,
  User,
  Ruler,
  Layers,
  Home,
  Landmark,
  Scale,
  ChevronDown,
  Ban
} from 'lucide-react';
import { getBoroughName } from '@/lib/property-utils';
import { isActiveViolation } from '@/lib/violation-utils';
import { LeaseQAWidget } from '@/components/lease/LeaseQAWidget';

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
  owner_name?: string | null;
  
  // Comprehensive fields
  zoning_district?: string | null;
  overlay_district?: string | null;
  special_district?: string | null;
  commercial_overlay?: string | null;
  lot_area_sqft?: number | null;
  building_area_sqft?: number | null;
  residential_area_sqft?: number | null;
  commercial_area_sqft?: number | null;
  floor_area_ratio?: number | null;
  max_floor_area_ratio?: number | null;
  air_rights_sqft?: number | null;
  unused_far?: number | null;
  
  building_class?: string | null;
  occupancy_group?: string | null;
  year_built?: number | null;
  
  cross_streets?: string | null;
  community_board?: string | null;
  council_district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  
  is_landmark?: boolean | null;
  landmark_status?: string | null;
  historic_district?: string | null;
  
  loft_law?: boolean | null;
  sro_restricted?: boolean | null;
  ta_restricted?: boolean | null;
  ub_restricted?: boolean | null;
  is_city_owned?: boolean | null;
  professional_cert_restricted?: boolean | null;
  
  assessed_land_value?: number | null;
  assessed_total_value?: number | null;
  number_of_buildings?: number | null;
}

interface Violation {
  id: string;
  status: string;
  oath_status?: string | null;
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
  const [zoningOpen, setZoningOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  
  // Filter to only active violations
  const activeViolations = violations.filter(isActiveViolation);
  
  const openViolations = activeViolations.filter(v => v.status === 'open').length;
  const inProgressViolations = activeViolations.filter(v => v.status === 'in_progress').length;
  const activeWorkOrders = workOrders.filter(w => w.status !== 'completed').length;

  // Find next deadline from active violations
  const upcomingDeadlines = activeViolations
    .filter(v => v.cure_due_date && new Date(v.cure_due_date) > new Date())
    .sort((a, b) => new Date(a.cure_due_date!).getTime() - new Date(b.cure_due_date!).getTime());
  
  const nextDeadline = upcomingDeadlines[0];
  const daysUntilDeadline = nextDeadline 
    ? Math.ceil((new Date(nextDeadline.cure_due_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // Calculate compliance score based on active violations
  const criticalIssues = activeViolations.filter(v => v.is_stop_work_order || v.is_vacate_order).length;
  const complianceScore = Math.max(0, 100 - (openViolations * 5) - (criticalIssues * 25));

  const getCOStatusBadge = (status: string | null | undefined) => {
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

  const coStatus = getCOStatusBadge(property.co_status);

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  const hasRestrictions = property.loft_law || property.sro_restricted || property.ta_restricted || property.ub_restricted;
  const hasZoningData = property.zoning_district || property.lot_area_sqft || property.floor_area_ratio;

  return (
    <div className="space-y-6">
      {/* Quick Stats Row */}
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

      {/* Building Details Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Building Details
            </CardTitle>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${coStatus.className}`}>
              <span>{coStatus.icon}</span>
              {coStatus.label}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Core Building Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Owner / Entity</p>
                <p className="font-medium text-sm">{property.owner_name || 'Not specified'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Year Built</p>
                <p className="font-medium text-sm">{property.year_built || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Building Class</p>
                <p className="font-medium text-sm">{property.building_class || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Home className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Occupancy Group</p>
                <p className="font-medium text-sm">{property.occupancy_group || property.primary_use_group || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Stories</p>
                <p className="font-medium text-sm">{property.stories || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Ruler className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Height</p>
                <p className="font-medium text-sm">{property.height_ft ? `${property.height_ft} ft` : '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Home className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Dwelling Units</p>
                <p className="font-medium text-sm">
                  {property.dwelling_units === 0 || property.dwelling_units === null ? 'N/A' : property.dwelling_units}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">BIN</p>
              <p className="font-medium text-sm font-mono">{property.bin || '-'}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Borough / Block / Lot</p>
              <p className="font-medium text-sm font-mono">
                {property.bbl ? (
                  <>
                    {getBoroughName(property.bbl.charAt(0))} / {property.bbl.substring(1, 6).replace(/^0+/, '')} / {property.bbl.substring(6, 10).replace(/^0+/, '')}
                  </>
                ) : '-'}
              </p>
            </div>

            <div className="col-span-2 md:col-span-3">
              <p className="text-xs text-muted-foreground">Cross Streets</p>
              <p className="font-medium text-sm">{property.cross_streets || '-'}</p>
            </div>
          </div>

          {/* Building Features */}
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Building Features</p>
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

          {/* Collapsible: Zoning & Area */}
          <Collapsible open={zoningOpen} onOpenChange={setZoningOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Scale className="w-4 h-4 text-muted-foreground" />
                Zoning & Area
                {hasZoningData && (
                  <Badge variant="secondary" className="text-xs ml-2">
                    {property.zoning_district || 'Data Available'}
                  </Badge>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${zoningOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Zoning District</p>
                  <p className="font-medium">{property.zoning_district || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Overlay District</p>
                  <p className="font-medium">{property.overlay_district || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Special District</p>
                  <p className="font-medium">{property.special_district || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Commercial Overlay</p>
                  <p className="font-medium">{property.commercial_overlay || '-'}</p>
                </div>
                <div className="flex items-start gap-2">
                  <Layers className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Lot Area</p>
                    <p className="font-medium">{formatNumber(property.lot_area_sqft)} sf</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Layers className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Building Area</p>
                    <p className="font-medium">{formatNumber(property.building_area_sqft || property.gross_sqft)} sf</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Built FAR</p>
                  <p className="font-medium">{property.floor_area_ratio?.toFixed(2) || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Max FAR</p>
                  <p className="font-medium">{property.max_floor_area_ratio?.toFixed(2) || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Unused Air Rights</p>
                  <p className="font-medium">
                    {property.air_rights_sqft ? `${formatNumber(property.air_rights_sqft)} sf` : '-'}
                    {property.unused_far ? ` (${property.unused_far.toFixed(2)} FAR)` : ''}
                  </p>
                </div>
                {(property.residential_area_sqft || property.commercial_area_sqft) && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Area Breakdown</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {property.residential_area_sqft && property.residential_area_sqft > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          Residential: {formatNumber(property.residential_area_sqft)} sf
                        </Badge>
                      )}
                      {property.commercial_area_sqft && property.commercial_area_sqft > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          Commercial: {formatNumber(property.commercial_area_sqft)} sf
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Collapsible: Status & Restrictions */}
          <Collapsible open={statusOpen} onOpenChange={setStatusOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Landmark className="w-4 h-4 text-muted-foreground" />
                Status & Restrictions
                {(property.is_landmark || hasRestrictions) && (
                  <Badge variant="destructive" className="text-xs ml-2">
                    {property.is_landmark ? 'Landmark' : 'Restrictions Apply'}
                  </Badge>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Landmark Status</p>
                  <p className="font-medium">
                    {property.is_landmark ? (
                      <Badge variant="default" className="bg-amber-500">Landmark</Badge>
                    ) : (
                      property.landmark_status || 'Not Landmarked'
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Historic District</p>
                  <p className="font-medium">{property.historic_district || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">City Owned</p>
                  <p className="font-medium">{property.is_city_owned ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pro Cert Restricted</p>
                  <p className="font-medium">{property.professional_cert_restricted ? 'Yes' : 'No'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Regulatory Restrictions</p>
                <div className="flex flex-wrap gap-2">
                  {property.loft_law && (
                    <Badge variant="destructive" className="text-xs gap-1">
                      <Ban className="w-3 h-3" /> Loft Law
                    </Badge>
                  )}
                  {property.sro_restricted && (
                    <Badge variant="destructive" className="text-xs gap-1">
                      <Ban className="w-3 h-3" /> SRO Restricted
                    </Badge>
                  )}
                  {property.ta_restricted && (
                    <Badge variant="destructive" className="text-xs gap-1">
                      <Ban className="w-3 h-3" /> TA Restricted
                    </Badge>
                  )}
                  {property.ub_restricted && (
                    <Badge variant="destructive" className="text-xs gap-1">
                      <Ban className="w-3 h-3" /> UB Restricted
                    </Badge>
                  )}
                  {!hasRestrictions && (
                    <span className="text-sm text-muted-foreground">No restrictions</span>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

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

      {/* Lease Q&A Widget */}
      <LeaseQAWidget propertyId={property.id} />
    </div>
  );
};
