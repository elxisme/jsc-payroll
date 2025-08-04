import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Download, Eye, FileText, Calendar } from 'lucide-react';

export default function Payslips() {
  const { user, hasRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');

  // Fetch payslips based on user role
  const { data: payslips, isLoading } = useQuery({
    queryKey: ['payslips', user?.id, searchTerm, periodFilter],
    queryFn: async () => {
      let query = supabase
        .from('payslips')
        .select(`
          *,
          staff (
            staff_id,
            first_name,
            last_name,
            email,
            departments (
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      // If user is staff, only show their payslips
      if (user?.role === 'staff' && user?.staff_profile?.id) {
        query = query.eq('staff_id', user.staff_profile.id);
      }

      if (periodFilter !== 'all') {
        query = query.eq('period', periodFilter);
      }

      if (searchTerm && hasRole(['super_admin', 'account_admin', 'payroll_admin'])) {
        // Search functionality for admin users
        query = query.or(`staff.first_name.ilike.%${searchTerm}%,staff.last_name.ilike.%${searchTerm}%,staff.staff_id.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch available periods for filter
  const { data: periods } = useQuery({
    queryKey: ['payslip-periods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payslips')
        .select('period')
        .order('period', { ascending: false });

      if (error) throw error;
      
      // Get unique periods
      const uniquePeriods = Array.from(new Set(data?.map(p => p.period) || []));
      return uniquePeriods;
    },
  });

  // Format currency
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Format period display
  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const handleDownloadPayslip = (payslipId: string) => {
    // TODO: Implement PDF download
    console.log('Download payslip:', payslipId);
  };

  const handleViewPayslip = (payslipId: string) => {
    // TODO: Implement payslip viewer modal
    console.log('View payslip:', payslipId);
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payslips</h1>
            <p className="text-gray-600">
              {user?.role === 'staff' 
                ? 'View and download your payslips' 
                : 'Manage staff payslips and generate reports'}
            </p>
          </div>
          {hasRole(['super_admin', 'account_admin', 'payroll_admin']) && (
            <Button className="bg-nigeria-green hover:bg-green-700">
              <FileText className="mr-2 h-4 w-4" />
              Generate Payslips
            </Button>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      {hasRole(['super_admin', 'account_admin', 'payroll_admin']) && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by staff name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    {periods?.map((period) => (
                      <SelectItem key={period} value={period}>
                        {formatPeriod(period)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payslips Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {user?.role === 'staff' ? 'My Payslips' : 'Staff Payslips'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
                  {hasRole(['super_admin', 'account_admin', 'payroll_admin']) && (
                    <>
                      <TableHead>Staff ID</TableHead>
                      <TableHead>Staff Name</TableHead>
                      <TableHead>Department</TableHead>
                    </>
                  )}
                  <TableHead>Period</TableHead>
                  <TableHead>Gross Pay</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((payslip) => (
                  <TableRow key={payslip.id}>
                    {hasRole(['super_admin', 'account_admin', 'payroll_admin']) && (
                      <>
                        <TableCell className="font-medium">
                          {payslip.staff?.staff_id}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {payslip.staff?.first_name} {payslip.staff?.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {payslip.staff?.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {payslip.staff?.departments?.name || 'Unassigned'}
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>{formatPeriod(payslip.period)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payslip.gross_pay || 0)}
                    </TableCell>
                    <TableCell className="text-red-600">
                      -{formatCurrency(payslip.total_deductions || 0)}
                    </TableCell>
                    <TableCell className="font-bold text-green-600">
                      {formatCurrency(payslip.net_pay || 0)}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewPayslip(payslip.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadPayslip(payslip.id)}
                          className="text-nigeria-green hover:text-green-700"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
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
              <p>No payslips found</p>
              <p className="text-sm">
                {user?.role === 'staff' 
                  ? 'Your payslips will appear here once generated'
                  : 'Generate payslips to see them here'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
