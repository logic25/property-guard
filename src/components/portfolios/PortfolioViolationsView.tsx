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
  Building2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Violation {
  id: string;
  agency: string;
  violation_number: string;
  issued_date: string;
  status: string;
  description_raw: string | null;
  cure_due_date: string | null;
  hearing_date: string | null;
  is_stop_work_order: boolean;
  is_vacate_order: boolean;
  property_id: string;
  property_address?: string;
}

interface PortfolioViolationsViewProps {
  violations: Violation[];
  portfolioName: string;
}

export const PortfolioViolationsView = ({ violations, portfolioName }: PortfolioViolationsViewProps) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agencyFilter, setAgencyFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');

  const agencies = useMemo(() => [...new Set(violations.map(v => v.agency))], [violations]);
  const properties = useMemo(() => {
    const map = new Map<string, string>();
    violations.forEach(v => {
      if (v.property_id && v.property_address) {
        map.set(v.property_id, v.property_address);
      }
    });
    return Array.from(map.entries());
  }, [violations]);

  const filteredViolations = useMemo(() => {
    return violations.filter(v => {
      const matchesSearch = 
        v.violation_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.description_raw?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.property_address?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchesAgency = agencyFilter === 'all' || v.agency === agencyFilter;
      const matchesProperty = propertyFilter === 'all' || v.property_id === propertyFilter;
      
      return matchesSearch && matchesStatus && matchesAgency && matchesProperty;
    });
  }, [violations, searchQuery, statusFilter, agencyFilter, propertyFilter]);

  const getAgencyColor = (agency: string) => {
    const colors: Record<string, string> = {
      FDNY: 'bg-red-500/10 text-red-600 border-red-200',
      DOB: 'bg-orange-500/10 text-orange-600 border-orange-200',
      ECB: 'bg-blue-500/10 text-blue-600 border-blue-200',
      HPD: 'bg-purple-500/10 text-purple-600 border-purple-200',
      DEP: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
      DOT: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
      DSNY: 'bg-green-500/10 text-green-600 border-green-200',
      LPC: 'bg-pink-500/10 text-pink-600 border-pink-200',
      DOF: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
    };
    return colors[agency] || 'bg-gray-500/10 text-gray-600 border-gray-200';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-destructive/10 text-destructive';
      case 'in_progress': return 'bg-warning/10 text-warning';
      case 'closed': return 'bg-success/10 text-success';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getOATHLookupUrl = (ticketNumber: string) => {
    return `https://a820-summonsfinder.nyc.gov/DARP/OATHViewer/ticket?ticket_number=${ticketNumber}`;
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold">{violations.length}</div>
          <div className="text-sm text-muted-foreground">Total Violations</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold text-destructive">
            {violations.filter(v => v.status === 'open').length}
          </div>
          <div className="text-sm text-muted-foreground">Open</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold text-warning">
            {violations.filter(v => v.status === 'in_progress').length}
          </div>
          <div className="text-sm text-muted-foreground">In Progress</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold text-orange-600">
            {violations.filter(v => v.is_stop_work_order || v.is_vacate_order).length}
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
      {filteredViolations.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Property</TableHead>
                <TableHead className="font-semibold">Violation</TableHead>
                <TableHead className="font-semibold">Agency</TableHead>
                <TableHead className="font-semibold">Issued</TableHead>
                <TableHead className="font-semibold">Deadline</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Lookup</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredViolations.map((violation) => (
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
                    <Badge variant="outline" className={getAgencyColor(violation.agency)}>
                      {violation.agency}
                    </Badge>
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
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => window.open(getOATHLookupUrl(violation.violation_number), '_blank')}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      OATH
                    </Button>
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
