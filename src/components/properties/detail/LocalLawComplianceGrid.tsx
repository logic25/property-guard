import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  Scale,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  Info,
} from 'lucide-react';
import {
  type PropertyForCompliance,
  type LocalLawRequirement,
  getApplicableLaws,
  getComplianceSummary,
} from '@/lib/local-law-engine';

interface LocalLawComplianceGridProps {
  property: PropertyForCompliance;
}

const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  overdue: {
    label: 'Overdue',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  due_soon: {
    label: 'Due Soon',
    className: 'bg-warning/10 text-warning border-warning/20',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  pending: {
    label: 'Pending',
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  compliant: {
    label: 'Compliant',
    className: 'bg-success/10 text-success border-success/20',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  exempt: {
    label: 'Exempt',
    className: 'bg-muted text-muted-foreground border-muted',
    icon: <Ban className="w-3.5 h-3.5" />,
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${config.className}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

function LawRow({ law }: { law: LocalLawRequirement }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between py-3 px-4 hover:bg-muted/50 transition-colors rounded-lg">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="font-mono font-semibold text-sm w-16 text-left shrink-0">
              {law.local_law}
            </span>
            <span className="text-sm truncate">{law.requirement_name}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">{law.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {law.next_due_date && law.applies && (
              <span className="text-xs text-muted-foreground hidden md:block">
                Due: {new Date(law.next_due_date).toLocaleDateString()}
              </span>
            )}
            <StatusBadge status={law.status} />
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-3 pt-1 ml-[76px] space-y-2 text-sm">
          <p className="text-muted-foreground">{law.description}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <div>
              <span className="text-muted-foreground">Why: </span>
              <span>{law.applicability_reason}</span>
            </div>
            {law.penalty_description && (
              <div>
                <span className="text-muted-foreground">Penalty: </span>
                <span className="text-destructive font-medium">{law.penalty_description}</span>
              </div>
            )}
            {law.cycle_year && (
              <div>
                <span className="text-muted-foreground">Cycle Year: </span>
                <span>{law.cycle_year}</span>
              </div>
            )}
          </div>
          <a
            href={law.learn_more_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Learn More <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function LocalLawComplianceGrid({ property }: LocalLawComplianceGridProps) {
  const [showExempt, setShowExempt] = useState(false);
  const requirements = getApplicableLaws(property);
  const summary = getComplianceSummary(requirements);

  const applicableLaws = requirements.filter(r => r.applies);
  const exemptLaws = requirements.filter(r => !r.applies);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="w-5 h-5" />
            Local Law Compliance
          </CardTitle>
          <div className="flex items-center gap-2">
            {summary.overdue > 0 && (
              <Badge variant="destructive" className="text-xs">
                {summary.overdue} Overdue
              </Badge>
            )}
            {summary.dueSoon > 0 && (
              <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                {summary.dueSoon} Due Soon
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {summary.total} Applicable
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {applicableLaws.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No applicable Local Law requirements detected for this property.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {applicableLaws.map(law => (
              <LawRow key={law.local_law} law={law} />
            ))}
          </div>
        )}

        {exemptLaws.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <button
              onClick={() => setShowExempt(!showExempt)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${showExempt ? 'rotate-180' : ''}`} />
              {showExempt ? 'Hide' : 'Show'} {exemptLaws.length} exempt requirements
            </button>
            {showExempt && (
              <div className="mt-2 divide-y divide-border/50">
                {exemptLaws.map(law => (
                  <LawRow key={law.local_law} law={law} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
