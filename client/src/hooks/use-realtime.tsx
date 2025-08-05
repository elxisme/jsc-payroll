import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { getRealtimeManager } from '@/lib/realtime-manager';
import { useToast } from './use-toast';

/**
 * Hook to manage real-time subscriptions based on user role and current page
 */
export function useRealtime(options: {
  enableNotifications?: boolean;
  enablePayrollUpdates?: boolean;
  enableStaffUpdates?: boolean;
  enableDepartmentUpdates?: boolean;
} = {}) {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const realtimeManager = getRealtimeManager(queryClient);

  const {
    enableNotifications = true,
    enablePayrollUpdates = false,
    enableStaffUpdates = false,
    enableDepartmentUpdates = false,
  } = options;

  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to notifications for all authenticated users
    if (enableNotifications) {
      realtimeManager.subscribeToUserNotifications(user.id, (payload) => {
        // Show toast for new notifications
        if (payload.eventType === 'INSERT' && payload.new) {
          const notification = payload.new;
          
          // Only show toast if it's not a system-generated notification
          if (!notification.title.includes('System')) {
            toast({
              title: notification.title,
              description: notification.message,
              variant: notification.type === 'error' ? 'destructive' : 'default',
            });
          }
        }
      });
    }

    // Subscribe to payroll updates for admin users
    if (enablePayrollUpdates && hasRole(['super_admin', 'account_admin', 'payroll_admin'])) {
      realtimeManager.subscribeToPayrollUpdates((payload) => {
        if (payload.eventType === 'UPDATE' && payload.new?.status !== payload.old?.status) {
          const status = payload.new.status;
          const period = payload.new.period;
          
          toast({
            title: 'Payroll Status Updated',
            description: `Payroll for ${period} is now ${status.replace('_', ' ')}`,
            variant: status === 'processed' ? 'default' : 'default',
          });
        }
      });
    }

    // Subscribe to staff updates for admin users
    if (enableStaffUpdates && hasRole(['super_admin', 'payroll_admin'])) {
      realtimeManager.subscribeToStaffUpdates((payload) => {
        if (payload.eventType === 'INSERT') {
          toast({
            title: 'New Staff Added',
            description: `${payload.new.first_name} ${payload.new.last_name} has been added to the system`,
          });
        }
      });
    }

    // Subscribe to department updates for admin users
    if (enableDepartmentUpdates && hasRole(['super_admin', 'payroll_admin'])) {
      realtimeManager.subscribeToDepartmentUpdates((payload) => {
        if (payload.eventType === 'INSERT') {
          toast({
            title: 'New Department Created',
            description: `Department "${payload.new.name}" has been created`,
          });
        }
      });
    }

    // Cleanup subscriptions when user changes or component unmounts
    return () => {
      if (enableNotifications) {
        realtimeManager.unsubscribe(`user-notifications-${user.id}`);
      }
      if (enablePayrollUpdates) {
        realtimeManager.unsubscribe('payroll-updates');
      }
      if (enableStaffUpdates) {
        realtimeManager.unsubscribe('staff-updates');
      }
      if (enableDepartmentUpdates) {
        realtimeManager.unsubscribe('department-updates');
      }
    };
  }, [user?.id, hasRole, enableNotifications, enablePayrollUpdates, enableStaffUpdates, enableDepartmentUpdates, realtimeManager, toast]);

  return {
    isConnected: user?.id ? realtimeManager.getActiveSubscriptionCount() > 0 : false,
    activeSubscriptions: realtimeManager.getActiveSubscriptionCount(),
  };
}