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
import { Download, University, FileSpreadsheet, FileText, Calendar, DollarSign, Loader2 } from 'lucide-react';

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

  // FIX: New query to fetch all unique banks for the selected period
  const { data: uniqueBanks } = useQuery({
    queryKey: ['unique-banks', selectedPeriod],
    queryFn: async () => {
      if (!selectedPeriod) return [];
      
      // Fetch payslips and related staff data just to get unique bank names
      const { data, error } = await supabase
        .from('payslips')
        .select('staff(bank_name)')
        .eq('period', selectedPeriod)
        .not('staff.bank_name', 'is', null);

      if (error) {
        console.error("Failed to fetch unique banks:", error);
        throw error;
      }

      // Use a Set to get unique, non-null bank names
      const banks = Array.from(new Set(data.map(p => p.staff?.bank_name).filter(Boolean as any)));
      return banks.sort();
    },
    enabled: !!selectedPeriod, // Only run this query when a period is selected
  });

  // Fetch bank transfer data based on selected period and bank
  const { data: bankTransfers, isLoading } = useQuery({
    queryKey: ['bank-transfers', selectedPeriod, selectedBank],
    queryFn: async () => {
      if (!selectedPeriod) return [];

      let query = supabase
        .from('payslips')
        .select(`
          id,
          net_pay,
          period,
          staff (
            staff_id,
            first_name,
            last_name,
            bank_name,
            account_number,
            account_name,
            departments (
              name,
              code
            )
          )
        `)
        .eq('period', selectedPeriod)
        .not('staff.bank_name', 'is', null)
        .not('staff.account_number', 'is', null);

      // Apply bank filter if a specific bank is selected
      if (selectedBank !== 'all') {
        query = query.eq('staff.bank_name', selectedBank);
      }

      const { data, error } = await query.order('bank_name', { referencedTable: 'staff', ascending: true });
      
      if (error) {
        console.error("Supabase request failed", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!selectedPeriod,
  });

  // Calculate totals based on the (potentially filtered) bankTransfers
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
    }).format(num);
  };

  // Format period display
  const formatPeriod = (period: string) => {
    if (!period) return '';
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  // Get bank codes (simplified mapping)
  const getBankCode = (bankName: string) => {
    if (!bankName) return '000';
    const bankCodes: Record<string, string> = {
      'access bank': '044',
      'guaranty trust bank': '058',
      'first bank of nigeria': '011',
      'zenith bank': '057',
      'united bank for africa': '033',
      'fidelity bank': '070',
      'union bank of nigeria': '032',
    };
    return bankCodes[bankName.toLowerCase()] || '000';
  };

  const handleExport = async (exportFn: Function, format: 'CSV' | 'Excel') => {
    if (!bankTransfers?.length) {
      toast({
        title: 'No Data',
        description: 'There is no data to export.',
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

      const filename = `bank_transfers_${selectedPeriod}_${selectedBank}.${format === 'CSV' ? 'csv' : 'xlsx'}`;
      await exportFn(exportData, filename);
      
      toast({
        title: 'Export Successful',
        description: `Bank transfer ${format} file has been generated.`,
      });
    } catch (error) {
      toast({
        title: 'Export Error',
        description: `Failed to export the ${format} file.`,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="w-full sm:w-auto">
            <h1 className="text-responsive-xl font-bold text-gray-900 mb-2">Bank Reports</h1>
            <p className="text-gray-600">Generate bank transfer schedules and reconciliation reports</p>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => handleExport(exportToBankCSV, 'CSV')}
              disabled={!bankTransfers?.length || isLoading}
            >
              <FileText className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              onClick={() => handleExport(exportToBankExcel, 'Excel')}
              disabled={!bankTransfers?.length || isLoading}
              className="w-full sm:w-auto bg-nigeria-green hover:bg-green-700"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pay Period
              </label>
              <Select value={selectedPeriod} onValueChange={(value) => {
                setSelectedPeriod(value);
                setSelectedBank('all'); // Reset bank filter when period changes
              }}>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank Filter
              </label>
              <Select value={selectedBank} onValueChange={setSelectedBank} disabled={!selectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="All banks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Banks</SelectItem>
                  {uniqueBanks?.map((bank) => (
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
                    {isLoading ? <Loader2 className="animate-spin" /> : formatCurrency(totals.totalAmount)}
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
                    {isLoading ? <Loader2 className="animate-spin" /> : totals.totalStaff.toLocaleString()}
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
                    {isLoading ? <Loader2 className="animate-spin" /> : (uniqueBanks?.length ?? 0)}
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
            <div className="text-center py-12 text-gray-500">
              <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p className="font-medium">Select a pay period to view the report.</p>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-nigeria-green" />
            </div>
          ) : bankTransfers && bankTransfers.length > 0 ? (
            <div className="overflow-x-auto">
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
                          <University className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="font-medium">{transfer.staff?.bank_name?.toUpperCase()}</span>
                          <Badge variant="secondary" className="text-xs">
                            {getBankCode(transfer.staff?.bank_name || '')}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {transfer.staff?.account_number}
                      </TableCell>
                      <TableCell>{transfer.staff?.account_name}</TableCell>
                      <TableCell>{transfer.staff?.departments?.name}</TableCell>
                      <TableCell className="text-right font-bold text-green-700">
                        {formatCurrency(transfer.net_pay || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <University className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p className="font-medium">No bank transfer data found for the selected criteria.</p>
              <p className="text-sm">This may be because staff banking information is incomplete for this period.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
