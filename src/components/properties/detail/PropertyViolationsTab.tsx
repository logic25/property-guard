import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  AlertTriangle, 
  Search,
  Calendar,
  AlertOctagon,
  Ban,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getAgencyLookupUrl, 
  getAgencyColor, 
  getStatusColor
} from '@/lib/violation-utils';

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

interface PropertyViolationsTabProps {
  violations: Violation[];
  onRefresh: () => void;
  bbl?: string | null;
}

type SortField = 'issued_date' | 'agency' | 'status' | 'violation_number';
type SortDirection = 'asc' | 'desc';

export const PropertyViolationsTab = ({ violations, onRefresh, bbl }: PropertyViolationsTabProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agencyFilter, setAgencyFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('issued_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const agencies = useMemo(() => [...new Set(violations.map(v => v.agency))].sort(), [violations]);

  const updateStatus = async (id: string, status: 'open' | 'in_progress' | 'closed') => {
    try {
      const { error } = await supabase
        .from('violations')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      toast.success('Status updated');
      onRefresh();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1" /> 
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const filteredAndSortedViolations = useMemo(() => {
    let result = violations.filter(v => {
      const matchesSearch = 
        v.violation_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.description_raw?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchesAgency = agencyFilter === 'all' || v.agency === agencyFilter;
      
      return matchesSearch && matchesStatus && matchesAgency;
    });

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'issued_date':
          comparison = new Date(a.issued_date).getTime() - new Date(b.issued_date).getTime();
          break;
        case 'agency':
          comparison = a.agency.localeCompare(b.agency);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'violation_number':
          comparison = a.violation_number.localeCompare(b.violation_number);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [violations, searchQuery, statusFilter, agencyFilter, sortField, sortDirection]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search violations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agencyFilter} onValueChange={setAgencyFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Agency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agencies</SelectItem>
            {agencies.map(agency => (
              <SelectItem key={agency} value={agency}>{agency}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredAndSortedViolations.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead 
                  className="font-semibold cursor-pointer hover:bg-muted/80"
                  onClick={() => handleSort('violation_number')}
                >
                  <div className="flex items-center">
                    Violation {getSortIcon('violation_number')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-semibold cursor-pointer hover:bg-muted/80"
                  onClick={() => handleSort('agency')}
                >
                  <div className="flex items-center">
                    Agency {getSortIcon('agency')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-semibold cursor-pointer hover:bg-muted/80"
                  onClick={() => handleSort('issued_date')}
                >
                  <div className="flex items-center">
                    Issued {getSortIcon('issued_date')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold">Deadline</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead 
                  className="font-semibold cursor-pointer hover:bg-muted/80"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status {getSortIcon('status')}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedViolations.map((violation) => (
                <TableRow key={violation.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {(violation.is_stop_work_order || violation.is_vacate_order) && (
                        <span className="text-destructive">
                          {violation.is_stop_work_order && <AlertOctagon className="w-4 h-4" />}
                          {violation.is_vacate_order && <Ban className="w-4 h-4" />}
                        </span>
                      )}
                      <span className="font-medium">#{violation.violation_number}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-auto py-1 px-2 ${getAgencyColor(violation.agency)}`}
                      onClick={() => window.open(getAgencyLookupUrl(violation.agency, violation.violation_number, bbl), '_blank')}
                    >
                      {violation.agency}
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(violation.issued_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {violation.cure_due_date ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="w-3 h-3" />
                        {new Date(violation.cure_due_date).toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {violation.description_raw || 'No description'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={violation.status}
                      onValueChange={(v) => updateStatus(violation.id, v as 'open' | 'in_progress' | 'closed')}
                    >
                      <SelectTrigger className={`w-28 h-8 text-xs ${getStatusColor(violation.status)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold text-foreground mb-2">No violations found</h3>
          <p className="text-muted-foreground text-sm">
            {violations.length === 0 
              ? 'This property has no violations on record.'
              : 'No violations match your filters.'}
          </p>
        </div>
      )}
    </div>
  );
};