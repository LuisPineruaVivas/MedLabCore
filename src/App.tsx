import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { BrandProvider } from "@/contexts/BrandContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { RoleRouter } from "@/components/RoleRouter";
import { RoleGuard } from "@/components/RoleGuard";
import DashboardPage from "@/pages/DashboardPage";
import PatientsPage from "@/pages/PatientsPage";
import PatientDetailPage from "@/pages/PatientDetailPage";
import TestsPage from "@/pages/TestsPage";
import VisitsPage from "@/pages/VisitsPage";
import BillingPage from "@/pages/BillingPage";
import OrdersPage from "@/pages/OrdersPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import SettingsPage from "@/pages/SettingsPage";
import OrganizationsPage from "@/pages/admin/OrganizationsPage";
import UsersPage from "@/pages/admin/UsersPage";
import LoginPage from "@/pages/LoginPage";
import NotFound from "@/pages/NotFound";
import { SuperAdminGuard } from "./components/SuperAdminGuard";
import TestsTemplatesPage from "./pages/admin/TestsTemplates";
import PatientPortalPage from "./pages/PatientPortalPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry on client errors (4xx): permission denied, not found, etc.
      // These won't resolve by retrying. Only retry on transient server errors (5xx).
      retry: (failureCount, error: unknown) => {
        const status = (error as { status?: number })?.status ?? 0;
        if (status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 1000 * 60, // 1 minute default cache
    },
    mutations: {
      retry: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/portal-paciente" element={<PatientPortalPage />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute><BrandProvider><AppLayout /></BrandProvider></ProtectedRoute>}>
              {/* Role-based home redirect */}
              <Route path="/" element={<RoleRouter />} />

              {/* Accessible to all lab roles */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/patients" element={<PatientsPage />} />
              <Route path="/patients/:id" element={<PatientDetailPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />

              {/* Tests: admin + bioanalyst only */}
              <Route element={<RoleGuard permission="canViewTests" />}>
                <Route path="/tests" element={<TestsPage />} />
              </Route>

              {/* Visits: all roles */}
              <Route path="/visits" element={<VisitsPage />} />

              {/* Billing: admin + secretary only */}
              <Route element={<RoleGuard permission="canViewBilling" />}>
                <Route path="/billing" element={<BillingPage />} />
              </Route>

              {/* Settings: admin only */}
              <Route element={<RoleGuard permission="canViewSettings" />}>
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              {/* Super admin routes */}
              <Route element={<SuperAdminGuard />}>
                <Route path="/admin/organizations" element={<OrganizationsPage />} />
                <Route path="/admin/users" element={<UsersPage />} />
                <Route path="/admin/tests-templates" element={<TestsTemplatesPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
