import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useRealtime } from '@/hooks/use-realtime';
import { supabase } from '@/lib/supabase';
import { getLeaveStatistics } from '@/lib/leave-management-utils';
import { formatDisplayCurrency } from '@/lib/currency-utils';
import { AddStaffModal } from '@/pages/staff/add-staff-modal';
import { BulkImportStaffModal } from '@/pages/staff/bulk-import-staff-modal';
import { generateStaffReportPDF } from '@/lib/pdf-generator';
import { PayrollDetailsModal } from '@/components/payroll-details-modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import {
  Users,
  DollarSign,
  Clock,
  Building,
  Calendar,
  ArrowUp,
  ArrowDown,
  Eye,
  Download,
  UserPlus,
  Upload,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
// The Recharts import is no longer needed since the chart is removed.
// I am removing it to keep the code clean, as it's part of the "chart" functionality.
// import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const [showAddStaffModal, setShowAddStaffModal] = React.useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = React.useState(false);
  const [showPayrollDetailsModal, setShowPayrollDetailsModal] = React.useState(false);
  const [selectedPayrollRun, setSelectedPayrollRun] = React.useState<any>(null);
  const { toast } = useToast();

  // Enable real-time updates for dashboard
  const { isConnected, activeSubscriptions } = useRealtime({
    enableNotifications: true,
    enablePayrollUpdates: hasRole(['super_admin', 'account_admin', 'payroll_admin']),
    enableStaffUpdates: hasRole(['super_admin', 'payroll_admin']),
    enableDepartmentUpdates: hasRole(['super_admin', 'payroll_admin']),
  });
  // Fetch dashboard statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      console.log('Fetching dashboard stats...');
      const [staffCount, payrollData, pendingApprovals, departmentCount, leaveStats] = await Promise.all([
        supabase.from('staff').select('id', { count: 'exact' }).eq('status', 'active'),
        supabase.from('payroll_runs').select('gross_amount, net_amount').eq('status', 'processed').order('created_at', { ascending: false }).limit(1),
        supabase.from('payroll_runs').select('id', { count: 'exact' }).eq('status', 'pending_review'),
        supabase.from('departments').select('id', { count: 'exact' }),
        getLeaveStatistics(),
      ]);

      console.log('Dashboard stats result:', {
        totalStaff: staffCount.count,
        monthlyPayroll: payrollData.data?.[0]?.gross_amount,
        pendingApprovals: pendingApprovals.count,
        departments: departmentCount.count,
        leaveStats,
      });
      return {
        totalStaff: staffCount.count || 0,
        monthlyPayroll: payrollData.data?.[0]?.gross_amount || '0',
        pendingApprovals: pendingApprovals.count || 0,
        departments: departmentCount.count || 0,
        pendingLeaveRequests: leaveStats.totalPendingRequests || 0,
        staffOnLeave: leaveStats.totalStaffOnLeave || 0,
      };
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds to keep stats current
  });

  // Fetch recent payroll runs
  const { data: recentPayrolls, isLoading: payrollsLoading } = useQuery({
    queryKey: ['recent-payrolls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_runs')
        .select(`
          *,
          departments (
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && hasRole(['super_admin', 'account_admin', 'payroll_admin']),
  });

  // Fetch payroll trends for charts (This function is no longer used by the UI but is kept as requested)
  const { data: payrollTrends, isLoading: trendsLoading } = useQuery({
    queryKey: ['payroll-trends'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_runs')
        .select('period, gross_amount, net_amount, total_deductions, total_staff')
        .eq('status', 'processed')
        .order('period', { ascending: true })
        .limit(12);

      if (error) throw error;
      
      return (data || []).map(run => ({
        period: run.period,
        grossAmount: parseFloat(run.gross_amount || '0'),
        netAmount: parseFloat(run.net_amount || '0'),
        totalDeductions: parseFloat(run.total_deductions || '0'),
        totalStaff: run.total_staff || 0,
      }));
    },
    enabled: !!user && hasRole(['super_admin', 'account_admin', 'payroll_admin']),
  });

  // Fetch notifications
  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['recent-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Format currency
  const formatCurrency = (amount: string | number) => {
    return formatDisplayCurrency(amount);
  };

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'processed':
        return 'default';
      case 'pending_review':
        return 'secondary';
      case 'approved':
        return 'default';
      case 'draft':
        return 'outline';
      default:
        return 'outline';
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed':
        return 'text-green-600';
      case 'pending_review':
        return 'text-yellow-600';
      case 'approved':
        return 'text-blue-600';
      case 'draft':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  // Handle bulk import
  const handleBulkImport = () => {
    setShowBulkImportModal(true);
  };

  // Handle generate staff report
  const handleGenerateStaffReport = async () => {
    try {
      const { data: staffData, error } = await supabase
        .from('staff')
        .select(`
          *,
          departments!staff_department_id_fkey (
            name,
            code
          )
        `)
        .order('first_name');

      if (error) throw error;

      if (!staffData || staffData.length === 0) {
        toast({
          title: "No Data",
          description: "No staff data available to generate report",
          variant: "destructive",
        });
        return;
      }

      await generateStaffReportPDF(staffData);
      
      toast({
        title: "Success",
        description: "Staff analytics report generated successfully",
      });

      // Create notification for admins
      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .in('role', ['super_admin', 'payroll_admin']);

      if (adminUsers?.length) {
        const notifications = adminUsers.map(admin => ({
          user_id: admin.id,
          title: 'Staff Report Generated',
          message: 'A new staff analytics report has been generated and downloaded.',
          type: 'info',
        }));

        await supabase
          .from('notifications')
          .insert(notifications);
      }
    } catch (error) {
      console.error('Error generating staff report:', error);
      toast({
        title: "Error",
        description: "Failed to generate staff report",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="pb-4 border-b border-gray-200">
        <div className="w-full">
          <h1 className="text-responsive-xl font-bold text-gray-900 mb-2">Dashboard Overview</h1>
          <p className="text-responsive-sm text-gray-600">
            Welcome back! Here's what's happening with your payroll system.
          </p>
        </div>
      </div>

      {/* Stats Cards - Mobile First Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
        {/* Total Staff */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-responsive-sm font-medium text-gray-600">Total Staff</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
                  {statsLoading ? '...' : stats?.totalStaff.toLocaleString()}
                </p>
                <p className="text-xs sm:text-sm text-green-600 mt-1 flex items-center">
                  <ArrowUp className="h-3 w-3 mr-1 flex-shrink-0" />
                  Active employees
                </p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="text-blue-600" size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Payroll */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Monthly Payroll</p>
                <p className="text-3xl font-bold text-gray-900">
                  {statsLoading ? '...' : formatCurrency(stats?.monthlyPayroll || 0)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Latest processing
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="text-nigeria-green" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
                <p className="text-3xl font-bold text-gray-900">
                  {statsLoading ? '...' : stats?.pendingApprovals}
                </p>
                <p className="text-sm text-orange-600 mt-1 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Requires attention
                </p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="text-orange-600" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Leave Requests */}
        {hasRole(['super_admin', 'account_admin', 'payroll_admin']) && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Leave Requests</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {statsLoading ? '...' : stats?.pendingLeaveRequests}
                  </p>
                  <p className="text-sm text-blue-600 mt-1 flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    Pending approval
                  </p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Calendar className="text-blue-600" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Departments */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Departments</p>
                <p className="text-3xl font-bold text-gray-900">
                  {statsLoading ? '...' : stats?.departments}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  System wide
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Building className="text-purple-600" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/*
        THE PAYROLL TRENDS CHART HAS BEEN REMOVED FROM THIS SECTION FOR TROUBLESHOOTING.
        The data fetching function 'useQuery({ queryKey: ['payroll-trends'], ... })' still exists
        but the UI part that renders the chart is gone.
      */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Recent Payroll Runs */}
          {hasRole(['super_admin', 'account_admin', 'payroll_admin']) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Payroll Runs</CardTitle>
                  <Link href="/payroll/workflow">
                    <Button variant="ghost" size="sm" className="text-nigeria-green">
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {payrollsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse flex space-x-4">
                        <div className="rounded-full bg-gray-200 h-10 w-10"></div>
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentPayrolls && recentPayrolls.length > 0 ? (
                  <div className="space-y-4">
                    {recentPayrolls.map((payroll) => (
                      <div key={payroll.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <DollarSign className="text-nigeria-green" size={20} />
                          </div>
                          <div>
                            <p className="font-medium">{payroll.period}</p>
                            <p className="text-sm text-gray-500">
                              {payroll.departments?.name || 'All Departments'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(payroll.gross_amount || 0)}</p>
                            <Badge variant={getStatusVariant(payroll.status)}>
                              {payroll.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                          <div className="flex space-x-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPayrollRun(payroll);
                                    setShowPayrollDetailsModal(true);
                                  }}
                                >
                                  <Eye size={16} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View payroll details</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Download size={16} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Download payroll report</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <DollarSign className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <p>No payroll runs found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Staff Management Quick Actions */}
          {hasRole(['super_admin', 'payroll_admin']) && (
            <Card>
              <CardHeader>
                <CardTitle>Staff Management</CardTitle>
                <p className="text-sm text-gray-600">Quick actions for staff records</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => setShowAddStaffModal(true)}
                        variant="outline"
                        className="flex flex-col items-center p-6 h-auto border-dashed hover:border-nigeria-green hover:bg-green-50"
                      >
                        <UserPlus className="h-8 w-8 text-gray-400 mb-2" />
                        <span className="font-medium">Add New Staff</span>
                        <span className="text-xs text-gray-500 mt-1">Create staff profile</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Add a new staff member to the system</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleBulkImport}
                        variant="outline"
                        className="flex flex-col items-center p-6 h-auto border-dashed hover:border-blue-500 hover:bg-blue-50"
                      >
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                        <span className="font-medium">Bulk Import</span>
                        <span className="text-xs text-gray-500 mt-1">Upload CSV/Excel</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Import multiple staff members from Excel file</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleGenerateStaffReport}
                        variant="outline"
                        className="flex flex-col items-center p-6 h-auto border-dashed hover:border-purple-500 hover:bg-purple-50"
                      >
                        <BarChart3 className="h-8 w-8 text-gray-400 mb-2" />
                        <span className="font-medium">Generate Report</span>
                        <span className="text-xs text-gray-500 mt-1">Staff analytics</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Generate and download staff analytics report</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Notifications Panel */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Notifications</CardTitle>
                <Badge variant="destructive">
                  {notifications?.length || 0}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {notificationsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse flex space-x-4">
                      <div className="rounded-full bg-gray-200 h-8 w-8"></div>
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications && notifications.length > 0 ? (
                <div className="space-y-4">
                  {notifications.map((notification) => (
                    <div key={notification.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          notification.type === 'warning' ? 'bg-orange-100' :
                          notification.type === 'error' ? 'bg-red-100' :
                          notification.type === 'success' ? 'bg-green-100' :
                          'bg-blue-100'
                        }`}>
                          <Clock className={`h-4 w-4 ${
                            notification.type === 'warning' ? 'text-orange-600' :
                            notification.type === 'error' ? 'text-red-600' :
                            notification.type === 'success' ? 'text-green-600' :
                            'text-blue-600'
                          }`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No notifications</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Staff Modal */}
      <AddStaffModal
        open={showAddStaffModal}
        onClose={() => setShowAddStaffModal(false)}
        onSuccess={() => {
          setShowAddStaffModal(false);
          toast({
            title: "Success",
            description: "Staff member added successfully",
          });
        }}
      />

      {/* Bulk Import Modal */}
      <BulkImportStaffModal
        open={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onSuccess={() => {
          setShowBulkImportModal(false);
          toast({
            title: "Success",
            description: "Staff data imported successfully",
          });
        }}
      />

      {/* Payroll Details Modal */}
      {selectedPayrollRun && (
        <PayrollDetailsModal
          open={showPayrollDetailsModal}
          onClose={() => {
            setShowPayrollDetailsModal(false);
            setSelectedPayrollRun(null);
          }}
          payrollRun={selectedPayrollRun}
        />
      )}
    </div>
  );
}
