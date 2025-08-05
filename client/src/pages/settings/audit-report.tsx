import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  Download, 
  Search, 
  Calendar,
  User,
  Activity,
  Filter,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';

export function AuditReport() {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { toast } = useToast();

  // Fetch audit logs with filters
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['audit-logs', searchTerm, actionFilter, resourceFilter, userFilter, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          users (
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (searchTerm) {
        query = query.or(`action.ilike.%${searchTerm}%,resource.ilike.%${searchTerm}%,resource_id.ilike.%${searchTerm}%`);
      }

      if (actionFilter !== 'all') {
        query = query.ilike('action', `%${actionFilter}%`);
      }

      if (resourceFilter !== 'all') {
        query = query.eq('resource', resourceFilter);
      }

      if (userFilter !== 'all') {
        query = query.eq('user_id', userFilter);
      }

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo + 'T23:59:59');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch users for filter
  const { data: users } = useQuery({
    queryKey: ['audit-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, email')
        .order('email');

      if (error) throw error;
      return data || [];
    },
  });

  // Get unique actions and resources for filters
  const uniqueActions = React.useMemo(() => {
    if (!auditLogs) return [];
    const actions = Array.from(new Set(auditLogs.map(log => log.action.split('_')[1] || log.action)));
    return actions.filter(Boolean).sort();
  }, [auditLogs]);

  const uniqueResources = React.useMemo(() => {
    if (!auditLogs) return [];
    const resources = Array.from(new Set(auditLogs.map(log => log.resource)));
    return resources.sort();
  }, [auditLogs]);

  const getActionColor = (action: string) => {
    if (action.includes('created')) return 'bg-green-100 text-green-800';
    if (action.includes('updated')) return 'bg-blue-100 text-blue-800';
    if (action.includes('deleted')) return 'bg-red-100 text-red-800';
    if (action.includes('login')) return 'bg-purple-100 text-purple-800';
    if (action.includes('logout')) return 'bg-gray-100 text-gray-800';
    if (action.includes('approved')) return 'bg-emerald-100 text-emerald-800';
    if (action.includes('rejected')) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatResource = (resource: string) => {
    return resource.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleExportAuditLog = async () => {
    if (!auditLogs?.length) {
      toast({
        title: 'Error',
        description: 'No audit data to export',
        variant: 'destructive',
      });
      return;
    }

    try {
      const exportData = auditLogs.map(log => ({
        'Timestamp': new Date(log.created_at).toLocaleString(),
        'User': log.users?.email || 'System',
        'Action': formatAction(log.action),
        'Resource': formatResource(log.resource),
        'Resource ID': log.resource_id || '-',
        'IP Address': log.ip_address || '-',
        'User Agent': log.user_agent || '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();

      // Add report metadata
      const reportInfo = [
        ['JSC PAYROLL MANAGEMENT SYSTEM'],
        ['Audit Trail Report'],
        [`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`],
        [`Total Records: ${auditLogs.length}`],
        [`Date Range: ${dateFrom || 'All time'} to ${dateTo || 'Present'}`],
        [''],
      ];

      XLSX.utils.sheet_add_aoa(worksheet, reportInfo, { origin: 'A1' });
      XLSX.utils.sheet_add_json(worksheet, exportData, { origin: `A${reportInfo.length + 1}`, skipHeader: false });

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Logs');
      XLSX.writeFile(workbook, `audit_report_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({
        title: 'Success',
        description: 'Audit report exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export audit report',
        variant: 'destructive',
      });
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setActionFilter('all');
    setResourceFilter('all');
    setUserFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = searchTerm || actionFilter !== 'all' || resourceFilter !== 'all' || 
    userFilter !== 'all' || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Audit Trail Report</span>
            </CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleExportAuditLog}
                  disabled={!auditLogs?.length}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Report
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Export audit logs to Excel</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search actions, resources..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {formatAction(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by resource" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  {uniqueResources.map((resource) => (
                    <SelectItem key={resource} value={resource}>
                      {formatResource(resource)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="From date"
              />

              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="To date"
              />
            </div>

            {hasActiveFilters && (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <Filter className="h-4 w-4" />
                  <span>Showing {auditLogs?.length || 0} filtered audit entries</span>
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

          {/* Audit Logs Table */}
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="animate-pulse flex space-x-4">
                  <div className="rounded-full bg-gray-200 h-8 w-8"></div>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : auditLogs && auditLogs.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Resource ID</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">
                            {log.users?.email || 'System'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getActionColor(log.action)}>
                          {formatAction(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Activity className="h-4 w-4 text-gray-400" />
                          <span className="capitalize">{formatResource(log.resource)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {log.resource_id ? log.resource_id.slice(0, 8) + '...' : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {log.ip_address || 'Unknown'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-gray-400" />
              </div>
              <p>No audit logs found</p>
              <p className="text-sm">
                {hasActiveFilters 
                  ? 'Try adjusting your filters'
                  : 'Audit logs will appear here as users perform actions'
                }
              </p>
            </div>
          )}

          {/* Summary Statistics */}
          {auditLogs && auditLogs.length > 0 && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{auditLogs.length}</p>
                    <p className="text-sm text-gray-600">Total Entries</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {Array.from(new Set(auditLogs.map(log => log.users?.email).filter(Boolean))).length}
                    </p>
                    <p className="text-sm text-gray-600">Unique Users</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {Array.from(new Set(auditLogs.map(log => log.action))).length}
                    </p>
                    <p className="text-sm text-gray-600">Action Types</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {Array.from(new Set(auditLogs.map(log => log.resource))).length}
                    </p>
                    <p className="text-sm text-gray-600">Resources</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}