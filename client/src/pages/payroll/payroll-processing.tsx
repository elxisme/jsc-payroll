import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Play, Download, Calculator, Users, DollarSign, FileText } from 'lucide-react';

export default function PayrollProcessing() {
  const [selectedPeriod, setSelectedPeriod] = useState('2025-02');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [payrollType, setPayrollType] = useState('regular');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, code')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch payroll summary for selected filters
  const { data: payrollSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['payroll-summary', selectedPeriod, selectedDepartment],
    queryFn: async () => {
      // Get staff count based on filters
      let staffQuery = supabase
        .from('staff')
        .select('id, grade_level, step', { count: 'exact' })
        .eq('status', 'active');

      if (selectedDepartment !== 'all') {
        staffQuery = staffQuery.eq('department_id', selectedDepartment);
      }

      const { data: staffData, count: totalStaff } = await staffQuery;

      // Calculate gross amount based on salary structure
      // This is a simplified calculation - in production, you'd fetch actual salary structure
      const calculateGrossAmount = (gradeLevel: number, step: number) => {
        // Simplified CONJUSS calculation
        const baseSalary = gradeLevel * 25000 + step * 5000;
        const allowances = baseSalary * 0.3; // 30% allowances
        return baseSalary + allowances;
      };

      let grossAmount = 0;
      if (staffData) {
        grossAmount = staffData.reduce((sum, staff) => {
          return sum + calculateGrossAmount(staff.grade_level, staff.step);
        }, 0);
      }

      const totalDeductions = grossAmount * 0.2; // 20% total deductions
      const netAmount = grossAmount - totalDeductions;

      return {
        totalStaff: totalStaff || 0,
        grossAmount,
        totalDeductions,
        netAmount,
        deductions: {
          paye: grossAmount * 0.075, // 7.5% PAYE
          pension: grossAmount * 0.08, // 8% Pension
          nhf: grossAmount * 0.025, // 2.5% NHF
          insurance: grossAmount * 0.01, // 1% Insurance
          union: grossAmount * 0.005, // 0.5% Union
          loans: grossAmount * 0.005, // 0.5% Loans
        },
      };
    },
  });

  // Start payroll run mutation
  const startPayrollMutation = useMutation({
    mutationFn: async () => {
      if (!payrollSummary) throw new Error('No payroll summary available');

      const { data, error } = await supabase
        .from('payroll_runs')
        .insert({
          period: selectedPeriod,
          department_id: selectedDepartment === 'all' ? null : selectedDepartment,
          status: 'draft',
          total_staff: payrollSummary.totalStaff,
          gross_amount: payrollSummary.grossAmount.toString(),
          total_deductions: payrollSummary.totalDeductions.toString(),
          net_amount: payrollSummary.netAmount.toString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Payroll run started successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start payroll run',
        variant: 'destructive',
      });
    },
  });

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Generate period options
  const generatePeriodOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    
    return options;
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payroll Processing</h1>
            <p className="text-gray-600">Process monthly payroll for departments</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Template
            </Button>
            <Button
              onClick={() => startPayrollMutation.mutate()}
              disabled={startPayrollMutation.isPending || !payrollSummary}
              className="bg-nigeria-green hover:bg-green-700"
            >
              <Play className="mr-2 h-4 w-4" />
              Start Payroll Run
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pay Period
                </label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {generatePeriodOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments?.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payroll Type
                </label>
                <Select value={payrollType} onValueChange={setPayrollType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular Monthly</SelectItem>
                    <SelectItem value="bonus">Bonus Payment</SelectItem>
                    <SelectItem value="arrears">Arrears Payment</SelectItem>
                    <SelectItem value="overtime">Overtime Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payroll Summary */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="bg-gray-200 rounded-lg p-4">
                        <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                        <div className="h-8 bg-gray-300 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : payrollSummary ? (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        <p className="text-sm text-blue-600 font-medium">Total Staff</p>
                      </div>
                      <p className="text-2xl font-bold text-blue-900">
                        {payrollSummary.totalStaff.toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-5 w-5 text-nigeria-green" />
                        <p className="text-sm text-nigeria-green font-medium">Gross Amount</p>
                      </div>
                      <p className="text-2xl font-bold text-green-900">
                        {formatCurrency(payrollSummary.grossAmount)}
                      </p>
                    </div>
                    
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Calculator className="h-5 w-5 text-orange-600" />
                        <p className="text-sm text-orange-600 font-medium">Total Deductions</p>
                      </div>
                      <p className="text-2xl font-bold text-orange-900">
                        {formatCurrency(payrollSummary.totalDeductions)}
                      </p>
                    </div>
                    
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-purple-600" />
                        <p className="text-sm text-purple-600 font-medium">Net Amount</p>
                      </div>
                      <p className="text-2xl font-bold text-purple-900">
                        {formatCurrency(payrollSummary.netAmount)}
                      </p>
                    </div>
                  </div>

                  {/* Deduction Breakdown */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h5 className="text-sm font-medium text-gray-900 mb-3">Deduction Breakdown</h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">PAYE Tax:</span>
                        <span className="font-medium">{formatCurrency(payrollSummary.deductions.paye)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pension:</span>
                        <span className="font-medium">{formatCurrency(payrollSummary.deductions.pension)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">NHF:</span>
                        <span className="font-medium">{formatCurrency(payrollSummary.deductions.nhf)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Insurance:</span>
                        <span className="font-medium">{formatCurrency(payrollSummary.deductions.insurance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Union Dues:</span>
                        <span className="font-medium">{formatCurrency(payrollSummary.deductions.union)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Loans:</span>
                        <span className="font-medium">{formatCurrency(payrollSummary.deductions.loans)}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calculator className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No payroll data available</p>
                  <p className="text-sm">Select filters to view payroll summary</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
