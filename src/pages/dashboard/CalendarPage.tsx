import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertTriangle, FileStack, ClipboardList, FileText } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek, isPast, isBefore, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface CalendarEvent {
  id: string;
  date: Date;
  title: string;
  subtitle: string;
  type: 'hearing' | 'cure_deadline' | 'certification' | 'permit_expiration' | 'document_expiration' | 'work_order';
  propertyId: string;
  propertyAddress: string;
  urgent: boolean;
}

const EVENT_COLORS: Record<CalendarEvent['type'], string> = {
  hearing: 'bg-destructive/15 text-destructive border-destructive/30',
  cure_deadline: 'bg-warning/15 text-warning border-warning/30',
  certification: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300/30',
  permit_expiration: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300/30',
  document_expiration: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300/30',
  work_order: 'bg-muted text-muted-foreground border-muted',
};

const EVENT_LABELS: Record<CalendarEvent['type'], string> = {
  hearing: 'Hearing',
  cure_deadline: 'Cure Deadline',
  certification: 'Certification Due',
  permit_expiration: 'Permit Expires',
  document_expiration: 'Doc Expires',
  work_order: 'Work Order',
};

const EVENT_ICONS: Record<CalendarEvent['type'], typeof AlertTriangle> = {
  hearing: AlertTriangle,
  cure_deadline: AlertTriangle,
  certification: AlertTriangle,
  permit_expiration: FileStack,
  document_expiration: FileText,
  work_order: ClipboardList,
};

