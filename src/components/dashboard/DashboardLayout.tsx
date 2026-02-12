import { Outlet } from 'react-router-dom';
import DashboardSidebar from './DashboardSidebar';
import { NotificationBell } from './NotificationBell';

const DashboardLayout = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Top bar with notification bell */}
        <header className="flex items-center justify-end px-8 py-3 border-b border-border/50 shrink-0">
          <NotificationBell />
        </header>
        <main className="flex-1 p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
