import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Search, 
  Calendar, 
  ExternalLink,
  AlertOctagon,
  Ban,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  getAgencyLookupUrl, 
  getAgencyColor, 
  getStatusColor,
  isActiveViolation
} from '@/lib/violation-utils';

interface Violation {
  id: string;
  agency: string;
  violation_number: string;
  issued_date: string;
  status: string;
  oath_status?: string | null;
  description_raw: string | null;
  cure_due_date: string | null;
  hearing_date: string | null;
  is_stop_work_order: boolean;
  is_vacate_order: boolean;
  property_id: string;
  property_address?: string;
  property_bbl?: string | null;
}

interface PortfolioViolationsViewProps {
  violations: Violation[];
  portfolioName: string;
}

type SortField = 'issued_date' | 'agency' | 'status' | 'property_address';
type SortDirection = 'asc' | 'desc';

export const PortfolioViolationsView = ({ violations, portfolioName }: PortfolioViolationsViewProps) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agencyFilter, setAgencyFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('issued_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const agencies = useMemo(() => [...new Set(violations.map(v => v.agency))].sort(), [violations]);
  const properties = useMemo(() => {
    const map = new Map<string, string>();
    violations.forEach(v => {
      if (v.property_id && v.property_address) {
        map.set(v.property_id, v.property_address);
      }
    });
    return Array.from(map.entries());
  }, [violations]);

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
        v.description_raw?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.property_address?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchesAgency = agencyFilter === 'all' || v.agency === agencyFilter;
      const matchesProperty = propertyFilter === 'all' || v.property_id === propertyFilter;
      
      return matchesSearch && matchesStatus && matchesAgency && matchesProperty;
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
        case 'property_address':
          comparison = (a.property_address || '').localeCompare(b.property_address || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [violations, searchQuery, statusFilter, agencyFilter, propertyFilter, sortField, sortDirection]);

  // Calculate active violations using proper filtering
  const activeViolations = violations.filter(isActiveViolation);
  const activeOpenCount = activeViolations.filter(v => v.status === 'open').length;
  const activeInProgressCount = activeViolations.filter(v => v.status === 'in_progress').length;
  const criticalCount = activeViolations.filter(v => v.is_stop_work_order || v.is_vacate_order).length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold">{activeViolations.length}</div>
          <div className="text-sm text-muted-foreground">Active Violations</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold text-destructive">
            {activeOpenCount}
          </div>
          <div className="text-sm text-muted-foreground">Open</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold text-warning">
            {activeInProgressCount}
          </div>
          <div className="text-sm text-muted-foreground">In Progress</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold text-orange-600">
            {criticalCount}
          </div>
          <div className="text-sm text-muted-foreground">Critical</div>
        </div>
      </div>

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
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Property" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map(([id, address]) => (
              <SelectItem key={id} value={id}>{address}</SelectItem>
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
                  onClick={() => handleSort('property_address')}
                >
                  <div className="flex items-center">
                    Property {getSortIcon('property_address')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold">Violation</TableHead>
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
                    <Button
                      variant="link"
                      className="p-0 h-auto text-left justify-start"
                      onClick={() => navigate(`/dashboard/properties/${violation.property_id}`)}
                    >
                      <Building2 className="w-3 h-3 mr-1" />
                      <span className="text-sm line-clamp-1">{violation.property_address}</span>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {(violation.is_stop_work_order || violation.is_vacate_order) && (
                        <span className="text-destructive">
                          {violation.is_stop_work_order && <AlertOctagon className="w-4 h-4" />}
                          {violation.is_vacate_order && <Ban className="w-4 h-4" />}
                        </span>
                      )}
                      <span className="font-medium text-sm">#{violation.violation_number}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-auto py-1 px-2 ${getAgencyColor(violation.agency)}`}
                      onClick={() => window.open(getAgencyLookupUrl(violation.agency, violation.violation_number, violation.property_bbl), '_blank')}
                    >
                      {violation.agency}
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(violation.issued_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {violation.cure_due_date || violation.hearing_date ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="w-3 h-3" />
                        {new Date(violation.cure_due_date || violation.hearing_date!).toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${getStatusColor(violation.status)}`}>
                      {violation.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <h3 className="font-semibold text-foreground mb-2">No violations found</h3>
          <p className="text-muted-foreground text-sm">
            {violations.length === 0 
              ? 'Properties in this portfolio have no violations.'
              : 'No violations match your filters.'}
          </p>
        </div>
      )}
    </div>
  );
};