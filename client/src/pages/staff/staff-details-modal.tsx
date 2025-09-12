import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStaffIndividualAllowances, getStaffIndividualDeductions, getStaffLoans } from '@/lib/individual-payroll-utils';
import { formatDisplayCurrency } from '@/lib/currency-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AddIndividualAllowanceModal } from '@/components/add-individual-allowance-modal';
import { AddIndividualDeductionModal } from '@/components/add-individual-deduction-modal';
import { EditIndividualAllowanceModal } from '@/components/edit-individual-allowance-modal';
import { EditIndividualDeductionModal } from '@/components/edit-individual-deduction-modal';
import { AddLoanModal } from '@/pages/loans/AddLoanModal';
import { LoanDetailsModal } from '@/pages/loans/LoanDetailsModal';
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Calendar, 
  CreditCard,
  Scale,
  MapPin,
  FileText,
  Plus,
  DollarSign,
  Minus,
  Edit,
  Eye
} from 'lucide-react';

interface StaffDetailsModalProps {
  open: boolean;
  onClose: () => void;
  staff: any;
}

export function StaffDetailsModal({ open, onClose, staff }: StaffDetailsModalProps) {
  const [showAddAllowanceModal, setShowAddAllowanceModal] = React.useState(false);
  const [showAddDeductionModal, setShowAddDeductionModal] = React.useState(false);
  const [showEditAllowanceModal, setShowEditAllowanceModal] = React.useState(false);
  const [showEditDeductionModal, setShowEditDeductionModal] = React.useState(false);
  const [selectedAllowance, setSelectedAllowance] = React.useState<any>(null);
  const [selectedDeduction, setSelectedDeduction] = React.useState<any>(null);

  if (!staff) return null;

  // Fetch individual allowances
  const { data: individualAllowances, isLoading: allowancesLoading } = useQuery({
    queryKey: ['staff-individual-allowances', staff.id],
    queryFn: () => getStaffIndividualAllowances(staff.id),
    enabled: !!staff.id && open,
  });

  // Fetch individual deductions
  const { data: individualDeductions, isLoading: deductionsLoading } = useQuery({
    queryKey: ['staff-individual-deductions', staff.id],
    queryFn: () => getStaffIndividualDeductions(staff.id),
    enabled: !!staff.id && open,
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getInitials = () => {
    return `${staff.first_name?.[0] || ''}${staff.last_name?.[0] || ''}`.toUpperCase();
  };

  const getFullName = () => {
    const firstName = staff.first_name || '';
    const lastName = staff.last_name || '';
    const middleName = staff.middle_name ? `${staff.middle_name.charAt(0)}.` : '';
    
    return `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, ' ').trim();
  };

  const getStatusColorForIndividual = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'applied':
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paid_off':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const calculateProgress = (deduction: any) => {
    if (!deduction.totalAmount || deduction.totalAmount === 0) return 0;
    const paid = deduction.totalAmount - (deduction.remainingBalance || 0);
    return (paid / deduction.totalAmount) * 100;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Staff Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 bg-nigeria-green rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">{getInitials()}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">{getFullName()}</h3>
                  <p className="text-gray-600">{staff.staff_id}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge className={getStatusColor(staff.status)}>
                      {formatStatus(staff.status)}
                    </Badge>
                    <Badge variant="outline">
                      GL {staff.grade_level} Step {staff.step}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid grid-cols-1 sm:grid-cols-4 w-full gap-1 h-auto">
              <TabsTrigger value="profile" className="w-full justify-start">Profile</TabsTrigger>
              <TabsTrigger value="employment" className="w-full justify-start">Employment</TabsTrigger>
              <TabsTrigger value="allowances" className="w-full justify-start">
                Individual Allowances
                {individualAllowances && individualAllowances.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {individualAllowances.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="deductions" className="w-full justify-start">
                Individual Deductions
                {individualDeductions && individualDeductions.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {individualDeductions.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* FIX: The problematic wrapping <div> has been removed. */}
            {/* Each <TabsContent> is now a direct child of <Tabs> */}

            <TabsContent value="profile" className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <User className="h-5 w-5" />
                      <span>Personal Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-medium">{staff.email}</p>
                      </div>
                    </div>
                    
                    {staff.phone_number && (
                      <div className="flex items-center space-x-3">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Phone Number</p>
                          <p className="font-medium">{staff.phone_number}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-3">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Employment Date</p>
                        <p className="font-medium">{formatDate(staff.employment_date)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Employment Information Card (duplicate from other tab, but keeping as per original code) */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Building className="h-5 w-5" />
                      <span>Employment Details</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Building className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Department</p>
                        <p className="font-medium">{staff.departments?.name || 'Unassigned'}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Scale className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Position</p>
                        <p className="font-medium">{staff.position}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Grade & Step</p>
                        <p className="font-medium">Grade Level {staff.grade_level}, Step {staff.step}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="employment" className="space-y-6 pt-4">
              {/* Employment Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Building className="h-5 w-5" />
                    <span>Employment Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3">
                      <Building className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Department</p>
                        <p className="font-medium">{staff.departments?.name || 'Unassigned'}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Scale className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Position</p>
                        <p className="font-medium">{staff.position}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Grade & Step</p>
                        <p className="font-medium">Grade Level {staff.grade_level}, Step {staff.step}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Employment Date</p>
                        <p className="font-medium">{formatDate(staff.employment_date)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Next of Kin Information */}
              {staff.next_of_kin && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <User className="h-5 w-5" />
                      <span>Next of Kin</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {staff.next_of_kin.name && (
                        <div>
                          <p className="text-sm text-gray-600">Name</p>
                          <p className="font-medium">{staff.next_of_kin.name}</p>
                        </div>
                      )}
                      
                      {staff.next_of_kin.relationship && (
                        <div>
                          <p className="text-sm text-gray-600">Relationship</p>
                          <p className="font-medium">{staff.next_of_kin.relationship}</p>
                        </div>
                      )}
                      
                      {staff.next_of_kin.phone && (
                        <div>
                          <p className="text-sm text-gray-600">Phone Number</p>
                          <p className="font-medium">{staff.next_of_kin.phone}</p>
                        </div>
                      )}
                      
                      {staff.next_of_kin.address && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-gray-600">Address</p>
                          <p className="font-medium">{staff.next_of_kin.address}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Banking Information */}
              {(staff.bank_name || staff.account_number) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <CreditCard className="h-5 w-5" />
                      <span>Banking Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {staff.bank_name && (
                        <div>
                          <p className="text-sm text-gray-600">Bank Name</p>
                          <p className="font-medium">{staff.bank_name.toUpperCase()}</p>
                        </div>
                      )}
                      
                      {staff.account_number && (
                        <div>
                          <p className="text-sm text-gray-600">Account Number</p>
                          <p className="font-medium font-mono">{staff.account_number}</p>
                        </div>
                      )}
                      
                      {staff.account_name && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-gray-600">Account Name</p>
                          <p className="font-medium">{staff.account_name}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="allowances" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Individual Allowances</h3>
                <Button
                  onClick={() => setShowAddAllowanceModal(true)}
                  size="sm"
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Allowance
                </Button>
              </div>

              {allowancesLoading ? (
                <div className="space-y-3">
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
              ) : individualAllowances && individualAllowances.length > 0 ? (
                <div className="space-y-3">
                  {individualAllowances.map((allowance) => (
                    <div key={allowance.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                          <DollarSign className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium capitalize">
                            {allowance.type.replace('_', ' ')}
                          </p>
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <span>{formatPeriod(allowance.period)}</span>
                            <span>•</span>
                            <Badge className={getStatusColorForIndividual(allowance.status)}>
                              {allowance.status.toUpperCase()}
                            </Badge>
                          </div>
                          {allowance.description && (
                            <p className="text-xs text-gray-500 mt-1">{allowance.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            +{formatDisplayCurrency(allowance.amount)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAllowance(allowance);
                            setShowEditAllowanceModal(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                  <DollarSign className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No individual allowances</p>
                  <p className="text-sm">Add overtime, bonuses, or special allowances</p>
                  <Button
                    onClick={() => setShowAddAllowanceModal(true)}
                    variant="outline"
                    size="sm"
                    className="mt-3"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Allowance
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="deductions" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Individual Deductions</h3>
                <Button
                  onClick={() => setShowAddDeductionModal(true)}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Deduction
                </Button>
              </div>

              {deductionsLoading ? (
                <div className="space-y-3">
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
              ) : individualDeductions && individualDeductions.length > 0 ? (
                <div className="space-y-3">
                  {individualDeductions.map((deduction) => (
                    <div key={deduction.id} className="p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                            <Minus className="h-4 w-4 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium capitalize">
                              {deduction.type.replace('_', ' ')}
                            </p>
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                              <span>{formatPeriod(deduction.period)}</span>
                              <span>•</span>
                              <Badge className={getStatusColorForIndividual(deduction.status)}>
                                {deduction.status.replace('_', ' ').toUpperCase()}
                              </Badge>
                            </div>
                            {deduction.description && (
                              <p className="text-xs text-gray-500 mt-1">{deduction.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedDeduction(deduction);
                              setShowEditDeductionModal(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Loan Progress Bar */}
                      {deduction.totalAmount && deduction.totalAmount > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Progress</span>
                            <span>{calculateProgress(deduction).toFixed(1)}% paid</span>
                          </div>
                          <Progress value={calculateProgress(deduction)} className="h-2" />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>Remaining: {formatDisplayCurrency(deduction.remainingBalance || 0)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                  <Minus className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No individual deductions</p>
                  <p className="text-sm">Add loans, advances, or other deductions</p>
                  <Button
                    onClick={() => setShowAddDeductionModal(true)}
                    variant="outline"
                    size="sm"
                    className="mt-3"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Deduction
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button className="bg-nigeria-green hover:bg-green-700">
              Edit Staff
            </Button>
          </div>
        </div>

        {/* Individual Allowance Modals */}
        <AddIndividualAllowanceModal
          open={showAddAllowanceModal}
          onClose={() => setShowAddAllowanceModal(false)}
          onSuccess={() => {
            setShowAddAllowanceModal(false);
          }}
          preselectedStaffId={staff.id}
        />

        <AddIndividualDeductionModal
          open={showAddDeductionModal}
          onClose={() => setShowAddDeductionModal(false)}
          onSuccess={() => {
            setShowAddDeductionModal(false);
          }}
          preselectedStaffId={staff.id}
        />

        {/* Loan Modals */}
        <AddLoanModal
          open={showAddLoanModal}
          onClose={() => setShowAddLoanModal(false)}
          onSuccess={() => {
            setShowAddLoanModal(false);
          }}
          preselectedStaffId={staff.id}
        />

        {selectedLoan && (
          <LoanDetailsModal
            open={showLoanDetailsModal}
            onClose={() => {
              setShowLoanDetailsModal(false);
              setSelectedLoan(null);
            }}
            loan={selectedLoan}
          />
        )}

        {selectedAllowance && (
          <EditIndividualAllowanceModal
            open={showEditAllowanceModal}
            onClose={() => {
              setShowEditAllowanceModal(false);
              setSelectedAllowance(null);
            }}
            allowance={selectedAllowance}
            onSuccess={() => {
              setShowEditAllowanceModal(false);
              setSelectedAllowance(null);
            }}
          />
        )}

        {selectedDeduction && (
          <EditIndividualDeductionModal
            open={showEditDeductionModal}
            onClose={() => {
              setShowEditDeductionModal(false);
              setSelectedDeduction(null);
            }}
            deduction={selectedDeduction}
            onSuccess={() => {
              setShowEditDeductionModal(false);
              setSelectedDeduction(null);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
