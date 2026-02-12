import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, AlertTriangle, FileText, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();

  const { data: profile } = useQuery({
    queryKey: ['admin-user-profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: properties } = useQuery({
    queryKey: ['admin-user-properties', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, address, borough, violations(id, status)')
        .eq('user_id', userId!);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: aiUsage } = useQuery({
    queryKey: ['admin-user-ai-usage', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_usage')
        .select('*')
        .eq('user_id', userId!)
        .order('month', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: ddReports } = useQuery({
    queryKey: ['admin-user-dd-reports', userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('dd_reports')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId!);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
  });

  const totalViolations = properties?.reduce(
    (sum, p) => sum + ((p.violations as any[])?.length || 0),
    0
  ) ?? 0;
  const openViolations = properties?.reduce(
    (sum, p) => sum + ((p.violations as any[])?.filter((v: any) => v.status === 'open').length || 0),
    0
  ) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/admin/users">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {profile?.display_name || 'User Detail'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {profile?.company_name || userId}
          </p>
        </div>
      </div>

      {/* User info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6 text-primary" />
              <div>
                <p className="text-xl font-bold">{properties?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Properties</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-destructive" />
              <div>
                <p className="text-xl font-bold">{openViolations} / {totalViolations}</p>
                <p className="text-xs text-muted-foreground">Open / Total Violations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary" />
              <div>
                <p className="text-xl font-bold">{ddReports ?? 0}</p>
                <p className="text-xs text-muted-foreground">DD Reports</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-primary" />
              <div>
                <p className="text-xl font-bold">
                  {aiUsage?.[0]?.question_count ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">AI Questions (this month)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profile details */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium">{profile?.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">License ID</dt>
              <dd className="font-medium">{profile?.license_id || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Signed Up</dt>
              <dd className="font-medium">
                {profile?.created_at ? format(new Date(profile.created_at), 'MMM d, yyyy') : '—'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Properties list */}
      <Card>
        <CardHeader>
          <CardTitle>Properties</CardTitle>
        </CardHeader>
        <CardContent>
          {!properties?.length ? (
            <p className="text-muted-foreground text-sm">No properties</p>
          ) : (
            <div className="space-y-2">
              {properties.map((p) => {
                const open = (p.violations as any[])?.filter((v: any) => v.status === 'open').length || 0;
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <p className="font-medium text-sm">{p.address}</p>
                      <p className="text-xs text-muted-foreground">{p.borough}</p>
                    </div>
                    {open > 0 && (
                      <Badge variant="destructive">{open} open violations</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
