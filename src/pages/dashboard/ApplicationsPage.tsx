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
import { FileStack, Search, RefreshCw, Building2, ExternalLink, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

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
  created_at: string;
  properties?: {
    address: string;
    bin: string | null;
  };
}

const ApplicationsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [agencyFilter, setAgencyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [sourceFilterInit, setSourceFilterInit] = useState(false);

  const { data: applications, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['applications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          properties:property_id (address, bin)
        `)
        .order('filing_date', { ascending: false });

      if (error) throw error;
      return data as Application[];
    },
    enabled: !!user?.id,
  });

  const handleSync = async () => {
    toast({
      title: "Syncing applications...",
      description: "Fetching latest data from NYC Open Data.",
    });
    // Future: Call sync edge function
    await refetch();
  };

  const filteredApplications = applications?.filter(app => {
    const matchesSearch = searchQuery === '' || 
      app.application_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.properties?.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAgency = agencyFilter === 'all' || app.agency === agencyFilter;
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesSource = selectedSources.size === 0 || selectedSources.has(app.source);
    
    return matchesSearch && matchesAgency && matchesStatus && matchesSource;
  });

  const getStatusVariant = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'issued':
      case 'complete':
        return 'default';
      case 'pending':
      case 'in review':
      case 'filed':
        return 'secondary';
      case 'denied':
      case 'withdrawn':
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
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
    return colors[agency] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  const uniqueAgencies = [...new Set(applications?.map(a => a.agency) || [])].sort();
  const uniqueStatuses = [...new Set(applications?.map(a => a.status).filter(Boolean) || [])].sort() as string[];
  const uniqueSources = [...new Set(applications?.map(a => a.source) || [])].sort();

  // Init source filter with all sources selected
  useEffect(() => {
    if (uniqueSources.length > 0 && !sourceFilterInit) {
      setSelectedSources(new Set(uniqueSources));
      setSourceFilterInit(true);
    }
  }, [uniqueSources, sourceFilterInit]);

  const toggleSource = (source: string) => {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Applications</h1>
          <p className="text-muted-foreground mt-1">
            Track permits and applications from all NYC agencies
          </p>
        </div>
        <Button onClick={handleSync} disabled={isRefetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Sync Applications
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by application #, address, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={agencyFilter} onValueChange={setAgencyFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Agency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agencies</SelectItem>
                {uniqueAgencies.map(agency => (
                  <SelectItem key={agency} value={agency}>{agency}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {uniqueStatuses.map(status => (
                  <SelectItem key={status} value={status || 'unknown'}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <CardDescription>
            Permits, jobs, and applications from DOB BIS, DOB NOW, FDNY, and other NYC agencies
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !filteredApplications?.length ? (
            <div className="text-center py-12">
              <FileStack className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No applications found</h3>
              <p className="text-muted-foreground">
                {applications?.length === 0 
                  ? "Applications will appear here once synced from NYC Open Data."
                  : "Try adjusting your search or filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application #</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Agency</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Filed</TableHead>
                    <TableHead>Est. Cost</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-mono text-sm">
                        {app.application_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate max-w-[200px]">
                            {app.properties?.address || 'Unknown'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {app.application_type}
                          {app.work_type && (
                            <span className="text-muted-foreground ml-1">({app.work_type})</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getAgencyColor(app.agency)}`}>
                          {app.agency}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs w-[90px] justify-center truncate">
                          {app.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(app.status)}>
                          {app.status || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {app.filing_date ? format(new Date(app.filing_date), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {app.estimated_cost 
                          ? `$${app.estimated_cost.toLocaleString()}`
                          : '—'}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApplicationsPage;
