import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { formatDisplayCurrency, formatDetailCurrency } from '@/lib/currency-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { generatePayslipPDF } from '@/lib/pdf-generator';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LeaveManagement } from './leave-management';
import { 
  Download, 
  Eye, 
  FileText, 
  TrendingUp, 
  Calendar,
  User,
  DollarSign,
  X
} from 'lucide-react';

// MODAL COMPONENT for Payslip Details
const PayslipDetailsModal = ({ payslip, staffProfile, onClose }: { payslip: any, staffProfile: any, onClose: () => void }) => {
  if (!payslip) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-white relative max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white z-10 border-b">
          <CardTitle>Payslip Details - {formatPeriod(payslip.period)}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div><strong>Staff Name:</strong> {staffProfile?.first_name} {staffProfile?.last_name}</div>
            <div><strong>Staff ID:</strong> {staffProfile?.staff_id}</div>
            <div><strong>Department:</strong> {staffProfile?.departments?.name}</div>
            <div><strong>Position:</strong> {staffProfile?.position}</div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Earnings */}
            <div>
              <h4 className="font-bold mb-2 border-b pb-1 text-green-700">Earnings</h4>
              <div className="space-y-1 text-sm">
                {payslip.earnings?.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between">
                    <span>{item.name}</span>
                    <span>{formatDetailCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t pt-1 mt-1">
                  <span>Gross Pay</span>
                  <span>{formatDetailCurrency(payslip.gross_pay)}</span>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div>
              <h4 className="font-bold mb-2 border-b pb-1 text-red-700">Deductions</h4>
              <div className="space-y-1 text-sm">
                {payslip.deductions?.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between">
                    <span>{item.name}</span>
                    <span>({formatDetailCurrency(item.amount)})</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t pt-1 mt-1">
                  <span>Total Deductions</span>
                  <span>({formatDetailCurrency(payslip.total_deductions)})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-6 pt-4 border-t-2 border-gray-300">
            <div className="flex justify-between items-center font-bold text-lg">
              <span>Net Pay</span>
              <span>{formatDetailCurrency(payslip.net_pay)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


// Helper function to format period
const formatPeriod = (period: string) => {
  const [year, month] = period.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
};

export default function StaffPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  // SOLUTION: State for managing the payslip modal
  const [selectedPayslip, setSelectedPayslip] = React.useState<any>(null);

  // Fetch staff profile
  const { data: staffProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['staff-profile', user?.id],
    queryFn: async () => {
      if (!user?.staff_profile?.id) return null;

      const { data, error } = await supabase
        .from('staff')
        .select(`
          *,
          departments!staff_department_id_fkey (
            name,
            code
          )
        `)
        .eq('id', user.staff_profile.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.staff_profile?.id,
  });

  // Fetch payslip history
  const { data: payslips, isLoading: payslipsLoading } = useQuery({
    queryKey: ['staff-payslips', user?.staff_profile?.id],
    queryFn: async () => {
      if (!user?.staff_profile?.id) return [];

      const { data, error } = await supabase
        .from('payslips')
        .select('*')
        .eq('staff_id', user.staff_profile.id)
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.staff_profile?.id,
  });

  // Calculate salary trends
  const salaryTrends = React.useMemo(() => {
    if (!payslips?.length) return [];
    
    return payslips.map(payslip => ({
      period: payslip.period,
      netPay: parseFloat(payslip.net_pay || '0'),
      grossPay: parseFloat(payslip.gross_pay || '0'),
      deductions: parseFloat(payslip.total_deductions || '0'),
    })).reverse(); // Show oldest to newest for trend
  }, [payslips]);

  // Format currency
  const formatCurrency = (amount: string | number) => {
    return formatDisplayCurrency(amount);
  };

  const handleDownloadPayslip = async (payslip: any) => {
    try {
      await generatePayslipPDF(payslip, staffProfile);
      toast({
        title: 'Success',
        description: 'Payslip downloaded successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download payslip',
        variant: 'destructive',
      });
    }
  };

  const getInitials = () => {
    if (!staffProfile) return 'U';
    return `${staffProfile.first_name?.[0] || ''}${staffProfile.last_name?.[0] || ''}`.toUpperCase();
  };

  const getFullName = () => {
    if (!staffProfile) return 'User';
    return `${staffProfile.first_name || ''} ${staffProfile.last_name || ''}`.trim();
  };

  const latestPayslip = payslips?.[0];
  const averageSalary = salaryTrends.length > 0 
    ? salaryTrends.reduce((sum, trend) => sum + trend.netPay, 0) / salaryTrends.length 
    : 0;

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <h1 className="text-responsive-xl font-bold text-gray-900 mb-2">Staff Portal</h1>
        <p className="text-gray-600">Your personal dashboard and salary information</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        {/* SOLUTION: Added color depth and hover effects to tabs */}
        <TabsList className="grid w-full grid-cols-2 bg-gray-200 p-1 rounded-lg">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-md hover:bg-gray-300 transition-colors"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="leave" 
            className="data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-md hover:bg-gray-300 transition-colors"
          >
            Leave Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile Overview */}
            <div className="lg:col-span-1">
              <Card>
                <CardContent className="p-0">
                  {profileLoading ? (
                    <div className="animate-pulse space-y-4 p-6">
                      <div className="h-16 w-16 bg-gray-200 rounded-full mx-auto"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                    </div>
                  ) : staffProfile ? (
                    // SOLUTION: Adjusted padding and text sizes for responsiveness
                    <div className="bg-gradient-to-br from-nigeria-green to-green-600 rounded-xl p-4 md:p-6 text-white">
                      <div className="flex flex-col items-center text-center space-y-3">
                        <div className="h-16 w-16 md:h-20 md:w-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                          <span className="text-xl md:text-2xl font-bold">{getInitials()}</span>
                        </div>
                        <div className="min-w-0">
                          {/* SOLUTION: Responsive font size for name */}
                          <h4 className="text-lg md:text-xl font-bold truncate" title={getFullName()}>{getFullName()}</h4>
                          <p className="text-green-100 text-sm">{staffProfile.staff_id}</p>
                          <p className="text-green-100 text-sm">{staffProfile.position}</p>
                          <p className="text-green-100 text-sm mt-1">{staffProfile.departments?.name || 'Unassigned'}</p>
                          <p className="text-green-100 text-xs">GL {staffProfile.grade_level} Step {staffProfile.step}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <User className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                      <p>Profile not found</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <div className="mt-6 space-y-3">
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="w-full flex items-center justify-start px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200"
                      onClick={() => latestPayslip && handleDownloadPayslip(latestPayslip)}
                      disabled={!latestPayslip}
                    >
                      <Download className="mr-3 h-5 w-5" />
                      <div className="text-left">
                        <p className="text-sm font-medium">Download Latest Payslip</p>
                        <p className="text-xs text-blue-600">
                          {latestPayslip ? formatPeriod(latestPayslip.period) : 'No payslips available'}
                        </p>
                      </div>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Download your most recent payslip as PDF</p>
                  </TooltipContent>
                </UiTooltip>
                
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full flex items-center justify-start px-4 py-3 border-purple-200 hover:bg-purple-50"
                    >
                      <TrendingUp className="mr-3 h-5 w-5 text-purple-600" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-purple-900">View Salary Trends</p>
                        <p className="text-xs text-purple-600">12-month analysis</p>
                      </div>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View your salary trends and analytics</p>
                  </TooltipContent>
                </UiTooltip>
              </div>
            </div>
            
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Latest Net Pay</p>
                        {/* SOLUTION: Added scaling class */}
                        <p className="text-2xl font-bold text-gray-900 transform scale-95 origin-left">
                          {latestPayslip ? formatDisplayCurrency(latestPayslip.net_pay || 0) : '---'}
                        </p>
                      </div>
                      <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <DollarSign className="text-nigeria-green" size={20} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Average Salary</p>
                        {/* SOLUTION: Added scaling class */}
                        <p className="text-2xl font-bold text-gray-900 transform scale-95 origin-left">
                          {formatDisplayCurrency(averageSalary)}
                        </p>
                      </div>
                      <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <TrendingUp className="text-blue-600" size={20} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Payslips Available</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {payslips?.length || 0}
                        </p>
                      </div>
                      <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <FileText className="text-purple-600" size={20} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Payslip History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Payslip History</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {payslipsLoading ? (
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="animate-pulse flex space-x-4">
                          <div className="rounded-full bg-gray-200 h-10 w-10"></div>
                          <div className="flex-1 space-y-2 py-1">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : payslips && payslips.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Gross Pay</TableHead>
                          <TableHead className="text-right">Deductions</TableHead>
                          <TableHead className="text-right">Net Pay</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payslips.map((payslip) => (
                          <TableRow key={payslip.id}>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span>{formatPeriod(payslip.period)}</span>
                              </div>
                            </TableCell>
                            {/* SOLUTION: Added scaling class */}
                            <TableCell className="font-medium text-right min-w-fit whitespace-nowrap transform scale-95 origin-right">
                              {formatDisplayCurrency(payslip.gross_pay || 0)}
                            </TableCell>
                            {/* SOLUTION: Added scaling class */}
                            <TableCell className="text-red-600 text-right min-w-fit whitespace-nowrap transform scale-95 origin-right">
                              -{formatDisplayCurrency(payslip.total_deductions || 0)}
                            </TableCell>
                            {/* SOLUTION: Added scaling class */}
                            <TableCell className="font-bold text-green-600 text-right min-w-fit whitespace-nowrap transform scale-95 origin-right">
                              {formatDisplayCurrency(payslip.net_pay || 0)}
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2 justify-center">
                                <UiTooltip>
                                  <TooltipTrigger asChild>
                                    {/* SOLUTION: onClick now opens the modal */}
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setSelectedPayslip(payslip)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>View payslip details</p>
                                  </TooltipContent>
                                </UiTooltip>
                                <UiTooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-nigeria-green hover:text-green-700"
                                      onClick={() => handleDownloadPayslip(payslip)}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Download payslip as PDF</p>
                                  </TooltipContent>
                                </UiTooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="h-8 w-8 text-gray-400" />
                      </div>
                      <p>No payslips available</p>
                      <p className="text-sm">Your payslips will appear here once generated</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Salary Trends Chart Placeholder */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>12-Month Salary Trend</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {salaryTrends.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={salaryTrends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="period" 
                            tickFormatter={(value) => {
                              const [year, month] = value.split('-');
                              const date = new Date(parseInt(year), parseInt(month) - 1);
                              return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                            }}
                          />
                          <YAxis 
                            tickFormatter={(value) => `₦${(value / 1000).toFixed(0)}k`}
                          />
                          <Tooltip 
                            formatter={(value: number) => [formatDetailCurrency(value), 'Net Pay']}
                            labelFormatter={(label) => formatPeriod(label)}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="netPay" 
                            stroke="var(--nigeria-green)" 
                            strokeWidth={2}
                            dot={{ fill: 'var(--nigeria-green)', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, stroke: 'var(--nigeria-green)', strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="mt-4 text-center text-sm text-gray-600">
                        <p>Average: {formatDisplayCurrency(averageSalary)} | Data points: {salaryTrends.length}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                      <div className="text-center">
                        <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-gray-500 font-medium">No Salary Data Available</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Salary trends will appear here once payslips are generated
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leave">
          <LeaveManagement />
        </TabsContent>
      </Tabs>

      {/* SOLUTION: Render the modal when a payslip is selected */}
      {selectedPayslip && (
        <PayslipDetailsModal
          payslip={selectedPayslip}
          staffProfile={staffProfile}
          onClose={() => setSelectedPayslip(null)}
        />
      )}
    </div>
  );
}
