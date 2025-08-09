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
  sendPasswordResetEmail: (email: string) => Promise<void>;
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

    // Check for email verification feedback in URL
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    const type = urlParams.get('type') || hashParams.get('type');
    const error = urlParams.get('error') || hashParams.get('error');
    const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');
    
    if (type === 'signup') {
      if (error) {
        toast({
          title: "Email Verification Failed",
          description: errorDescription || error || "Failed to verify your email address",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email Verified Successfully",
          description: "Your account has been verified. You can now sign in.",
        });
      }
      
      // Clear URL parameters to prevent re-triggering
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Handle email verification events
        if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
          const urlParams = new URLSearchParams(window.location.search);
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const type = urlParams.get('type') || hashParams.get('type');
          
          if (type === 'signup') {
            toast({
              title: "Email Verified Successfully",
              description: "Your account has been verified. Welcome to JSC Payroll System!",
            });
          }
        }
        
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
        description: "Failed to load your profile information. Please refresh the page or contact support if the issue persists.",
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

      if (error) {
        // Provide more specific error messages
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('Please verify your email address before signing in. Check your inbox for a verification link.');
        } else if (error.message.includes('Too many requests')) {
          throw new Error('Too many login attempts. Please wait a few minutes before trying again.');
        } else {
          throw new Error(error.message || 'Failed to sign in. Please try again.');
        }
      }

      // Log successful login
      await logAuthEvent('login', email);

      toast({
        title: "Success",
        description: "Welcome back! You have been signed in successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in. Please check your credentials and try again.",
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
        description: "You have been signed out successfully. Thank you for using JSC Payroll System.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign out. Please try again or close your browser.",
        variant: "destructive",
      });
    }
  };

  const sendPasswordResetEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Password reset instructions have been sent to ${email}. Please check your inbox and spam folder.`,
      });
    } catch (error: any) {
      let errorMessage = "Failed to send password reset email. Please try again.";
      
      if (error.message.includes('rate limit')) {
        errorMessage = "Too many password reset requests. Please wait a few minutes before trying again.";
      } else if (error.message.includes('not found')) {
        errorMessage = "No account found with this email address. Please check the email and try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
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
    sendPasswordResetEmail,
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