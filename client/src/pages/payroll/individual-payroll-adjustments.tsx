import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { formatDisplayCurrency } from '@/lib/currency-utils';
import { 
  getPendingAllowancesForPeriod,
  getActiveDeductionsForPeriod,
  updateIndividualAllowanceStatus,
  updateIndividualDeduction
} from '@/lib/individual-payroll-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { AddIndividualAllowanceModal } from '@/components/add-individual-allowance-modal';
import { AddIndividualDeductionModal } from '@/components/add-individual-deduction-modal';
import { useToast } from '@/hooks/use-toast';
import { 
  DollarSign, 
  Minus, 
  Plus, 
  Check, 
  X, 
  Calendar,
  Users,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

export default function IndividualPayrollAdjustments() {
  const { hasRole } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [showAddAllowanceModal, setShowAddAllowanceModal] = useState(false);
  const [showAddDeductionModal, setShowAddDeductionModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pending allowances for the selected period
  const { data: pendingAllowances, isLoading: allowancesLoading } = useQuery({
    queryKey: ['pending-allowances', selectedPeriod],
    queryFn: () => getPendingAllowancesForPeriod(selectedPeriod),
    enabled: !!selectedPeriod,
  });

  // Fetch active deductions for the selected period
  const { data: activeDeductions, isLoading: deductionsLoading } = useQuery({
    queryKey: ['active-deductions', selectedPeriod],
    queryFn: () => getActiveDeductionsForPeriod(selectedPeriod),
    enabled: !!selectedPeriod,
  });

  // Fetch available periods
  const { data: availablePeriods } = useQuery({
    queryKey: ['individual-periods'],
    queryFn: async () => {
      const { data: allowancePeriods } = await supabase
        .from('staff_individual_allowances')
        .select('period')
        .order('period', { ascending: false });

      const { data: deductionPeriods } = await supabase
        .from('staff_individual_deductions')
        .select('period')
        .order('period', { ascending: false });

      const allPeriods = [
        ...(allowancePeriods?.map(p => p.period) || []),
        ...(deductionPeriods?.map(p => p.period) || []),
      ].filter(Boolean); // Added filter to prevent errors with empty values

      return Array.from(new Set(allPeriods)).sort().reverse();
    },
  });

  // Approve allowance mutation
  const approveAllowanceMutation = useMutation({
    mutationFn: async (allowanceId: string) => {
      await updateIndividualAllowanceStatus(allowanceId, 'applied');
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Allowance approved successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['pending-allowances'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve allowance',
        variant: 'destructive',
      });
    },
  });

  // Reject allowance mutation
  const rejectAllowanceMutation = useMutation({
    mutationFn: async (allowanceId: string) => {
      await updateIndividualAllowanceStatus(allowanceId, 'cancelled');
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Allowance rejected successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['pending-allowances'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject allowance',
        variant: 'destructive',
      });
    },
  });

  const formatPeriod = (period: string) => {
    if (!period) return 'Invalid Period';
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const calculateProgress = (deduction: any) => {
    if (!deduction.totalAmount || deduction.totalAmount === 0) return 0;
    const paid = deduction.totalAmount - (deduction.remainingBalance || 0);
    return (paid / deduction.totalAmount) * 100;
  };

  const totalPendingAllowances = pendingAllowances?.reduce((sum, allowance) => sum + allowance.amount, 0) || 0;
  const totalActiveDeductions = activeDeductions?.reduce((sum, deduction) => sum + deduction.amount, 0) || 0;

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="w-full sm:w-auto">
            <h1 className="text-responsive-xl font-bold text-gray-900 mb-2">Individual Payroll Adjustments</h1>
            <p className="text-gray-600">Manage individual allowances and deductions for staff members</p>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
            <Button
              onClick={() => setShowAddAllowanceModal(true)}
              variant="outline"
              className="w-full sm:w-auto text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Allowance
            </Button>
            <Button
              onClick={() => setShowAddDeductionModal(true)}
              variant="outline"
              className="w-full sm:w-auto text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Deduction
            </Button>
          </div>
        </div>
      </div>

      {/* Period Selection */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <Label className="text-sm font-medium text-gray-700">Select Period:</Label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={new Date().toISOString().slice(0, 7)}>
                  Current Month ({formatPeriod(new Date().toISOString().slice(0, 7))})
                </SelectItem>
                {availablePeriods?.map((period) => (
                  <SelectItem key={period} value={period}>
                    {formatPeriod(period)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Allowances</p>
                <p className="text-2xl font-bold text-green-600">
                  {pendingAllowances?.length || 0}
                </p>
              </div>
              <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="text-green-600" size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Deductions</p>
                <p className="text-2xl font-bold text-red-600">
                  {activeDeductions?.length || 0}
                </p>
              </div>
              <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Minus className="text-red-600" size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Allowances</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatDisplayCurrency(totalPendingAllowances)}
                </p>
              </div>
              <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-green-600" size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Deductions</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatDisplayCurrency(totalActiveDeductions)}
                </p>
              </div>
              <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-red-600" size={20} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="allowances" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="allowances" className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4" />
            <span>Individual Allowances</span>
            {pendingAllowances && pendingAllowances.length > 0 && (
              <Badge variant="secondary">{pendingAllowances.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="deductions" className="flex items-center space-x-2">
            <Minus className="h-4 w-4" />
            <span>Individual Deductions</span>
            {activeDeductions && activeDeductions.length > 0 && (
              <Badge variant="secondary">{activeDeductions.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pending Allowances Tab */}
        <TabsContent value="allowances">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <span>Pending Individual Allowances</span>
                <Badge variant="outline">{formatPeriod(selectedPeriod)}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allowancesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse flex space-x-4 p-4 border rounded-lg">
                      <div className="rounded-full bg-gray-200 h-8 w-8"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : pendingAllowances && pendingAllowances.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingAllowances.map((allowance) => (
                      <TableRow key={allowance.id}>
                        <TableCell>
                          <div className="font-medium">
                            {allowance.staff?.first_name} {allowance.staff?.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {allowance.staff?.staff_id}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {allowance.type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-green-600">
                          +{formatDisplayCurrency(allowance.amount)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {allowance.description || 'No description'}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => approveAllowanceMutation.mutate(allowance.id)}
                                  disabled={approveAllowanceMutation.isPending}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Approve allowance</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => rejectAllowanceMutation.mutate(allowance.id)}
                                  disabled={rejectAllowanceMutation.isPending}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reject allowance</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <DollarSign className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No pending allowances for {formatPeriod(selectedPeriod)}</p>
                  <p className="text-sm">Individual allowances will appear here for review</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Deductions Tab */}
        <TabsContent value="deductions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Minus className="h-5 w-5 text-red-600" />
                <span>Active Individual Deductions</span>
                <Badge variant="outline">{formatPeriod(selectedPeriod)}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deductionsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse flex space-x-4 p-4 border rounded-lg">
                      <div className="rounded-full bg-gray-200 h-8 w-8"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : activeDeductions && activeDeductions.length > 0 ? (
                <div className="space-y-4">
                  {activeDeductions.map((deduction) => (
                    <div key={deduction.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                            <Minus className="h-4 w-4 text-red-600" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {deduction.staff?.first_name} {deduction.staff?.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {deduction.staff?.staff_id} • {deduction.type.replace('_', ' ')}
                            </div>
                            {deduction.description && (
                              <div className="text-xs text-gray-500 mt-1">
                                {deduction.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">
                            -{formatDisplayCurrency(deduction.amount)}
                          </p>
                          {deduction.totalAmount && (
                            <p className="text-xs text-gray-500">
                              of {formatDisplayCurrency(deduction.totalAmount)}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Loan Progress */}
                      {deduction.totalAmount && deduction.totalAmount > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Loan Progress</span>
                            <span>{calculateProgress(deduction).toFixed(1)}% paid</span>
                          </div>
                          <Progress value={calculateProgress(deduction)} className="h-2" />
                          <div className="text-xs text-gray-500 mt-1">
                            Remaining: {formatDisplayCurrency(deduction.remainingBalance || 0)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Minus className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No active deductions for {formatPeriod(selectedPeriod)}</p>
                  <p className="text-sm">Individual deductions will appear here when active</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Modals */}
      <AddIndividualAllowanceModal
        open={showAddAllowanceModal}
        onClose={() => setShowAddAllowanceModal(false)}
        onSuccess={() => {
          setShowAddAllowanceModal(false);
          toast({
            title: "Success",
            description: "Individual allowance added successfully",
          });
        }}
      />

      <AddIndividualDeductionModal
        open={showAddDeductionModal}
        onClose={() => setShowAddDeductionModal(false)}
        onSuccess={() => {
          setShowAddDeductionModal(false);
          toast({
            title: "Success",
            description: "Individual deduction added successfully",
          });
        }}
      />
    </div>
  );
}
