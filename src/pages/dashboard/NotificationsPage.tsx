import { useState, useMemo } from 'react';
import { Bell, CheckCheck, Trash2, AlertTriangle, AlertCircle, Info, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow, format } from 'date-fns';

const priorityConfig: Record<string, { icon: typeof Bell; color: string; bg: string; label: string }> = {
  critical: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Critical' },
  high: { icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10', label: 'High' },
  normal: { icon: Info, color: 'text-primary', bg: 'bg-primary/10', label: 'Normal' },
  low: { icon: Info, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Low' },
};

const NotificationsPage = () => {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');

  const categories = useMemo(() => {
    return [...new Set(notifications.map(n => n.category))].sort();
  }, [notifications]);

  const filtered = useMemo(() => {
    return notifications.filter(n => {
      if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false;
      if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
      if (readFilter === 'unread' && n.is_read) return false;
      if (readFilter === 'read' && !n.is_read) return false;
      return true;
    });
  }, [notifications, priorityFilter, categoryFilter, readFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    filtered.forEach(n => {
      const day = format(new Date(n.created_at), 'yyyy-MM-dd');
      if (!groups[day]) groups[day] = [];
      groups[day].push(n);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const formatDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) return 'Today';
    if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) return 'Yesterday';
    return format(date, 'EEEE, MMM d, yyyy');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => markAllAsRead()}>
            <CheckCheck className="w-4 h-4" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />
          Filters:
        </div>
        <Select value={readFilter} onValueChange={setReadFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        {categories.length > 1 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Notification List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <h3 className="text-lg font-medium text-muted-foreground">No notifications</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {notifications.length === 0
                ? 'Notifications will appear here when there are updates to your properties.'
                : 'No notifications match the current filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {formatDayLabel(day)}
              </h3>
              <div className="space-y-2">
                {items.map(n => {
                  const config = priorityConfig[n.priority] || priorityConfig.normal;
                  const Icon = config.icon;
                  return (
                    <Card
                      key={n.id}
                      className={cn(
                        'transition-colors',
                        !n.is_read && 'border-primary/30 bg-primary/[0.02]'
                      )}
                    >
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start gap-3">
                          <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5', config.bg)}>
                            <Icon className={cn('w-4 h-4', config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={cn('text-sm font-medium', !n.is_read ? 'text-foreground' : 'text-muted-foreground')}>
                                {n.title}
                              </p>
                              <Badge
                                variant="outline"
                                className={cn('text-[10px] px-1.5 py-0 capitalize', config.color)}
                              >
                                {config.label}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                                {n.category}
                              </Badge>
                              {!n.is_read && (
                                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                            <p className="text-xs text-muted-foreground mt-1.5">
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!n.is_read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => markAsRead(n.id)}
                                title="Mark as read"
                              >
                                <CheckCheck className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteNotification(n.id)}
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
