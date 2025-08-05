import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Calendar, 
  CreditCard,
  Scale,
  MapPin,
  FileText
} from 'lucide-react';

interface StaffDetailsModalProps {
  open: boolean;
  onClose: () => void;
  staff: any;
}

export function StaffDetailsModal({ open, onClose, staff }: StaffDetailsModalProps) {
  if (!staff) return null;

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
    return `${staff.first_name || ''} ${staff.middle_name ? staff.middle_name + ' ' : ''}${staff.last_name || ''}`.trim();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

            {/* Employment Information */}
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

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {staff.pension_pin && (
                  <div>
                    <p className="text-sm text-gray-600">Pension PIN</p>
                    <p className="font-medium font-mono">{staff.pension_pin}</p>
                  </div>
                )}
                
                {staff.tax_pin && (
                  <div>
                    <p className="text-sm text-gray-600">Tax PIN</p>
                    <p className="font-medium font-mono">{staff.tax_pin}</p>
                  </div>
                )}
                
                <div>
                  <p className="text-sm text-gray-600">Created</p>
                  <p className="font-medium">{formatDate(staff.created_at)}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Last Updated</p>
                  <p className="font-medium">{formatDate(staff.updated_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

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
      </DialogContent>
    </Dialog>
  );
}