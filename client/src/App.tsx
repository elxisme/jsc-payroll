import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AuthGuard } from "@/components/auth-guard";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";

// Pages
import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/auth/forgot-password";
import ResetPasswordPage from "@/pages/auth/reset-password";
import Dashboard from "@/pages/dashboard";
import StaffManagement from "@/pages/staff/staff-management";
import Departments from "@/pages/departments/departments";
import PayrollProcessing from "@/pages/payroll/payroll-processing";
import PayrollWorkflow from "@/pages/payroll/payroll-workflow";
import Payslips from "@/pages/payslips/payslips";
import BankReports from "@/pages/reports/bank-reports";
import Notifications from "@/pages/notifications/notifications";
import Settings from "@/pages/settings/settings";
import StaffPortal from "@/pages/staff-portal/staff-portal";
import NotFound from "@/pages/not-found";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nigeria-green"></div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Unauthenticated routes */}
      {!user && (
        <>
          <Route path="/forgot-password">
            <ForgotPasswordPage />
          </Route>
          <Route path="/reset-password">
            <ResetPasswordPage />
          </Route>
          <Route>
            <LoginPage />
          </Route>
        </>
      )}
      
      {/* Authenticated routes */}
      {user && (
        <ResponsiveLayout>
          <Switch>
            <Route path="/">
              <Dashboard />
            </Route>
            
            <Route path="/dashboard">
              <Dashboard />
            </Route>
            
            <Route path="/staff">
              <AuthGuard roles={['super_admin', 'account_admin', 'payroll_admin']}>
                <StaffManagement />
              </AuthGuard>
            </Route>
            
            <Route path="/departments">
              <AuthGuard roles={['super_admin', 'account_admin', 'payroll_admin']}>
                <Departments />
              </AuthGuard>
            </Route>
            
            <Route path="/payroll">
              <AuthGuard roles={['super_admin', 'account_admin', 'payroll_admin']}>
                <PayrollProcessing />
              </AuthGuard>
            </Route>
            
            <Route path="/payroll/workflow">
              <AuthGuard roles={['super_admin', 'account_admin', 'payroll_admin']}>
                <PayrollWorkflow />
              </AuthGuard>
            </Route>
            
            <Route path="/payslips">
              <AuthGuard roles={['super_admin', 'account_admin', 'payroll_admin', 'staff']}>
                <Payslips />
              </AuthGuard>
            </Route>
            
            <Route path="/reports">
              <AuthGuard roles={['super_admin', 'account_admin']}>
                <BankReports />
              </AuthGuard>
            </Route>
            
            <Route path="/notifications" component={Notifications} />
            
            <Route path="/settings">
              <AuthGuard roles={['super_admin']}>
                <Settings />
              </AuthGuard>
            </Route>
            
            <Route path="/staff-portal">
              <AuthGuard roles={['staff']}>
                <StaffPortal />
              </AuthGuard>
            </Route>
            
            <Route component={NotFound} />
          </Switch>
        </ResponsiveLayout>
      )}
      
      {/* Fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <AppContent />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
