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
import IndividualPayrollAdjustments from "@/pages/payroll/individual-payroll-adjustments";
import Payslips from "@/pages/payslips/payslips";
import BankReports from "@/pages/reports/bank-reports";
import Notifications from "@/pages/notifications/notifications";
import Settings from "@/pages/settings/settings";
import ProfileSettings from "@/pages/settings/profile-settings";
import LeaveApprovalWorkflow from "@/pages/leave/leave-approval-workflow";
import StaffPortal from "@/pages/staff-portal/staff-portal";
import PromotionsManagement from "@/pages/promotions/PromotionsManagement"; // New Import
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
      {/* Public routes (unauthenticated) */}
      <Route path="/forgot-password">
        {!user ? <ForgotPasswordPage /> : <Redirect to="/dashboard" />}
      </Route>
      
      <Route path="/reset-password">
        <ResetPasswordPage />
      </Route>
      
      {/* Login route */}
      <Route path="/">
        {!user ? <LoginPage /> : <Redirect to={user.role === 'staff' ? '/staff-portal' : '/dashboard'} />}
      </Route>
      
      {/* Protected routes (authenticated) */}
      <Route path="/dashboard">
        {user ? (
          user.role === 'staff' ? (
            <Redirect to="/staff-portal" />
          ) : (
            <ResponsiveLayout>
              <Dashboard />
            </ResponsiveLayout>
          )
        ) : (
          <Redirect to="/" />
        )}
      </Route>
      
      <Route path="/staff">
        {user ? (
          <ResponsiveLayout>
            <AuthGuard roles={['super_admin', 'account_admin', 'payroll_admin']}>
              <StaffManagement />
            </AuthGuard>
          </ResponsiveLayout>
        ) : (
          <Redirect to="/" />
        )}
      </Route>
      
      <Route path="/departments">
        {user ? (
          <ResponsiveLayout>
            <AuthGuard roles={['super_admin', 'account_admin', 'payroll_admin']}>
              <Departments />
            </AuthGuard>
          </ResponsiveLayout>
        ) : (
          <Redirect to="/" />
        )}
      </Route>
      
      <Route path="/payroll">
        {user ? (
          <ResponsiveLayout>
            <AuthGuard roles={['super_admin', 'account_admin', 'payroll_admin']}>
              <PayrollProcessing />
            </AuthGuard>
          </ResponsiveLayout>
        ) : (
          <Redirect to="/" />
        )}
      </Route>
      
      <Route path="/payroll/workflow">
        {user ? (
          <ResponsiveLayout>
            <AuthGuard roles={['super_admin', 'account_admin', 'payroll_admin']}>
              <PayrollWorkflow />
            </AuthGuard>
          </ResponsiveLayout>
        ) : (
          <Redirect to="/" />
        )}
      </Route>
      
      <Route path="/payroll/adjustments">
        {user ? (
          <ResponsiveLayout>
            <AuthGuard roles={['super_admin', 'payroll_admin']}>
              <IndividualPayrollAdjustments />
            </AuthGuard>
          </ResponsiveLayout>
        ) : (
          <Redirect to="/" />
        )}
      </Route>
      
      <Route path="/payslips">
        {user ? (
          <ResponsiveLayout>
            <AuthGuard roles={['super_admin', 'account_admin', 'payroll_admin', 'staff']}>
              <Payslips />
            </AuthGuard>
          </ResponsiveLayout>
        ) : (
          <Redirect to="/" />
        )}
      </Route>
      
      <Route path="/leave/approval">
        {user ? (
          <ResponsiveLayout>
            <AuthGuard roles={['super_admin', 'account_admin', 'payroll_admin']}>
              <LeaveApprovalWorkflow />
            </AuthGuard>
          </ResponsiveLayout>
        ) : (
          <Redirect to="/" />
        )}
      </Route>
      
      <Route path="/reports">
        {user ? (
          <ResponsiveLayout>
            <AuthGuard roles={['super_admin', 'account_admin']}>
              <BankReports />
            </AuthGuard>
          </ResponsiveLayout>
        ) : (
          <Redirect to="/" />
        )}
      </Route>
      
      <Route path="/notifications">
        {user ? (
          <ResponsiveLayout>
            <Notifications />
          </ResponsiveLayout>
        ) : (
          <Redirect to="/" />
        )}
      </Route>
      
      <Route path="/settings">
        {user ? (
          <ResponsiveLayout>
            <AuthGuard roles={['super_admin']}>
              <Settings />
            </AuthGuard>
          </ResponsiveLayout>
        ) : (
          <Redirect to="/" />
        )}
      </Route>
      
      <Route path="/settings/profile">
        {user ? (
          <ResponsiveLayout>
            <ProfileSettings />
          </ResponsiveLayout>
        ) : (
          <Redirect to="/" />
        )}
      </Route>

      {/* New Promotions Management Route */}
      <Route path="/promotions">
        {user ? (
          <ResponsiveLayout>
            <AuthGuard roles={['super_admin', 'payroll_admin']}>
              <PromotionsManagement />
            </AuthGuard>
          </ResponsiveLayout>
        ) : (
          <Redirect to="/" />
        )}
      </Route>
      
      {/* New Loan Management Route */}
      <Route path="/loans">
        {user ? (
          <ResponsiveLayout>
            <AuthGuard roles={['super_admin', 'account_admin', 'payroll_admin']}>
              <LoanManagement />
            </AuthGuard>
          </ResponsiveLayout>
        ) : (
          <Redirect to="/" />
        )}
      </Route>
      
      <Route path="/staff-portal">
        {user ? (
          <ResponsiveLayout>
            <AuthGuard roles={['staff']}>
              <StaffPortal />
            </AuthGuard>
          </ResponsiveLayout>
        ) : (
          <Redirect to="/" />
        )}
      </Route>
      
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
