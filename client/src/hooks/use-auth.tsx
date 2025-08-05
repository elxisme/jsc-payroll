import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { logAuthEvent } from '@/lib/audit-logger';
import { useQueryClient } from '@tanstack/react-query';

interface AuthUser extends User {
  role?: string;
  staff_profile?: any;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (roles: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          fetchUserProfile(session.user);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Set up real-time notifications subscription
  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to notifications for the current user
    const notificationsSubscription = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time notification update:', payload);
          
          // Invalidate notification queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['notification-count', user.id] });
          queryClient.invalidateQueries({ queryKey: ['recent-notifications'] });
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
          
          // Show toast for new notifications
          if (payload.eventType === 'INSERT' && payload.new) {
            const notification = payload.new;
            toast({
              title: notification.title,
              description: notification.message,
              variant: notification.type === 'error' ? 'destructive' : 'default',
            });
          }
        }
      )
      .subscribe();

    // Cleanup subscription on user change or unmount
    return () => {
      supabase.removeChannel(notificationsSubscription);
    };
  }, [user?.id, queryClient, toast]);

  const fetchUserProfile = async (authUser: User) => {
    try {
      // Fetch user role and staff profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .single();

      if (userError) throw userError;

      // Fetch staff profile if user is staff
      let staffProfile = null;
      if (userData.role === 'staff') {
        const { data: staff, error: staffError } = await supabase
          .from('staff')
          .select(`
            *,
            departments!staff_department_id_fkey (
              id,
              name,
              code
            )
          `)
          .eq('user_id', authUser.id)
          .single();

        if (!staffError) {
          staffProfile = staff;
        }
      }

      setUser({
        ...authUser,
        role: userData.role,
        staff_profile: staffProfile,
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast({
        title: "Error",
        description: "Failed to load user profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Log successful login
      await logAuthEvent('login', email);

      toast({
        title: "Success",
        description: "Signed in successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in",
        variant: "destructive",
      });
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const currentEmail = user?.email;
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Log logout
      if (currentEmail) {
        await logAuthEvent('logout', currentEmail);
      }

      toast({
        title: "Success",
        description: "Signed out successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  const hasRole = (roles: string | string[]) => {
    if (!user?.role) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  };

  const value = {
    user,
    loading,
    signIn,
    signOut,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}