import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { formatDisplayCurrency, formatDetailCurrency } from '@/lib/currency-utils';
import { logSystemEvent } from '@/lib/audit-logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AddLoanModal } from './AddLoanModal';
import { EditLoanModal } from './EditLoanModal';
import { LoanDetailsModal } from './LoanDetailsModal';
import { CooperativeManagementModal } from './CooperativeManagementModal';
import { useToast } from '@/hooks/use-toast';
import { 
  CreditCard, 
  Plus, 
  Eye, 
  Edit, 
  Search,
  Filter,
  Building,
  Users,
  DollarSign,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';

export default function LoanManagement() {
  const { hasRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cooperativeFilter, setCooperativeFilter] = useState('all');
  const [loanTypeFilter, setLoanTypeFilter] = useState('all');
  const [showAddLoanModal, setShowAddLoanModal] = useState(false);
  const [showEditLoanModal, setShowEditLoanModal] = useState(false);
  const [showLoanDetailsModal, setShowLoanDetailsModal] = useState(false);
  const [showCooperativeModal, setShowCooperativeModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch loans with related data
  const { data: loans, isLoading: loansLoading } = useQuery({
    queryKey: ['loans', searchTerm, statusFilter, cooperativeFilter, loanTypeFilter],
    queryFn: async () => {
      let query = supabase
        .from('loans')
        .select(`
          *,
          staff (
            staff_id,
            first_name,
            last_name,
            departments!staff_department_id_fkey (
              name
            )
          ),
          cooperative_organizations (
            name
          ),
          created_by_user:users!loans_created_by_fkey (
            email
          ),
          approved_by_user:users!loans_approved_by_fkey (
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`staff.first_name.ilike.%${searchTerm}%,staff.last_name.ilike.%${searchTerm}%,staff.staff_id.ilike.%${searchTerm}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (cooperativeFilter !== 'all') {
        if (cooperativeFilter === 'none') {
          query = query.is('cooperative_id', null);
        } else {
          query = query.eq('cooperative_id', cooperativeFilter);
        }
      }

      if (loanTypeFilter !== 'all') {
        query = query.eq('loan_type', loanTypeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!hasRole(['super_admin', 'account_admin', 'payroll_admin']),
  });

  // Fetch cooperative organizations
  const { data: cooperatives } = useQuery({
    queryKey: ['cooperative-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cooperative_organizations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch loan statistics
  const { data: loanStats } = useQuery({
    queryKey: ['loan-statistics'],
    queryFn: async () => {
      const { data: allLoans, error } = await supabase
        .from('loans')
        .select('status, total_loan_amount, remaining_balance');

      if (error) throw error;

      const stats = {
        totalLoans: allLoans?.length || 0,
        activeLoans: allLoans?.filter(l => l.status === 'active').length || 0,
        totalDisbursed: allLoans?.reduce((sum, l) => sum + parseFloat(l.total_loan_amount || '0'), 0) || 0,
        totalOutstanding: allLoans?.filter(l => l.status === 'active').reduce((sum, l) => sum + parseFloat(l.remaining_balance || '0'), 0) || 0,
      };

      return stats;
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'paid_off':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'defaulted':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'paid_off':
        return 'bg-green-100 text-green-800';
      case 'defaulted':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatLoanType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const calculateProgress = (loan: any) => {
    if (!loan.total_loan_amount || loan.total_loan_amount === 0) return 0;
    const paid = parseFloat(loan.total_loan_amount) - parseFloat(loan.remaining_balance || '0');
    return (paid / parseFloat(loan.total_loan_amount)) * 100;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCooperativeFilter('all');
    setLoanTypeFilter('all');
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || cooperativeFilter !== 'all' || loanTypeFilter !== 'all';

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="w-full sm:w-auto">
            <h1 className="text-responsive-xl font-bold text-gray-900 mb-2">Loan Management</h1>
            <p className="text-gray-600">Manage staff loans, cooperatives, and repayment schedules</p>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
            <Button
              onClick={() => setShowCooperativeModal(true)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Building className="mr-2 h-4 w-4" />
              Manage Cooperatives
            </Button>
            <Button
              onClick={() => setShowAddLoanModal(true)}
              className="w-full sm:w-auto bg-nigeria-green hover:bg-green-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Loan
            </Button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Loans</p>
                <p className="text-3xl font-bold text-gray-900">
                  {loanStats?.totalLoans || 0}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <CreditCard className="text-blue-600" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Loans</p>
                <p className="text-3xl font-bold text-blue-600">
                  {loanStats?.activeLoans || 0}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-nigeria-green" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Disbursed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatDisplayCurrency(loanStats?.totalDisbursed || 0)}
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <DollarSign className="text-purple-600" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Outstanding</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatDisplayCurrency(loanStats?.totalOutstanding || 0)}
                </p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="text-red-600" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="space-y-4">
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
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paid_off">Paid Off</SelectItem>
                    <SelectItem value="defaulted">Defaulted</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={cooperativeFilter} onValueChange={setCooperativeFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Cooperatives" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cooperatives</SelectItem>
                    <SelectItem value="none">Direct Loans</SelectItem>
                    {cooperatives?.map((coop) => (
                      <SelectItem key={coop.id} value={coop.id}>
                        {coop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={loanTypeFilter} onValueChange={setLoanTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="salary_advance">Salary Advance</SelectItem>
                    <SelectItem value="cooperative_loan">Cooperative Loan</SelectItem>
                    <SelectItem value="personal_loan">Personal Loan</SelectItem>
                    <SelectItem value="emergency_loan">Emergency Loan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <Filter className="h-4 w-4" />
                  <span>Showing {loans?.length || 0} filtered loans</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loans Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Loan Records</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loansLoading ? (
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
          ) : loans && loans.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Loan Type</TableHead>
                  <TableHead>Cooperative</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Monthly Payment</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {loan.staff?.first_name} {loan.staff?.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {loan.staff?.staff_id} • {loan.staff?.departments?.name}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {formatLoanType(loan.loan_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {loan.cooperative_organizations?.name || (
                        <span className="text-gray-500 italic">Direct Loan</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatDisplayCurrency(loan.total_loan_amount)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatDisplayCurrency(loan.monthly_total_deduction)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{loan.installments_paid}/{loan.number_of_installments}</span>
                          <span>{calculateProgress(loan).toFixed(1)}%</span>
                        </div>
                        <Progress value={calculateProgress(loan)} className="h-2" />
                        <div className="text-xs text-gray-500">
                          Remaining: {formatDisplayCurrency(loan.remaining_balance)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(loan.status)}
                        <Badge className={getStatusColor(loan.status)}>
                          {loan.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedLoan(loan);
                                setShowLoanDetailsModal(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View loan details</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedLoan(loan);
                                setShowEditLoanModal(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit loan</p>
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
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="h-8 w-8 text-gray-400" />
              </div>
              <p>No loans found</p>
              <p className="text-sm">
                {hasActiveFilters 
                  ? 'Try adjusting your filters'
                  : 'Create your first loan to get started'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <AddLoanModal
        open={showAddLoanModal}
        onClose={() => setShowAddLoanModal(false)}
        onSuccess={() => {
          setShowAddLoanModal(false);
          queryClient.invalidateQueries({ queryKey: ['loans'] });
          toast({
            title: "Success",
            description: "Loan created successfully",
          });
        }}
      />

      {selectedLoan && (
        <>
          <EditLoanModal
            open={showEditLoanModal}
            onClose={() => {
              setShowEditLoanModal(false);
              setSelectedLoan(null);
            }}
            loan={selectedLoan}
            onSuccess={() => {
              setShowEditLoanModal(false);
              setSelectedLoan(null);
              queryClient.invalidateQueries({ queryKey: ['loans'] });
              toast({
                title: "Success",
                description: "Loan updated successfully",
              });
            }}
          />

          <LoanDetailsModal
            open={showLoanDetailsModal}
            onClose={() => {
              setShowLoanDetailsModal(false);
              setSelectedLoan(null);
            }}
            loan={selectedLoan}
          />
        </>
      )}

      <CooperativeManagementModal
        open={showCooperativeModal}
        onClose={() => setShowCooperativeModal(false)}
        onSuccess={() => {
          setShowCooperativeModal(false);
          queryClient.invalidateQueries({ queryKey: ['cooperative-organizations'] });
          toast({
            title: "Success",
            description: "Cooperative organizations updated successfully",
          });
        }}
      />
    </div>
  );
}