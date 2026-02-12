import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import StatsCard from '@/components/dashboard/StatsCard';
import CriticalViolationsWidget from '@/components/dashboard/CriticalViolationsWidget';
import { usePortfolioScores } from '@/hooks/useComplianceScore';
import { ComplianceScoreCard } from '@/components/dashboard/ComplianceScoreCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isActiveViolation, getAgencyColor } from '@/lib/violation-utils';
import { 
  Building2, 
  AlertTriangle, 
  Users, 
  ClipboardList, 
  Plus,
  ArrowRight,
  Bell,
  FileCheck,
  Loader2,
  DollarSign,
  Calendar,
  Gavel,
  TrendingUp
} from 'lucide-react';

interface DashboardStats {
  totalProperties: number;
  activeViolations: number;
  totalVendors: number;
  openWorkOrders: number;
  totalPenalties: number;
  upcomingHearings: number;
  violationsLast90Days: number;
}

interface AgencyBreakdown {
  agency: string;
  count: number;
}

interface RecentViolation {
  id: string;
  agency: string;
  violation_number: string;
  description_raw: string | null;
  status: string;
  issued_date: string;
  hearing_date: string | null;
  penalty_amount: number | null;
  is_stop_work_order: boolean | null;
  is_vacate_order: boolean | null;
  property: {
    id: string;
    address: string;
  } | null;
}

