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
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileStack, Search, ExternalLink, ChevronRight, ChevronDown, Calendar, User, DollarSign, Building2, FileText, ShieldCheck, Filter, StickyNote, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getSourceBadge } from '@/lib/application-utils';

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
  notes: string | null;
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

const COMPLETED_STATUSES = ['Signed Off', 'Signed Off / Completed', 'Completed', 'Complete', 'CO Issued', 'Letter of Completion', 'LOC Issued'];

const normalizeStatusLabel = (status: string): string => {
  // Clean up verbose/redundant status labels from API
  const cleanups: [RegExp, string][] = [
    [/^filing\s+/i, ''],           // "Filing withdrawn" → "Withdrawn"
    [/^permit\s+issued\s*-\s*/i, 'Permit Issued – '], // normalize dash
  ];
  let result = status;
  cleanups.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, replacement);
  });
  // Title-case the first letter
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
  // LOC / Letter of Completion — intermediate completion, visually distinct from Signed Off
  if (['loc issued', 'letter of completion'].some(s => decoded.includes(s))) {
    return 'secondary' as const;
  }
  // Fully completed — dark/primary badge
  if (['signed off', 'completed', 'co issued'].some(s => decoded.includes(s))) {
    return 'default' as const;
  }
  // Active/issued permits
  if (['permit issued', 'issued', 'permit entire'].some(s => decoded.includes(s))) {
    return 'default' as const;
  }
  // In-progress
  if (['pre-filing', 'plan exam', 'partial permit', 'pending', 'filed', 'in review', 'plan approved'].some(s => decoded.includes(s))) {
    return 'secondary' as const;
  }
  // Terminal/negative
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

/** Parse filing suffix: B00518982-I1 → { prefix: 'B00518982', suffix: 'I1' }
 *  Also handles electrical/agency suffixes: B00020213-I1-EL → { prefix: 'B00020213', suffix: 'I1-EL' }
 */
const parseFilingNumber = (appNumber: string) => {
  // Match job-prefix followed by filing suffix, with optional agency tag like -EL
  const match = appNumber.match(/^(.+?)-(I\d+|P\d+|S\d+)(-[A-Z]+)?$/i);
  if (match) {
    const suffix = (match[2] + (match[3] || '')).toUpperCase();
    return { prefix: match[1], suffix };
  }
  return { prefix: appNumber, suffix: null };
};

const isActiveApplication = (status: string | null, source: string): boolean => {
  const decoded = decodeStatus(status, source);
  return !COMPLETED_STATUSES.some(cs => decoded.toLowerCase().includes(cs.toLowerCase()));
};

// ─── Notes Inline Editor ───
const NotesEditor = ({ appId, initialNotes }: { appId: string; initialNotes: string | null }) => {
  const [notes, setNotes] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('applications')
      .update({ notes })
      .eq('id', appId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save notes');
    } else {
      setDirty(false);
      toast.success('Notes saved');
    }
  };

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs gap-1.5 px-2 h-7">
          <StickyNote className="w-3 h-3" />
          Notes {initialNotes ? '•' : ''}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="space-y-2">
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
      </CollapsibleContent>
    </Collapsible>
  );
};

