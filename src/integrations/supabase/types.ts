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
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: number | null
          entity_type: string | null
          id: number
          tenant_id: number | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: number | null
          entity_type?: string | null
          id?: never
          tenant_id?: number | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: number | null
          entity_type?: string | null
          id?: never
          tenant_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: number
          name: string
          parent_id: number | null
          tenant_id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: never
          name: string
          parent_id?: number | null
          tenant_id: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: never
          name?: string
          parent_id?: number | null
          tenant_id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      packaging_units: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: number
          name: string
          tenant_id: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: number
          name: string
          tenant_id: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: number
          name?: string
          tenant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "packaging_units_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          id: number
          tenant_id: number
          product_id: number
          supplier_id: number
          price: number
          package_id: number | null
          recorded_at: string
          source_quote_id: number | null
          source_quote_item_id: number | null
          created_at: string
        }
        Insert: {
          id?: never
          tenant_id: number
          product_id: number
          supplier_id: number
          price: number
          package_id?: number | null
          recorded_at?: string
          source_quote_id?: number | null
          source_quote_item_id?: number | null
          created_at?: string
        }
        Update: {
          id?: never
          tenant_id?: number
          product_id?: number
          supplier_id?: number
          price?: number
          package_id?: number | null
          recorded_at?: string
          source_quote_id?: number | null
          source_quote_item_id?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          id: number
          user_id: string
          tenant_id: number
          permission: string
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: never
          user_id: string
          tenant_id: number
          permission: string
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: never
          user_id?: string
          tenant_id?: number
          permission?: string
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          id: number
          tenant_id: number
          quote_id: number
          supplier_id: number
          po_number: string
          status: string
          total_value: number
          notes: string | null
          delivery_address: string | null
          payment_terms: string | null
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
          sent_at: string | null
          confirmed_at: string | null
        }
        Insert: {
          id?: never
          tenant_id: number
          quote_id: number
          supplier_id: number
          po_number: string
          status?: string
          total_value?: number
          notes?: string | null
          delivery_address?: string | null
          payment_terms?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
          sent_at?: string | null
          confirmed_at?: string | null
        }
        Update: {
          id?: never
          tenant_id?: number
          quote_id?: number
          supplier_id?: number
          po_number?: string
          status?: string
          total_value?: number
          notes?: string | null
          delivery_address?: string | null
          payment_terms?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
          sent_at?: string | null
          confirmed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          id: number
          purchase_order_id: number
          quote_item_id: number
          product_id: number
          package_id: number | null
          quantity: number
          unit_price: number
          subtotal: number
          delivery_days: number | null
          notes: string | null
        }
        Insert: {
          id?: never
          purchase_order_id: number
          quote_item_id: number
          product_id: number
          package_id?: number | null
          quantity: number
          unit_price: number
          subtotal: number
          delivery_days?: number | null
          notes?: string | null
        }
        Update: {
          id?: never
          purchase_order_id?: number
          quote_item_id?: number
          product_id?: number
          package_id?: number | null
          quantity?: number
          unit_price?: number
          subtotal?: number
          delivery_days?: number | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }

      product_list_items: {
        Row: {
          created_at: string
          default_qty: number | null
          id: number
          list_id: number
          preferred_package_id: number | null
          product_id: number
        }
        Insert: {
          created_at?: string
          default_qty?: number | null
          id?: never
          list_id: number
          preferred_package_id?: number | null
          product_id: number
        }
        Update: {
          created_at?: string
          default_qty?: number | null
          id?: never
          list_id?: number
          preferred_package_id?: number | null
          product_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "product_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_list_items_preferred_package_id_fkey"
            columns: ["preferred_package_id"]
            isOneToOne: false
            referencedRelation: "product_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_lists: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: number
          name: string
          tenant_id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: never
          name: string
          tenant_id: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: never
          name?: string
          tenant_id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_lists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_packages: {
        Row: {
          barcode: string | null
          created_at: string
          id: number
          is_default: boolean
          multiplier: number
          product_id: number
          unit: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          id?: never
          is_default?: boolean
          multiplier?: number
          product_id: number
          unit: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          id?: never
          is_default?: boolean
          multiplier?: number
          product_id?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_packages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          brand: string | null
          category_id: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: number
          name: string
          notes: string | null
          tenant_id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category_id?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: never
          name: string
          notes?: string | null
          tenant_id: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          brand?: string | null
          category_id?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: never
          name?: string
          notes?: string | null
          tenant_id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: number
          tenant_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: never
          tenant_id?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: never
          tenant_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          id: number
          notes: string | null
          package_id: number | null
          product_id: number
          quote_id: number
          requested_qty: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: never
          notes?: string | null
          package_id?: number | null
          product_id: number
          quote_id: number
          requested_qty?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: never
          notes?: string | null
          package_id?: number | null
          product_id?: number
          quote_id?: number
          requested_qty?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "product_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_responses: {
        Row: {
          delivery_days: number | null
          filled_at: string
          id: number
          min_qty: number | null
          notes: string | null
          price: number | null
          quote_id: number
          quote_item_id: number
          quote_supplier_id: number
        }
        Insert: {
          delivery_days?: number | null
          filled_at?: string
          id?: never
          min_qty?: number | null
          notes?: string | null
          price?: number | null
          quote_id: number
          quote_item_id: number
          quote_supplier_id: number
        }
        Update: {
          delivery_days?: number | null
          filled_at?: string
          id?: never
          min_qty?: number | null
          notes?: string | null
          price?: number | null
          quote_id?: number
          quote_item_id?: number
          quote_supplier_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_responses_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_responses_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_responses_quote_supplier_id_fkey"
            columns: ["quote_supplier_id"]
            isOneToOne: false
            referencedRelation: "quote_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_suppliers: {
        Row: {
          created_at: string
          id: number
          invited_at: string
          last_access_at: string | null
          public_token: string
          quote_id: number
          status: Database["public"]["Enums"]["supplier_status"]
          submitted_at: string | null
          supplier_id: number
        }
        Insert: {
          created_at?: string
          id?: never
          invited_at?: string
          last_access_at?: string | null
          public_token?: string
          quote_id: number
          status?: Database["public"]["Enums"]["supplier_status"]
          submitted_at?: string | null
          supplier_id: number
        }
        Update: {
          created_at?: string
          id?: never
          invited_at?: string
          last_access_at?: string | null
          public_token?: string
          quote_id?: number
          status?: Database["public"]["Enums"]["supplier_status"]
          submitted_at?: string | null
          supplier_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_suppliers_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          created_by: string | null
          deadline_at: string | null
          deleted_at: string | null
          description: string | null
          id: number
          status: Database["public"]["Enums"]["quote_status"]
          tenant_id: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deadline_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: never
          status?: Database["public"]["Enums"]["quote_status"]
          tenant_id: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deadline_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: never
          status?: Database["public"]["Enums"]["quote_status"]
          tenant_id?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          cnpj: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string
          id: number
          name: string
          notes: string | null
          phone: string | null
          tenant_id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email: string
          id?: never
          name: string
          notes?: string | null
          phone?: string | null
          tenant_id: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string
          id?: never
          name?: string
          notes?: string | null
          phone?: string | null
          tenant_id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: number
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: never
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: never
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: number
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_quote_snapshot: {
        Args: { p_quote_id: number }
        Returns: number
      }
      get_quote_by_token: {
        Args: { p_token: string }
        Returns: {
          quote_deadline: string
          quote_description: string
          quote_id: number
          quote_status: Database["public"]["Enums"]["quote_status"]
          quote_supplier_id: number
          quote_title: string
          status: Database["public"]["Enums"]["supplier_status"]
          submitted_at: string
          supplier_id: number
        }[]
      }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      save_price_history_from_quote: {
        Args: { p_quote_id: number }
        Returns: number
      }
      has_permission: {
        Args: {
          p_user_id: string
          p_permission: string
          p_tenant_id: number
        }
        Returns: boolean
      }
      get_user_permissions: {
        Args: {
          p_user_id: string
          p_tenant_id: number
        }
        Returns: { permission: string }[]
      }
      generate_po_number: {
        Args: {
          p_tenant_id: number
        }
        Returns: string
      }
      create_purchase_order_from_quote: {
        Args: {
          p_quote_id: number
          p_supplier_id: number
          p_delivery_address?: string
          p_payment_terms?: string
          p_notes?: string
        }
        Returns: number
      }
      save_supplier_response: {
        Args: {
          p_delivery_days?: number
          p_min_qty?: number
          p_notes?: string
          p_price: number
          p_quote_item_id: number
          p_token: string
        }
        Returns: boolean
      }
      set_quote_item_winner: {
        Args: {
          p_quote_item_id: number
          p_winner_supplier_id: number
          p_winner_response_id: number
          p_reason?: string
        }
        Returns: boolean
      }
      submit_supplier_quote: { Args: { p_token: string }; Returns: boolean }
      update_supplier_access: { Args: { p_token: string }; Returns: boolean }
      verify_supplier_token: {
        Args: { p_quote_supplier_id: number; p_token: string }
        Returns: boolean
      }
    }

    Enums: {
      app_role: "admin" | "buyer" | "supplier"
      quote_status: "draft" | "open" | "closed" | "cancelled"
      supplier_status: "invited" | "viewed" | "partial" | "submitted"
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
      app_role: ["admin", "buyer", "supplier"],
      quote_status: ["draft", "open", "closed", "cancelled"],
      supplier_status: ["invited", "viewed", "partial", "submitted"],
    },
  },
} as const
