import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rawxiolblbfqgtdvygli.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          email: string;
          password: string;
          role?: string;
        };
        Update: {
          email?: string;
          role?: string;
        };
      };
      staff: {
        Row: {
          id: string;
          staff_id: string;
          user_id: string | null;
          first_name: string;
          last_name: string;
          middle_name: string | null;
          email: string;
          phone_number: string | null;
          department_id: string | null;
          position: string;
          grade_level: number;
          step: number;
          employment_date: string;
          status: string;
          bank_name: string | null;
          account_number: string | null;
          account_name: string | null;
          pension_pin: string | null;
          tax_pin: string | null;
          next_of_kin: any;
          documents: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          first_name: string;
          last_name: string;
          middle_name?: string;
          email: string;
          phone_number?: string;
          department_id?: string;
          position: string;
          grade_level: number;
          step: number;
          employment_date: string;
          status?: string;
          bank_name?: string;
          account_number?: string;
          account_name?: string;
          pension_pin?: string;
          tax_pin?: string;
          next_of_kin?: any;
          documents?: any;
        };
        Update: Partial<Database['public']['Tables']['staff']['Insert']>;
      };
      departments: {
        Row: {
          id: string;
          name: string;
          code: string;
          head_of_department: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          code: string;
          head_of_department?: string;
          description?: string;
        };
        Update: Partial<Database['public']['Tables']['departments']['Insert']>;
      };
    };
  };
};
