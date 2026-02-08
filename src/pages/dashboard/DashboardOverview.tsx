import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import StatsCard from '@/components/dashboard/StatsCard';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  AlertTriangle, 
  Users, 
  ClipboardList, 
  Plus,
  ArrowRight,
  Bell,
  FileCheck,
  Loader2
} from 'lucide-react';

interface DashboardStats {
  totalProperties: number;
  activeViolations: number;
  totalVendors: number;
  openWorkOrders: number;
}

interface RecentViolation {
  id: string;
  agency: string;
  violation_number: string;
  description_raw: string | null;
  status: string;
  property: {
    address: string;
  } | null;
}

const DashboardOverview = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalProperties: 0,
    activeViolations: 0,
    totalVendors: 0,
    openWorkOrders: 0,
  });
  const [recentViolations, setRecentViolations] = useState<RecentViolation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        // Fetch properties count
        const { count: propertiesCount } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true });

        // Fetch active violations count
        const { count: violationsCount } = await supabase
          .from('violations')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'closed');

        // Fetch vendors count
        const { count: vendorsCount } = await supabase
          .from('vendors')
          .select('*', { count: 'exact', head: true });

        // Fetch open work orders count
        const { count: workOrdersCount } = await supabase
          .from('work_orders')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'completed');

        // Fetch recent violations
        const { data: violations } = await supabase
          .from('violations')
          .select(`
            id,
            agency,
            violation_number,
            description_raw,
            status,
            property:properties(address)
          `)
          .neq('status', 'closed')
          .order('created_at', { ascending: false })
          .limit(5);

        setStats({
          totalProperties: propertiesCount || 0,
          activeViolations: violationsCount || 0,
          totalVendors: vendorsCount || 0,
          openWorkOrders: workOrdersCount || 0,
        });

        setRecentViolations(violations as unknown as RecentViolation[] || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

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
            Welcome back! Here's an overview of your properties.
          </p>
        </div>
        <Link to="/dashboard/properties">
          <Button variant="hero">
            <Plus className="w-4 h-4" />
            Add Property
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Properties"
          value={stats.totalProperties}
          icon={Building2}
          variant="default"
        />
        <StatsCard
          title="Active Violations"
          value={stats.activeViolations}
          icon={AlertTriangle}
          variant={stats.activeViolations > 0 ? 'danger' : 'success'}
        />
        <StatsCard
          title="Vendors"
          value={stats.totalVendors}
          icon={Users}
          variant="default"
        />
        <StatsCard
          title="Open Work Orders"
          value={stats.openWorkOrders}
          icon={ClipboardList}
          variant={stats.openWorkOrders > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Violations */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-destructive" />
              </div>
              <h2 className="font-display text-lg font-semibold text-foreground">
                Recent Violations
              </h2>
            </div>
            <Link to="/dashboard/violations" className="text-sm font-medium text-accent hover:underline flex items-center gap-1">
              View all
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {recentViolations.length > 0 ? (
            <div className="space-y-4">
              {recentViolations.map((violation) => (
                <div 
                  key={violation.id}
                  className="flex items-start gap-4 p-4 rounded-lg bg-secondary/50 border border-border"
                >
                  <div className={`
                    px-2 py-1 rounded text-xs font-bold
                    ${violation.agency === 'FDNY' ? 'bg-destructive/10 text-destructive' : ''}
                    ${violation.agency === 'DOB' ? 'bg-warning/10 text-warning' : ''}
                    ${violation.agency === 'ECB' ? 'bg-primary/10 text-primary' : ''}
                  `}>
                    {violation.agency}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {violation.description_raw || `Violation #${violation.violation_number}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {violation.property?.address}
                    </p>
                  </div>
                  <span className={`
                    px-2 py-0.5 rounded-full text-xs font-medium
                    ${violation.status === 'open' ? 'bg-destructive/10 text-destructive' : ''}
                    ${violation.status === 'in_progress' ? 'bg-warning/10 text-warning' : ''}
                    ${violation.status === 'closed' ? 'bg-success/10 text-success' : ''}
                  `}>
                    {violation.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No active violations</p>
              <p className="text-sm">Your properties are in good standing!</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-accent" />
            </div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Quick Actions
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Link to="/dashboard/properties">
              <div className="p-4 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                <Building2 className="w-8 h-8 text-primary mb-3" />
                <p className="font-medium text-foreground">Add Property</p>
                <p className="text-xs text-muted-foreground">Register a new building</p>
              </div>
            </Link>
            <Link to="/dashboard/vendors">
              <div className="p-4 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                <Users className="w-8 h-8 text-primary mb-3" />
                <p className="font-medium text-foreground">Add Vendor</p>
                <p className="text-xs text-muted-foreground">Register a contractor</p>
              </div>
            </Link>
            <Link to="/dashboard/violations">
              <div className="p-4 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                <AlertTriangle className="w-8 h-8 text-warning mb-3" />
                <p className="font-medium text-foreground">Log Violation</p>
                <p className="text-xs text-muted-foreground">Track a new issue</p>
              </div>
            </Link>
            <Link to="/dashboard/work-orders">
              <div className="p-4 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                <ClipboardList className="w-8 h-8 text-success mb-3" />
                <p className="font-medium text-foreground">Create Work Order</p>
                <p className="text-xs text-muted-foreground">Assign to vendor</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
