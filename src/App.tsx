import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { BrandProvider } from "@/contexts/BrandContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { RoleRouter } from "@/components/RoleRouter";
import { RoleGuard } from "@/components/RoleGuard";
import { SuperAdminGuard } from "./components/SuperAdminGuard";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const PatientsPage = lazy(() => import("@/pages/PatientsPage"));
const PatientDetailPage = lazy(() => import("@/pages/PatientDetailPage"));
const TestsPage = lazy(() => import("@/pages/TestsPage"));
const VisitsPage = lazy(() => import("@/pages/VisitsPage"));
const BillingPage = lazy(() => import("@/pages/BillingPage"));
const OrdersPage = lazy(() => import("@/pages/OrdersPage"));
const OrderDetailPage = lazy(() => import("@/pages/OrderDetailPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const OrganizationsPage = lazy(() => import("@/pages/admin/OrganizationsPage"));
const UsersPage = lazy(() => import("@/pages/admin/UsersPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const TestsTemplatesPage = lazy(() => import("./pages/admin/TestsTemplates"));
const TemplateBuilderPage = lazy(() => import("./pages/admin/TemplateBuilderPage"));
const PatientPortalPage = lazy(() => import("./pages/PatientPortalPage"));

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
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/portal-paciente" element={<PatientPortalPage />} />

              <Route element={<ProtectedRoute><BrandProvider><AppLayout /></BrandProvider></ProtectedRoute>}>
                <Route path="/" element={<RoleRouter />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/patients" element={<PatientsPage />} />
                <Route path="/patients/:id" element={<PatientDetailPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/orders/:id" element={<OrderDetailPage />} />

                <Route element={<RoleGuard permission="canViewTests" />}>
                  <Route path="/tests" element={<TestsPage />} />
                  <Route path="/tests/templates/new" element={<TemplateBuilderPage />} />
                  <Route path="/tests/templates/:id/edit" element={<TemplateBuilderPage />} />
                </Route>

                <Route path="/visits" element={<VisitsPage />} />

                <Route element={<RoleGuard permission="canViewBilling" />}>
                  <Route path="/billing" element={<BillingPage />} />
                </Route>

                <Route element={<RoleGuard permission="canViewSettings" />}>
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>

                <Route element={<SuperAdminGuard />}>
                  <Route path="/admin/organizations" element={<OrganizationsPage />} />
                  <Route path="/admin/users" element={<UsersPage />} />
                  <Route path="/admin/tests-templates" element={<TestsTemplatesPage />} />
                  <Route path="/admin/tests-templates/new" element={<TemplateBuilderPage />} />
                  <Route path="/admin/tests-templates/:id/edit" element={<TemplateBuilderPage />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
