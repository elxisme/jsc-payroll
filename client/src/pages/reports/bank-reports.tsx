import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/hooks/use-toast';
import { exportToBankCSV, exportToBankExcel } from '@/lib/export-utils';
import { Download, University, FileSpreadsheet, FileText, Calendar, DollarSign } from 'lucide-react';

export default function BankReports() {
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedBank, setSelectedBank] = useState('all');
  const { toast } = useToast();

  // Fetch payroll runs for period selection
  const { data: payrollRuns } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_runs')
        .select('id, period, status')
        .eq('status', 'processed')
        .order('period', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch bank transfer data
  const { data: bankTransfers, isLoading } = useQuery({
    queryKey: ['bank-transfers', selectedPeriod, selectedBank],
    queryFn: async () => {
      if (!selectedPeriod) return [];

      let query = supabase
        .from('payslips')
        .select(`
          *,
          staff (
            staff_id,
            first_name,
            last_name,
            bank_name,
            account_number,
            account_name,
            departments!staff_department_id_fkey (
              name,
              code
            )
          )
        `)
        .eq('period', selectedPeriod)
        // FIX: Specify the referenced table for filtering
        .not('bank_name', 'is', null, { referencedTable: 'staff' })
        .not('account_number', 'is', null, { referencedTable: 'staff' });

      if (selectedBank !== 'all') {
        // FIX: Specify the referenced table for filtering
        query = query.eq('bank_name', selectedBank, { referencedTable: 'staff' });
      }

      // FIX: Specify the referenced table for ordering
      const { data, error } = await query.order('bank_name', { referencedTable: 'staff', ascending: true });
      
      if (error) {
        // Provide more detailed error logging
        console.error("Supabase request failed", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!selectedPeriod,
  });

  // Get unique banks
  const uniqueBanks = React.useMemo(() => {
    if (!bankTransfers) return [];
    const banks = Array.from(new Set(bankTransfers.map(t => t.staff?.bank_name).filter(Boolean)));
    return banks.sort();
  }, [bankTransfers]);

  // Calculate totals
  const totals = React.useMemo(() => {
    if (!bankTransfers) return { totalAmount: 0, totalStaff: 0 };
    
    const totalAmount = bankTransfers.reduce((sum, transfer) => 
      sum + parseFloat(transfer.net_pay || '0'), 0);
    const totalStaff = bankTransfers.length;

    return { totalAmount, totalStaff };
  }, [bankTransfers]);

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

  // Get bank codes (simplified mapping)
  const getBankCode = (bankName: string) => {
    const bankCodes: Record<string, string> = {
      'access': '044',
      'gtb': '058',
      'firstbank': '011',
      'zenith': '057',
      'uba': '033',
      'fidelity': '070',
      'union': '032',
    };
    return bankCodes[bankName.toLowerCase()] || '000';
  };

  const handleExportCSV = async () => {
    console.log('Export CSV clicked, bankTransfers length:', bankTransfers?.length);
    if (!bankTransfers?.length) {
      toast({
        title: 'Error',
        description: 'No data to export',
        variant: 'destructive',
      });
      return;
    }

    try {
      const exportData = bankTransfers.map(transfer => ({
        staffId: transfer.staff?.staff_id || '',
        staffName: `${transfer.staff?.first_name || ''} ${transfer.staff?.last_name || ''}`.trim(),
        accountNumber: transfer.staff?.account_number || '',
        accountName: transfer.staff?.account_name || '',
        bankName: transfer.staff?.bank_name || '',
        bankCode: getBankCode(transfer.staff?.bank_name || ''),
        amount: parseFloat(transfer.net_pay || '0'),
        department: transfer.staff?.departments?.name || '',
        period: transfer.period,
      }));

      await exportToBankCSV(exportData, `bank_transfers_${selectedPeriod}.csv`);
      
      toast({
        title: 'Success',
        description: 'Bank transfer CSV exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export CSV file',
        variant: 'destructive',
      });
    }
  };

  const handleExportExcel = async () => {
    console.log('Export Excel clicked, bankTransfers length:', bankTransfers?.length);
    if (!bankTransfers?.length) {
      toast({
        title: 'Error',
        description: 'No data to export',
        variant: 'destructive',
      });
      return;
    }

    try {
      const exportData = bankTransfers.map(transfer => ({
        'Staff ID': transfer.staff?.staff_id || '',
        'Staff Name': `${transfer.staff?.first_name || ''} ${transfer.staff?.last_name || ''}`.trim(),
        'Account Number': transfer.staff?.account_number || '',
        'Account Name': transfer.staff?.account_name || '',
        'Bank Name': transfer.staff?.bank_name || '',
        'Bank Code': getBankCode(transfer.staff?.bank_name || ''),
        'Amount (NGN)': parseFloat(transfer.net_pay || '0'),
        'Department': transfer.staff?.departments?.name || '',
        'Period': formatPeriod(transfer.period),
      }));

      await exportToBankExcel(exportData, `bank_transfers_${selectedPeriod}.xlsx`);
      
      toast({
        title: 'Success',
        description: 'Bank transfer Excel file exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export Excel file',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Bank Reports</h1>
            <p className="text-gray-600">Generate bank transfer schedules and reconciliation reports</p>
          </div>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={!bankTransfers?.length}
            >
              <FileText className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              onClick={handleExportExcel}
              disabled={!bankTransfers?.length}
              className="bg-nigeria-green hover:bg-green-700"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pay Period
              </label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pay period" />
                </SelectTrigger>
                <SelectContent>
                  {payrollRuns?.map((run) => (
                    <SelectItem key={run.id} value={run.period}>
                      {formatPeriod(run.period)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank Filter
              </label>
              <Select value={selectedBank} onValueChange={setSelectedBank}>
                <SelectTrigger>
                  <SelectValue placeholder="All banks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Banks</SelectItem>
                  {uniqueBanks.map((bank) => (
                    <SelectItem key={bank} value={bank}>
                      {bank.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {selectedPeriod && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Amount</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(totals.totalAmount)}
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="text-nigeria-green" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Recipients</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {totals.totalStaff.toLocaleString()}
                  </p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <University className="text-blue-600" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Banks Involved</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {uniqueBanks.length}
                  </p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <University className="text-purple-600" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bank Transfer Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Bank Transfer Schedule</span>
            {selectedPeriod && (
              <Badge variant="outline">{formatPeriod(selectedPeriod)}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedPeriod ? (
            <div className="text-center py-8 text-gray-500">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
              <p>Select a pay period to view bank transfers</p>
            </div>
          ) : isLoading ? (
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
          ) : bankTransfers && bankTransfers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Staff Name</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankTransfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="font-medium">
                      {transfer.staff?.staff_id}
                    </TableCell>
                    <TableCell>
                      {transfer.staff?.first_name} {transfer.staff?.last_name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <University className="h-4 w-4 text-gray-400" />
                        <span>{transfer.staff?.bank_name?.toUpperCase()}</span>
                        <Badge variant="outline" className="text-xs">
                          {getBankCode(transfer.staff?.bank_name || '')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {transfer.staff?.account_number}
                    </TableCell>
                    <TableCell>{transfer.staff?.account_name}</TableCell>
                    <TableCell>{transfer.staff?.departments?.name}</TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      {formatCurrency(transfer.net_pay || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <University className="h-8 w-8 text-gray-400" />
              </div>
              <p>No bank transfer data found</p>
              <p className="text-sm">Ensure staff have complete banking information</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
