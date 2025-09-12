import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { formatDisplayCurrency } from '@/lib/currency-utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Calendar,
  CreditCard,
  FileText,
  BarChart3,
  Settings,
  TrendingUp,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils'; // Import cn utility

interface ResponsiveLayoutProps {
  children: React.ReactNode;
}

interface NavigationGroup {
  name: string;
  icon: React.ComponentType<any>;
  items: NavigationItem[];
  roles: string[];
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  roles: string[];
}

export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const { user, signOut } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    dashboard: true,
    hr: false,
    payroll: false,
    analytics: false,
    settings: false,
  });

  // Grouped navigation structure
  const navigationGroups = React.useMemo((): NavigationGroup[] => {
    if (user?.role === 'staff') {
      return [
        {
          name: 'Dashboard',
          icon: Home,
          roles: ['staff'],
          items: [
            { name: 'Dashboard', href: '/staff-portal', icon: Home, roles: ['staff'] },
            { name: 'Profile', href: '/settings/profile', icon: User, roles: ['staff'] },
          ],
        },
        {
          name: 'My Records',
          icon: FileText,
          roles: ['staff'],
          items: [
            { name: 'My Payslips', href: '/payslips', icon: FileText, roles: ['staff'] },
          ],
        },
      ];
    }

    return [
      {
        name: 'Dashboard',
        icon: Home,
        roles: ['super_admin', 'account_admin', 'payroll_admin'],
        items: [
          { name: 'Overview', href: '/dashboard', icon: Home, roles: ['super_admin', 'account_admin', 'payroll_admin'] },
        ],
      },
      {
        name: 'Human Resources (HR)',
        icon: Users,
        roles: ['super_admin', 'account_admin', 'payroll_admin'],
        items: [
          { name: 'Staff Management', href: '/staff', icon: Users, roles: ['super_admin', 'payroll_admin'] },
          { name: 'Departments', href: '/departments', icon: Building2, roles: ['super_admin', 'account_admin', 'payroll_admin'] },
          { name: 'Promotions', href: '/promotions', icon: TrendingUp, roles: ['super_admin', 'payroll_admin'] },
          { name: 'Leave Approval', href: '/leave/approval', icon: Calendar, roles: ['super_admin', 'account_admin', 'payroll_admin'] },
        ],
      },
      {
        name: 'Payroll & Compensation',
        icon: CreditCard,
        roles: ['super_admin', 'account_admin', 'payroll_admin'],
        items: [
          { name: 'Payroll Processing', href: '/payroll', icon: CreditCard, roles: ['super_admin', 'account_admin', 'payroll_admin'] },
          { name: 'Payroll Workflow', href: '/payroll/workflow', icon: CreditCard, roles: ['super_admin', 'account_admin', 'payroll_admin'] },
          { name: 'Individual Adjustments', href: '/payroll/adjustments', icon: CreditCard, roles: ['super_admin', 'payroll_admin'] },
          { name: 'Payslips', href: '/payslips', icon: FileText, roles: ['super_admin', 'account_admin', 'payroll_admin'] },
          { name: 'Loan Management', href: '/loans', icon: CreditCard, roles: ['super_admin', 'account_admin', 'payroll_admin'] },
        ],
      },
      {
        name: 'Analytics & Oversight',
        icon: BarChart3,
        roles: ['super_admin', 'account_admin'],
        items: [
          { name: 'Bank Reports', href: '/reports', icon: BarChart3, roles: ['super_admin', 'account_admin'] },
        ],
      },
      {
        name: 'Settings',
        icon: Settings,
        roles: ['super_admin'],
        items: [
          { name: 'System Settings', href: '/settings', icon: Settings, roles: ['super_admin'] },
          { name: 'Profile Settings', href: '/settings/profile', icon: User, roles: ['super_admin'] },
        ],
      },
    ];
  }, [user?.role]);

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

  const isCurrentPath = (path: string): boolean => {
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

  const isGroupActive = (group: NavigationGroup): boolean => {
    return group.items.some(item => isCurrentPath(item.href));
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const getUserInitials = () => {
    if (user?.staff_profile) {
      return `${user.staff_profile.first_name?.[0] || ''}${user.staff_profile.last_name?.[0] || ''}`.toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || 'U';
  };

  const getUserDisplayName = () => {
    if (user?.staff_profile) {
      return `${user.staff_profile.first_name || ''} ${user.staff_profile.last_name || ''}`.trim();
    }
    return user?.email || 'User';
  };

  const { hasRole } = useAuth();

  // Filter navigation groups and items based on user role
  const filteredNavigationGroups = navigationGroups
    .filter(group => hasRole(group.roles))
    .map(group => ({
      ...group,
      items: group.items.filter(item => hasRole(item.roles)),
    }))
    .filter(group => group.items.length > 0);

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
      <ScrollArea className="flex-1 px-4 lg:px-6 py-4">
        <nav className="space-y-2">
          {filteredNavigationGroups.map((group, groupIndex) => {
            const groupKey = group.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const isGroupExpanded = expandedGroups[groupKey];
            const groupIsActive = isGroupActive(group);

            // If group has only one item, render it directly without collapsible
            if (group.items.length === 1) {
              const item = group.items[0];
              const isActive = isCurrentPath(item.href);

              return (
                <Link key={item.name} href={item.href} onClick={() => isMobile && setMobileMenuOpen(false)} asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      'group flex items-center w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors justify-start',
                      isActive
                        ? 'bg-nigeria-green text-white shadow-sm hover:bg-nigeria-green'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                    )}
                  >
                    <item.icon
                      className={cn(
                        'mr-3 h-5 w-5 flex-shrink-0',
                        isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-900'
                      )}
                    />
                    {item.name}
                  </Button>
                </Link>
              );
            }

            return (
              <Collapsible
                key={group.name}
                open={isGroupExpanded}
                onOpenChange={() => toggleGroup(groupKey)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      'group flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                      groupIsActive
                        ? 'bg-gray-100 text-gray-900 hover:bg-gray-100'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-center">
                      <group.icon
                        className={cn(
                          'mr-3 h-5 w-5 flex-shrink-0',
                          groupIsActive ? 'text-nigeria-green' : 'text-gray-400 group-hover:text-gray-900'
                        )}
                      />
                      <span className="font-medium">{group.name}</span>
                    </div>
                    {isGroupExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1">
                  <div className="ml-6 mt-1 space-y-1">
                    {group.items.map((item) => {
                      const isActive = isCurrentPath(item.href);
                      return (
                        <Link key={item.name} href={item.href} onClick={() => isMobile && setMobileMenuOpen(false)} asChild>
                          <Button
                            variant="ghost"
                            className={cn(
                              'group flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors justify-start',
                              isActive
                                ? 'bg-nigeria-green text-white shadow-sm hover:bg-nigeria-green'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            )}
                          >
                            <item.icon
                              className={cn(
                                'mr-3 h-4 w-4 flex-shrink-0',
                                isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'
                              )}
                            />
                            {item.name}
                          </Button>
                        </Link>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {/* Notifications - Always visible */}
          <div className="pt-4 border-t border-gray-200">
            <Link href="/notifications" onClick={() => isMobile && setMobileMenuOpen(false)} asChild>
              <Button
                variant="ghost"
                className={cn(
                  'group flex items-center w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors relative justify-start',
                  isCurrentPath('/notifications')
                    ? 'bg-nigeria-green text-white shadow-sm hover:bg-nigeria-green'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <Bell
                  className={cn(
                    'mr-3 h-5 w-5 flex-shrink-0',
                    isCurrentPath('/notifications') ? 'text-white' : 'text-gray-400 group-hover:text-gray-900'
                  )}
                />
                Notifications
                {notificationCount && notificationCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        </nav>
      </ScrollArea>

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

  // Auto-expand groups that contain the current active page
  React.useEffect(() => {
    const activeGroup = filteredNavigationGroups.find(group => isGroupActive(group));
    if (activeGroup) {
      const groupKey = activeGroup.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      setExpandedGroups(prev => ({
        ...prev,
        [groupKey]: true,
      }));
    }
  }, [location, filteredNavigationGroups]);

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-80 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex flex-col flex-grow bg-white shadow-sm border-r border-gray-200">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-80">
          <div className="bg-white h-full">
            <SidebarContent isMobile />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-col w-0 flex-1 lg:pl-80">
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
              <UiTooltip>
                <TooltipTrigger asChild>
                  <Link href="/notifications" asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'relative transition-all duration-300',
                        hasNewNotifications ? 'animate-pulse bg-blue-50 hover:bg-blue-100' : ''
                      )}
                    >
                      <Bell className="h-5 w-5" />
                      {notificationCount && notificationCount > 0 && (
                        <span className={cn(
                          'absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center transition-all duration-300',
                          hasNewNotifications ? 'animate-bounce scale-110' : ''
                        )}>
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
              </UiTooltip>

              {/* Profile dropdown */}
              <DropdownMenu>
                <UiTooltip>
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
                </UiTooltip>
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
