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
          created_at: string | null
          created_by: string | null
          details: Json | null
          entity_id: number | null
          entity_type: string
          id: number
          tenant_id: number | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          created_by?: string | null
          details?: Json | null
          entity_id?: number | null
          entity_type: string
          id?: number
          tenant_id?: number | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          created_by?: string | null
          details?: Json | null
          entity_id?: number | null
          entity_type?: string
          id?: number
          tenant_id?: number | null
          updated_at?: string | null
          updated_by?: string | null
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
          active: boolean | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: number
          name: string
          tenant_id: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: number
          name: string
          tenant_id: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: number
          name?: string
          tenant_id?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
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
          abbreviation: string
          active: boolean | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: number
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          abbreviation: string
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: number
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          abbreviation?: string
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: number
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      price_history: {
        Row: {
          created_at: string | null
          id: number
          package_id: number | null
          price: number
          product_id: number
          recorded_at: string | null
          source_quote_id: number | null
          source_quote_item_id: number | null
          supplier_id: number
          tenant_id: number
        }
        Insert: {
          created_at?: string | null
          id?: number
          package_id?: number | null
          price: number
          product_id: number
          recorded_at?: string | null
          source_quote_id?: number | null
          source_quote_item_id?: number | null
          supplier_id: number
          tenant_id: number
        }
        Update: {
          created_at?: string | null
          id?: number
          package_id?: number | null
          price?: number
          product_id?: number
          recorded_at?: string | null
          source_quote_id?: number | null
          source_quote_item_id?: number | null
          supplier_id?: number
          tenant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_history_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "product_packages"
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
            foreignKeyName: "price_history_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_source_quote_item_id_fkey"
            columns: ["source_quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_list_items: {
        Row: {
          created_at: string | null
          default_qty: number | null
          id: number
          list_id: number
          preferred_package_id: number | null
          product_id: number
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          default_qty?: number | null
          id?: number
          list_id: number
          preferred_package_id?: number | null
          product_id: number
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          default_qty?: number | null
          id?: number
          list_id?: number
          preferred_package_id?: number | null
          product_id?: number
          sort_order?: number | null
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
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: number
          name: string
          tenant_id: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: number
          name: string
          tenant_id: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: number
          name?: string
          tenant_id?: number
          updated_at?: string | null
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
          id: number
          is_default: boolean | null
          multiplier: number | null
          product_id: number
          unit: string
        }
        Insert: {
          id?: number
          is_default?: boolean | null
          multiplier?: number | null
          product_id: number
          unit: string
        }
        Update: {
          id?: number
          is_default?: boolean | null
          multiplier?: number | null
          product_id?: number
          unit?: string
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
          active: boolean | null
          category_id: number | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: number
          name: string
          sku: string | null
          tenant_id: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          category_id?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: number
          name: string
          sku?: string | null
          tenant_id: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          category_id?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: number
          name?: string
          sku?: string | null
          tenant_id?: number
          updated_at?: string | null
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
          created_at: string | null
          email: string
          full_name: string | null
          id: number
          tenant_id: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: number
          tenant_id?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: number
          tenant_id?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          delivery_days: number | null
          id: number
          notes: string | null
          package_id: number | null
          product_id: number
          purchase_order_id: number
          quantity: number
          quote_item_id: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          delivery_days?: number | null
          id?: number
          notes?: string | null
          package_id?: number | null
          product_id: number
          purchase_order_id: number
          quantity: number
          quote_item_id: number
          subtotal: number
          unit_price: number
        }
        Update: {
          delivery_days?: number | null
          id?: number
          notes?: string | null
          package_id?: number | null
          product_id?: number
          purchase_order_id?: number
          quantity?: number
          quote_item_id?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
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
        ]
      }
      purchase_orders: {
        Row: {
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          delivery_address: string | null
          id: number
          notes: string | null
          payment_terms: string | null
          po_number: string
          quote_id: number
          sent_at: string | null
          status: string | null
          supplier_id: number
          tenant_id: number
          total_value: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_address?: string | null
          id?: number
          notes?: string | null
          payment_terms?: string | null
          po_number: string
          quote_id: number
          sent_at?: string | null
          status?: string | null
          supplier_id: number
          tenant_id: number
          total_value?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_address?: string | null
          id?: number
          notes?: string | null
          payment_terms?: string | null
          po_number?: string
          quote_id?: number
          sent_at?: string | null
          status?: string | null
          supplier_id?: number
          tenant_id?: number
          total_value?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
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
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string | null
          id: number
          notes: string | null
          package_id: number | null
          product_id: number
          quote_id: number
          requested_qty: number | null
          sort_order: number | null
          updated_at: string | null
          winner_reason: string | null
          winner_response_id: number | null
          winner_set_at: string | null
          winner_set_by: string | null
          winner_supplier_id: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          notes?: string | null
          package_id?: number | null
          product_id: number
          quote_id: number
          requested_qty?: number | null
          sort_order?: number | null
          updated_at?: string | null
          winner_reason?: string | null
          winner_response_id?: number | null
          winner_set_at?: string | null
          winner_set_by?: string | null
          winner_supplier_id?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          notes?: string | null
          package_id?: number | null
          product_id?: number
          quote_id?: number
          requested_qty?: number | null
          sort_order?: number | null
          updated_at?: string | null
          winner_reason?: string | null
          winner_response_id?: number | null
          winner_set_at?: string | null
          winner_set_by?: string | null
          winner_supplier_id?: number | null
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
          {
            foreignKeyName: "quote_items_winner_response_id_fkey"
            columns: ["winner_response_id"]
            isOneToOne: false
            referencedRelation: "quote_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_winner_supplier_id_fkey"
            columns: ["winner_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_responses: {
        Row: {
          created_at: string | null
          delivery_days: number | null
          filled_at: string | null
          id: number
          min_qty: number | null
          notes: string | null
          price: number | null
          quote_id: number
          quote_item_id: number
          quote_supplier_id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_days?: number | null
          filled_at?: string | null
          id?: number
          min_qty?: number | null
          notes?: string | null
          price?: number | null
          quote_id: number
          quote_item_id: number
          quote_supplier_id: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_days?: number | null
          filled_at?: string | null
          id?: number
          min_qty?: number | null
          notes?: string | null
          price?: number | null
          quote_id?: number
          quote_item_id?: number
          quote_supplier_id?: number
          updated_at?: string | null
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
      quote_snapshots: {
        Row: {
          created_at: string | null
          id: number
          quote_id: number
          snapshot_data: Json
          tenant_id: number
          total_items: number | null
          total_suppliers: number | null
          total_value: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          quote_id: number
          snapshot_data: Json
          tenant_id: number
          total_items?: number | null
          total_suppliers?: number | null
          total_value?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          quote_id?: number
          snapshot_data?: Json
          tenant_id?: number
          total_items?: number | null
          total_suppliers?: number | null
          total_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_snapshots_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_suppliers: {
        Row: {
          created_at: string | null
          id: number
          invited_at: string | null
          last_access_at: string | null
          public_token: string
          quote_id: number
          status: Database["public"]["Enums"]["supplier_status"]
          submitted_at: string | null
          supplier_id: number
        }
        Insert: {
          created_at?: string | null
          id?: number
          invited_at?: string | null
          last_access_at?: string | null
          public_token?: string
          quote_id: number
          status?: Database["public"]["Enums"]["supplier_status"]
          submitted_at?: string | null
          supplier_id: number
        }
        Update: {
          created_at?: string | null
          id?: number
          invited_at?: string | null
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
          created_at: string | null
          created_by: string | null
          deadline_at: string | null
          description: string | null
          id: number
          status: Database["public"]["Enums"]["quote_status"]
          tenant_id: number
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deadline_at?: string | null
          description?: string | null
          id?: number
          status?: Database["public"]["Enums"]["quote_status"]
          tenant_id: number
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deadline_at?: string | null
          description?: string | null
          id?: number
          status?: Database["public"]["Enums"]["quote_status"]
          tenant_id?: number
          title?: string
          updated_at?: string | null
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
          active: boolean | null
          address: string | null
          contact_name: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string
          id: number
          name: string
          notes: string | null
          phone: string | null
          tenant_id: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          id?: number
          name: string
          notes?: string | null
          phone?: string | null
          tenant_id: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          id?: number
          name?: string
          notes?: string | null
          phone?: string | null
          tenant_id?: number
          updated_at?: string | null
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
          created_at: string | null
          id: number
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: number
          permission: string
          tenant_id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          permission: string
          tenant_id: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          permission?: string
          tenant_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: number
          role: string
          tenant_id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          role: string
          tenant_id: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          role?: string
          tenant_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_quote_by_token: {
        Args: {
          p_token: string
        }
        Returns: {
          quote_supplier_id: number
          quote_id: number
          supplier_id: number
          status: string
          submitted_at: string | null
          quote_status: string
          quote_title: string
          quote_description: string | null
          quote_deadline: string | null
        }[]
      }
      update_supplier_access: {
        Args: {
          p_token: string
        }
        Returns: undefined
      }
      submit_supplier_quote: {
        Args: {
          p_token: string
        }
        Returns: boolean
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
      create_quote_snapshot: {
        Args: {
          p_quote_id: number
        }
        Returns: number
      }
      generate_po_number: {
        Args: {
          p_tenant_id: number
        }
        Returns: string
      }
      get_user_permissions: {
        Args: {
          p_user_id: string
          p_tenant_id: number
        }
        Returns: {
          permission: string
        }[]
      }
      has_permission: {
        Args: {
          p_user_id: string
          p_permission: string
          p_tenant_id: number
        }
        Returns: boolean
      }
      save_price_history_from_quote: {
        Args: {
          p_quote_id: number
        }
        Returns: undefined
      }
      save_supplier_response: {
        Args: {
          p_delivery_days?: number
          p_filled_at?: string
          p_min_qty?: number
          p_notes?: string
          p_price?: number
          p_quote_item_id?: number
          p_quote_supplier_id?: number
        }
        Returns: undefined
      }
      set_quote_item_winner: {
        Args: {
          p_quote_item_id: number
          p_winner_supplier_id: number
          p_winner_response_id: number
          p_winner_reason?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      quote_status: "draft" | "open" | "closed" | "cancelled"
      supplier_status: "invited" | "sent" | "viewed" | "submitted"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
  | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
  | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
  | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
  ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
