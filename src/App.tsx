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
import PortfoliosPage from "@/pages/dashboard/PortfoliosPage";
import PortfolioDetailPage from "@/pages/dashboard/PortfolioDetailPage";
import ApplicationsPage from "@/pages/dashboard/ApplicationsPage";
import ViolationsPage from "@/pages/dashboard/ViolationsPage";
import DDReportsPage from "@/pages/dashboard/DDReportsPage";
import VendorsPage from "@/pages/dashboard/VendorsPage";
import WorkOrdersPage from "@/pages/dashboard/WorkOrdersPage";
import SettingsPage from "@/pages/dashboard/SettingsPage";
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
              <Route path="portfolios" element={<PortfoliosPage />} />
              <Route path="portfolios/:id" element={<PortfolioDetailPage />} />
              <Route path="applications" element={<ApplicationsPage />} />
              <Route path="violations" element={<ViolationsPage />} />
              <Route path="dd-reports" element={<DDReportsPage />} />
              <Route path="vendors" element={<VendorsPage />} />
              <Route path="work-orders" element={<WorkOrdersPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
