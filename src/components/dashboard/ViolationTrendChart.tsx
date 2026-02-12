import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

interface Violation {
  id: string;
  issued_date: string;
  severity: string | null;
}

interface ViolationTrendChartProps {
  violations: Violation[];
}

export function ViolationTrendChart({ violations }: ViolationTrendChartProps) {
  const data = useMemo(() => {
    const now = new Date();
    const months: { month: string; critical: number; high: number; moderate: number; low: number; total: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);

      const monthViolations = violations.filter(v => {
        if (!v.issued_date) return false;
        const d = new Date(v.issued_date);
        return isWithinInterval(d, { start, end });
      });

      const severityCounts = { critical: 0, high: 0, moderate: 0, low: 0 };
      monthViolations.forEach(v => {
        const s = (v.severity || 'moderate').toLowerCase();
        if (s === 'critical') severityCounts.critical++;
        else if (s === 'high') severityCounts.high++;
        else if (s === 'low') severityCounts.low++;
        else severityCounts.moderate++;
      });

      months.push({
        month: format(monthDate, 'MMM yy'),
        ...severityCounts,
        total: monthViolations.length,
      });
    }

    return months;
  }, [violations]);

  const hasData = data.some(d => d.total > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Violation Trends (12 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            No violation data to display trends.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Violation Trends (12 Months)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            />
            <Line
              type="monotone"
              dataKey="critical"
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Critical"
            />
            <Line
              type="monotone"
              dataKey="high"
              stroke="hsl(var(--warning))"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="High"
            />
            <Line
              type="monotone"
              dataKey="moderate"
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Moderate"
            />
            <Line
              type="monotone"
              dataKey="low"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              dot={{ r: 2 }}
              strokeDasharray="4 4"
              name="Low"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
