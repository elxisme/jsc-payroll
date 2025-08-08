import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { formatDisplayCurrency } from '@/lib/currency-utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, CreditCard, FileText, BarChart3, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link, useLocation } from 'wouter';
import {
  Menu,
  X,
  Home,
  Users,
  Building2,
  LogOut,
  Bell,
  User,
} from 'lucide-react';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
}

export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const { user, signOut } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  // Dynamic navigation based on user role
  const navigation = React.useMemo(() => {
    const baseNavigation = [
      { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['super_admin', 'account_admin', 'payroll_admin'] },
      { name: 'Staff Portal', href: '/staff-portal', icon: Home, roles: ['staff'] },
      { name: 'Staff Management', href: '/staff', icon: Users, roles: ['super_admin'] },
      { name: 'Departments', href: '/departments', icon: Building2, roles: ['super_admin', 'account_admin', 'payroll_admin'] },
      { name: 'Payroll', href: '/payroll', icon: CreditCard, roles: ['super_admin', 'account_admin', 'payroll_admin'] },
      { name: 'Payroll Workflow', href: '/payroll/workflow', icon: CreditCard, roles: ['super_admin', 'account_admin', 'payroll_admin'] },
      { name: 'Individual Adjustments', href: '/payroll/adjustments', icon: CreditCard, roles: ['super_admin', 'payroll_admin'] },
      { name: 'Payslips', href: '/payslips', icon: FileText, roles: ['super_admin', 'account_admin', 'payroll_admin', 'staff'] },
      { name: 'Leave Approval', href: '/leave/approval', icon: Calendar, roles: ['super_admin', 'account_admin', 'payroll_admin'] },
      { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['super_admin', 'account_admin'] },
      { name: 'Settings', href: '/settings', icon: Settings, roles: ['super_admin'] },
    ];

    return baseNavigation;
  }, []);

  // Fetch unread notifications count
  const { data: notificationCount } = useQuery({
    queryKey: ['notification-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Track when notification count increases to show animation
  const previousCount = React.useRef(notificationCount);
  React.useEffect(() => {
    if (notificationCount && previousCount.current !== undefined && notificationCount > previousCount.current) {
      setHasNewNotifications(true);
      // Reset the animation after 3 seconds
      const timer = setTimeout(() => setHasNewNotifications(false), 3000);
      return () => clearTimeout(timer);
    }
    previousCount.current = notificationCount;
  }, [notificationCount]);
  const handleSignOut = async () => {
    await signOut();
  };

  const isCurrentPath = (path: string) => {
    // Exact match first
    if (location === path) return true;
    
    // Special handling for staff portal as dashboard
    if (user?.role === 'staff' && path === '/staff-portal' && location === '/dashboard') return true;
    
    // For sub-paths, ensure we don't match parent paths incorrectly
    // e.g., /payroll/workflow should not highlight /payroll
    if (path === '/') return location === '/';
    
    // Only match sub-paths if the current location starts with the path + '/'
    // and the path is not a substring of another valid path
    return location.startsWith(path + '/') && path !== '/payroll' && path !== '/staff';
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

  const { hasRole } = useAuth();

  // Filter navigation items based on user role
  const filteredNavigation = navigation.filter(item => hasRole(item.roles));

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-4 lg:px-6">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-lg bg-nigeria-green flex items-center justify-center">
            <span className="text-white font-bold text-sm">JSC</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-semibold text-gray-900">Payroll System</h1>
            <p className="text-xs text-gray-500">Judicial Service Committee</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 lg:px-6 py-4 space-y-1">
        {filteredNavigation.map((item) => {
          const isActive = isCurrentPath(item.href);
          return (
            <Link key={item.name} href={item.href}>
              <button
                onClick={() => isMobile && setMobileMenuOpen(false)}
                className={`
                  group flex items-center w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors
                  ${isActive
                    ? 'bg-nigeria-green text-white'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                <item.icon
                  className={`
                    mr-3 h-5 w-5 flex-shrink-0
                    ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-900'}
                  `}
                />
                {item.name}
              </button>
            </Link>
          );
        })}
      </nav>

      {/* User info (mobile only) */}
      {isMobile && (
        <div className="px-4 lg:px-6 py-4 border-t border-gray-200">
          <div className="flex items-center space-x-3 mb-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-nigeria-green text-white text-sm">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {getUserDisplayName()}
              </p>
              <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <Button
            onClick={handleSignOut}
            variant="ghost"
            size="sm"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex flex-col flex-grow bg-white shadow-sm border-r border-gray-200">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-72">
          <div className="bg-white h-full">
            <SidebarContent isMobile />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-col w-0 flex-1 lg:pl-72">
        {/* Top Navigation */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          {/* Mobile menu button */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open sidebar</span>
              </Button>
            </SheetTrigger>
          </Sheet>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1"></div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Notifications */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/notifications">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`relative transition-all duration-300 ${
                        hasNewNotifications ? 'animate-pulse bg-blue-50 hover:bg-blue-100' : ''
                      }`}
                    >
                    <Bell className="h-5 w-5" />
                      {notificationCount && notificationCount > 0 && (
                        <span className={`absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center transition-all duration-300 ${
                          hasNewNotifications ? 'animate-bounce scale-110' : ''
                        }`}>
                          {notificationCount > 99 ? '99+' : notificationCount}
                        </span>
                      )}
                      {hasNewNotifications && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 bg-blue-500 rounded-full animate-ping"></span>
                      )}
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View notifications ({notificationCount || 0} unread)</p>
                </TooltipContent>
              </Tooltip>

              {/* Profile dropdown */}
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-nigeria-green text-white text-sm">
                            {getUserInitials()}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Account menu</p>
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{getUserDisplayName()}</p>
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        {user?.email}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {user?.role?.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings/profile" className="w-full">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  {hasRole(['super_admin']) && (
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="w-full">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8 overflow-y-auto">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
          
          {/* Global Footer */}
          <footer className="mt-12 pt-8 border-t border-gray-200">
            <div className="text-center">
              <p className="text-gray-500" style={{ fontSize: '0.7em' }}>
                JSC Payroll | Powered by{' '}
                <a 
                  href="https://elxis.com.ng" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-nigeria-green hover:text-green-700 underline"
                >
                  eLxis
                </a>
              </p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}