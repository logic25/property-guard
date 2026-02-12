import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { FileStack, Search, ExternalLink } from 'lucide-react';
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
}

const getStatusVariant = (status: string | null) => {
  switch (status?.toLowerCase()) {
    case 'approved':
    case 'issued':
    case 'complete':
      return 'default' as const;
    case 'pending':
    case 'in review':
    case 'filed':
      return 'secondary' as const;
    case 'denied':
    case 'withdrawn':
    case 'cancelled':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
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

  const agencies = useMemo(() => [...new Set(applications?.map(a => a.agency) || [])].sort(), [applications]);
  const statuses = useMemo(() => [...new Set(applications?.map(a => a.status).filter(Boolean) || [])].sort() as string[], [applications]);

  const filtered = useMemo(() => {
    return (applications || []).filter(app => {
      const matchesSearch = !searchQuery ||
        app.application_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.applicant_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAgency = agencyFilter === 'all' || app.agency === agencyFilter;
      const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
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
          <SelectTrigger className="w-36">
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
                <TableHead className="font-semibold">Application #</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Agency</TableHead>
                <TableHead className="font-semibold">Source</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Filed</TableHead>
                <TableHead className="font-semibold">Est. Cost</TableHead>
                <TableHead className="font-semibold">Applicant</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="font-mono text-sm">{app.application_number}</TableCell>
                  <TableCell className="text-sm">
                    {app.application_type}
                    {app.work_type && (
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
                    <Badge variant={getStatusVariant(app.status)}>{app.status || 'Unknown'}</Badge>
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
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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
