// Hand-written until `supabase gen types` can run against a linked project.
// Regenerate with: npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts

export type StaffRole = "staff" | "super_admin";
export type OrderStatus = "pending_payment" | "paid" | "needs_review" | "rejected" | "expired";
export type TicketStatus = "active" | "cancelled";
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          student_id: string | null;
          consent_at: string | null;
          first_name: string | null;
          last_name: string | null;
          faculty: string | null;
          year_of_study: number | null;
          registered_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      staff_members: {
        Row: { email: string; role: StaffRole; created_at: string };
        Insert: { email: string; role?: StaffRole; created_at?: string };
        Update: { email?: string; role?: StaffRole; created_at?: string };
        Relationships: [];
      };
      settings: {
        Row: {
          id: number;
          price_satang: number;
          open_time: string;
          close_time: string;
          sales_cutoff: string;
          order_ttl_minutes: number;
          updated_at: string;
        };
        Insert: never;
        Update: Partial<{
          price_satang: number;
          open_time: string;
          close_time: string;
          sales_cutoff: string;
          order_ttl_minutes: number;
          updated_at: string;
        }>;
        Relationships: [];
      };
      closed_dates: {
        Row: { date: string; note: string | null; created_at: string };
        Insert: { date: string; note?: string | null };
        Update: { date?: string; note?: string | null };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          business_date: string;
          amount_satang: number;
          status: OrderStatus;
          review_reason: string | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          business_date: string;
          amount_satang: number;
          expires_at: string;
          status?: OrderStatus;
        };
        Update: { status?: OrderStatus; review_reason?: string | null; updated_at?: string };
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          order_id: string;
          user_id: string;
          business_date: string;
          status: TicketStatus;
          issued_at: string;
          totp_secret: string;
        };
        Insert: never;
        Update: { status?: TicketStatus };
        Relationships: [];
      };
      gate_scans: {
        Row: {
          id: number;
          ticket_id: string | null;
          ok: boolean;
          reason: string | null;
          method: "qr" | "manual";
          staff_email: string;
          scanned_at: string;
        };
        Insert: {
          ticket_id?: string | null;
          ok: boolean;
          reason?: string | null;
          method: "qr" | "manual";
          staff_email: string;
          scanned_at: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      current_staff_role: { Args: Record<string, never>; Returns: StaffRole | null };
      accept_consent: { Args: Record<string, never>; Returns: undefined };
      register_student: {
        Args: {
          p_student_id: string;
          p_first_name: string;
          p_last_name: string;
          p_faculty: string;
          p_year_of_study: number;
        };
        Returns: undefined;
      };
      record_slip_result: {
        Args: {
          p_order_id: string;
          p_storage_path: string;
          p_verifier: string;
          p_verified: boolean;
          p_reason: string | null;
          p_trans_ref: string | null;
          p_amount_satang: number | null;
          p_transferred_at: string | null;
          p_raw: Json;
          p_now: string;
        };
        Returns: OrderStatus;
      };
    };
    Enums: { staff_role: StaffRole; order_status: OrderStatus; ticket_status: TicketStatus };
    CompositeTypes: { [_ in never]: never };
  };
};
