import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileStack, Search, ExternalLink, ChevronRight, ChevronDown, Calendar, User, DollarSign, Building2, FileText, ShieldCheck, Wrench, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface PropertyApplicationsTabProps {
  propertyId: string;
}

interface Application {
  id: string;
  application_number: string;
  application_type: string;
  agency: string;
  source: string;
  status: string | null;
  filing_date: string | null;
  approval_date: string | null;
  expiration_date: string | null;
  job_type: string | null;
  work_type: string | null;
  description: string | null;
  applicant_name: string | null;
  owner_name: string | null;
  estimated_cost: number | null;
  stories: number | null;
  dwelling_units: number | null;
  floor_area: number | null;
  raw_data: Record<string, unknown> | null;
}

// DOB BIS job status codes decoded
const BIS_STATUS_CODES: Record<string, string> = {
  'A': 'Pre-Filing',
  'B': 'Plan Examination',
  'C': 'Plan Exam Approval Pending',
  'D': 'Plan Approved',
  'E': 'Partial Permit Issued',
  'F': 'Permit Issued - Entire',
  'G': 'Permit Renewed',
  'H': 'Completed',
  'I': 'Signed Off',
  'J': 'Letter of Completion',
  'K': 'CO Issued',
  'L': 'Withdrawn',
  'M': 'Disapproved',
  'N': 'Suspended',
  'P': 'Permit Expired',
  'Q': 'Partial Permit',
  'R': 'Plan Exam - Incomplete',
  'X': 'Signed Off / Completed',
};

const decodeStatus = (status: string | null, source: string): string => {
  if (!status) return 'Unknown';
  if (source === 'DOB BIS' && status.length <= 2) {
    return BIS_STATUS_CODES[status.toUpperCase()] || status;
  }
  return status;
};

const getStatusVariant = (status: string | null, source: string) => {
  const decoded = decodeStatus(status, source).toLowerCase();
  if (['signed off', 'completed', 'co issued', 'letter of completion', 'permit issued', 'permit entire', 'issued'].some(s => decoded.includes(s))) {
    return 'default' as const;
  }
  if (['pre-filing', 'plan exam', 'partial permit', 'pending', 'filed', 'in review', 'plan approved'].some(s => decoded.includes(s))) {
    return 'secondary' as const;
  }
  if (['disapproved', 'withdrawn', 'suspended', 'expired', 'denied', 'cancelled'].some(s => decoded.includes(s))) {
    return 'destructive' as const;
  }
  return 'outline' as const;
};

const getAgencyColor = (agency: string) => {
  const colors: Record<string, string> = {
    DOB: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    FDNY: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    HPD: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    DEP: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    DOT: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  };
  return colors[agency] || 'bg-muted text-muted-foreground';
};

const getDOBNowBuildUrl = (appNumber: string) =>
  `https://a810-dobnow.nyc.gov/Publish/#!/job/${appNumber}`;

const getDOBBisUrl = (appNumber: string) =>
  `https://a810-bisweb.nyc.gov/bisweb/JobsQueryByNumberServlet?passjobnumber=${appNumber}`;

