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
      daily_steps: {
        Row: {
          completed: boolean
          created_at: string
          goal_steps: number
          household_id: string
          id: string
          log_date: string
          profile_id: string
          steps: number | null
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          goal_steps?: number
          household_id: string
          id?: string
          log_date: string
          profile_id: string
          steps?: number | null
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          goal_steps?: number
          household_id?: string
          id?: string
          log_date?: string
          profile_id?: string
          steps?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_steps_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_steps_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fasting_logs: {
        Row: {
          created_at: string
          end_time: string
          household_id: string
          id: string
          log_date: string
          profile_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          household_id: string
          id?: string
          log_date: string
          profile_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          household_id?: string
          id?: string
          log_date?: string
          profile_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fasting_logs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fasting_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_entries: {
        Row: {
          basis_snapshot: Json | null
          calculated_product_id: string | null
          calculated_revision: number | null
          amount: number | null
          coffee: Json | null
          created_at: string
          food_id: string | null
          food_name: string
          household_id: string
          id: string
          log_date: string
          note: string | null
          base_points: number | null
          benefit_rule: string | null
          consumed_weight_g: number | null
          dish_id: string | null
          dish_revision: number | null
          estimated_product_id: string | null
          points_basis: string | null
          points_model_version: string | null
          points_value: number | null
          reference_item_id: string | null
          weight_source: string | null
          profile_id: string
          quantity_mode: string
          slot: string
          subjective: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          basis_snapshot?: Json | null
          calculated_product_id?: string | null
          calculated_revision?: number | null
          amount?: number | null
          coffee?: Json | null
          created_at?: string
          food_id?: string | null
          food_name: string
          household_id: string
          id?: string
          log_date: string
          note?: string | null
          base_points?: number | null
          benefit_rule?: string | null
          consumed_weight_g?: number | null
          dish_id?: string | null
          dish_revision?: number | null
          estimated_product_id?: string | null
          points_basis?: string | null
          points_model_version?: string | null
          points_value?: number | null
          reference_item_id?: string | null
          weight_source?: string | null
          profile_id: string
          quantity_mode: string
          slot: string
          subjective?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          basis_snapshot?: Json | null
          calculated_product_id?: string | null
          calculated_revision?: number | null
          amount?: number | null
          coffee?: Json | null
          created_at?: string
          food_id?: string | null
          food_name?: string
          household_id?: string
          id?: string
          log_date?: string
          note?: string | null
          base_points?: number | null
          benefit_rule?: string | null
          consumed_weight_g?: number | null
          dish_id?: string | null
          dish_revision?: number | null
          estimated_product_id?: string | null
          points_basis?: string | null
          points_model_version?: string | null
          points_value?: number | null
          reference_item_id?: string | null
          weight_source?: string | null
          profile_id?: string
          quantity_mode?: string
          slot?: string
          subjective?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_entries_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_entries_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_reference_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          item_id: string
          normalized_alias: string
          origin: string
          verified: boolean
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          item_id: string
          normalized_alias: string
          origin?: string
          verified?: boolean
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          item_id?: string
          normalized_alias?: string
          origin?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "food_reference_aliases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "food_reference_items"
            referencedColumns: ["id"]
          },
        ]
      }
      food_reference_items: {
        Row: {
          base_name: string | null
          benefit_of: string | null
          category: string | null
          cleaning_rules: string[]
          conflict_group: string | null
          created_at: string
          display_name: string
          duplicate_of: string | null
          id: string
          normalized_name: string
          notes: string[]
          points: number
          portion: Json | null
          review_reasons: string[]
          rule: string | null
          source_category: string | null
          source_id: string
          source_name: string
          source_points: number
          source_quantity_text: string | null
          source_row: number
          source_version: string
          status: string
          updated_at: string
        }
        Insert: {
          base_name?: string | null
          benefit_of?: string | null
          category?: string | null
          cleaning_rules?: string[]
          conflict_group?: string | null
          created_at?: string
          display_name: string
          duplicate_of?: string | null
          id: string
          normalized_name: string
          notes?: string[]
          points: number
          portion?: Json | null
          review_reasons?: string[]
          rule?: string | null
          source_category?: string | null
          source_id: string
          source_name: string
          source_points: number
          source_quantity_text?: string | null
          source_row: number
          source_version: string
          status: string
          updated_at?: string
        }
        Update: {
          base_name?: string | null
          benefit_of?: string | null
          category?: string | null
          cleaning_rules?: string[]
          conflict_group?: string | null
          created_at?: string
          display_name?: string
          duplicate_of?: string | null
          id?: string
          normalized_name?: string
          notes?: string[]
          points?: number
          portion?: Json | null
          review_reasons?: string[]
          rule?: string | null
          source_category?: string | null
          source_id?: string
          source_name?: string
          source_points?: number
          source_quantity_text?: string | null
          source_row?: number
          source_version?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_reference_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "food_reference_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      food_reference_sources: {
        Row: {
          file_name: string
          id: string
          imported_at: string
          sha256: string
          sheet: string | null
          version: string
        }
        Insert: {
          file_name: string
          id: string
          imported_at?: string
          sha256: string
          sheet?: string | null
          version: string
        }
        Update: {
          file_name?: string
          id?: string
          imported_at?: string
          sha256?: string
          sheet?: string | null
          version?: string
        }
        Relationships: []
      }
      calculated_products: {
        Row: {
          created_at: string
          created_by_profile_id: string | null
          household_id: string
          id: string
          is_active: boolean
          method_version: string
          name: string
          normalized_name: string
          points_per_gram: number
          revision: number
          total_points: number
          total_weight_g: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id?: string | null
          household_id: string
          id?: string
          is_active?: boolean
          method_version?: string
          name: string
          normalized_name: string
          points_per_gram: number
          revision?: number
          total_points: number
          total_weight_g: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string | null
          household_id?: string
          id?: string
          is_active?: boolean
          method_version?: string
          name?: string
          normalized_name?: string
          points_per_gram?: number
          revision?: number
          total_points?: number
          total_weight_g?: number
          updated_at?: string
        }
        Relationships: []
      }
      dish_versions: {
        Row: {
          created_at: string
          created_by_profile_id: string | null
          dish_id: string
          final_weight_g: number
          household_id: string
          id: string
          ingredients: Json
          name: string
          points_per_gram: number
          revision: number
          total_points: number
          usual_serving_weight_g: number | null
        }
        Insert: {
          created_at?: string
          created_by_profile_id?: string | null
          dish_id: string
          final_weight_g: number
          household_id: string
          id?: string
          ingredients: Json
          name: string
          points_per_gram: number
          revision: number
          total_points: number
          usual_serving_weight_g?: number | null
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string | null
          dish_id?: string
          final_weight_g?: number
          household_id?: string
          id?: string
          ingredients?: Json
          name?: string
          points_per_gram?: number
          revision?: number
          total_points?: number
          usual_serving_weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dish_versions_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      dishes: {
        Row: {
          created_at: string
          created_by_profile_id: string | null
          final_weight_g: number
          household_id: string
          id: string
          is_active: boolean
          name: string
          normalized_name: string
          points_per_gram: number
          revision: number
          total_points: number
          updated_at: string
          usual_serving_weight_g: number | null
        }
        Insert: {
          created_at?: string
          created_by_profile_id?: string | null
          final_weight_g: number
          household_id: string
          id?: string
          is_active?: boolean
          name: string
          normalized_name: string
          points_per_gram: number
          revision?: number
          total_points: number
          updated_at?: string
          usual_serving_weight_g?: number | null
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string | null
          final_weight_g?: number
          household_id?: string
          id?: string
          is_active?: boolean
          name?: string
          normalized_name?: string
          points_per_gram?: number
          revision?: number
          total_points?: number
          updated_at?: string
          usual_serving_weight_g?: number | null
        }
        Relationships: []
      }
      estimated_products: {
        Row: {
          brand: string | null
          created_at: string
          created_by_profile_id: string | null
          estimator_version: string
          household_id: string
          id: string
          is_active: boolean
          label_added_sugar_g: number | null
          label_basis: string
          label_calories: number
          label_fiber_g: number | null
          label_protein_g: number | null
          label_saturated_fat_g: number | null
          label_unsaturated_fat_g: number | null
          name: string
          normalized_name: string
          points_per_100g: number
          serving_weight_g: number | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          created_by_profile_id?: string | null
          estimator_version?: string
          household_id: string
          id?: string
          is_active?: boolean
          label_added_sugar_g?: number | null
          label_basis: string
          label_calories: number
          label_fiber_g?: number | null
          label_protein_g?: number | null
          label_saturated_fat_g?: number | null
          label_unsaturated_fat_g?: number | null
          name: string
          normalized_name: string
          points_per_100g: number
          serving_weight_g?: number | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          created_by_profile_id?: string | null
          estimator_version?: string
          household_id?: string
          id?: string
          is_active?: boolean
          label_added_sugar_g?: number | null
          label_basis?: string
          label_calories?: number
          label_fiber_g?: number | null
          label_protein_g?: number | null
          label_saturated_fat_g?: number | null
          label_unsaturated_fat_g?: number | null
          name?: string
          normalized_name?: string
          points_per_100g?: number
          serving_weight_g?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      weight_bridges: {
        Row: {
          created_at: string
          created_by_profile_id: string | null
          estimated_product_id: string | null
          grams_per_unit: number
          household_id: string
          id: string
          provenance: string
          reference_item_id: string | null
          source_key: string
          source_kind: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id?: string | null
          estimated_product_id?: string | null
          grams_per_unit: number
          household_id: string
          id?: string
          provenance: string
          reference_item_id?: string | null
          source_key: string
          source_kind: string
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string | null
          estimated_product_id?: string | null
          grams_per_unit?: number
          household_id?: string
          id?: string
          provenance?: string
          reference_item_id?: string | null
          source_key?: string
          source_kind?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weight_bridges_estimated_product_id_fkey"
            columns: ["estimated_product_id"]
            isOneToOne: false
            referencedRelation: "estimated_products"
            referencedColumns: ["id"]
          },
        ]
      }
      food_preferences: {
        Row: {
          created_at: string
          food_id: string
          household_id: string
          id: string
          is_favorite: boolean
          last_used_at: string | null
          profile_id: string
          updated_at: string
          use_count: number
        }
        Insert: {
          created_at?: string
          food_id: string
          household_id: string
          id?: string
          is_favorite?: boolean
          last_used_at?: string | null
          profile_id: string
          updated_at?: string
          use_count?: number
        }
        Update: {
          created_at?: string
          food_id?: string
          household_id?: string
          id?: string
          is_favorite?: boolean
          last_used_at?: string | null
          profile_id?: string
          updated_at?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "food_preferences_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          category: string | null
          created_at: string
          default_unit: string | null
          household_id: string
          id: string
          is_active: boolean
          kind: string
          name: string
          normalized_name: string
          points_confirmed_at: string | null
          points_per_portion: number | null
          points_status: string
          reference_group_key: string | null
          portion_amount: number | null
          portion_unit: string | null
          created_by_profile_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_unit?: string | null
          household_id: string
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          normalized_name: string
          points_confirmed_at?: string | null
          points_per_portion?: number | null
          points_status?: string
          reference_group_key?: string | null
          portion_amount?: number | null
          portion_unit?: string | null
          created_by_profile_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          default_unit?: string | null
          household_id?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          normalized_name?: string
          points_confirmed_at?: string | null
          points_per_portion?: number | null
          points_status?: string
          reference_group_key?: string | null
          portion_amount?: number | null
          portion_unit?: string | null
          created_by_profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "foods_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_users: {
        Row: {
          created_at: string
          household_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_users_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      meal_statuses: {
        Row: {
          created_at: string
          household_id: string
          id: string
          log_date: string
          profile_id: string
          slot: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          log_date: string
          profile_id: string
          slot: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          log_date?: string
          profile_id?: string
          slot?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_statuses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_statuses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          birth_date: string | null
          daily_points_budget: number
          display_name: string
          goal_mode: string
          height_cm: number | null
          points_budget_override: number | null
          sex_at_birth: string | null
          household_id: string
          id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          birth_date?: string | null
          daily_points_budget?: number
          display_name: string
          goal_mode?: string
          height_cm?: number | null
          points_budget_override?: number | null
          sex_at_birth?: string | null
          household_id: string
          id?: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          birth_date?: string | null
          daily_points_budget?: number
          display_name?: string
          goal_mode?: string
          height_cm?: number | null
          points_budget_override?: number | null
          sex_at_birth?: string | null
          household_id?: string
          id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      weigh_ins: {
        Row: {
          body_fat_pct: number | null
          created_at: string
          household_id: string
          id: string
          measured_at: string | null
          measured_on: string
          profile_id: string
          updated_at: string
          weight_kg: number
        }
        Insert: {
          body_fat_pct?: number | null
          created_at?: string
          household_id: string
          id?: string
          measured_at?: string | null
          measured_on: string
          profile_id: string
          updated_at?: string
          weight_kg: number
        }
        Update: {
          body_fat_pct?: number | null
          created_at?: string
          household_id?: string
          id?: string
          measured_at?: string | null
          measured_on?: string
          profile_id?: string
          updated_at?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weigh_ins_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weigh_ins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          created_at: string
          feeling: string | null
          household_id: string
          id: string
          log_date: string
          performed: boolean | null
          profile_id: string
          updated_at: string
          workout_type: string | null
        }
        Insert: {
          created_at?: string
          feeling?: string | null
          household_id: string
          id?: string
          log_date: string
          performed?: boolean | null
          profile_id: string
          updated_at?: string
          workout_type?: string | null
        }
        Update: {
          created_at?: string
          feeling?: string | null
          household_id?: string
          id?: string
          log_date?: string
          performed?: boolean | null
          profile_id?: string
          updated_at?: string
          workout_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      body_delete_weigh_in: {
        Args: { p_id: string; p_pin: string; p_profile_id: string }
        Returns: undefined
      }
      body_lock: { Args: { p_profile_id: string }; Returns: undefined }
      body_list_weigh_ins: {
        Args: { p_pin: string; p_profile_id: string }
        Returns: {
          body_fat_pct: number | null
          created_at: string
          id: string
          measured_at: string | null
          measured_on: string
          weight_kg: number
        }[]
      }
      body_pin_status: { Args: { p_profile_id: string }; Returns: string }
      body_save_weigh_in: {
        Args: {
          p_body_fat_pct?: number | null
          p_id: string | null
          p_measured_at: string | null
          p_measured_on: string
          p_pin: string
          p_profile_id: string
          p_weight_kg: number
        }
        Returns: string
      }
      body_set_pin: {
        Args: { p_current_pin?: string | null; p_new_pin: string; p_profile_id: string }
        Returns: string
      }
      body_unlock: { Args: { p_pin: string; p_profile_id: string }; Returns: string }
      bootstrap_household: { Args: never; Returns: string }
      is_household_member: { Args: { hid: string }; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
