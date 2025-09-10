import React from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import {
  Users,
  Building,
  Calculator,
  FileText,
  University,
  Bell,
  Settings,
  BarChart3,
  LogOut,
  Scale,
  TrendingUp, // New Import
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  path: string;
  roles: string[];
  badge?: number;
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: BarChart3,
    path: '/',
    roles: ['super_admin', 'account_admin', 'payroll_admin', 'staff'],
  },
  {
    id: 'staff',
    label: 'Staff Management',
    icon: Users,
    path: '/staff',
    roles: ['super_admin', 'payroll_admin'],
  },
  {
    id: 'departments',
    label: 'Departments',
    icon: Building,
    path: '/departments',
    roles: ['super_admin', 'payroll_admin'],
  },
  {
    id: 'promotions', // New Menu Item
    label: 'Promotions',
    icon: TrendingUp,
    path: '/promotions',
    roles: ['super_admin', 'payroll_admin'],
  },
  {
    id: 'payroll',
    label: 'Payroll Processing',
    icon: Calculator,
    path: '/payroll',
    roles: ['super_admin', 'account_admin', 'payroll_admin'],
  },
  {
    id: 'payroll-workflow',
    label: 'Payroll Workflow',
    icon: Calculator,
    path: '/payroll/workflow',
    roles: ['super_admin', 'account_admin', 'payroll_admin'],
  },
  {
    id: 'payslips',
    label: 'Payslips',
    icon: FileText,
    path: '/payslips',
    roles: ['super_admin', 'account_admin', 'payroll_admin', 'staff'],
  },
  {
    id: 'reports',
    label: 'Bank Reports',
    icon: University,
    path: '/reports',
    roles: ['super_admin', 'account_admin'],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    path: '/notifications',
    roles: ['super_admin', 'account_admin', 'payroll_admin', 'staff'],
    badge: 3,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/settings',
    roles: ['super_admin'],
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, signOut, hasRole } = useAuth();

  const filteredMenuItems = menuItems.filter(item =>
    hasRole(item.roles)
  );

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'account_admin':
        return 'Account Manager';
      case 'payroll_admin':
        return 'Payroll Manager';
      case 'staff':
        return 'Staff';
      default:
        return 'User';
    }
  };

  const getUserInitials = () => {
    if (user?.staff_profile) {
      const { first_name, last_name } = user.staff_profile;
      return `${first_name?.[0] || ''}${last_name?.[0] || ''}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  const getUserName = () => {
    if (user?.staff_profile) {
      const { first_name, last_name } = user.staff_profile;
      return `${first_name || ''} ${last_name || ''}`.trim();
    }
    return user?.email || 'User';
  };

  return (
    <div className="hidden lg:flex lg:flex-shrink-0">
      <div className="w-64 bg-white shadow-lg border-r border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-center h-16 px-4 bg-nigeria-green">
          <div className="flex items-center">
            <Scale className="text-white text-xl mr-3" size={24} />
            <h1 className="text-white font-bold text-lg">JSC Payroll</h1>
          </div>
        </div>

        {/* User Info */}
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-nigeria-green flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {getUserInitials()}
              </span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900 truncate">
                {getUserName()}
              </p>
              <p className="text-xs text-gray-500">
                {getRoleDisplayName(user?.role || '')}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="mt-2 px-2 flex-1">
          <div className="space-y-1">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path || 
                (item.path !== '/' && location.startsWith(item.path));

              return (
                <Link key={item.id} href={item.path}>
                  <a
                    className={cn(
                      'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors',
                      isActive
                        ? 'bg-nigeria-green text-white'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <Icon
                      className={cn(
                        'mr-3',
                        isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-500'
                      )}
                      size={18}
                    />
                    {item.label}
                    {item.badge && (
                      <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center ml-auto">
                        {item.badge}
                      </span>
                    )}
                  </a>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200">
          <button
            onClick={signOut}
            className="w-full flex items-center px-2 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            <LogOut className="mr-3" size={18} />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