const DashboardOverview = () => {
  const { user } = useAuth();
  const { scores: portfolioScores, averageScore, averageGrade } = usePortfolioScores();
  const [stats, setStats] = useState<DashboardStats>({
    totalProperties: 0,
    activeViolations: 0,
    totalVendors: 0,
    openWorkOrders: 0,
    totalPenalties: 0,
    upcomingHearings: 0,
    violationsLast90Days: 0,
  });
  const [agencyBreakdown, setAgencyBreakdown] = useState<AgencyBreakdown[]>([]);
  const [recentViolations, setRecentViolations] = useState<RecentViolation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        const [propertiesRes, violationsRes, vendorsRes, workOrdersRes] = await Promise.all([
          supabase.from('properties').select('*', { count: 'exact', head: true }),
          supabase.from('violations').select('id, agency, violation_number, description_raw, status, oath_status, violation_class, issued_date, hearing_date, penalty_amount, is_stop_work_order, is_vacate_order, property:properties(id, address)').order('created_at', { ascending: false }),
          supabase.from('vendors').select('*', { count: 'exact', head: true }),
          supabase.from('work_orders').select('*', { count: 'exact', head: true }).neq('status', 'completed'),
        ]);

        const allViolations = violationsRes.data || [];
        const active = allViolations.filter(isActiveViolation);
        
        // Calculate penalties
        const totalPenalties = active.reduce((sum, v) => sum + (v.penalty_amount || 0), 0);
        
        // Upcoming hearings (next 30 days)
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const today = new Date();
        const upcomingHearings = active.filter(v => {
          if (!v.hearing_date) return false;
          const d = new Date(v.hearing_date);
          return d >= today && d <= thirtyDaysFromNow;
        }).length;

        // Violations opened in last 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const violationsLast90Days = active.filter(v => {
          if (!v.issued_date) return false;
          return new Date(v.issued_date) >= ninetyDaysAgo;
        }).length;

        // Agency breakdown (active only)
        const agencyCounts: Record<string, number> = {};
        active.forEach(v => {
          agencyCounts[v.agency] = (agencyCounts[v.agency] || 0) + 1;
        });
        const breakdown = Object.entries(agencyCounts)
          .map(([agency, count]) => ({ agency, count }))
          .sort((a, b) => b.count - a.count);

        setStats({
          totalProperties: propertiesRes.count || 0,
          activeViolations: active.length,
          totalVendors: vendorsRes.count || 0,
          openWorkOrders: workOrdersRes.count || 0,
          totalPenalties,
          upcomingHearings,
          violationsLast90Days,
        });

        setAgencyBreakdown(breakdown);

        // Recent active violations
        const recentActive = active.slice(0, 8) as unknown as RecentViolation[];
        setRecentViolations(recentActive);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const getDaysUntilHearing = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const today = new Date();
    return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Portfolio overview — {stats.totalProperties} properties monitored
          </p>
        </div>
        <Link to="/dashboard/properties">
          <Button variant="hero">
            <Plus className="w-4 h-4" />
            Add Property
          </Button>
        </Link>
      </div>

      {/* Top Summary Bar - spec §10.1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard
          title="Properties"
          value={stats.totalProperties}
          icon={Building2}
          variant="default"
          compact
        />
        <StatsCard
          title="Active Violations"
          value={stats.activeViolations}
          icon={AlertTriangle}
          variant={stats.activeViolations > 0 ? 'danger' : 'success'}
          compact
        />
        <StatsCard
          title="Upcoming Hearings"
          value={stats.upcomingHearings}
          subtitle="Next 30 days"
          icon={Gavel}
          variant={stats.upcomingHearings > 0 ? 'warning' : 'success'}
          compact
        />
        <StatsCard
          title="Total Penalties"
          value={`$${stats.totalPenalties.toLocaleString()}`}
          icon={DollarSign}
          variant={stats.totalPenalties > 0 ? 'danger' : 'success'}
          compact
        />
        <StatsCard
          title="Open Work Orders"
          value={stats.openWorkOrders}
          icon={ClipboardList}
          variant={stats.openWorkOrders > 0 ? 'warning' : 'success'}
          compact
        />
        <StatsCard
          title="New (90 Days)"
          value={stats.violationsLast90Days}
          icon={TrendingUp}
          variant={stats.violationsLast90Days > 0 ? 'warning' : 'success'}
          compact
        />
      </div>

      {/* Agency Breakdown Bar */}
      {agencyBreakdown.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wide">
              Active Violations by Agency
            </h3>
            <Link to="/dashboard/violations" className="text-xs font-medium text-accent hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {agencyBreakdown.map(({ agency, count }) => (
              <div 
                key={agency}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getAgencyColor(agency)}`}
              >
                <span className="text-sm font-bold">{agency}</span>
                <span className="text-lg font-display font-bold">{count}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/50">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="text-lg font-display font-bold text-foreground">{stats.activeViolations}</span>
            </div>
          </div>
        </div>
      )}

      {/* Critical Violations & Deadlines */}
      <CriticalViolationsWidget />

      {/* Portfolio Compliance Score */}
      {averageScore !== null && averageGrade !== null && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ComplianceScoreCard
            score={averageScore}
            grade={averageGrade}
            violationScore={Math.round(portfolioScores.reduce((s, p) => s + p.violation_score, 0) / portfolioScores.length)}
            complianceScore={Math.round(portfolioScores.reduce((s, p) => s + p.compliance_score, 0) / portfolioScores.length)}
            resolutionScore={Math.round(portfolioScores.reduce((s, p) => s + p.resolution_score, 0) / portfolioScores.length)}
          />
          <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5 shadow-card">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide mb-4">Property Scores</h3>
            <div className="space-y-2">
              {portfolioScores.map(s => {
                const cfg = s.grade === 'A' ? 'text-emerald-600' : s.grade === 'B' ? 'text-blue-600' : s.grade === 'C' ? 'text-amber-600' : s.grade === 'D' ? 'text-orange-600' : 'text-red-600';
                return (
                  <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <span className={`font-display text-lg font-bold w-8 ${cfg}`}>{s.grade}</span>
                    <div className="flex-1">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.score >= 80 ? 'bg-emerald-500' : s.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${s.score}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium tabular-nums w-12 text-right">{s.score}/100</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Violations - wider */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">
                  Recent Violations
                </h2>
                <p className="text-xs text-muted-foreground">Latest active violations across all properties</p>
              </div>
            </div>
            <Link to="/dashboard/violations" className="text-sm font-medium text-accent hover:underline flex items-center gap-1">
              View all
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {recentViolations.length > 0 ? (
            <div className="space-y-2">
              {recentViolations.map((violation) => {
                const daysUntilHearing = getDaysUntilHearing(violation.hearing_date);
                const isHearingSoon = daysUntilHearing !== null && daysUntilHearing >= 0 && daysUntilHearing <= 7;
                const isCritical = violation.is_stop_work_order || violation.is_vacate_order;

                return (
                  <Link
                    key={violation.id}
                    to={`/dashboard/properties/${violation.property?.id}`}
                    className={`flex items-center gap-4 p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
                      isCritical 
                        ? 'border-destructive/30 bg-destructive/5' 
                        : isHearingSoon 
                          ? 'border-warning/30 bg-warning/5'
                          : 'border-border bg-secondary/30'
                    }`}
                  >
                    <Badge variant="outline" className={`${getAgencyColor(violation.agency)} text-xs font-bold shrink-0`}>
                      {violation.agency}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {violation.description_raw || `#${violation.violation_number}`}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {violation.property?.address}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isHearingSoon && (
                        <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                          Hearing {daysUntilHearing === 0 ? 'Today' : `in ${daysUntilHearing}d`}
                        </span>
                      )}
                      {isCritical && (
                        <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                          {violation.is_stop_work_order ? 'SWO' : 'Vacate'}
                        </span>
                      )}
                      {violation.penalty_amount && violation.penalty_amount > 0 && (
                        <span className="text-xs font-medium text-muted-foreground tabular-nums">
                          ${violation.penalty_amount.toLocaleString()}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        violation.status === 'open' ? 'bg-destructive/10 text-destructive' : 
                        violation.status === 'in_progress' ? 'bg-warning/10 text-warning' : 
                        'bg-success/10 text-success'
                      }`}>
                        {violation.status.replace('_', ' ')}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No active violations</p>
              <p className="text-sm">Your properties are in good standing!</p>
            </div>
          )}
        </div>

        {/* Quick Actions - narrower */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-accent" />
            </div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Quick Actions
            </h2>
          </div>

          <div className="space-y-3">
            <Link to="/dashboard/properties" className="block">
              <div className="p-4 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <Building2 className="w-6 h-6 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-foreground">Add Property</p>
                    <p className="text-xs text-muted-foreground">Register a new building</p>
                  </div>
                </div>
              </div>
            </Link>
            <Link to="/dashboard/violations" className="block">
              <div className="p-4 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-warning shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-foreground">Log Violation</p>
                    <p className="text-xs text-muted-foreground">Track a new issue</p>
                  </div>
                </div>
              </div>
            </Link>
            <Link to="/dashboard/work-orders" className="block">
              <div className="p-4 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-6 h-6 text-success shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-foreground">Create Work Order</p>
                    <p className="text-xs text-muted-foreground">Assign to vendor</p>
                  </div>
                </div>
              </div>
            </Link>
            <Link to="/dashboard/dd-reports" className="block">
              <div className="p-4 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <FileCheck className="w-6 h-6 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-foreground">DD Report</p>
                    <p className="text-xs text-muted-foreground">Generate due diligence</p>
                  </div>
                </div>
              </div>
            </Link>
            <Link to="/dashboard/vendors" className="block">
              <div className="p-4 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-foreground">Add Vendor</p>
                    <p className="text-xs text-muted-foreground">Register a contractor</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
