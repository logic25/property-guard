import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { isActiveViolation } from '@/lib/violation-utils';
import { 
  AlertOctagon, 
  Ban, 
  Calendar, 
  ArrowRight,
  Clock,
  Loader2
} from 'lucide-react';

interface CriticalViolation {
  id: string;
  agency: string;
  violation_number: string;
  description_raw: string | null;
  status: string;
  oath_status: string | null;
  cure_due_date: string | null;
  hearing_date: string | null;
  is_stop_work_order: boolean;
  is_vacate_order: boolean;
  property: {
    id: string;
    address: string;
  } | null;
}

const CriticalViolationsWidget = () => {
  const [criticalViolations, setCriticalViolations] = useState<CriticalViolation[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<CriticalViolation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCriticalData = async () => {
      try {
        // Fetch stop work and vacate orders
        const { data: critical } = await supabase
          .from('violations')
          .select(`
            id,
            agency,
            violation_number,
            description_raw,
            status,
            oath_status,
            cure_due_date,
            hearing_date,
            is_stop_work_order,
            is_vacate_order,
            property:properties(id, address)
          `)
          .or('is_stop_work_order.eq.true,is_vacate_order.eq.true')
          .order('created_at', { ascending: false })
          .limit(20);

        // Filter to only active violations
        const activeCritical = (critical || [])
          .filter(v => isActiveViolation(v))
          .slice(0, 5);

        // Fetch upcoming deadlines (next 14 days)
        const twoWeeksFromNow = new Date();
        twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
        
        const { data: deadlines } = await supabase
          .from('violations')
          .select(`
            id,
            agency,
            violation_number,
            description_raw,
            status,
            oath_status,
            cure_due_date,
            hearing_date,
            is_stop_work_order,
            is_vacate_order,
            property:properties(id, address)
          `)
          .or(`cure_due_date.lte.${twoWeeksFromNow.toISOString()},hearing_date.lte.${twoWeeksFromNow.toISOString()}`)
          .order('cure_due_date', { ascending: true })
          .limit(20);

        // Filter to only active violations
        const activeDeadlines = (deadlines || [])
          .filter(v => isActiveViolation(v))
          .slice(0, 5);

        setCriticalViolations(activeCritical as unknown as CriticalViolation[]);
        setUpcomingDeadlines(activeDeadlines as unknown as CriticalViolation[]);
      } catch (error) {
        console.error('Error fetching critical data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCriticalData();
  }, []);

  const getAgencyColor = (agency: string) => {
    switch (agency) {
      case 'FDNY': return 'bg-red-500/10 text-red-600 border-red-200';
      case 'DOB': return 'bg-orange-500/10 text-orange-600 border-orange-200';
      case 'ECB': return 'bg-blue-500/10 text-blue-600 border-blue-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getDaysUntil = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 shadow-card">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Critical Orders */}
      <div className="bg-card rounded-xl border border-destructive/20 p-6 shadow-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertOctagon className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">
                Critical Orders
              </h2>
              <p className="text-xs text-muted-foreground">Stop work & vacate orders</p>
            </div>
          </div>
          <Link to="/dashboard/violations" className="text-sm font-medium text-accent hover:underline flex items-center gap-1">
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {criticalViolations.length > 0 ? (
          <div className="space-y-3">
            {criticalViolations.map((violation) => (
              <Link
                key={violation.id}
                to={`/dashboard/properties/${violation.property?.id}`}
                className="block p-3 rounded-lg bg-destructive/5 border border-destructive/10 hover:bg-destructive/10 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {violation.is_stop_work_order && <AlertOctagon className="w-4 h-4 text-destructive" />}
                    {violation.is_vacate_order && <Ban className="w-4 h-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={getAgencyColor(violation.agency)}>
                        {violation.agency}
                      </Badge>
                      <span className="text-xs font-medium text-destructive">
                        {violation.is_stop_work_order && 'Stop Work'}
                        {violation.is_vacate_order && 'Vacate Order'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">
                      #{violation.violation_number}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {violation.property?.address}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <AlertOctagon className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No critical orders</p>
            <p className="text-xs">All clear!</p>
          </div>
        )}
      </div>

      {/* Upcoming Deadlines */}
      <div className="bg-card rounded-xl border border-warning/20 p-6 shadow-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">
                Upcoming Deadlines
              </h2>
              <p className="text-xs text-muted-foreground">Next 14 days</p>
            </div>
          </div>
          <Link to="/dashboard/violations" className="text-sm font-medium text-accent hover:underline flex items-center gap-1">
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {upcomingDeadlines.length > 0 ? (
          <div className="space-y-3">
            {upcomingDeadlines.map((violation) => {
              const deadline = violation.cure_due_date || violation.hearing_date;
              const daysUntil = getDaysUntil(deadline);
              const isUrgent = daysUntil !== null && daysUntil <= 3;
              
              return (
                <Link
                  key={violation.id}
                  to={`/dashboard/properties/${violation.property?.id}`}
                  className={`block p-3 rounded-lg border transition-colors ${
                    isUrgent 
                      ? 'bg-destructive/5 border-destructive/20 hover:bg-destructive/10' 
                      : 'bg-warning/5 border-warning/10 hover:bg-warning/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={getAgencyColor(violation.agency)}>
                          {violation.agency}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">
                        #{violation.violation_number}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {violation.property?.address}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {deadline && new Date(deadline).toLocaleDateString()}
                      </div>
                      {daysUntil !== null && (
                        <span className={`text-xs font-medium ${
                          isUrgent ? 'text-destructive' : 'text-warning'
                        }`}>
                          {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No upcoming deadlines</p>
            <p className="text-xs">Nothing due in the next 14 days</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CriticalViolationsWidget;
