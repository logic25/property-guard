import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { FileStack, Search, ExternalLink, ChevronRight, ChevronDown, Calendar, User, DollarSign, Building2, FileText } from 'lucide-react';
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
}

// DOB BIS job status codes decoded
const BIS_STATUS_CODES: Record<string, string> = {
  'A': 'Pre-Filing',
  'B': 'Plan Examination',
  'C': 'Plan Examination Approval Pending',
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
  // DOB BIS uses single-letter codes
  if (source === 'DOB BIS' && status.length <= 2) {
    return BIS_STATUS_CODES[status.toUpperCase()] || status;
  }
  // DOB NOW Build already has readable statuses
  return status;
};

const getStatusVariant = (status: string | null, source: string) => {
  const decoded = decodeStatus(status, source).toLowerCase();
  if (['signed off', 'completed', 'co issued', 'letter of completion', 'permit issued - entire', 'permit entire', 'issued'].some(s => decoded.includes(s))) {
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

export const PropertyApplicationsTab = ({ propertyId }: PropertyApplicationsTabProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
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

  const filtered = useMemo(() => {
    return (applications || []).filter(app => {
      const matchesSearch = !searchQuery ||
        app.application_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.applicant_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAgency = agencyFilter === 'all' || app.agency === agencyFilter;
      const decodedStatus = decodeStatus(app.status, app.source);
      const matchesStatus = statusFilter === 'all' || decodedStatus === statusFilter;
      return matchesSearch && matchesAgency && matchesStatus;
    });
  }, [applications, searchQuery, agencyFilter, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                <TableHead className="font-semibold">Applicant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((app) => {
                const isExpanded = expandedRows.has(app.id);
                const decodedStatus = decodeStatus(app.status, app.source);

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
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">
                        {app.applicant_name || '—'}
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <TableRow key={`${app.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={8} className="py-4 px-6">
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

                            {/* Building Details */}
                            <div className="space-y-2">
                              <h4 className="font-medium text-foreground flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5" />
                                Building Details
                              </h4>
                              <div className="space-y-1 text-muted-foreground">
                                <p>Est. Cost: <span className="text-foreground">{app.estimated_cost ? `$${app.estimated_cost.toLocaleString()}` : '—'}</span></p>
                                <p>Stories: <span className="text-foreground">{app.stories ?? '—'}</span></p>
                                <p>Units: <span className="text-foreground">{app.dwelling_units ?? '—'}</span></p>
                                <p>Floor Area: <span className="text-foreground">{app.floor_area ? `${app.floor_area.toLocaleString()} sqft` : '—'}</span></p>
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

                            {/* Status decode explanation for BIS */}
                            {app.source === 'DOB BIS' && app.status && app.status.length <= 2 && (
                              <div className="col-span-2 md:col-span-3 bg-muted/50 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">Status Code "{app.status}"</span> → {decodeStatus(app.status, app.source)}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* External link */}
                          <div className="mt-3 pt-3 border-t border-border">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = app.source === 'DOB NOW Build'
                                  ? `https://a810-bisweb.nyc.gov/bisweb/JobsQueryByNumberServlet?passjobnumber=${app.application_number}`
                                  : `https://a810-bisweb.nyc.gov/bisweb/JobsQueryByNumberServlet?passjobnumber=${app.application_number}`;
                                window.open(url, '_blank');
                              }}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              View on DOB BIS Web
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