const CalendarPage = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const navigate = useNavigate();

  // Fetch violations with dates
  const { data: violations } = useQuery({
    queryKey: ['calendar-violations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('violations')
        .select('id, hearing_date, cure_due_date, certification_due_date, violation_number, agency, status, property_id, properties!inner(address)')
        .or('hearing_date.not.is.null,cure_due_date.not.is.null,certification_due_date.not.is.null');
      if (error) throw error;
      return data;
    },
  });

  // Fetch applications with expiration dates
  const { data: applications } = useQuery({
    queryKey: ['calendar-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select('id, application_number, expiration_date, application_type, status, property_id, properties!inner(address)')
        .not('expiration_date', 'is', null);
      if (error) throw error;
      return data;
    },
  });

  // Fetch documents with expiration dates
  const { data: documents } = useQuery({
    queryKey: ['calendar-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_documents')
        .select('id, document_name, document_type, expiration_date, property_id, properties!inner(address)')
        .not('expiration_date', 'is', null);
      if (error) throw error;
      return data;
    },
  });

  // Build events
  const events = useMemo<CalendarEvent[]>(() => {
    const result: CalendarEvent[] = [];
    const sevenDaysFromNow = addDays(new Date(), 7);

    (violations || []).forEach((v: any) => {
      const addr = (v.properties as any)?.address || 'Unknown';
      if (v.hearing_date) {
        const d = new Date(v.hearing_date);
        result.push({
          id: `hearing-${v.id}`, date: d, title: `${v.agency} Hearing`, subtitle: `#${v.violation_number}`,
          type: 'hearing', propertyId: v.property_id, propertyAddress: addr,
          urgent: isBefore(d, sevenDaysFromNow) && !isPast(d),
        });
      }
      if (v.cure_due_date) {
        const d = new Date(v.cure_due_date);
        result.push({
          id: `cure-${v.id}`, date: d, title: `Cure Deadline`, subtitle: `${v.agency} #${v.violation_number}`,
          type: 'cure_deadline', propertyId: v.property_id, propertyAddress: addr,
          urgent: isBefore(d, sevenDaysFromNow) && !isPast(d),
        });
      }
      if (v.certification_due_date) {
        const d = new Date(v.certification_due_date);
        result.push({
          id: `cert-${v.id}`, date: d, title: `Certification Due`, subtitle: `${v.agency} #${v.violation_number}`,
          type: 'certification', propertyId: v.property_id, propertyAddress: addr,
          urgent: isBefore(d, sevenDaysFromNow) && !isPast(d),
        });
      }
    });

    (applications || []).forEach((a: any) => {
      if (a.expiration_date) {
        const d = new Date(a.expiration_date);
        const addr = (a.properties as any)?.address || 'Unknown';
        result.push({
          id: `permit-${a.id}`, date: d, title: `Permit Expires`, subtitle: `${a.application_type} ${a.application_number}`,
          type: 'permit_expiration', propertyId: a.property_id, propertyAddress: addr,
          urgent: isBefore(d, sevenDaysFromNow) && !isPast(d),
        });
      }
    });

    (documents || []).forEach((doc: any) => {
      if (doc.expiration_date) {
        const d = new Date(doc.expiration_date);
        const addr = (doc.properties as any)?.address || 'Unknown';
        result.push({
          id: `doc-${doc.id}`, date: d, title: `${doc.document_type} Expires`, subtitle: doc.document_name,
          type: 'document_expiration', propertyId: doc.property_id, propertyAddress: addr,
          urgent: isBefore(d, sevenDaysFromNow) && !isPast(d),
        });
      }
    });

    return result;
  }, [violations, applications, documents]);

  const filteredEvents = useMemo(() => {
    if (typeFilter === 'all') return events;
    return events.filter(e => e.type === typeFilter);
  }, [events, typeFilter]);

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const eventsForDay = (day: Date) => filteredEvents.filter(e => isSameDay(e.date, day));
  const selectedDayEvents = selectedDay ? eventsForDay(selectedDay) : [];

  // Upcoming events (next 30 days)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const thirtyDays = addDays(now, 30);
    return filteredEvents
      .filter(e => !isPast(e.date) || isToday(e.date))
      .filter(e => isBefore(e.date, thirtyDays))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filteredEvents]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Compliance Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track hearings, deadlines, permit expirations, and certifications across all properties
          </p>
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="hearing">Hearings</SelectItem>
            <SelectItem value="cure_deadline">Cure Deadlines</SelectItem>
            <SelectItem value="certification">Certifications</SelectItem>
            <SelectItem value="permit_expiration">Permit Expirations</SelectItem>
            <SelectItem value="document_expiration">Document Expirations</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-4">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="font-display text-lg font-semibold">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {calDays.map(day => {
              const dayEvents = eventsForDay(day);
              const inMonth = isSameMonth(day, currentMonth);
              const today = isToday(day);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const hasUrgent = dayEvents.some(e => e.urgent);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`
                    min-h-[80px] p-1.5 text-left transition-colors bg-card hover:bg-muted/50
                    ${!inMonth ? 'opacity-40' : ''}
                    ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}
                  `}
                >
                  <div className={`
                    text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
                    ${today ? 'bg-primary text-primary-foreground' : 'text-foreground'}
                  `}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => (
                      <div
                        key={ev.id}
                        className={`text-[10px] leading-tight px-1 py-0.5 rounded border truncate ${EVENT_COLORS[ev.type]}`}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar: selected day or upcoming */}
        <div className="space-y-4">
          {selectedDay ? (
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-3">
                {format(selectedDay, 'EEEE, MMM d, yyyy')}
              </h3>
              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events on this day.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map(ev => {
                    const Icon = EVENT_ICONS[ev.type];
                    return (
                      <div
                        key={ev.id}
                        className="p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => navigate(`/dashboard/properties/${ev.propertyId}`)}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{ev.title}</span>
                              <Badge variant="outline" className={`text-[10px] ${EVENT_COLORS[ev.type]}`}>
                                {EVENT_LABELS[ev.type]}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{ev.subtitle}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{ev.propertyAddress}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {/* Upcoming events */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Upcoming (30 days)
            </h3>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {upcomingEvents.map(ev => {
                  const Icon = EVENT_ICONS[ev.type];
                  return (
                    <div
                      key={ev.id}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-colors hover:bg-muted/30 ${ev.urgent ? 'border-destructive/40 bg-destructive/5' : 'border-border'}`}
                      onClick={() => navigate(`/dashboard/properties/${ev.propertyId}`)}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${ev.urgent ? 'text-destructive' : 'text-muted-foreground'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground truncate">{ev.title}</span>
                            <span className={`text-[10px] font-medium whitespace-nowrap ${ev.urgent ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {format(ev.date, 'MM/dd/yy')}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{ev.subtitle}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{ev.propertyAddress}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