export const PropertyApplicationsTab = ({ propertyId }: PropertyApplicationsTabProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [statusFilterInit, setStatusFilterInit] = useState(false);
  const [sourceFilterInit, setSourceFilterInit] = useState(false);
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
  const sources = useMemo(() => [...new Set(applications?.map(a => a.source) || [])].sort(), [applications]);

  // Active count for the parent to display
  const activeCount = useMemo(() => {
    return (applications || []).filter(a => isActiveApplication(a.status, a.source)).length;
  }, [applications]);

  // Initialize default status filter: exclude completed
  useEffect(() => {
    if (statuses.length > 0 && !statusFilterInit) {
      const defaults = new Set(
        statuses.filter(s => !COMPLETED_STATUSES.some(cs => s.toLowerCase().includes(cs.toLowerCase())))
      );
      setSelectedStatuses(defaults);
      setStatusFilterInit(true);
    }
  }, [statuses, statusFilterInit]);

  // Initialize source filter: all selected
  useEffect(() => {
    if (sources.length > 0 && !sourceFilterInit) {
      setSelectedSources(new Set(sources));
      setSourceFilterInit(true);
    }
  }, [sources, sourceFilterInit]);

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const toggleSource = (source: string) => {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const selectAllStatuses = () => setSelectedStatuses(new Set(statuses));
  const clearAllStatuses = () => setSelectedStatuses(new Set());
  const selectAllSources = () => setSelectedSources(new Set(sources));
  const clearAllSources = () => setSelectedSources(new Set());

  const filtered = useMemo(() => {
    return (applications || []).filter(app => {
      const matchesSearch = !searchQuery ||
        app.application_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.applicant_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAgency = agencyFilter === 'all' || app.agency === agencyFilter;
      const decodedStatus = decodeStatus(app.status, app.source);
      const matchesStatus = selectedStatuses.size === 0 || selectedStatuses.has(decodedStatus);
      const matchesSource = selectedSources.size === 0 || selectedSources.has(app.source);
      return matchesSearch && matchesAgency && matchesStatus && matchesSource;
    });
  }, [applications, searchQuery, agencyFilter, selectedStatuses, selectedSources]);

  // Build a map of related filings by job number prefix
  const relatedFilingsMap = useMemo(() => {
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

  // Deduplicate: for job families, only show the primary (I1) row in the table.
  // Subsequent filings (P1, P2, S1, etc.) are nested inside the expanded detail.
  const sortedFiltered = useMemo(() => {
    // Identify which prefixes have an I-filing (initial) present in the filtered set
    const prefixInitialMap = new Map<string, Application>();
    const subsequentPrefixes = new Set<string>();

    filtered.forEach(app => {
      const { prefix, suffix } = parseFilingNumber(app.application_number);
      if (!suffix) return; // no suffix = standalone app, always show
      const suffixUpper = suffix.replace(/-[A-Z]+$/, '').toUpperCase(); // strip agency tag
      if (suffixUpper.startsWith('I')) {
        prefixInitialMap.set(prefix, app);
      } else {
        subsequentPrefixes.add(prefix);
      }
    });

    // Filter: keep apps that are either:
    // 1. Standalone (no suffix)
    // 2. Initial filings (I1, I1-EL, etc.)
    // 3. Subsequent filings whose family has NO initial filing in the filtered set
    const deduped = filtered.filter(app => {
      const { prefix, suffix } = parseFilingNumber(app.application_number);
      if (!suffix) return true; // standalone
      const suffixUpper = suffix.replace(/-[A-Z]+$/, '').toUpperCase();
      if (suffixUpper.startsWith('I')) return true; // initial filing
      // Subsequent filing: only show if no initial filing exists for this family
      return !prefixInitialMap.has(prefix);
    });

    return deduped.sort((a, b) => {
      const dateA = a.filing_date || '';
      const dateB = b.filing_date || '';
      return dateB.localeCompare(dateA);
    });
  }, [filtered]);

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
            <p>Filed: <span className="text-foreground">{app.filing_date ? format(new Date(app.filing_date), 'MM/dd/yy') : '—'}</span></p>
            <p>Approved: <span className="text-foreground">{app.approval_date ? format(new Date(app.approval_date), 'MM/dd/yy') : '—'}</span></p>
            {raw.first_permit_date && (
              <p>First Permit: <span className="text-foreground">{format(new Date(raw.first_permit_date as string), 'MM/dd/yy')}</span></p>
            )}
            <p>Expires: <span className="text-foreground">{app.expiration_date ? format(new Date(app.expiration_date), 'MM/dd/yy') : '—'}</span></p>
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
            <p>Filed: <span className="text-foreground">{app.filing_date ? format(new Date(app.filing_date), 'MM/dd/yy') : '—'}</span></p>
            <p>Approved: <span className="text-foreground">{app.approval_date ? format(new Date(app.approval_date), 'MM/dd/yy') : '—'}</span></p>
            <p>Expires: <span className="text-foreground">{app.expiration_date ? format(new Date(app.expiration_date), 'MM/dd/yy') : '—'}</span></p>
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

  const renderAppRow = (app: Application) => {
    const isExpanded = expandedRows.has(app.id);
    const decodedStatus = decodeStatus(app.status, app.source);
    const isBuild = app.source.startsWith('DOB NOW');
    const { prefix, suffix } = parseFilingNumber(app.application_number);
    // Show related filings for any app that belongs to a family (has suffix)
    const relatedApps = suffix ? (relatedFilingsMap.get(prefix) || []).filter(a => a.id !== app.id) : [];

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
          <TableCell className="font-mono text-sm">
            {app.application_number}
          </TableCell>
          <TableCell className="text-sm">
            {app.application_type}
          </TableCell>
          <TableCell>
            <span className={`inline-flex items-center justify-center w-12 px-2 py-0.5 rounded text-xs font-medium ${getAgencyColor(app.agency)}`}>
              {app.agency}
            </span>
          </TableCell>
          <TableCell>
            {(() => {
              const sb = getSourceBadge(app.source);
              return (
                <span className={`inline-flex items-center justify-center w-[90px] px-2 py-0.5 rounded text-xs font-semibold ${sb.bgColor} ${sb.color}`}>
                  {sb.label}
                </span>
              );
            })()}
          </TableCell>
          <TableCell>
            <Badge variant={getStatusVariant(app.status, app.source)} className="whitespace-nowrap">
              {decodedStatus}
            </Badge>
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">
            {app.filing_date ? format(new Date(app.filing_date), 'MM/dd/yy') : '—'}
          </TableCell>
          <TableCell className="text-sm">
            {app.estimated_cost ? `$${app.estimated_cost.toLocaleString()}` : '—'}
          </TableCell>
          <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">
            {app.applicant_name || '—'}
          </TableCell>
        </TableRow>

        {isExpanded && (
          <TableRow key={`${app.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
            <TableCell colSpan={9} className="py-4 px-6">
              {isBuild ? renderBuildDetails(app) : renderBisDetails(app)}

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
                            {isRelExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="font-mono text-xs">{related.application_number}</span>
                            {relSuffix && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{relSuffix}</Badge>
                            )}
                            <Badge variant={getStatusVariant(related.status, related.source)} className="text-xs whitespace-nowrap">
                              {relStatus}
                            </Badge>
                            <span className="text-muted-foreground text-xs">
                              {related.filing_date ? format(new Date(related.filing_date), 'MM/dd/yy') : '—'}
                            </span>
                            {related.estimated_cost && (
                              <span className="text-xs">${related.estimated_cost.toLocaleString()}</span>
                            )}
                          </div>
                          {isRelExpanded && (
                            <div className="px-4 py-3 bg-muted/10 border-t border-border/40">
                              {relIsBuild ? renderBuildDetails(related) : renderBisDetails(related)}
                              <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
                                <NotesEditor appId={related.id} initialNotes={related.notes} />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const url = relIsBuild
                                      ? getDOBNowBuildUrl(related.application_number)
                                      : getDOBBisUrl(related.application_number);
                                    window.open(url, '_blank');
                                  }}
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
                  variant="outline"
                  size="sm"
                  className="text-xs shrink-0"
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
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span><strong>{applications?.length || 0}</strong> total applications</span>
        <span>•</span>
        <span><strong>{activeCount}</strong> active</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
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

        {/* Source Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-48 justify-start text-sm">
              <Filter className="w-4 h-4 mr-2" />
              Source ({selectedSources.size}/{sources.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Filter by source</p>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={selectAllSources}>All</Button>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={clearAllSources}>None</Button>
              </div>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {sources.map(source => (
                <label key={source} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                  <Checkbox
                    checked={selectedSources.has(source)}
                    onCheckedChange={() => toggleSource(source)}
                  />
                  <span className="text-sm">{source}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Status Filter */}
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
      {sortedFiltered.length > 0 ? (
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
              {sortedFiltered.map((app) => renderAppRow(app))}
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
