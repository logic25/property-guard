import { cn } from '@/lib/utils';
import { RefreshCw, Shield, AlertTriangle, Scale, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useState } from 'react';

interface ComplianceScoreCardProps {
  score: number;
  grade: string;
  violationScore: number;
  complianceScore: number;
  resolutionScore: number;
  violationDetails?: Record<string, number>;
  complianceDetails?: Record<string, number>;
  resolutionDetails?: Record<string, number>;
  calculatedAt?: string;
  onRecalculate?: () => Promise<unknown>;
  compact?: boolean;
}

const gradeConfig: Record<string, { color: string; bg: string; ring: string }> = {
  A: { color: 'text-emerald-600', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30' },
  B: { color: 'text-blue-600', bg: 'bg-blue-500/10', ring: 'ring-blue-500/30' },
  C: { color: 'text-amber-600', bg: 'bg-amber-500/10', ring: 'ring-amber-500/30' },
  D: { color: 'text-orange-600', bg: 'bg-orange-500/10', ring: 'ring-orange-500/30' },
  F: { color: 'text-red-600', bg: 'bg-red-500/10', ring: 'ring-red-500/30' },
};

export const ComplianceScoreCard = ({
  score,
  grade,
  violationScore,
  complianceScore,
  resolutionScore,
  violationDetails,
  complianceDetails,
  resolutionDetails,
  calculatedAt,
  onRecalculate,
  compact = false,
}: ComplianceScoreCardProps) => {
  const [recalculating, setRecalculating] = useState(false);
  const config = gradeConfig[grade] || gradeConfig.C;

  const handleRecalculate = async () => {
    if (!onRecalculate) return;
    setRecalculating(true);
    try {
      await onRecalculate();
    } finally {
      setRecalculating(false);
    }
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3 p-3 rounded-xl border', config.bg, config.ring, 'ring-1')}>
        <div className={cn('w-12 h-12 rounded-full flex items-center justify-center font-display text-xl font-bold', config.bg, config.color)}>
          {grade}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{score}/100</p>
          <p className="text-xs text-muted-foreground">Compliance Score</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide">Compliance Score</h3>
        </div>
        {onRecalculate && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRecalculate} disabled={recalculating}>
            <RefreshCw className={cn('w-3.5 h-3.5', recalculating && 'animate-spin')} />
          </Button>
        )}
      </div>

      {/* Grade Circle + Score */}
      <div className="flex items-center gap-5 mb-5">
        <div className={cn('w-20 h-20 rounded-full flex items-center justify-center ring-4', config.bg, config.ring)}>
          <span className={cn('font-display text-4xl font-black', config.color)}>{grade}</span>
        </div>
        <div>
          <p className="text-3xl font-display font-bold">{score}<span className="text-lg text-muted-foreground">/100</span></p>
          {calculatedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Updated {new Date(calculatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="space-y-3">
        <TooltipProvider>
          <ScoreBar
            icon={AlertTriangle}
            label="Violations"
            score={violationScore}
            max={40}
            tooltip={violationDetails ? `Critical: ${violationDetails.critical_open || 0}, High: ${violationDetails.high_open || 0}, Normal: ${violationDetails.normal_open || 0}` : undefined}
          />
          <ScoreBar
            icon={Scale}
            label="Compliance"
            score={complianceScore}
            max={40}
            tooltip={complianceDetails ? `Overdue: ${complianceDetails.overdue_count || 0}, Pending: ${complianceDetails.pending_count || 0}` : undefined}
          />
          <ScoreBar
            icon={Clock}
            label="Resolution"
            score={resolutionScore}
            max={20}
            tooltip={resolutionDetails ? `Closed: ${resolutionDetails.closed_violations || 0}/${resolutionDetails.total_violations || 0}, Avg: ${resolutionDetails.avg_days_to_close || 0} days` : undefined}
          />
        </TooltipProvider>
      </div>
    </div>
  );
};

const ScoreBar = ({
  icon: Icon,
  label,
  score,
  max,
  tooltip,
}: {
  icon: typeof Shield;
  label: string;
  score: number;
  max: number;
  tooltip?: string;
}) => {
  const pct = Math.round((score / max) * 100);
  const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';

  const content = (
    <div className="flex items-center gap-3">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium">{label}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{score}/{max}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{content}</div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
};
