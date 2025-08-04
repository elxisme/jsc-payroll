import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, Search, Menu, ChevronDown } from 'lucide-react';

interface TopBarProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
}

export function TopBar({ title, breadcrumbs = [] }: TopBarProps) {
  const { user, signOut } = useAuth();

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

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden p-2 text-gray-400 hover:text-gray-500"
          >
            <Menu size={20} />
          </Button>

          {/* Breadcrumbs */}
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>{title}</span>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                <ChevronDown className="h-3 w-3 rotate-270" />
                <span className={index === breadcrumbs.length - 1 ? 'text-gray-900' : ''}>
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative hidden md:block">
              <Input
                type="text"
                placeholder="Search staff, payroll..."
                className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-nigeria-green focus:border-nigeria-green"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            </div>

            {/* Notifications */}
            <Button variant="ghost" size="sm" className="relative p-2 text-gray-400 hover:text-gray-500">
              <Bell size={20} />
              <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
            </Button>

            {/* Profile Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center text-sm text-gray-700 hover:text-gray-900">
                  <div className="h-8 w-8 rounded-full bg-nigeria-green flex items-center justify-center mr-2">
                    <span className="text-white font-medium text-xs">
                      {getUserInitials()}
                    </span>
                  </div>
                  <span className="hidden lg:block">{getUserName()}</span>
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2 border-b">
                  <p className="text-sm font-medium">{getUserName()}</p>
                  <p className="text-xs text-gray-500">{getRoleDisplayName(user?.role || '')}</p>
                </div>
                <DropdownMenuItem>Profile Settings</DropdownMenuItem>
                <DropdownMenuItem>Help & Support</DropdownMenuItem>
                <DropdownMenuItem onClick={signOut} className="text-red-600">
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
