import { useState, Fragment } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

interface ExpandableApplicationRowProps {
  application: any;
  index: number;
  note: string;
  onNoteChange: (note: string) => void;
}

const ExpandableApplicationRow = ({ application, index, note, onNoteChange }: ExpandableApplicationRowProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('approved') || s.includes('complete') || s === 'x') return 'bg-green-500/10 text-green-600 border-green-200';
    if (s.includes('pending') || s.includes('review') || s === 'p') return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
    if (s.includes('rejected') || s.includes('denied')) return 'bg-red-500/10 text-red-600 border-red-200';
    return '';
  };

  const getBISJobUrl = (jobNumber: string) => {
    return `https://a810-bisweb.nyc.gov/bisweb/JobsQueryByNumberServlet?passjobnumber=${jobNumber}`;
  };

  return (
    <Fragment>
      <TableRow 
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <TableCell className="w-8">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </TableCell>
        <TableCell className="font-mono text-sm">{application.application_number || application.job_number}</TableCell>
        <TableCell>
          <Badge variant="outline">{application.source || 'BIS'}</Badge>
        </TableCell>
        <TableCell>{application.application_type || application.job_type || '—'}</TableCell>
        <TableCell>
          <Badge variant="outline" className={getStatusColor(application.status)}>
            {application.status || '—'}
          </Badge>
        </TableCell>
        <TableCell>{application.filing_date || application.filed_date || '—'}</TableCell>
      </TableRow>
      {isOpen && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={6} className="p-4">
            <div className="space-y-4">
              {/* Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {application.work_type && (
                  <div>
                    <p className="text-muted-foreground">Work Type</p>
                    <p className="font-medium">{application.work_type}</p>
                  </div>
                )}
                {application.estimated_cost && (
                  <div>
                    <p className="text-muted-foreground">Estimated Cost</p>
                    <p className="font-medium">${Number(application.estimated_cost).toLocaleString()}</p>
                  </div>
                )}
                {application.approval_date && (
                  <div>
                    <p className="text-muted-foreground">Approval Date</p>
                    <p className="font-medium">{application.approval_date}</p>
                  </div>
                )}
                {application.owner_name && (
                  <div>
                    <p className="text-muted-foreground">Owner</p>
                    <p className="font-medium">{application.owner_name}</p>
                  </div>
                )}
                {application.applicant_name && (
                  <div>
                    <p className="text-muted-foreground">Applicant</p>
                    <p className="font-medium">{application.applicant_name}</p>
                  </div>
                )}
              </div>

              {/* Note Input */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
                <Textarea
                  placeholder="Add notes about this application..."
                  value={note}
                  onChange={(e) => onNoteChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* BIS Link */}
              <div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(getBISJobUrl(application.application_number || application.job_number), '_blank');
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View on DOB BIS
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
};

export default ExpandableApplicationRow;
