import { supabase } from './supabase';
import { QueryClient } from '@tanstack/react-query';

export class RealtimeManager {
  private subscriptions: Map<string, any> = new Map();
  private queryClient: QueryClient;

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  /**
   * Subscribe to real-time updates for a specific table and user
   */
  subscribeToUserNotifications(userId: string, onUpdate?: (payload: any) => void) {
    const channelName = `user-notifications-${userId}`;
    
    // Remove existing subscription if any
    this.unsubscribe(channelName);

    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Real-time notification update:', payload);
          
          // Invalidate notification queries
          this.queryClient.invalidateQueries({ queryKey: ['notification-count', userId] });
          this.queryClient.invalidateQueries({ queryKey: ['recent-notifications'] });
          this.queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
          
          // Call custom callback if provided
          if (onUpdate) {
            onUpdate(payload);
          }
        }
      )
      .subscribe();

    this.subscriptions.set(channelName, subscription);
    return subscription;
  }

  /**
   * Subscribe to payroll run updates for admins
   */
  subscribeToPayrollUpdates(onUpdate?: (payload: any) => void) {
    const channelName = 'payroll-updates';
    
    // Remove existing subscription if any
    this.unsubscribe(channelName);

    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payroll_runs',
        },
        (payload) => {
          console.log('Real-time payroll update:', payload);
          
          // Invalidate payroll-related queries
          this.queryClient.invalidateQueries({ queryKey: ['payroll-workflow'] });
          this.queryClient.invalidateQueries({ queryKey: ['recent-payrolls'] });
          this.queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
          
          if (onUpdate) {
            onUpdate(payload);
          }
        }
      )
      .subscribe();

    this.subscriptions.set(channelName, subscription);
    return subscription;
  }

  /**
   * Subscribe to staff updates
   */
  subscribeToStaffUpdates(onUpdate?: (payload: any) => void) {
    const channelName = 'staff-updates';
    
    // Remove existing subscription if any
    this.unsubscribe(channelName);

    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff',
        },
        (payload) => {
          console.log('Real-time staff update:', payload);
          
          // Invalidate staff-related queries
          this.queryClient.invalidateQueries({ queryKey: ['staff'] });
          this.queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
          this.queryClient.invalidateQueries({ queryKey: ['departments-with-staff'] });
          
          if (onUpdate) {
            onUpdate(payload);
          }
        }
      )
      .subscribe();

    this.subscriptions.set(channelName, subscription);
    return subscription;
  }

  /**
   * Subscribe to department updates
   */
  subscribeToDepartmentUpdates(onUpdate?: (payload: any) => void) {
    const channelName = 'department-updates';
    
    // Remove existing subscription if any
    this.unsubscribe(channelName);

    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'departments',
        },
        (payload) => {
          console.log('Real-time department update:', payload);
          
          // Invalidate department-related queries
          this.queryClient.invalidateQueries({ queryKey: ['departments'] });
          this.queryClient.invalidateQueries({ queryKey: ['departments-with-staff'] });
          
          if (onUpdate) {
            onUpdate(payload);
          }
        }
      )
      .subscribe();

    this.subscriptions.set(channelName, subscription);
    return subscription;
  }

  /**
   * Unsubscribe from a specific channel
   */
  unsubscribe(channelName: string) {
    const subscription = this.subscriptions.get(channelName);
    if (subscription) {
      supabase.removeChannel(subscription);
      this.subscriptions.delete(channelName);
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll() {
    this.subscriptions.forEach((subscription, channelName) => {
      supabase.removeChannel(subscription);
    });
    this.subscriptions.clear();
  }

  /**
   * Get active subscription count
   */
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Check if a specific channel is subscribed
   */
  isSubscribed(channelName: string): boolean {
    return this.subscriptions.has(channelName);
  }
}

// Create a singleton instance
let realtimeManager: RealtimeManager | null = null;

export function getRealtimeManager(queryClient: QueryClient): RealtimeManager {
  if (!realtimeManager) {
    realtimeManager = new RealtimeManager(queryClient);
  }
  return realtimeManager;
}

export function cleanupRealtimeManager() {
  if (realtimeManager) {
    realtimeManager.unsubscribeAll();
    realtimeManager = null;
  }
}