import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

export default function AdminAPILogsPage() {
  const [endpointFilter, setEndpointFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['admin-api-logs', endpointFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('api_call_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (endpointFilter !== 'all') query = query.eq('endpoint', endpointFilter);
      if (statusFilter === 'errors') query = query.or('status_code.gte.400,status_code.is.null');
      if (statusFilter === 'success') query = query.gte('status_code', 200).lt('status_code', 400);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 15_000,
  });

  const getStatusBadge = (code: number | null) => {
    if (!code) return <Badge variant="destructive">ERR</Badge>;
    if (code >= 200 && code < 300) return <Badge className="bg-green-600 text-white">{code}</Badge>;
    if (code >= 300 && code < 400) return <Badge variant="secondary">{code}</Badge>;
    if (code >= 400) return <Badge variant="destructive">{code}</Badge>;
    return <Badge variant="outline">{code}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">API Call Logs</h1>
        <p className="text-muted-foreground">All outgoing NYC Open Data API calls</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={endpointFilter} onValueChange={setEndpointFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Endpoint" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Endpoints</SelectItem>
            <SelectItem value="PLUTO">PLUTO</SelectItem>
            <SelectItem value="DOB_JOBS">DOB Jobs</SelectItem>
            <SelectItem value="ECB">ECB</SelectItem>
            <SelectItem value="OATH">OATH</SelectItem>
            <SelectItem value="PAD">PAD</SelectItem>
            <SelectItem value="DOB_VIOLATIONS">DOB Violations</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="errors">Errors</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading...</TableCell>
                </TableRow>
              ) : !logs?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No API calls logged yet</TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.endpoint}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status_code)}</TableCell>
                    <TableCell className="text-sm">{log.response_time_ms}ms</TableCell>
                    <TableCell className="text-xs text-destructive max-w-[300px] truncate">
                      {log.error_message || '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
