import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, AlertTriangle, FileText, Wrench, CheckCircle, Clock, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityLog {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  metadata: unknown;
  created_at: string;
}

interface PropertyActivityTabProps {
  propertyId: string;
}

export const PropertyActivityTab = ({ propertyId }: PropertyActivityTabProps) => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('property_activity_log')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [propertyId]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'sync':
        return <RefreshCw className="w-4 h-4" />;
      case 'violation_added':
        return <AlertTriangle className="w-4 h-4" />;
      case 'violation_status_change':
        return <CheckCircle className="w-4 h-4" />;
      case 'document_uploaded':
        return <FileText className="w-4 h-4" />;
      case 'work_order_created':
      case 'work_order_updated':
        return <Wrench className="w-4 h-4" />;
      case 'property_updated':
        return <Zap className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'sync':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'violation_added':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'violation_status_change':
        return 'bg-success/10 text-success border-success/20';
      case 'document_uploaded':
        return 'bg-secondary text-secondary-foreground border-secondary';
      case 'work_order_created':
      case 'work_order_updated':
        return 'bg-warning/10 text-warning border-warning/20';
      default:
        return 'bg-muted text-muted-foreground border-muted';
    }
  };

  const formatActivityType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No activity yet</p>
              <p className="text-sm">Activities will appear here when you sync violations, add documents, or create work orders.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
              
              <div className="space-y-4">
                {activities.map((activity, index) => (
                  <div key={activity.id} className="relative pl-10">
                    {/* Timeline dot */}
                    <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border ${getActivityColor(activity.activity_type)}`}>
                      {getActivityIcon(activity.activity_type)}
                    </div>
                    
                    <div className="bg-card border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{activity.title}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {formatActivityType(activity.activity_type)}
                            </Badge>
                          </div>
                          {activity.description && (
                            <p className="text-sm text-muted-foreground">
                              {activity.description}
                            </p>
                          )}
                          {activity.metadata && typeof activity.metadata === 'object' && !Array.isArray(activity.metadata) && Object.keys(activity.metadata as Record<string, unknown>).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {Object.entries(activity.metadata as Record<string, unknown>).map(([key, value]) => (
                                <Badge key={key} variant="secondary" className="text-[10px]">
                                  {key}: {String(value)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
