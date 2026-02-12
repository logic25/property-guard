import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Building2, 
  LayoutDashboard, 
  Home, 
  AlertTriangle, 
  Users, 
  ClipboardList,
  Settings,
  LogOut,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  FileStack,
  FileText,
  Calendar,
  Bell
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
  { icon: Home, label: 'Properties', href: '/dashboard/properties' },
  { icon: FolderOpen, label: 'Portfolios', href: '/dashboard/portfolios' },
  { icon: FileStack, label: 'Applications', href: '/dashboard/applications' },
  { icon: AlertTriangle, label: 'Violations', href: '/dashboard/violations' },
  { icon: Bell, label: 'Notifications', href: '/dashboard/notifications' },
  { icon: FileText, label: 'DD Reports', href: '/dashboard/dd-reports' },
  { icon: Users, label: 'Vendors', href: '/dashboard/vendors' },
  { icon: ClipboardList, label: 'Work Orders', href: '/dashboard/work-orders' },
  { icon: Calendar, label: 'Calendar', href: '/dashboard/calendar' },
];

const DashboardSidebar = () => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const NavItem = ({ item }: { item: typeof navItems[0] }) => {
    const isActive = location.pathname === item.href || 
      (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
    
    const linkContent = (
      <Link
        to={item.href}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isActive 
            ? "bg-primary text-primary-foreground" 
            : "text-muted-foreground hover:text-foreground hover:bg-secondary",
          collapsed && "justify-center px-2"
        )}
      >
        <item.icon className="w-5 h-5 shrink-0" />
        {!collapsed && item.label}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <span className="block">{linkContent}</span>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  return (
    <aside 
      className={cn(
        "min-h-screen bg-card border-r border-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "p-4 border-b border-border flex items-center",
        collapsed ? "justify-center" : "justify-between"
      )}>
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-display font-bold text-xl text-foreground">
              Property Guard
            </span>
          )}
        </Link>
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={() => setCollapsed(true)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="p-2 flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCollapsed(false)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <NavItem item={item} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="p-2 border-t border-border space-y-1">
        {collapsed ? (
          <>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <span className="block">
                  <Link
                    to="/dashboard/settings"
                    className={cn(
                      "flex items-center justify-center px-2 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      location.pathname === '/dashboard/settings'
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <Settings className="w-5 h-5" />
                  </Link>
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Settings
              </TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => signOut()}
                  className="flex items-center justify-center px-2 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors w-full"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Sign Out
              </TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <Link
              to="/dashboard/settings"
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                location.pathname === '/dashboard/settings'
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Settings className="w-5 h-5" />
              Settings
            </Link>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors w-full"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </>
        )}
      </div>

      {/* User info */}
      <div className={cn(
        "p-4 border-t border-border",
        collapsed && "p-2"
      )}>
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center mx-auto cursor-default">
                <span className="text-sm font-medium text-foreground">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              <p>{user?.email}</p>
              <p className="text-muted-foreground">Property Owner</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-foreground">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.email}
              </p>
              <p className="text-xs text-muted-foreground">Property Owner</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default DashboardSidebar;
