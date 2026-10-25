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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      antibiotics: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "antibiotics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          org_id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          org_id: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_holder: string | null
          account_number: string | null
          bank_name: string | null
          created_at: string
          currency: string
          description: string | null
          email: string | null
          id: string
          is_active: boolean
          method_type: Database["public"]["Enums"]["payment_method_type"]
          name: string
          org_id: string
          phone_number: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          method_type?: Database["public"]["Enums"]["payment_method_type"]
          name: string
          org_id: string
          phone_number?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          method_type?: Database["public"]["Enums"]["payment_method_type"]
          name?: string
          org_id?: string
          phone_number?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register_sessions: {
        Row: {
          actual_totals: Json | null
          closed_at: string | null
          closed_by: string | null
          closing_notes: string | null
          created_at: string
          difference: Json | null
          expected_totals: Json | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_cash_usd: number
          opening_cash_ves: number
          operator_name: string
          org_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["cash_session_status"]
          updated_at: string
        }
        Insert: {
          actual_totals?: Json | null
          closed_at?: string | null
          closed_by?: string | null
          closing_notes?: string | null
          created_at?: string
          difference?: Json | null
          expected_totals?: Json | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_cash_usd?: number
          opening_cash_ves?: number
          operator_name: string
          org_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["cash_session_status"]
          updated_at?: string
        }
        Update: {
          actual_totals?: Json | null
          closed_at?: string | null
          closed_by?: string | null
          closing_notes?: string | null
          created_at?: string
          difference?: Json | null
          expected_totals?: Json | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_cash_usd?: number
          opening_cash_ves?: number
          operator_name?: string
          org_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["cash_session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
      exchange_rate_history: {
        Row: {
          created_at: string
          created_by: string | null
          effective_date: string
          from_currency: string
          id: string
          org_id: string
          rate: number
          source: string
          to_currency: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          from_currency?: string
          id?: string
          org_id: string
          rate: number
          source?: string
          to_currency?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          from_currency?: string
          id?: string
          org_id?: string
          rate?: number
          source?: string
          to_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rate_history_org_id_fkey"
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
      inventory_transactions: {
        Row: {
          created_at: string
          created_by: string
          expiration_date: string | null
          id: string
          invoice_consumption_id: string | null
          item_id: string
          lot_number: string | null
          new_stock: number
          new_unit_cost: number
          notes: string | null
          org_id: string
          prev_stock: number
          prev_unit_cost: number
          purchase_invoice_ref: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          supplier_name: string | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["inventory_transaction_type"]
          unit_cost_at_time: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expiration_date?: string | null
          id?: string
          invoice_consumption_id?: string | null
          item_id: string
          lot_number?: string | null
          new_stock?: number
          new_unit_cost?: number
          notes?: string | null
          org_id: string
          prev_stock?: number
          prev_unit_cost?: number
          purchase_invoice_ref?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          supplier_name?: string | null
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["inventory_transaction_type"]
          unit_cost_at_time?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expiration_date?: string | null
          id?: string
          invoice_consumption_id?: string | null
          item_id?: string
          lot_number?: string | null
          new_stock?: number
          new_unit_cost?: number
          notes?: string | null
          org_id?: string
          prev_stock?: number
          prev_unit_cost?: number
          purchase_invoice_ref?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          supplier_name?: string | null
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["inventory_transaction_type"]
          unit_cost_at_time?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_invoice_consumption_fkey"
            columns: ["invoice_consumption_id"]
            isOneToOne: false
            referencedRelation: "invoice_consumptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_consumptions: {
        Row: {
          adjustment_reason: string | null
          confirmed_by: string
          created_at: string
          id: string
          invoice_id: string | null
          is_extra: boolean
          item_id: string
          order_id: string
          order_item_id: string | null
          org_id: string
          quantity_consumed: number
          total_cost: number
          unit_cost_at_consumption: number
          was_adjusted: boolean
        }
        Insert: {
          adjustment_reason?: string | null
          confirmed_by: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          is_extra?: boolean
          item_id: string
          order_id: string
          order_item_id?: string | null
          org_id: string
          quantity_consumed: number
          total_cost?: number
          unit_cost_at_consumption?: number
          was_adjusted?: boolean
        }
        Update: {
          adjustment_reason?: string | null
          confirmed_by?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          is_extra?: boolean
          item_id?: string
          order_id?: string
          order_item_id?: string | null
          org_id?: string
          quantity_consumed?: number
          total_cost?: number
          unit_cost_at_consumption?: number
          was_adjusted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "invoice_consumptions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_consumptions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_consumptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_consumptions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_consumptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          last_value: number
          org_id: string
          updated_at: string
        }
        Insert: {
          last_value?: number
          org_id: string
          updated_at?: string
        }
        Update: {
          last_value?: number
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid_usd: number
          balance_due_usd: number
          cancelled_at: string | null
          created_at: string
          created_by: string
          discount_amount: number
          discount_pct: number
          due_date: string | null
          exchange_rate: number | null
          exchange_rate_id: string | null
          id: string
          invoice_number: string
          invoice_seq: number
          is_exempted: boolean
          issued_at: string
          notes: string | null
          order_id: string
          org_id: string
          paid_at: string | null
          patient_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_usd: number
          tax_amount: number
          tax_pct: number
          total_local: number | null
          total_usd: number
          updated_at: string
        }
        Insert: {
          amount_paid_usd?: number
          balance_due_usd?: number
          cancelled_at?: string | null
          created_at?: string
          created_by: string
          discount_amount?: number
          discount_pct?: number
          due_date?: string | null
          exchange_rate?: number | null
          exchange_rate_id?: string | null
          id?: string
          invoice_number: string
          invoice_seq: number
          is_exempted?: boolean
          issued_at?: string
          notes?: string | null
          order_id: string
          org_id: string
          paid_at?: string | null
          patient_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_usd?: number
          tax_amount?: number
          tax_pct?: number
          total_local?: number | null
          total_usd?: number
          updated_at?: string
        }
        Update: {
          amount_paid_usd?: number
          balance_due_usd?: number
          cancelled_at?: string | null
          created_at?: string
          created_by?: string
          discount_amount?: number
          discount_pct?: number
          due_date?: string | null
          exchange_rate?: number | null
          exchange_rate_id?: string | null
          id?: string
          invoice_number?: string
          invoice_seq?: number
          is_exempted?: boolean
          issued_at?: string
          notes?: string | null
          order_id?: string
          org_id?: string
          paid_at?: string | null
          patient_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_usd?: number
          tax_amount?: number
          tax_pct?: number
          total_local?: number | null
          total_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_exchange_rate_id_fkey"
            columns: ["exchange_rate_id"]
            isOneToOne: false
            referencedRelation: "exchange_rate_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: Database["public"]["Enums"]["item_category"]
          code: string | null
          created_at: string
          created_by: string | null
          current_stock: number
          description: string | null
          expiration_date: string | null
          id: string
          is_active: boolean
          is_trackable: boolean
          lot_number: string | null
          max_stock: number | null
          min_stock: number
          name: string
          org_id: string
          storage_condition: string | null
          total_value: number
          unit_cost: number
          unit_of_measure: Database["public"]["Enums"]["unit_of_measure"]
          units_per_package: number
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["item_category"]
          code?: string | null
          created_at?: string
          created_by?: string | null
          current_stock?: number
          description?: string | null
          expiration_date?: string | null
          id?: string
          is_active?: boolean
          is_trackable?: boolean
          lot_number?: string | null
          max_stock?: number | null
          min_stock?: number
          name: string
          org_id: string
          storage_condition?: string | null
          total_value?: number
          unit_cost?: number
          unit_of_measure?: Database["public"]["Enums"]["unit_of_measure"]
          units_per_package?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["item_category"]
          code?: string | null
          created_at?: string
          created_by?: string | null
          current_stock?: number
          description?: string | null
          expiration_date?: string | null
          id?: string
          is_active?: boolean
          is_trackable?: boolean
          lot_number?: string | null
          max_stock?: number | null
          min_stock?: number
          name?: string
          org_id?: string
          storage_condition?: string | null
          total_value?: number
          unit_cost?: number
          unit_of_measure?: Database["public"]["Enums"]["unit_of_measure"]
          units_per_package?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
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
          method_name: string | null
          order_id: string
          parent_profile_id: string | null
          price_at_order: number
          results_data: Json | null
          template_id: string | null
          test_method_id: string | null
          test_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_profile_header?: boolean
          method_name?: string | null
          order_id: string
          parent_profile_id?: string | null
          price_at_order?: number
          results_data?: Json | null
          template_id?: string | null
          test_method_id?: string | null
          test_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_profile_header?: boolean
          method_name?: string | null
          order_id?: string
          parent_profile_id?: string | null
          price_at_order?: number
          results_data?: Json | null
          template_id?: string | null
          test_method_id?: string | null
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
          {
            foreignKeyName: "order_items_test_method_id_fkey"
            columns: ["test_method_id"]
            isOneToOne: false
            referencedRelation: "test_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          access_pin: string | null
          completed_at: string | null
          consumption_confirmed_at: string | null
          consumption_confirmed_by: string | null
          created_at: string
          created_by: string
          exchange_rate: number | null
          firma_name: string | null
          firma_url: string | null
          id: string
          invoice_id: string | null
          is_exempted: boolean
          notes: string | null
          order_seq: number | null
          org_id: string
          patient_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          sello_url: string | null
          signature_footer_text: string | null
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number
          total_bs: number | null
          updated_at: string
        }
        Insert: {
          access_pin?: string | null
          completed_at?: string | null
          consumption_confirmed_at?: string | null
          consumption_confirmed_by?: string | null
          created_at?: string
          created_by?: string
          exchange_rate?: number | null
          firma_name?: string | null
          firma_url?: string | null
          id?: string
          invoice_id?: string | null
          is_exempted?: boolean
          notes?: string | null
          order_seq?: number | null
          org_id: string
          patient_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          sello_url?: string | null
          signature_footer_text?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          total_bs?: number | null
          updated_at?: string
        }
        Update: {
          access_pin?: string | null
          completed_at?: string | null
          consumption_confirmed_at?: string | null
          consumption_confirmed_by?: string | null
          created_at?: string
          created_by?: string
          exchange_rate?: number | null
          firma_name?: string | null
          firma_url?: string | null
          id?: string
          invoice_id?: string | null
          is_exempted?: boolean
          notes?: string | null
          order_seq?: number | null
          org_id?: string
          patient_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          sello_url?: string | null
          signature_footer_text?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          total_bs?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
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
      organization_test_category_settings: {
        Row: {
          created_at: string
          custom_sort_order: number
          department_name: string
          id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_sort_order: number
          department_name: string
          id?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_sort_order?: number
          department_name?: string
          id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_test_category_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          has_erp_module: boolean
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          phone: string | null
          primary_color: string | null
          report_footer_text: string | null
          report_template: string | null
          rif: string | null
          secondary_color: string | null
          state: string | null
          subscription_active: boolean
          watermark_url: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          has_erp_module?: boolean
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          report_footer_text?: string | null
          report_template?: string | null
          rif?: string | null
          secondary_color?: string | null
          state?: string | null
          subscription_active?: boolean
          watermark_url?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          has_erp_module?: boolean
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          report_footer_text?: string | null
          report_template?: string | null
          rif?: string | null
          secondary_color?: string | null
          state?: string | null
          subscription_active?: boolean
          watermark_url?: string | null
        }
        Relationships: []
      }
      patients: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
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
          created_by?: string
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
          created_by?: string
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
      payment_schedules: {
        Row: {
          amount_due_usd: number
          amount_paid_usd: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          invoice_id: string
          notes: string | null
          org_id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
        }
        Insert: {
          amount_due_usd: number
          amount_paid_usd?: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          invoice_id: string
          notes?: string | null
          org_id: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Update: {
          amount_due_usd?: number
          amount_paid_usd?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          invoice_id?: string
          notes?: string | null
          org_id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          amount_usd: number
          bank_account_id: string | null
          cash_session_id: string | null
          created_at: string
          created_by: string
          currency: string
          exchange_rate: number | null
          exchange_rate_id: string | null
          id: string
          invoice_id: string
          is_void: boolean
          method_type: Database["public"]["Enums"]["payment_method_type"]
          org_id: string
          payment_date: string
          payment_method: string
          receipt_url: string | null
          reference_number: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          amount_usd: number
          bank_account_id?: string | null
          cash_session_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          exchange_rate?: number | null
          exchange_rate_id?: string | null
          id?: string
          invoice_id: string
          is_void?: boolean
          method_type?: Database["public"]["Enums"]["payment_method_type"]
          org_id: string
          payment_date?: string
          payment_method: string
          receipt_url?: string | null
          reference_number?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          amount_usd?: number
          bank_account_id?: string | null
          cash_session_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          exchange_rate?: number | null
          exchange_rate_id?: string | null
          id?: string
          invoice_id?: string
          is_void?: boolean
          method_type?: Database["public"]["Enums"]["payment_method_type"]
          org_id?: string
          payment_date?: string
          payment_method?: string
          receipt_url?: string | null
          reference_number?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_cash_session_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_register_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_exchange_rate_id_fkey"
            columns: ["exchange_rate_id"]
            isOneToOne: false
            referencedRelation: "exchange_rate_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_fkey"
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
          firma_url: string | null
          full_name: string | null
          id: string
          org_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          sello_url: string | null
          signature_footer_text: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          firma_url?: string | null
          full_name?: string | null
          id: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          sello_url?: string | null
          signature_footer_text?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          firma_url?: string | null
          full_name?: string | null
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          sello_url?: string | null
          signature_footer_text?: string | null
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
      test_materials: {
        Row: {
          created_at: string
          id: string
          item_id: string
          notes: string | null
          org_id: string
          quantity_per_test: number
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          org_id: string
          quantity_per_test?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          org_id?: string
          quantity_per_test?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_materials_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_materials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_materials_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "test_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_materials_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "v_test_templates_filtered"
            referencedColumns: ["id"]
          },
        ]
      }
      test_methods: {
        Row: {
          created_at: string
          description: string | null
          id: string
          id_global_ref: string | null
          is_active: boolean
          name: string
          org_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          id_global_ref?: string | null
          is_active?: boolean
          name: string
          org_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          id_global_ref?: string | null
          is_active?: boolean
          name?: string
          org_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_methods_id_global_ref_fkey"
            columns: ["id_global_ref"]
            isOneToOne: false
            referencedRelation: "test_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_methods_org_id_fkey"
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
          result_type: string
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
          result_type?: string
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
          result_type?: string
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
      test_templates_backup: {
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
          updated_at: string | null
        }
        Insert: {
          base_price?: number | null
          category?: string | null
          created_at?: string | null
          id?: string | null
          id_global_ref?: string | null
          is_active?: boolean | null
          name?: string | null
          org_id?: string | null
          schema?: Json | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          base_price?: number | null
          category?: string | null
          created_at?: string | null
          id?: string | null
          id_global_ref?: string | null
          is_active?: boolean | null
          name?: string | null
          org_id?: string | null
          schema?: Json | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
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
      bulk_upsert_org_prices: {
        Args: { p_items: Json; p_org_id: string }
        Returns: Json
      }
      close_cash_session: {
        Args: {
          p_actual_totals: Json
          p_closing_notes?: string
          p_session_id: string
        }
        Returns: Json
      }
      confirm_order_consumption: {
        Args: { p_consumptions: Json; p_order_id: string; p_signature?: Json }
        Returns: Json
      }
      create_lab_order: {
        Args: {
          p_created_by: string
          p_exchange_rate: number
          p_is_exempted: boolean
          p_items: Json
          p_notes: string
          p_org_id: string
          p_patient_id: string
          p_total_bs: number
        }
        Returns: Json
      }
      create_payment_schedule: {
        Args: { p_installments: Json; p_invoice_id: string; p_org_id: string }
        Returns: Json
      }
      erp_assert_access: {
        Args: {
          p_org_id: string
          p_roles: Database["public"]["Enums"]["user_role"][]
        }
        Returns: undefined
      }
      erp_backfill_invoices: {
        Args: { p_dry_run?: boolean; p_from?: string; p_org_id: string }
        Returns: Json
      }
      erp_cash_session_totals: { Args: { p_session_id: string }; Returns: Json }
      erp_invoice_overdue_amount: {
        Args: { p_invoice_id: string }
        Returns: number
      }
      erp_local_date: { Args: { p_ts: string }; Returns: string }
      erp_report_range: {
        Args: { p_date_from: string; p_date_to: string }
        Returns: {
          date_from: string
          date_to: string
        }[]
      }
      erp_user_has_role: {
        Args: {
          p_org_id: string
          p_roles: Database["public"]["Enums"]["user_role"][]
        }
        Returns: boolean
      }
      fn_log_audit_event: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_org_id: string
        }
        Returns: undefined
      }
      get_accounts_receivable_report: {
        Args: { p_limit?: number; p_offset?: number; p_org_id: string }
        Returns: Json
      }
      get_cash_session_summary: {
        Args: { p_session_id: string }
        Returns: Json
      }
      get_dashboard_summary: { Args: { p_org_id: string }; Returns: Json }
      get_dashboard_top_tests: {
        Args: { p_limit?: number; p_org_id: string }
        Returns: {
          count: number
          name: string
          pct: number
        }[]
      }
      get_erp_financial_summary: {
        Args: { p_date_from?: string; p_date_to?: string; p_org_id: string }
        Returns: Json
      }
      get_erp_inventory_summary: {
        Args: { p_date_from?: string; p_date_to?: string; p_org_id: string }
        Returns: Json
      }
      get_erp_profitability_report: {
        Args: { p_date_from?: string; p_date_to?: string; p_org_id: string }
        Returns: Json
      }
      get_exchange_rate: {
        Args: {
          p_date?: string
          p_from?: string
          p_org_id: string
          p_to?: string
        }
        Returns: number
      }
      get_my_org_id: { Args: never; Returns: string }
      get_order_bom_preview: { Args: { p_order_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_overdue_invoices: { Args: never; Returns: Json }
      open_cash_session: {
        Args: {
          p_notes?: string
          p_opening_usd?: number
          p_opening_ves?: number
          p_org_id: string
        }
        Returns: Json
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
        Args: { p_patient_id: string; p_pin: string }
        Returns: {
          access_pin: string
          created_at: string
          department_order: Json
          firma_url: string
          items: Json
          order_id: string
          order_seq: number
          org_logo_url: string
          org_name: string
          report_template: string
          sello_url: string
          status: string
          total_amount: number
        }[]
      }
      register_adjustment: {
        Args: {
          p_direction: string
          p_item_id: string
          p_org_id: string
          p_quantity: number
          p_reason: string
        }
        Returns: Json
      }
      register_payment: {
        Args: { p_invoice_id: string; p_org_id: string; p_payments: Json }
        Returns: Json
      }
      register_purchase: {
        Args: {
          p_expiration_date?: string
          p_is_initial?: boolean
          p_item_id: string
          p_lot_number?: string
          p_notes?: string
          p_org_id: string
          p_purchase_invoice_ref?: string
          p_quantity: number
          p_supplier_name?: string
          p_unit_cost: number
        }
        Returns: Json
      }
      review_cash_session: {
        Args: { p_notes?: string; p_session_id: string }
        Returns: Json
      }
      upsert_exam_profile: {
        Args: {
          p_description: string
          p_name: string
          p_org_id: string
          p_profile_id: string
          p_template_ids: string[]
          p_total_price: number
        }
        Returns: Json
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
      void_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: Json
      }
    }
    Enums: {
      cash_session_status: "open" | "closed" | "reviewed"
      inventory_transaction_type:
        | "purchase"
        | "consumption"
        | "adjustment_in"
        | "adjustment_out"
        | "return"
        | "transfer_in"
        | "transfer_out"
        | "initial"
      invoice_status:
        | "draft"
        | "issued"
        | "partial"
        | "paid"
        | "overdue"
        | "cancelled"
        | "credit_note"
      item_category:
        | "reagent"
        | "consumable"
        | "equipment_part"
        | "office_supply"
        | "other"
      order_status:
        | "pendiente"
        | "procesando"
        | "por_aprobar"
        | "completada"
        | "cancelada"
      payment_method_type:
        | "cash"
        | "bank_transfer"
        | "mobile_payment"
        | "zelle"
        | "pos_terminal"
        | "other"
      payment_status: "unpaid" | "partial" | "paid" | "pending"
      schedule_status: "pending" | "partial" | "paid" | "overdue" | "cancelled"
      unit_of_measure:
        | "units"
        | "boxes"
        | "packs"
        | "ml"
        | "l"
        | "mg"
        | "g"
        | "kg"
        | "tests"
        | "strips"
        | "other"
      user_role:
        | "super_admin"
        | "lab_admin"
        | "bioanalyst"
        | "secretary"
        | "lab_affiliate"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      cash_session_status: ["open", "closed", "reviewed"],
      inventory_transaction_type: [
        "purchase",
        "consumption",
        "adjustment_in",
        "adjustment_out",
        "return",
        "transfer_in",
        "transfer_out",
        "initial",
      ],
      invoice_status: [
        "draft",
        "issued",
        "partial",
        "paid",
        "overdue",
        "cancelled",
        "credit_note",
      ],
      item_category: [
        "reagent",
        "consumable",
        "equipment_part",
        "office_supply",
        "other",
      ],
      order_status: [
        "pendiente",
        "procesando",
        "por_aprobar",
        "completada",
        "cancelada",
      ],
      payment_method_type: [
        "cash",
        "bank_transfer",
        "mobile_payment",
        "zelle",
        "pos_terminal",
        "other",
      ],
      payment_status: ["unpaid", "partial", "paid", "pending"],
      schedule_status: ["pending", "partial", "paid", "overdue", "cancelled"],
      unit_of_measure: [
        "units",
        "boxes",
        "packs",
        "ml",
        "l",
        "mg",
        "g",
        "kg",
        "tests",
        "strips",
        "other",
      ],
      user_role: [
        "super_admin",
        "lab_admin",
        "bioanalyst",
        "secretary",
        "lab_affiliate",
      ],
    },
  },
} as const
