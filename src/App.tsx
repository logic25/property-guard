import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardOverview from "@/pages/dashboard/DashboardOverview";
import PropertiesPage from "@/pages/dashboard/PropertiesPage";
import PropertyDetailPage from "@/pages/dashboard/PropertyDetailPage";
// Portfolio pages preserved in src/pages/dashboard/PortfoliosPage.tsx & PortfolioDetailPage.tsx
import ApplicationsPage from "@/pages/dashboard/ApplicationsPage";
import ViolationsPage from "@/pages/dashboard/ViolationsPage";
import DDReportsPage from "@/pages/dashboard/DDReportsPage";
import VendorsPage from "@/pages/dashboard/VendorsPage";
import WorkOrdersPage from "@/pages/dashboard/WorkOrdersPage";
import SettingsPage from "@/pages/dashboard/SettingsPage";
import CalendarPage from "@/pages/dashboard/CalendarPage";
import NotificationsPage from "@/pages/dashboard/NotificationsPage";
import AdminOverview from "@/pages/dashboard/admin/AdminOverview";
import AdminAPILogsPage from "@/pages/dashboard/admin/AdminAPILogsPage";
import AdminUsersPage from "@/pages/dashboard/admin/AdminUsersPage";
import AdminUserDetailPage from "@/pages/dashboard/admin/AdminUserDetailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardOverview />} />
              <Route path="properties" element={<PropertiesPage />} />
              <Route path="properties/:id" element={<PropertyDetailPage />} />
              {/* Portfolio routes removed – files preserved for future use */}
              <Route path="applications" element={<ApplicationsPage />} />
              <Route path="violations" element={<ViolationsPage />} />
              <Route path="dd-reports" element={<DDReportsPage />} />
              <Route path="vendors" element={<VendorsPage />} />
              <Route path="work-orders" element={<WorkOrdersPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="admin" element={<AdminOverview />} />
              <Route path="admin/api-logs" element={<AdminAPILogsPage />} />
              <Route path="admin/users" element={<AdminUsersPage />} />
              <Route path="admin/users/:userId" element={<AdminUserDetailPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
