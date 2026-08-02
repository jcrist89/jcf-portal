// Generated via `mcp__supabase__generate_typescript_types` against the live
// project (xdztfuocalvpdmmvsxaw) on 2026-08-02, after migrations 0014-0023 were
// applied to production (includes the new event_log/stripe_events tables added
// by that pass). Not currently imported anywhere — src/lib/types.ts remains the
// app's hand-written type source (reconciled against this file's shape; the two
// match exactly, field for field). Kept here as the canonical generated
// reference for future regeneration
// (`supabase gen types typescript --project-id xdztfuocalvpdmmvsxaw`) and as a
// drift check: if this file and src/lib/types.ts ever diverge again, one of them
// is stale.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          created_at: string
          date_earned: string
          description: string | null
          icon: string | null
          id: string
          profile_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          date_earned?: string
          description?: string | null
          icon?: string | null
          id?: string
          profile_id: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          date_earned?: string
          description?: string | null
          icon?: string | null
          id?: string
          profile_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_notes: {
        Row: {
          author: string
          created_at: string
          id: string
          message: string
          profile_id: string
          read: boolean
        }
        Insert: {
          author: string
          created_at?: string
          id?: string
          message: string
          profile_id: string
          read?: boolean
        }
        Update: {
          author?: string
          created_at?: string
          id?: string
          message?: string
          profile_id?: string
          read?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "coach_notes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deviation_reports: {
        Row: {
          actual_rpe: number | null
          actual_weight: number
          created_at: string
          exercise_name: string
          id: string
          lift_key: string | null
          pain_score: number | null
          prescribed_weight: number | null
          profile_id: string
          reason: string | null
          reviewed: boolean
          technical_rating: number | null
          week_number: number | null
          workout_log_id: string | null
        }
        Insert: {
          actual_rpe?: number | null
          actual_weight: number
          created_at?: string
          exercise_name: string
          id?: string
          lift_key?: string | null
          pain_score?: number | null
          prescribed_weight?: number | null
          profile_id: string
          reason?: string | null
          reviewed?: boolean
          technical_rating?: number | null
          week_number?: number | null
          workout_log_id?: string | null
        }
        Update: {
          actual_rpe?: number | null
          actual_weight?: number
          created_at?: string
          exercise_name?: string
          id?: string
          lift_key?: string | null
          pain_score?: number | null
          prescribed_weight?: number | null
          profile_id?: string
          reason?: string | null
          reviewed?: boolean
          technical_rating?: number | null
          week_number?: number | null
          workout_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deviation_reports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deviation_reports_workout_log_id_fkey"
            columns: ["workout_log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      event_log: {
        Row: {
          context: Json
          created_at: string
          id: string
          level: string
          message: string
          profile_id: string | null
          source: string
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          level?: string
          message: string
          profile_id?: string | null
          source: string
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          level?: string
          message?: string
          profile_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_drafts: {
        Row: {
          created_at: string
          draft_key: string
          form_type: string
          id: string
          payload: Json
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          draft_key: string
          form_type: string
          id?: string
          payload?: Json
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          draft_key?: string
          form_type?: string
          id?: string
          payload?: Json
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_drafts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      joker_requests: {
        Row: {
          actual_rpe: number | null
          actual_weight: number | null
          coach_response: string | null
          id: string
          lift: string
          max_permitted_weight: number
          profile_id: string
          program_id: string | null
          requested_at: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          technical_result: string | null
          top_single_rpe: number
          top_single_weight: number
          week_number: number
        }
        Insert: {
          actual_rpe?: number | null
          actual_weight?: number | null
          coach_response?: string | null
          id?: string
          lift: string
          max_permitted_weight: number
          profile_id: string
          program_id?: string | null
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          technical_result?: string | null
          top_single_rpe: number
          top_single_weight: number
          week_number: number
        }
        Update: {
          actual_rpe?: number | null
          actual_weight?: number | null
          coach_response?: string | null
          id?: string
          lift?: string
          max_permitted_weight?: number
          profile_id?: string
          program_id?: string | null
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          technical_result?: string | null
          top_single_rpe?: number
          top_single_weight?: number
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "joker_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "joker_requests_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "joker_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      measurements: {
        Row: {
          arms: number | null
          chest: number | null
          created_at: string
          date: string
          hips: number | null
          id: string
          notes: string | null
          profile_id: string
          thighs: number | null
          waist: number | null
          weight: number | null
        }
        Insert: {
          arms?: number | null
          chest?: number | null
          created_at?: string
          date?: string
          hips?: number | null
          id?: string
          notes?: string | null
          profile_id: string
          thighs?: number | null
          waist?: number | null
          weight?: number | null
        }
        Update: {
          arms?: number | null
          chest?: number | null
          created_at?: string
          date?: string
          hips?: number | null
          id?: string
          notes?: string | null
          profile_id?: string
          thighs?: number | null
          waist?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "measurements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birthday: string | null
          created_at: string
          current_weight: number | null
          email: string | null
          full_name: string | null
          goal: string | null
          height_in: number | null
          id: string
          is_active: boolean
          last_nudge_threshold: number | null
          onboarded: boolean
          program_id: string | null
          role: string
          starting_weight: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          tier: string
          updated_at: string
          username: string | null
          welcome_email_sent_at: string | null
        }
        Insert: {
          birthday?: string | null
          created_at?: string
          current_weight?: number | null
          email?: string | null
          full_name?: string | null
          goal?: string | null
          height_in?: number | null
          id?: string
          is_active?: boolean
          last_nudge_threshold?: number | null
          onboarded?: boolean
          program_id?: string | null
          role?: string
          starting_weight?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          tier?: string
          updated_at?: string
          username?: string | null
          welcome_email_sent_at?: string | null
        }
        Update: {
          birthday?: string | null
          created_at?: string
          current_weight?: number | null
          email?: string | null
          full_name?: string | null
          goal?: string | null
          height_in?: number | null
          id?: string
          is_active?: boolean
          last_nudge_threshold?: number | null
          onboarded?: boolean
          program_id?: string | null
          role?: string
          starting_weight?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          tier?: string
          updated_at?: string
          username?: string | null
          welcome_email_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          attempt_plan: Json | null
          client_id: string | null
          created_at: string
          description: string | null
          goal: string
          id: string
          is_default_template: boolean
          is_template: boolean
          meet_date: string | null
          name: string
          structure: Json
          updated_at: string
          weaknesses: Json | null
        }
        Insert: {
          attempt_plan?: Json | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          goal: string
          id?: string
          is_default_template?: boolean
          is_template?: boolean
          meet_date?: string | null
          name: string
          structure?: Json
          updated_at?: string
          weaknesses?: Json | null
        }
        Update: {
          attempt_plan?: Json | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          goal?: string
          id?: string
          is_default_template?: boolean
          is_template?: boolean
          meet_date?: string | null
          name?: string
          structure?: Json
          updated_at?: string
          weaknesses?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prs: {
        Row: {
          created_at: string
          date: string
          id: string
          lift: string
          notes: string | null
          profile_id: string
          reps: number
          unit: string
          weight: number
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          lift: string
          notes?: string | null
          profile_id: string
          reps?: number
          unit?: string
          weight: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          lift?: string
          notes?: string | null
          profile_id?: string
          reps?: number
          unit?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "prs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          profile_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          profile_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      readiness_checkins: {
        Row: {
          confidence: number
          created_at: string
          date: string
          fatigue: number
          id: string
          joint_pain: number
          motivation: number
          nutrition: number
          profile_id: string
          score: number
          sleep: number
          soreness: number
          stress: number
          tier: string
        }
        Insert: {
          confidence: number
          created_at?: string
          date?: string
          fatigue: number
          id?: string
          joint_pain: number
          motivation: number
          nutrition: number
          profile_id: string
          score: number
          sleep: number
          soreness: number
          stress: number
          tier: string
        }
        Update: {
          confidence?: number
          created_at?: string
          date?: string
          fatigue?: number
          id?: string
          joint_pain?: number
          motivation?: number
          nutrition?: number
          profile_id?: string
          score?: number
          sleep?: number
          soreness?: number
          stress?: number
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "readiness_checkins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          event_type: string
          id: string
          processed_at: string
        }
        Insert: {
          event_type: string
          id: string
          processed_at?: string
        }
        Update: {
          event_type?: string
          id?: string
          processed_at?: string
        }
        Relationships: []
      }
      training_maxes: {
        Row: {
          id: string
          lift: string
          one_rm: number | null
          profile_id: string
          tm_percent: number | null
          unit: string
          updated_at: string
          updated_by: string | null
          weight: number
        }
        Insert: {
          id?: string
          lift: string
          one_rm?: number | null
          profile_id: string
          tm_percent?: number | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
          weight: number
        }
        Update: {
          id?: string
          lift?: string
          one_rm?: number | null
          profile_id?: string
          tm_percent?: number | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_maxes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_maxes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          completed: boolean
          created_at: string
          date: string
          day_label: string | null
          exercises_completed: Json
          id: string
          profile_id: string
          program_id: string | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          date?: string
          day_label?: string | null
          exercises_completed?: Json
          id?: string
          profile_id: string
          program_id?: string | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          date?: string
          day_label?: string | null
          exercises_completed?: Json
          id?: string
          profile_id?: string
          program_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_tier: {
        Args: { allowed_tiers: string[]; uid: string }
        Returns: boolean
      }
      is_coach: { Args: { uid: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals["public"]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
