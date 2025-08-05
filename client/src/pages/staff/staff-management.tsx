import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealtime } from '@/hooks/use-realtime';
import { supabase } from '@/lib/supabase';
import { formatDisplayCurrency } from '@/lib/currency-utils';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { AddStaffModal } from './add-staff-modal';
import { StaffDetailsModal } from './staff-details-modal';
import { EditStaffModal } from './edit-staff-modal';
import { Search, Plus, Eye, Edit, Filter } from 'lucide-react';

export default function StaffManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [gradeLevelFilter, setGradeLevelFilter] = useState('all');
  const [stepFilter, setStepFilter] = useState('all');
  const [employmentDateStart, setEmploymentDateStart] = useState('');
  const [employmentDateEnd, setEmploymentDateEnd] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Enable real-time updates for staff management
  useRealtime({
    enableNotifications: true,
    enableStaffUpdates: true,
  });
  // Fetch staff data
  const { data: staff, isLoading: staffLoading } = useQuery({
    queryKey: ['staff', searchTerm, departmentFilter, statusFilter, gradeLevelFilter, stepFilter, employmentDateStart, employmentDateEnd],
    queryFn: async () => {
      let query = supabase
        .from('staff')
        .select(`
          *,
          departments!staff_department_id_fkey (
            id,
            name,
            code
          )
        `)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,staff_id.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      if (departmentFilter !== 'all') {
        query = query.eq('department_id', departmentFilter);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (gradeLevelFilter !== 'all') {
        query = query.eq('grade_level', parseInt(gradeLevelFilter));
      }

      if (stepFilter !== 'all') {
        query = query.eq('step', parseInt(stepFilter));
      }

      if (employmentDateStart) {
        query = query.gte('employment_date', employmentDateStart);
      }

      if (employmentDateEnd) {
        query = query.lte('employment_date', employmentDateEnd);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch departments for filter
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'on_leave':
        return 'bg-yellow-100 text-yellow-800';
      case 'retired':
        return 'bg-gray-100 text-gray-800';
      case 'terminated':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').toUpperCase();
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setDepartmentFilter('all');
    setStatusFilter('all');
    setGradeLevelFilter('all');
    setStepFilter('all');
    setEmploymentDateStart('');
    setEmploymentDateEnd('');
  };

  const hasActiveFilters = searchTerm || departmentFilter !== 'all' || statusFilter !== 'all' || 
    gradeLevelFilter !== 'all' || stepFilter !== 'all' || employmentDateStart || employmentDateEnd;
  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Staff Management</h1>
            <p className="text-gray-600">Manage staff profiles and information</p>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-nigeria-green hover:bg-green-700"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Staff
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add a new staff member</p>
              </TooltipContent>
            </Tooltip>
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Primary Filters Row */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, staff ID, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by department" />
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

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Advanced
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 flex items-center justify-center">
                      !
                    </Badge>
                  )}
                </Button>
              </div>
            </div>

            {/* Advanced Filters Row */}
            {showAdvancedFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border">
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1 block">Grade Level</Label>
                  <Select value={gradeLevelFilter} onValueChange={setGradeLevelFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Grades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grade Levels</SelectItem>
                      {[...Array(17)].map((_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          Grade Level {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1 block">Step</Label>
                  <Select value={stepFilter} onValueChange={setStepFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Steps" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Steps</SelectItem>
                      {[...Array(15)].map((_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          Step {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1 block">Employment From</Label>
                  <Input
                    type="date"
                    value={employmentDateStart}
                    onChange={(e) => setEmploymentDateStart(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1 block">Employment To</Label>
                  <Input
                    type="date"
                    value={employmentDateEnd}
                    onChange={(e) => setEmploymentDateEnd(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            {/* Filter Summary and Clear */}
            {hasActiveFilters && (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <Filter className="h-4 w-4" />
                  <span>
                    Showing {staff?.length || 0} staff members with active filters
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                >
                  Clear All Filters
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Filter Chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        {searchTerm && (
          <Badge variant="secondary" className="flex items-center gap-1">
            Search: "{searchTerm}"
            <button
              onClick={() => setSearchTerm('')}
              className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
            >
              ×
            </button>
          </Badge>
        )}
        {departmentFilter !== 'all' && (
          <Badge variant="secondary" className="flex items-center gap-1">
            Dept: {departments?.find(d => d.id === departmentFilter)?.name}
            <button
              onClick={() => setDepartmentFilter('all')}
              className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
            >
              ×
            </button>
          </Badge>
        )}
        {statusFilter !== 'all' && (
          <Badge variant="secondary" className="flex items-center gap-1">
            Status: {formatStatus(statusFilter)}
            <button
              onClick={() => setStatusFilter('all')}
              className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
            >
              ×
            </button>
          </Badge>
        )}
        {gradeLevelFilter !== 'all' && (
          <Badge variant="secondary" className="flex items-center gap-1">
            GL: {gradeLevelFilter}
            <button
              onClick={() => setGradeLevelFilter('all')}
              className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
            >
              ×
            </button>
          </Badge>
        )}
        {stepFilter !== 'all' && (
          <Badge variant="secondary" className="flex items-center gap-1">
            Step: {stepFilter}
            <button
              onClick={() => setStepFilter('all')}
              className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
            >
              ×
            </button>
          </Badge>
        )}
        {employmentDateStart && (
          <Badge variant="secondary" className="flex items-center gap-1">
            From: {employmentDateStart}
            <button
              onClick={() => setEmploymentDateStart('')}
              className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
            >
              ×
            </button>
          </Badge>
        )}
        {employmentDateEnd && (
          <Badge variant="secondary" className="flex items-center gap-1">
            To: {employmentDateEnd}
            <button
              onClick={() => setEmploymentDateEnd('')}
              className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
            >
              ×
            </button>
          </Badge>
        )}
      </div>

      {/* Remove the old filters section since it's now integrated above */}
      {/* <Card className="mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, staff ID, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by department" />
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

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card> */}

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Directory</CardTitle>
        </CardHeader>
        <CardContent>
          {staffLoading ? (
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
          ) : staff && staff.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Grade Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.staff_id}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {member.first_name} {member.last_name}
                        </div>
                        <div className="text-sm text-gray-500">{member.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.departments?.name || 'Unassigned'}
                    </TableCell>
                    <TableCell>{member.position}</TableCell>
                    <TableCell>GL {member.grade_level} Step {member.step}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(member.status)}>
                        {formatStatus(member.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedStaff(member);
                                setShowDetailsModal(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View staff details</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedStaff(member);
                                setShowEditModal(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit staff information</p>
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
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <p>No staff members found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Staff Modal */}
      <AddStaffModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          queryClient.invalidateQueries({ queryKey: ['staff'] });
          toast({
            title: "Success",
            description: "Staff member added successfully",
          });
        }}
      />

      {/* Staff Details Modal */}
      {selectedStaff && (
        <StaffDetailsModal
          open={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedStaff(null);
          }}
          staff={selectedStaff}
        />
      )}

      {/* Edit Staff Modal */}
      {selectedStaff && (
        <EditStaffModal
          open={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedStaff(null);
          }}
          staff={selectedStaff}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedStaff(null);
            toast({
              title: "Success",
              description: "Staff member updated successfully",
            });
          }}
        />
      )}
    </div>
  );
}
