import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { FileStack, Search, RefreshCw, Building2, ExternalLink, Filter, ChevronRight, ChevronDown, Calendar, User, DollarSign, FileText, ShieldCheck, StickyNote, Save, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { getSourceBadge } from '@/lib/application-utils';
import { toast as sonnerToast } from 'sonner';

interface Application {
  id: string;
  property_id: string;
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
  notes: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
  properties?: {
    address: string;
    bin: string | null;
  };
}

// DOB BIS job status codes decoded
const BIS_STATUS_CODES: Record<string, string> = {
  'A': 'Pre-Filing', 'B': 'Plan Examination', 'C': 'Plan Exam Approval Pending',
  'D': 'Plan Approved', 'E': 'Partial Permit Issued', 'F': 'Permit Issued - Entire',
  'G': 'Permit Renewed', 'H': 'Completed', 'I': 'Signed Off',
  'J': 'Letter of Completion', 'K': 'CO Issued', 'L': 'Withdrawn',
  'M': 'Disapproved', 'N': 'Suspended', 'P': 'Permit Expired',
  'Q': 'Partial Permit', 'R': 'Plan Exam - Incomplete', 'X': 'Signed Off / Completed',
};

const COMPLETED_STATUSES = ['Signed Off', 'Signed Off / Completed', 'Completed', 'CO Issued', 'Letter of Completion'];

const normalizeStatusLabel = (status: string): string => {
  const cleanups: [RegExp, string][] = [
    [/^filing\s+/i, ''],
    [/^permit\s+issued\s*-\s*/i, 'Permit Issued – '],
  ];
  let result = status;
  cleanups.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, replacement);
  });
  return result.charAt(0).toUpperCase() + result.slice(1);
};

const decodeStatus = (status: string | null, source: string): string => {
  if (!status) return 'Unknown';
  if (source === 'DOB BIS' && status.length <= 2) {
    return BIS_STATUS_CODES[status.toUpperCase()] || status;
  }
  return normalizeStatusLabel(status);
};

const getStatusVariant = (status: string | null, source: string) => {
  const decoded = decodeStatus(status, source).toLowerCase();
  if (['loc issued', 'letter of completion'].some(s => decoded.includes(s))) return 'secondary' as const;
  if (['signed off', 'completed', 'co issued', 'permit issued', 'issued', 'permit entire'].some(s => decoded.includes(s))) return 'default' as const;
  if (['pre-filing', 'plan exam', 'partial permit', 'pending', 'filed', 'in review', 'plan approved'].some(s => decoded.includes(s))) return 'secondary' as const;
  if (['disapproved', 'withdrawn', 'suspended', 'expired', 'denied', 'cancelled'].some(s => decoded.includes(s))) return 'destructive' as const;
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
  return colors[agency] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
};

const getDOBNowBuildUrl = (appNumber: string) =>
  `https://a810-dobnow.nyc.gov/Publish/#!/job/${appNumber}`;

const getDOBBisUrl = (appNumber: string) =>
  `https://a810-bisweb.nyc.gov/bisweb/JobsQueryByNumberServlet?passjobnumber=${appNumber}`;

/** Parse filing suffix: X08023336-I1 → { prefix: 'X08023336', suffix: 'I1' } */
const parseFilingNumber = (appNumber: string) => {
  const match = appNumber.match(/^(.+)-(I\d+|P\d+|S\d+)$/i);
  if (match) return { prefix: match[1], suffix: match[2].toUpperCase() };
  return { prefix: appNumber, suffix: null };
};

