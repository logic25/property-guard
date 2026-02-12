import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Users, Building2, AlertTriangle } from 'lucide-react';

export default function AdminOverview() {
  // API health summary (last 24h)
  const { data: apiHealth } = useQuery({
    queryKey: ['admin-api-health'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('api_call_logs')
        .select('endpoint, status_code, response_time_ms')
        .gte('created_at', since);
      if (error) throw error;

      const endpoints: Record<string, { total: number; errors: number; avgMs: number }> = {};
      for (const row of data || []) {
        if (!endpoints[row.endpoint]) endpoints[row.endpoint] = { total: 0, errors: 0, avgMs: 0 };
        const e = endpoints[row.endpoint];
        e.total++;
        if (!row.status_code || row.status_code >= 400) e.errors++;
        e.avgMs += row.response_time_ms || 0;
      }
      for (const key of Object.keys(endpoints)) {
        endpoints[key].avgMs = Math.round(endpoints[key].avgMs / endpoints[key].total);
      }
      return endpoints;
    },
    refetchInterval: 30_000,
  });

  // User count
  const { data: userCount } = useQuery({
    queryKey: ['admin-user-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // Property count
  const { data: propertyCount } = useQuery({
    queryKey: ['admin-property-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // Active violations
  const { data: violationCount } = useQuery({
    queryKey: ['admin-violation-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('violations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
      if (error) throw error;
      return count || 0;
    },
  });

  const getHealthColor = (errors: number, total: number) => {
    const rate = total > 0 ? errors / total : 0;
    if (rate === 0) return 'bg-green-500';
    if (rate < 0.1) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Overview</h1>
        <p className="text-muted-foreground">System health and user statistics</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{userCount ?? '—'}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{propertyCount ?? '—'}</p>
                <p className="text-sm text-muted-foreground">Total Properties</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{violationCount ?? '—'}</p>
                <p className="text-sm text-muted-foreground">Open Violations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            NYC Open Data API Health (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!apiHealth || Object.keys(apiHealth).length === 0 ? (
            <p className="text-muted-foreground text-sm">No API calls logged yet. Calls will appear here once properties are synced.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(apiHealth).map(([endpoint, stats]) => (
                <div key={endpoint} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getHealthColor(stats.errors, stats.total)}`} />
                    <span className="font-medium text-sm">{endpoint}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{stats.total} calls</Badge>
                    {stats.errors > 0 && (
                      <Badge variant="destructive" className="text-xs">{stats.errors} err</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{stats.avgMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
