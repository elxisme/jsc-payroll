import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Link } from 'wouter';
import {
  User,
  Mail,
  Shield,
  Building,
  Scale,
  Calendar,
  ExternalLink,
  Settings,
} from 'lucide-react';

export default function ProfileSettings() {
  const { user } = useAuth();

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Administrator';
      case 'account_admin':
        return 'Account Manager';
      case 'payroll_admin':
        return 'Payroll Manager';
      case 'staff':
        return 'Staff Member';
      default:
        return 'User';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-100 text-red-800';
      case 'account_admin':
        return 'bg-blue-100 text-blue-800';
      case 'payroll_admin':
        return 'bg-green-100 text-green-800';
      case 'staff':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getUserInitials = () => {
    if (user?.staff_profile) {
      return `${user.staff_profile.first_name[0]}${user.staff_profile.last_name[0]}`;
    }
    return user?.email?.substring(0, 2).toUpperCase() || 'U';
  };

  const getUserDisplayName = () => {
    if (user?.staff_profile) {
      return `${user.staff_profile.first_name} ${user.staff_profile.last_name}`;
    }
    return user?.email || 'User';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile Settings</h1>
        <p className="text-gray-600">View and manage your account information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Overview */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <Avatar className="h-24 w-24 mx-auto mb-4">
                  <AvatarFallback className="bg-nigeria-green text-white text-2xl">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {getUserDisplayName()}
                </h3>
                
                <Badge className={`${getRoleColor(user?.role || '')} mb-4`}>
                  {getRoleDisplayName(user?.role || '')}
                </Badge>

                <div className="space-y-3 text-left">
                  <div className="flex items-center space-x-3">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{user?.email}</span>
                  </div>
                  
                  {user?.staff_profile && (
                    <>
                      <div className="flex items-center space-x-3">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {user.staff_profile.staff_id}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <Building className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {user.staff_profile.departments?.name || 'Unassigned'}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {user?.role === 'staff' && (
                  <div className="mt-6">
                    <Link href="/staff-portal">
                      <Button className="w-full bg-nigeria-green hover:bg-green-700">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Go to Staff Portal
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Account Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Email Address</label>
                  <p className="mt-1 text-sm text-gray-900">{user?.email}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700">Role</label>
                  <p className="mt-1">
                    <Badge className={getRoleColor(user?.role || '')}>
                      {getRoleDisplayName(user?.role || '')}
                    </Badge>
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Account Created</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {user?.created_at ? formatDate(user.created_at) : 'Unknown'}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Last Updated</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {user?.updated_at ? formatDate(user.updated_at) : 'Unknown'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Staff Profile Information */}
          {user?.staff_profile && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Staff Profile</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Staff ID</label>
                    <p className="mt-1 text-sm font-mono text-gray-900">
                      {user.staff_profile.staff_id}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700">Full Name</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {user.staff_profile.first_name} {user.staff_profile.middle_name || ''} {user.staff_profile.last_name}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Position</label>
                    <p className="mt-1 text-sm text-gray-900">{user.staff_profile.position}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Department</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {user.staff_profile.departments?.name || 'Unassigned'}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Grade & Step</label>
                    <p className="mt-1">
                      <Badge variant="outline">
                        GL {user.staff_profile.grade_level} Step {user.staff_profile.step}
                      </Badge>
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Employment Date</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {formatDate(user.staff_profile.employment_date)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <p className="mt-1">
                      <Badge className={
                        user.staff_profile.status === 'active' ? 'bg-green-100 text-green-800' :
                        user.staff_profile.status === 'on_leave' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }>
                        {user.staff_profile.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </p>
                  </div>

                  {user.staff_profile.phone_number && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Phone Number</label>
                      <p className="mt-1 text-sm text-gray-900">{user.staff_profile.phone_number}</p>
                    </div>
                  )}
                </div>

                {/* Banking Information */}
                {(user.staff_profile.bank_name || user.staff_profile.account_number) && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-md font-medium text-gray-900 mb-4">Banking Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {user.staff_profile.bank_name && (
                        <div>
                          <label className="text-sm font-medium text-gray-700">Bank Name</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {user.staff_profile.bank_name.toUpperCase()}
                          </p>
                        </div>
                      )}
                      
                      {user.staff_profile.account_number && (
                        <div>
                          <label className="text-sm font-medium text-gray-700">Account Number</label>
                          <p className="mt-1 text-sm font-mono text-gray-900">
                            {user.staff_profile.account_number}
                          </p>
                        </div>
                      )}
                      
                      {user.staff_profile.account_name && (
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium text-gray-700">Account Name</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {user.staff_profile.account_name}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Role Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Role Permissions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {user?.role === 'super_admin' && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">Super Administrator</h4>
                    <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                      <li>Full system access and configuration</li>
                      <li>Manage all users and roles</li>
                      <li>Configure salary structure and system settings</li>
                      <li>Final payroll approval and processing</li>
                      <li>View all audit logs and reports</li>
                    </ul>
                  </div>
                )}

                {user?.role === 'account_admin' && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">Account Manager</h4>
                    <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                      <li>Review and approve payroll runs</li>
                      <li>Generate bank transfer reports</li>
                      <li>View financial reports and analytics</li>
                      <li>Manage payment processing</li>
                    </ul>
                  </div>
                )}

                {user?.role === 'payroll_admin' && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">Payroll Manager</h4>
                    <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                      <li>Create and process payroll runs</li>
                      <li>Manage staff records and departments</li>
                      <li>Generate payslips and reports</li>
                      <li>Configure allowances and deductions</li>
                    </ul>
                  </div>
                )}

                {user?.role === 'staff' && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">Staff Member</h4>
                    <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                      <li>View personal payslips and salary history</li>
                      <li>Access staff portal dashboard</li>
                      <li>Download payslip PDFs</li>
                      <li>View salary trends and analytics</li>
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user?.role === 'staff' && (
                  <Link href="/staff-portal">
                    <Button variant="outline" className="w-full justify-start">
                      <User className="mr-2 h-4 w-4" />
                      Staff Portal
                    </Button>
                  </Link>
                )}

                {user?.role === 'staff' && (
                  <Link href="/payslips">
                    <Button variant="outline" className="w-full justify-start">
                      <Scale className="mr-2 h-4 w-4" />
                      My Payslips
                    </Button>
                  </Link>
                )}

                {(user?.role === 'super_admin' || user?.role === 'payroll_admin') && (
                  <Link href="/staff">
                    <Button variant="outline" className="w-full justify-start">
                      <User className="mr-2 h-4 w-4" />
                      Staff Management
                    </Button>
                  </Link>
                )}

                {user?.role === 'super_admin' && (
                  <Link href="/settings">
                    <Button variant="outline" className="w-full justify-start">
                      <Settings className="mr-2 h-4 w-4" />
                      System Settings
                    </Button>
                  </Link>
                )}

                <Link href="/notifications">
                  <Button variant="outline" className="w-full justify-start">
                    <Mail className="mr-2 h-4 w-4" />
                    Notifications
                  </Button>
                </Link>

                <Link href="/dashboard">
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}