// ─── Notes Inline Editor ───
const NotesEditor = ({ appId, initialNotes }: { appId: string; initialNotes: string | null }) => {
  const [notes, setNotes] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('applications').update({ notes }).eq('id', appId);
    setSaving(false);
    if (error) sonnerToast.error('Failed to save notes');
    else { setDirty(false); sonnerToast.success('Notes saved'); }
  };

  return (
    <div>
      <Button variant="ghost" size="sm" className="text-xs gap-1.5 px-2 h-7" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <StickyNote className="w-3 h-3" />
        Notes {initialNotes ? '•' : ''}
      </Button>
      {open && (
        <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
          <Textarea
            placeholder="Add notes about this application..."
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
            className="min-h-[60px] text-sm"
          />
          {dirty && (
            <Button size="sm" className="h-7 text-xs" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              Save
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

const ApplicationsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [agencyFilter, setAgencyFilter] = useState<string>('all');
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [statusFilterInit, setStatusFilterInit] = useState(false);
  const [sourceFilterInit, setSourceFilterInit] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: applications, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['applications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select(`*, properties:property_id (address, bin)`)
        .order('filing_date', { ascending: false });
      if (error) throw error;
      return data as Application[];
    },
    enabled: !!user?.id,
  });

  // Last sync timestamp
  const { data: lastSyncTime } = useQuery({
    queryKey: ['last-sync-time', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('properties')
        .select('last_synced_at')
        .eq('user_id', user!.id)
        .not('last_synced_at', 'is', null)
        .order('last_synced_at', { ascending: false })
        .limit(1);
      return data?.[0]?.last_synced_at || null;
    },
    enabled: !!user?.id,
  });

  const handleSync = async () => {
    toast({ title: "Syncing applications...", description: "Fetching latest data from NYC Open Data." });
    await refetch();
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const uniqueAgencies = useMemo(() => [...new Set(applications?.map(a => a.agency) || [])].sort(), [applications]);
  const uniqueStatuses = useMemo(() => [...new Set(applications?.map(a => decodeStatus(a.status, a.source)).filter(Boolean) || [])].sort() as string[], [applications]);
  const uniqueSources = useMemo(() => [...new Set(applications?.map(a => a.source) || [])].sort(), [applications]);

  // Default status filter: exclude completed
  useEffect(() => {
    if (uniqueStatuses.length > 0 && !statusFilterInit) {
      const defaults = new Set(
        uniqueStatuses.filter(s => !COMPLETED_STATUSES.some(cs => s.toLowerCase().includes(cs.toLowerCase())))
      );
      setSelectedStatuses(defaults);
      setStatusFilterInit(true);
    }
  }, [uniqueStatuses, statusFilterInit]);

  // Default source filter: all
  useEffect(() => {
    if (uniqueSources.length > 0 && !sourceFilterInit) {
      setSelectedSources(new Set(uniqueSources));
      setSourceFilterInit(true);
    }
  }, [uniqueSources, sourceFilterInit]);

  const toggleStatus = (s: string) => setSelectedStatuses(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const toggleSource = (s: string) => setSelectedSources(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  // (old filteredApplications removed — replaced by deduped version below)

  // Build job family map from ALL applications — group by job prefix
  const jobFamilyMap = useMemo(() => {
    const map = new Map<string, Application[]>();
    (applications || []).forEach(app => {
      const { prefix, suffix } = parseFilingNumber(app.application_number);
      if (suffix) {
        if (!map.has(prefix)) map.set(prefix, []);
        map.get(prefix)!.push(app);
      }
    });
    return map;
  }, [applications]);

  // Determine the primary app ID for each job family (latest filing_date)
  const primaryAppIds = useMemo(() => {
    const ids = new Set<string>();
    const nonPrimaryIds = new Set<string>();
    for (const [, family] of jobFamilyMap) {
      if (family.length <= 1) {
        if (family.length === 1) ids.add(family[0].id);
        continue;
      }
      // Pick the one with the latest filing date as primary
      const sorted = [...family].sort((a, b) => {
        const da = a.filing_date ? new Date(a.filing_date).getTime() : 0;
        const db = b.filing_date ? new Date(b.filing_date).getTime() : 0;
        return db - da;
      });
      ids.add(sorted[0].id);
      sorted.slice(1).forEach(a => nonPrimaryIds.add(a.id));
    }
    return { primary: ids, nonPrimary: nonPrimaryIds };
  }, [jobFamilyMap]);

  // Filter out non-primary family members from the displayed list
  const filteredApplications = useMemo(() => {
    return (applications || []).filter(app => {
      // Skip non-primary family members
      if (primaryAppIds.nonPrimary.has(app.id)) return false;

      const matchesSearch = searchQuery === '' ||
        app.application_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.properties?.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAgency = agencyFilter === 'all' || app.agency === agencyFilter;
      const decoded = decodeStatus(app.status, app.source);
      const matchesStatus = selectedStatuses.size === 0 || selectedStatuses.has(decoded);
      const matchesSource = selectedSources.size === 0 || selectedSources.has(app.source);
      return matchesSearch && matchesAgency && matchesStatus && matchesSource;
    });
  }, [applications, searchQuery, agencyFilter, selectedStatuses, selectedSources, primaryAppIds]);

  const activeCount = useMemo(() => {
    return (applications || []).filter(a => {
      const decoded = decodeStatus(a.status, a.source);
      return !COMPLETED_STATUSES.some(cs => decoded.toLowerCase().includes(cs.toLowerCase()));
    }).length;
  }, [applications]);

  const renderBuildDetails = (app: Application) => {
    const raw = app.raw_data || {};
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Dates & Permit</h4>
          <div className="space-y-1 text-muted-foreground">
            <p>Filed: <span className="text-foreground">{app.filing_date ? format(new Date(app.filing_date), 'MM/dd/yy') : '—'}</span></p>
            <p>Approved: <span className="text-foreground">{app.approval_date ? format(new Date(app.approval_date), 'MM/dd/yy') : '—'}</span></p>
            {raw.first_permit_date && <p>First Permit: <span className="text-foreground">{format(new Date(raw.first_permit_date as string), 'MM/dd/yy')}</span></p>}
            <p>Expires: <span className="text-foreground">{app.expiration_date ? format(new Date(app.expiration_date), 'MM/dd/yy') : '—'}</span></p>
            {raw.signoff_date && <p>Sign-Off: <span className="text-foreground">{raw.signoff_date as string}</span></p>}
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Applicant</h4>
          <div className="space-y-1 text-muted-foreground">
            <p>Name: <span className="text-foreground">{app.applicant_name || '—'}</span></p>
            {raw.applicant_license && <p>License #: <span className="text-foreground">{raw.applicant_license as string}</span></p>}
            {(raw.applicant_business_name || raw.applicant_business) && <p>Company: <span className="text-foreground">{(raw.applicant_business_name || raw.applicant_business) as string}</span></p>}
            {raw.applicant_phone && <p>Phone: <span className="text-foreground">{raw.applicant_phone as string}</span></p>}
            {raw.applicant_email && <p>Email: <span className="text-foreground">{raw.applicant_email as string}</span></p>}
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Cost & Scope</h4>
          <div className="space-y-1 text-muted-foreground">
            <p>Est. Cost: <span className="text-foreground">{app.estimated_cost ? `$${app.estimated_cost.toLocaleString()}` : '—'}</span></p>
            {app.floor_area != null && app.floor_area > 0 && <p>Floor Area: <span className="text-foreground">{app.floor_area.toLocaleString()} sqft</span></p>}
            {raw.work_on_floor && <p>Work Location: <span className="text-foreground">{raw.work_on_floor as string}</span></p>}
          </div>
        </div>
        {(raw.special_inspection || raw.progress_inspection || raw.building_code || raw.review_building_code) && (
          <div className="space-y-2">
            <h4 className="font-medium text-foreground flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Technical</h4>
            <div className="space-y-1 text-muted-foreground">
              {(raw.review_building_code || raw.building_code) && <p>Building Code: <span className="text-foreground">{(raw.review_building_code || raw.building_code) as string}</span></p>}
              {raw.special_inspection && <p>Special Inspection: <span className="text-foreground">{raw.special_inspection as string}</span></p>}
              {raw.progress_inspection && <p>Progress Inspection: <span className="text-foreground">{raw.progress_inspection as string}</span></p>}
            </div>
          </div>
        )}
        {app.description && (
          <div className="col-span-2 md:col-span-3 space-y-2">
            <h4 className="font-medium text-foreground flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Scope of Work</h4>
            <p className="text-muted-foreground whitespace-pre-wrap">{app.description}</p>
          </div>
        )}
      </div>
    );
  };

  const renderBisDetails = (app: Application) => {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Dates</h4>
          <div className="space-y-1 text-muted-foreground">
            <p>Filed: <span className="text-foreground">{app.filing_date ? format(new Date(app.filing_date), 'MM/dd/yy') : '—'}</span></p>
            <p>Approved: <span className="text-foreground">{app.approval_date ? format(new Date(app.approval_date), 'MM/dd/yy') : '—'}</span></p>
            <p>Expires: <span className="text-foreground">{app.expiration_date ? format(new Date(app.expiration_date), 'MM/dd/yy') : '—'}</span></p>
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> People</h4>
          <div className="space-y-1 text-muted-foreground">
            <p>Applicant: <span className="text-foreground">{app.applicant_name || '—'}</span></p>
            <p>Owner: <span className="text-foreground">{app.owner_name || '—'}</span></p>
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Cost</h4>
          <div className="space-y-1 text-muted-foreground">
            <p>Est. Cost: <span className="text-foreground">{app.estimated_cost ? `$${app.estimated_cost.toLocaleString()}` : '—'}</span></p>
          </div>
        </div>
        {app.description && (
          <div className="col-span-2 md:col-span-3 space-y-2">
            <h4 className="font-medium text-foreground flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Description</h4>
            <p className="text-muted-foreground">{app.description}</p>
          </div>
        )}
        {app.source === 'DOB BIS' && app.status && app.status.length <= 2 && (
          <div className="col-span-2 md:col-span-3 bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Status Code "{app.status}"</span> → {decodeStatus(app.status, app.source)}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderAppDetails = (app: Application) => {
    const isBuild = app.source.startsWith('DOB NOW');
    return isBuild ? renderBuildDetails(app) : renderBisDetails(app);
  };

  const renderAppRow = (app: Application) => {
    const isExpanded = expandedRows.has(app.id);
    const decodedStatus = decodeStatus(app.status, app.source);
    const sb = getSourceBadge(app.source);
    const isBuild = app.source.startsWith('DOB NOW');
    const { prefix, suffix } = parseFilingNumber(app.application_number);
    const relatedApps = (jobFamilyMap.get(prefix) || []).filter(a => a.id !== app.id);

    return (
      <>
        <TableRow
          key={app.id}
          className="cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => toggleRow(app.id)}
        >
          <TableCell className="px-2">
            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </TableCell>
          <TableCell className="font-mono text-sm">{app.application_number}</TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm truncate max-w-[200px]">{app.properties?.address || 'Unknown'}</span>
            </div>
          </TableCell>
          <TableCell>
            <span className="text-sm">
              {app.application_type}
              {app.work_type && app.work_type !== app.application_type && <span className="text-muted-foreground ml-1 text-xs">({app.work_type})</span>}
            </span>
          </TableCell>
          <TableCell>
            <span className={`inline-flex items-center justify-center w-12 px-2 py-0.5 rounded text-xs font-medium ${getAgencyColor(app.agency)}`}>{app.agency}</span>
          </TableCell>
          <TableCell>
            <span className={`inline-flex items-center justify-center w-[90px] px-2 py-0.5 rounded text-xs font-semibold ${sb.bgColor} ${sb.color}`}>{sb.label}</span>
          </TableCell>
          <TableCell>
            <Badge variant={getStatusVariant(app.status, app.source)} className="whitespace-nowrap">{decodedStatus}</Badge>
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">
            {app.filing_date ? format(new Date(app.filing_date), 'MM/dd/yy') : '—'}
          </TableCell>
          <TableCell className="text-sm">
            {app.estimated_cost ? `$${app.estimated_cost.toLocaleString()}` : '—'}
          </TableCell>
        </TableRow>

        {isExpanded && (
          <TableRow key={`${app.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
            <TableCell colSpan={9} className="py-4 px-6">
              {renderAppDetails(app)}

              {/* Related filings section */}
              {relatedApps.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border">
                  <h4 className="text-sm font-medium text-foreground mb-2">
                    Related Filings ({relatedApps.length})
                  </h4>
                  <div className="space-y-2">
                    {relatedApps.map(related => {
                      const relSuffix = parseFilingNumber(related.application_number).suffix;
                      const relStatus = decodeStatus(related.status, related.source);
                      const isRelExpanded = expandedRows.has(`rel-${related.id}`);
                      const relIsBuild = related.source.startsWith('DOB NOW');
                      return (
                        <div key={related.id} className="rounded-lg border border-border/60 overflow-hidden">
                          <div
                            className="flex items-center gap-3 text-sm bg-muted/30 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRows(prev => {
                                const next = new Set(prev);
                                const key = `rel-${related.id}`;
                                if (next.has(key)) next.delete(key); else next.add(key);
                                return next;
                              });
                            }}
                          >
                            {isRelExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                            <span className="font-mono text-xs">{related.application_number}</span>
                            {relSuffix && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{relSuffix}</Badge>}
                            <Badge variant={getStatusVariant(related.status, related.source)} className="text-xs whitespace-nowrap">{relStatus}</Badge>
                            <span className="text-muted-foreground text-xs">{related.filing_date ? format(new Date(related.filing_date), 'MM/dd/yy') : '—'}</span>
                            {related.estimated_cost && <span className="text-xs">${related.estimated_cost.toLocaleString()}</span>}
                          </div>
                          {isRelExpanded && (
                            <div className="px-4 py-3 bg-muted/10 border-t border-border/40">
                              {relIsBuild ? renderBuildDetails(related) : renderBisDetails(related)}
                              <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
                                <NotesEditor appId={related.id} initialNotes={related.notes} />
                                <Button
                                  variant="outline" size="sm" className="text-xs shrink-0"
                                  onClick={(e) => { e.stopPropagation(); window.open(relIsBuild ? getDOBNowBuildUrl(related.application_number) : getDOBBisUrl(related.application_number), '_blank'); }}
                                >
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  {relIsBuild ? 'DOB NOW' : 'BIS Web'}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-border flex items-start justify-between gap-4">
                <NotesEditor appId={app.id} initialNotes={app.notes} />
                <Button
                  variant="outline" size="sm" className="text-xs shrink-0"
                  onClick={(e) => { e.stopPropagation(); window.open(isBuild ? getDOBNowBuildUrl(app.application_number) : getDOBBisUrl(app.application_number), '_blank'); }}
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
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Applications</h1>
          <p className="text-muted-foreground mt-1">Track permits and applications from all NYC agencies</p>
        </div>
        <Button onClick={handleSync} disabled={isRefetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Sync Applications
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span><strong>{applications?.length || 0}</strong> total applications</span>
        <span><strong>{applications?.length || 0}</strong> total applications</span>
        <span>•</span>
        <span><strong>{activeCount}</strong> active</span>
        <span>•</span>
        <span><strong>{filteredApplications?.length || 0}</strong> shown</span>
        {lastSyncTime && (
          <>
            <span>•</span>
            <span className="text-xs">Last synced: {format(new Date(lastSyncTime), 'MMM d, yyyy h:mm a')}</span>
          </>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by application #, address, or description..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
            </div>
            <Select value={agencyFilter} onValueChange={setAgencyFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Agency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agencies</SelectItem>
                {uniqueAgencies.map(agency => (<SelectItem key={agency} value={agency}>{agency}</SelectItem>))}
              </SelectContent>
            </Select>

            {/* Source Filter - multi-select */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-start text-sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Source ({selectedSources.size}/{uniqueSources.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="start">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Filter by source</p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedSources(new Set(uniqueSources))}>All</Button>
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedSources(new Set())}>None</Button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {uniqueSources.map(source => (
                    <label key={source} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                      <Checkbox checked={selectedSources.has(source)} onCheckedChange={() => toggleSource(source)} />
                      <span className="text-sm">{getSourceBadge(source).label}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Status Filter - multi-select with active default */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-start text-sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Status ({selectedStatuses.size}/{uniqueStatuses.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="start">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Filter by status</p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedStatuses(new Set(uniqueStatuses))}>All</Button>
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedStatuses(new Set())}>None</Button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {uniqueStatuses.map(status => (
                    <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                      <Checkbox checked={selectedStatuses.has(status)} onCheckedChange={() => toggleStatus(status)} />
                      <span className="text-sm">{status}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileStack className="w-5 h-5" />
            Applications ({filteredApplications?.length || 0})
          </CardTitle>
          <CardDescription>Permits, jobs, and applications from DOB BIS, DOB NOW, FDNY, and other NYC agencies</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (<Skeleton key={i} className="h-16 w-full" />))}
            </div>
          ) : !filteredApplications?.length ? (
            <div className="text-center py-12">
              <FileStack className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No applications found</h3>
              <p className="text-muted-foreground">
                {applications?.length === 0 ? "Applications will appear here once synced from NYC Open Data." : "Try adjusting your search or filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Application #</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Agency</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Filed</TableHead>
                    <TableHead>Est. Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.map((app) => renderAppRow(app))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApplicationsPage;
