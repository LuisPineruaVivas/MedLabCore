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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      exam_profiles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          total_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          total_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          id: string
          org_id: string
          rate: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          org_id: string
          rate?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          rate?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          is_profile_header: boolean
          order_id: string
          parent_profile_id: string | null
          price_at_order: number
          results_data: Json | null
          template_id: string | null
          test_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_profile_header?: boolean
          order_id: string
          parent_profile_id?: string | null
          price_at_order?: number
          results_data?: Json | null
          template_id?: string | null
          test_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_profile_header?: boolean
          order_id?: string
          parent_profile_id?: string | null
          price_at_order?: number
          results_data?: Json | null
          template_id?: string | null
          test_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "test_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "v_test_templates_filtered"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          access_pin: string | null
          completed_at: string | null
          created_at: string
          exchange_rate: number | null
          id: string
          notes: string | null
          order_seq: number | null
          org_id: string
          patient_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number
          total_bs: number | null
          updated_at: string
        }
        Insert: {
          access_pin?: string | null
          completed_at?: string | null
          created_at?: string
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          order_seq?: number | null
          org_id: string
          patient_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          total_bs?: number | null
          updated_at?: string
        }
        Update: {
          access_pin?: string | null
          completed_at?: string | null
          created_at?: string
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          order_seq?: number | null
          org_id?: string
          patient_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          total_bs?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_exam_settings: {
        Row: {
          created_at: string | null
          custom_sort_order: number
          id: string
          org_id: string | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_sort_order: number
          id?: string
          org_id?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_sort_order?: number
          id?: string
          org_id?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_exam_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_exam_settings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "test_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_exam_settings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "v_test_templates_filtered"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          phone: string | null
          primary_color: string | null
          rif: string | null
          secondary_color: string | null
          state: string | null
          subscription_active: boolean
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          rif?: string | null
          secondary_color?: string | null
          state?: string | null
          subscription_active?: boolean
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          rif?: string | null
          secondary_color?: string | null
          state?: string | null
          subscription_active?: boolean
        }
        Relationships: []
      }
      patients: {
        Row: {
          address: string | null
          created_at: string
          date_of_birth: string
          email: string | null
          first_name: string
          gender: string
          id: string
          id_number: string
          last_name: string
          occupation: string | null
          org_id: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          date_of_birth: string
          email?: string | null
          first_name: string
          gender: string
          id?: string
          id_number: string
          last_name: string
          occupation?: string | null
          org_id: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          date_of_birth?: string
          email?: string | null
          first_name?: string
          gender?: string
          id?: string
          id_number?: string
          last_name?: string
          occupation?: string | null
          org_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_templates_junction: {
        Row: {
          id: string
          profile_id: string
          template_id: string
        }
        Insert: {
          id?: string
          profile_id: string
          template_id: string
        }
        Update: {
          id?: string
          profile_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_templates_junction_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "exam_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_templates_junction_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "test_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_templates_junction_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "v_test_templates_filtered"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          org_id: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      test_templates: {
        Row: {
          base_price: number
          category: string
          created_at: string
          id: string
          id_global_ref: string | null
          is_active: boolean
          name: string
          org_id: string | null
          schema: Json
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          base_price?: number
          category: string
          created_at?: string
          id?: string
          id_global_ref?: string | null
          is_active?: boolean
          name: string
          org_id?: string | null
          schema?: Json
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          base_price?: number
          category?: string
          created_at?: string
          id?: string
          id_global_ref?: string | null
          is_active?: boolean
          name?: string
          org_id?: string | null
          schema?: Json
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_templates_id_global_ref_fkey"
            columns: ["id_global_ref"]
            isOneToOne: false
            referencedRelation: "test_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_templates_id_global_ref_fkey"
            columns: ["id_global_ref"]
            isOneToOne: false
            referencedRelation: "v_test_templates_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_test_templates_filtered: {
        Row: {
          base_price: number | null
          category: string | null
          created_at: string | null
          id: string | null
          id_global_ref: string | null
          is_active: boolean | null
          name: string | null
          org_id: string | null
          schema: Json | null
          sort_order: number | null
        }
        Relationships: [
          {
            foreignKeyName: "test_templates_id_global_ref_fkey"
            columns: ["id_global_ref"]
            isOneToOne: false
            referencedRelation: "test_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_templates_id_global_ref_fkey"
            columns: ["id_global_ref"]
            isOneToOne: false
            referencedRelation: "v_test_templates_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_my_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      portal_authenticate: {
        Args: { p_dni: string; p_pin: string }
        Returns: {
          date_of_birth: string
          email: string
          first_name: string
          gender: string
          id_number: string
          last_name: string
          patient_id: string
          phone: string
        }[]
      }
      portal_get_patient_orders: {
        Args: { p_patient_id: string }
        Returns: {
          access_pin: string
          created_at: string
          id: string
          items: Json
          order_seq: number
          org_logo_url: string
          org_name: string
          status: string
          total_amount: number
        }[]
      }
      upsert_test_template: {
        Args: {
          p_base_price: number
          p_category: string
          p_id: string
          p_name: string
          p_org_id: string
          p_schema: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      order_status: "pendiente" | "procesando" | "completada" | "cancelada"
      payment_status: "unpaid" | "partial" | "paid"
      user_role: "super_admin" | "lab_admin" | "bioanalyst" | "secretary"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

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
    Enums: {
      order_status: ["pendiente", "procesando", "completada", "cancelada"],
      payment_status: ["unpaid", "partial", "paid"],
      user_role: ["super_admin", "lab_admin", "bioanalyst", "secretary"],
    },
  },
} as const
