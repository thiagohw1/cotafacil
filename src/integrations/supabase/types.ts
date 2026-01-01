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
            products: {
                Row: {
                    created_at: string | null
                    description: string
                    id: string
                    last_cost: number | null
                    last_purchase_date: string | null
                    last_supplier_id: string | null
                    packagings: Json
                    updated_at: string | null
                }
                Insert: {
                    created_at?: string | null
                    description: string
                    id: string
                    last_cost?: number | null
                    last_purchase_date?: string | null
                    last_supplier_id?: string | null
                    packagings?: Json
                    updated_at?: string | null
                }
                Update: {
                    created_at?: string | null
                    description?: string
                    id?: string
                    last_cost?: number | null
                    last_purchase_date?: string | null
                    last_supplier_id?: string | null
                    packagings?: Json
                    updated_at?: string | null
                }
                Relationships: []
            }
            purchase_history: {
                Row: {
                    created_at: string | null
                    date: string
                    id: string
                    package_price: number
                    packaging_id: string
                    product_id: string
                    quantity: number
                    supplier_id: string
                    unit_price: number
                }
                Insert: {
                    created_at?: string | null
                    date: string
                    id: string
                    package_price: number
                    packaging_id: string
                    product_id: string
                    quantity: number
                    supplier_id: string
                    unit_price: number
                }
                Update: {
                    created_at?: string | null
                    date?: string
                    id?: string
                    package_price?: number
                    packaging_id?: string
                    product_id?: string
                    quantity?: number
                    supplier_id?: string
                    unit_price?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "purchase_history_product_id_fkey"
                        columns: ["product_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "purchase_history_supplier_id_fkey"
                        columns: ["supplier_id"]
                        isOneToOne: false
                        referencedRelation: "suppliers"
                        referencedColumns: ["id"]
                    },
                ]
            }
            quote_items: {
                Row: {
                    created_at: string | null
                    id: string
                    product_description: string
                    product_id: string
                    quantity: number
                    quote_id: string
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    product_description: string
                    product_id: string
                    quantity: number
                    quote_id: string
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    product_description?: string
                    product_id?: string
                    quantity?: number
                    quote_id?: string
                }
                Relationships: [
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
                    created_at: string | null
                    id: string
                    is_winner: boolean | null
                    notes: string | null
                    price: number
                    quote_item_id: string
                    supplier_id: string
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    is_winner?: boolean | null
                    notes?: string | null
                    price: number
                    quote_item_id: string
                    supplier_id: string
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    is_winner?: boolean | null
                    notes?: string | null
                    price?: number
                    quote_item_id?: string
                    supplier_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "quote_responses_quote_item_id_fkey"
                        columns: ["quote_item_id"]
                        isOneToOne: false
                        referencedRelation: "quote_items"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "quote_responses_supplier_id_fkey"
                        columns: ["supplier_id"]
                        isOneToOne: false
                        referencedRelation: "suppliers"
                        referencedColumns: ["id"]
                    },
                ]
            }
            quotes: {
                Row: {
                    closed_at: string | null
                    created_at: string | null
                    description: string | null
                    due_date: string | null
                    id: string
                    status: string
                    title: string
                    user_id: string | null
                }
                Insert: {
                    closed_at?: string | null
                    created_at?: string | null
                    description?: string | null
                    due_date?: string | null
                    id?: string
                    status?: string
                    title: string
                    user_id?: string | null
                }
                Update: {
                    closed_at?: string | null
                    created_at?: string | null
                    description?: string | null
                    due_date?: string | null
                    id?: string
                    status?: string
                    title?: string
                    user_id?: string | null
                }
                Relationships: []
            }
            supplier_quotes: {
                Row: {
                    created_at: string | null
                    id: string
                    quote_id: string
                    responded_at: string | null
                    status: string | null
                    supplier_id: string
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    quote_id: string
                    responded_at?: string | null
                    status?: string | null
                    supplier_id: string
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    quote_id?: string
                    responded_at?: string | null
                    status?: string | null
                    supplier_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "supplier_quotes_quote_id_fkey"
                        columns: ["quote_id"]
                        isOneToOne: false
                        referencedRelation: "quotes"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "supplier_quotes_supplier_id_fkey"
                        columns: ["supplier_id"]
                        isOneToOne: false
                        referencedRelation: "suppliers"
                        referencedColumns: ["id"]
                    },
                ]
            }
            suppliers: {
                Row: {
                    active: boolean | null
                    category: string | null
                    contact_name: string | null
                    created_at: string | null
                    email: string | null
                    id: string
                    min_order_value: number | null
                    name: string
                    payment_terms: string | null
                    phone: string | null
                    rating: number | null
                    updated_at: string | null
                }
                Insert: {
                    active?: boolean | null
                    category?: string | null
                    contact_name?: string | null
                    created_at?: string | null
                    email?: string | null
                    id: string
                    min_order_value?: number | null
                    name: string
                    payment_terms?: string | null
                    phone?: string | null
                    rating?: number | null
                    updated_at?: string | null
                }
                Update: {
                    active?: boolean | null
                    category?: string | null
                    contact_name?: string | null
                    created_at?: string | null
                    email?: string | null
                    id?: string
                    min_order_value?: number | null
                    name?: string
                    payment_terms?: string | null
                    phone?: string | null
                    rating?: number | null
                    updated_at?: string | null
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
    PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        (Database[PublicTableNameOrOptions["schema"]] extends { Views: any }
            ? Database[PublicTableNameOrOptions["schema"]]["Views"]
            : unknown))
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        (Database[PublicTableNameOrOptions["schema"]] extends { Views: any }
            ? Database[PublicTableNameOrOptions["schema"]]["Views"]
            : unknown))[TableName] extends {
                Row: infer R
            }
    ? R
    : never
    : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

export type Enums<
    PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
    EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
    ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof Database
    }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
    ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