export const PropertyApplicationsTab = ({ propertyId }: PropertyApplicationsTabProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [statusFilterInit, setStatusFilterInit] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: applications, isLoading } = useQuery({
    queryKey: ['property-applications', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('property_id', propertyId)
        .order('filing_date', { ascending: false });

      if (error) throw error;
      return data as Application[];
    },
  });

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const agencies = useMemo(() => [...new Set(applications?.map(a => a.agency) || [])].sort(), [applications]);
  const statuses = useMemo(() => [...new Set(applications?.map(a => decodeStatus(a.status, a.source)).filter(Boolean) || [])].sort() as string[], [applications]);

  // Closed/completed statuses to exclude by default
  const COMPLETED_STATUSES = ['Signed Off', 'Signed Off / Completed', 'Completed', 'CO Issued', 'Letter of Completion'];

  // Initialize default filter: exclude completed statuses
  useEffect(() => {
    if (statuses.length > 0 && !statusFilterInit) {
      const defaults = new Set(
        statuses.filter(s => !COMPLETED_STATUSES.some(cs => s.toLowerCase().includes(cs.toLowerCase())))
      );
      setSelectedStatuses(defaults);
      setStatusFilterInit(true);
    }
  }, [statuses, statusFilterInit]);

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const selectAllStatuses = () => setSelectedStatuses(new Set(statuses));
  const clearAllStatuses = () => setSelectedStatuses(new Set());

  const filtered = useMemo(() => {
    return (applications || []).filter(app => {
      const matchesSearch = !searchQuery ||
        app.application_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.applicant_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAgency = agencyFilter === 'all' || app.agency === agencyFilter;
      const decodedStatus = decodeStatus(app.status, app.source);
      const matchesStatus = selectedStatuses.size === 0 || selectedStatuses.has(decodedStatus);
      return matchesSearch && matchesAgency && matchesStatus;
    });
  }, [applications, searchQuery, agencyFilter, selectedStatuses]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const renderBuildDetails = (app: Application) => {
    const raw = app.raw_data || {};
    const filingStatus = app.status || '';
    const isPermitted = filingStatus.toLowerCase().includes('permit');

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        {/* Dates & Permit Info */}
        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Dates & Permit
          </h4>
          <div className="space-y-1 text-muted-foreground">
            <p>Filed: <span className="text-foreground">{app.filing_date ? format(new Date(app.filing_date), 'MMM d, yyyy') : '—'}</span></p>
            <p>Approved: <span className="text-foreground">{app.approval_date ? format(new Date(app.approval_date), 'MMM d, yyyy') : '—'}</span></p>
            {raw.first_permit_date && (
              <p>First Permit: <span className="text-foreground">{format(new Date(raw.first_permit_date as string), 'MMM d, yyyy')}</span></p>
            )}
            <p>Expires: <span className="text-foreground">{app.expiration_date ? format(new Date(app.expiration_date), 'MMM d, yyyy') : '—'}</span></p>
            {raw.signoff_date && (
              <p>Sign-Off: <span className="text-foreground">{raw.signoff_date as string}</span></p>
            )}
            {isPermitted && (
              <p className="text-success font-medium">✓ Permitted</p>
            )}
          </div>
        </div>

        {/* Applicant */}
        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            Applicant
          </h4>
          <div className="space-y-1 text-muted-foreground">
            <p>Name: <span className="text-foreground">{app.applicant_name || '—'}</span></p>
            {raw.applicant_title && (
              <p>Title: <span className="text-foreground">{raw.applicant_title as string}</span></p>
            )}
            {raw.applicant_license && (
              <p>License #: <span className="text-foreground">{raw.applicant_license as string}</span></p>
            )}
            {(raw.applicant_business_name || raw.applicant_business) && (
              <p>Company: <span className="text-foreground">{(raw.applicant_business_name || raw.applicant_business) as string}</span></p>
            )}
            {raw.applicant_phone && (
              <p>Phone: <span className="text-foreground">{raw.applicant_phone as string}</span></p>
            )}
            {raw.applicant_email && (
              <p>Email: <span className="text-foreground">{raw.applicant_email as string}</span></p>
            )}
            {raw.firm_name && (
              <p>Firm: <span className="text-foreground">{raw.firm_name as string}</span></p>
            )}
            {raw.license_type && (
              <p>License Type: <span className="text-foreground">{raw.license_type as string} {raw.license_number ? `#${raw.license_number}` : ''}</span></p>
            )}
          </div>
        </div>

        {/* Filing Rep / Owner */}
        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Owner / Filing Rep
          </h4>
          <div className="space-y-1 text-muted-foreground">
            <p>Owner: <span className="text-foreground">{app.owner_name || '—'}</span></p>
            {raw.filing_rep_name && (
              <p>Filing Rep: <span className="text-foreground">{raw.filing_rep_name as string}</span></p>
            )}
            {raw.filing_rep_company && (
              <p>Company: <span className="text-foreground">{raw.filing_rep_company as string}</span></p>
            )}
            {raw.design_professional && (
              <p>Design Prof: <span className="text-foreground">{raw.design_professional as string}</span></p>
            )}
            {raw.design_professional_license && (
              <p>License: <span className="text-foreground">{raw.design_professional_license as string}</span></p>
            )}
          </div>
        </div>

        {/* Cost & Work */}
        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            Cost & Scope
          </h4>
          <div className="space-y-1 text-muted-foreground">
            <p>Est. Cost: <span className="text-foreground">{app.estimated_cost ? `$${app.estimated_cost.toLocaleString()}` : '—'}</span></p>
            {app.floor_area != null && app.floor_area > 0 && (
              <p>Floor Area: <span className="text-foreground">{app.floor_area.toLocaleString()} sqft</span></p>
            )}
            {raw.apt_condo && (
              <p>Apt/Condo #: <span className="text-foreground">{raw.apt_condo as string}</span></p>
            )}
            {raw.work_on_floor && (
              <p>Work Location: <span className="text-foreground">{raw.work_on_floor as string}</span></p>
            )}
          </div>
        </div>

        {/* Technical / Inspections */}
        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Technical & Inspections
          </h4>
          <div className="space-y-1 text-muted-foreground">
            {raw.review_building_code && (
              <p>Building Code: <span className="text-foreground">{raw.review_building_code as string}</span></p>
            )}
            {raw.building_code && (
              <p>Building Code: <span className="text-foreground">{raw.building_code as string}</span></p>
            )}
            {raw.device_type && (
              <p>Device Type: <span className="text-foreground">{raw.device_type as string}</span></p>
            )}
            {raw.special_inspection ? (
              <p>Special Inspection: <span className="text-foreground">{raw.special_inspection as string}</span>
                {raw.special_inspection_agency && <span className="text-xs ml-1">(Agency #{raw.special_inspection_agency as string})</span>}
              </p>
            ) : app.source === 'DOB NOW Build' ? (
              <p>Special Inspection: <span className="text-foreground">None</span></p>
            ) : null}
            {raw.progress_inspection ? (
              <p>Progress Inspection: <span className="text-foreground">{raw.progress_inspection as string}</span>
                {raw.progress_inspection_agency && <span className="text-xs ml-1">(Agency #{raw.progress_inspection_agency as string})</span>}
              </p>
            ) : app.source === 'DOB NOW Build' ? (
              <p>Progress Inspection: <span className="text-foreground">None</span></p>
            ) : null}
            {raw.inspection_type && (
              <p>Inspection: <span className="text-foreground">{raw.inspection_type as string}</span>
                {raw.inspection_date && <span className="text-xs ml-1">({raw.inspection_date as string})</span>}
              </p>
            )}
            {raw.plumbing_work && <p className="text-foreground">✓ Plumbing Work</p>}
            {raw.sprinkler_work && <p className="text-foreground">✓ Sprinkler Work</p>}
            {raw.general_wiring === 'Yes' && <p className="text-foreground">✓ General Wiring</p>}
            {raw.lighting_work === 'Yes' && <p className="text-foreground">✓ Lighting Work</p>}
            {raw.hvac_wiring === 'Yes' && <p className="text-foreground">✓ HVAC Wiring</p>}
          </div>
        </div>

        {/* Building Info (if available) */}
        {(raw.existing_stories || raw.proposed_stories || app.stories || raw.building_type || raw.building_use_type) && (
          <div className="space-y-2">
            <h4 className="font-medium text-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Building Info
            </h4>
            <div className="space-y-1 text-muted-foreground">
              {raw.building_type && <p>Type: <span className="text-foreground">{raw.building_type as string}</span></p>}
              {raw.building_use_type && <p>Use: <span className="text-foreground">{raw.building_use_type as string}</span></p>}
              {app.stories && <p>Stories: <span className="text-foreground">{app.stories}</span></p>}
              {raw.existing_stories && <p>Existing: <span className="text-foreground">{raw.existing_stories as string} stories</span></p>}
              {raw.proposed_stories && <p>Proposed: <span className="text-foreground">{raw.proposed_stories as string} stories</span></p>}
            </div>
          </div>
        )}

        {/* Description / Scope of Work */}
        {app.description && (
          <div className="col-span-2 md:col-span-3 space-y-2">
            <h4 className="font-medium text-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Scope of Work
            </h4>
            <p className="text-muted-foreground whitespace-pre-wrap">{app.description}</p>
          </div>
        )}
      </div>
    );
  };

  const renderBisDetails = (app: Application) => {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        {/* Dates */}
        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Dates
          </h4>
          <div className="space-y-1 text-muted-foreground">
            <p>Filed: <span className="text-foreground">{app.filing_date ? format(new Date(app.filing_date), 'MMM d, yyyy') : '—'}</span></p>
            <p>Approved: <span className="text-foreground">{app.approval_date ? format(new Date(app.approval_date), 'MMM d, yyyy') : '—'}</span></p>
            <p>Expires: <span className="text-foreground">{app.expiration_date ? format(new Date(app.expiration_date), 'MMM d, yyyy') : '—'}</span></p>
          </div>
        </div>

        {/* People */}
        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            People
          </h4>
          <div className="space-y-1 text-muted-foreground">
            <p>Applicant: <span className="text-foreground">{app.applicant_name || '—'}</span></p>
            <p>Owner: <span className="text-foreground">{app.owner_name || '—'}</span></p>
          </div>
        </div>

        {/* Cost */}
        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            Cost
          </h4>
          <div className="space-y-1 text-muted-foreground">
            <p>Est. Cost: <span className="text-foreground">{app.estimated_cost ? `$${app.estimated_cost.toLocaleString()}` : '—'}</span></p>
          </div>
        </div>

        {/* Description */}
        {app.description && (
          <div className="col-span-2 md:col-span-3 space-y-2">
            <h4 className="font-medium text-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Description
            </h4>
            <p className="text-muted-foreground">{app.description}</p>
          </div>
        )}

        {/* Status decode */}
        {app.status && app.status.length <= 2 && (
          <div className="col-span-2 md:col-span-3 bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Status Code "{app.status}"</span> → {decodeStatus(app.status, app.source)}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span><strong>{applications?.length || 0}</strong> applications</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search applications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={agencyFilter} onValueChange={setAgencyFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Agency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agencies</SelectItem>
            {agencies.map(agency => (
              <SelectItem key={agency} value={agency}>{agency}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-48 justify-start text-sm">
              <Filter className="w-4 h-4 mr-2" />
              Status ({selectedStatuses.size}/{statuses.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Filter by status</p>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={selectAllStatuses}>All</Button>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={clearAllStatuses}>None</Button>
              </div>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {statuses.map(status => (
                <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                  <Checkbox
                    checked={selectedStatuses.has(status)}
                    onCheckedChange={() => toggleStatus(status)}
                  />
                  <span className="text-sm">{status}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-8"></TableHead>
                <TableHead className="font-semibold">Application #</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Agency</TableHead>
                <TableHead className="font-semibold">Source</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Filed</TableHead>
                <TableHead className="font-semibold">Est. Cost</TableHead>
                <TableHead className="font-semibold">Applicant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((app) => {
                const isExpanded = expandedRows.has(app.id);
                const decodedStatus = decodeStatus(app.status, app.source);
                const isBuild = app.source.startsWith('DOB NOW');

                return (
                  <>
                    <TableRow
                      key={app.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleRow(app.id)}
                    >
                      <TableCell className="w-8 px-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{app.application_number}</TableCell>
                      <TableCell className="text-sm">
                        {app.application_type}
                        {app.work_type && app.work_type !== app.application_type && (
                          <span className="text-muted-foreground ml-1 text-xs">({app.work_type})</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getAgencyColor(app.agency)}`}>
                          {app.agency}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{app.source}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(app.status, app.source)}>
                          {decodedStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {app.filing_date ? format(new Date(app.filing_date), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {app.estimated_cost ? `$${app.estimated_cost.toLocaleString()}` : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">
                        {app.applicant_name || '—'}
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <TableRow key={`${app.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={9} className="py-4 px-6">
                          {isBuild ? renderBuildDetails(app) : renderBisDetails(app)}

                          {/* External link */}
                          <div className="mt-3 pt-3 border-t border-border">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = isBuild
                                  ? getDOBNowBuildUrl(app.application_number)
                                  : getDOBBisUrl(app.application_number);
                                window.open(url, '_blank');
                              }}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              {isBuild ? 'View on DOB NOW' : 'View on DOB BIS Web'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <FileStack className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No applications found</h3>
          <p className="text-muted-foreground text-sm">
            {!applications?.length
              ? "Applications will appear here once synced from NYC Open Data."
              : "Try adjusting your search or filters."}
          </p>
        </div>
      )}
    </div>
  );
};
