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
      portfolios: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          additional_bins: string[] | null
          address: string
          air_rights_sqft: number | null
          applicable_agencies: string[] | null
          assessed_land_value: number | null
          assessed_total_value: number | null
          assigned_phone_number: string | null
          basement_code: string | null
          bbl: string | null
          bin: string | null
          borough: string | null
          building_area_sqft: number | null
          building_class: string | null
          building_remarks: string | null
          census_tract: string | null
          co_data: Json | null
          co_status: string | null
          commercial_area_sqft: number | null
          commercial_overlay: string | null
          community_board: string | null
          compliance_status: string | null
          council_district: string | null
          created_at: string
          cross_streets: string | null
          dwelling_units: number | null
          environmental_restrictions: string | null
          exempt_land_value: number | null
          exempt_total_value: number | null
          factory_area_sqft: number | null
          floor_area_ratio: number | null
          garage_area_sqft: number | null
          grandfathered_sign: boolean | null
          gross_sqft: number | null
          has_boiler: boolean | null
          has_elevator: boolean | null
          has_gas: boolean | null
          has_sprinkler: boolean | null
          height_ft: number | null
          historic_district: string | null
          hpd_multiple_dwelling: boolean | null
          id: string
          is_city_owned: boolean | null
          is_landmark: boolean | null
          jurisdiction: Database["public"]["Enums"]["jurisdiction_type"]
          landmark_status: string | null
          last_synced_at: string | null
          latitude: number | null
          legal_adult_use: boolean | null
          local_law: string | null
          loft_law: boolean | null
          longitude: number | null
          lot_area_sqft: number | null
          max_floor_area_ratio: number | null
          nta_name: string | null
          number_of_buildings: number | null
          number_of_floors: number | null
          occupancy_classification: string | null
          occupancy_group: string | null
          office_area_sqft: number | null
          other_area_sqft: number | null
          overlay_district: string | null
          owner_name: string | null
          owner_phone: string | null
          portfolio_id: string | null
          primary_use_group: string | null
          professional_cert_restricted: boolean | null
          residential_area_sqft: number | null
          retail_area_sqft: number | null
          sms_enabled: boolean | null
          special_district: string | null
          special_place_name: string | null
          special_status: string | null
          sro_restricted: boolean | null
          storage_area_sqft: number | null
          stories: number | null
          ta_restricted: boolean | null
          ub_restricted: boolean | null
          unused_far: number | null
          updated_at: string
          use_type: string | null
          user_id: string
          year_altered_1: number | null
          year_altered_2: number | null
          year_built: number | null
          zoning_district: string | null
          zoning_map: string | null
        }
        Insert: {
          additional_bins?: string[] | null
          address: string
          air_rights_sqft?: number | null
          applicable_agencies?: string[] | null
          assessed_land_value?: number | null
          assessed_total_value?: number | null
          assigned_phone_number?: string | null
          basement_code?: string | null
          bbl?: string | null
          bin?: string | null
          borough?: string | null
          building_area_sqft?: number | null
          building_class?: string | null
          building_remarks?: string | null
          census_tract?: string | null
          co_data?: Json | null
          co_status?: string | null
          commercial_area_sqft?: number | null
          commercial_overlay?: string | null
          community_board?: string | null
          compliance_status?: string | null
          council_district?: string | null
          created_at?: string
          cross_streets?: string | null
          dwelling_units?: number | null
          environmental_restrictions?: string | null
          exempt_land_value?: number | null
          exempt_total_value?: number | null
          factory_area_sqft?: number | null
          floor_area_ratio?: number | null
          garage_area_sqft?: number | null
          grandfathered_sign?: boolean | null
          gross_sqft?: number | null
          has_boiler?: boolean | null
          has_elevator?: boolean | null
          has_gas?: boolean | null
          has_sprinkler?: boolean | null
          height_ft?: number | null
          historic_district?: string | null
          hpd_multiple_dwelling?: boolean | null
          id?: string
          is_city_owned?: boolean | null
          is_landmark?: boolean | null
          jurisdiction?: Database["public"]["Enums"]["jurisdiction_type"]
          landmark_status?: string | null
          last_synced_at?: string | null
          latitude?: number | null
          legal_adult_use?: boolean | null
          local_law?: string | null
          loft_law?: boolean | null
          longitude?: number | null
          lot_area_sqft?: number | null
          max_floor_area_ratio?: number | null
          nta_name?: string | null
          number_of_buildings?: number | null
          number_of_floors?: number | null
          occupancy_classification?: string | null
          occupancy_group?: string | null
          office_area_sqft?: number | null
          other_area_sqft?: number | null
          overlay_district?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          portfolio_id?: string | null
          primary_use_group?: string | null
          professional_cert_restricted?: boolean | null
          residential_area_sqft?: number | null
          retail_area_sqft?: number | null
          sms_enabled?: boolean | null
          special_district?: string | null
          special_place_name?: string | null
          special_status?: string | null
          sro_restricted?: boolean | null
          storage_area_sqft?: number | null
          stories?: number | null
          ta_restricted?: boolean | null
          ub_restricted?: boolean | null
          unused_far?: number | null
          updated_at?: string
          use_type?: string | null
          user_id: string
          year_altered_1?: number | null
          year_altered_2?: number | null
          year_built?: number | null
          zoning_district?: string | null
          zoning_map?: string | null
        }
        Update: {
          additional_bins?: string[] | null
          address?: string
          air_rights_sqft?: number | null
          applicable_agencies?: string[] | null
          assessed_land_value?: number | null
          assessed_total_value?: number | null
          assigned_phone_number?: string | null
          basement_code?: string | null
          bbl?: string | null
          bin?: string | null
          borough?: string | null
          building_area_sqft?: number | null
          building_class?: string | null
          building_remarks?: string | null
          census_tract?: string | null
          co_data?: Json | null
          co_status?: string | null
          commercial_area_sqft?: number | null
          commercial_overlay?: string | null
          community_board?: string | null
          compliance_status?: string | null
          council_district?: string | null
          created_at?: string
          cross_streets?: string | null
          dwelling_units?: number | null
          environmental_restrictions?: string | null
          exempt_land_value?: number | null
          exempt_total_value?: number | null
          factory_area_sqft?: number | null
          floor_area_ratio?: number | null
          garage_area_sqft?: number | null
          grandfathered_sign?: boolean | null
          gross_sqft?: number | null
          has_boiler?: boolean | null
          has_elevator?: boolean | null
          has_gas?: boolean | null
          has_sprinkler?: boolean | null
          height_ft?: number | null
          historic_district?: string | null
          hpd_multiple_dwelling?: boolean | null
          id?: string
          is_city_owned?: boolean | null
          is_landmark?: boolean | null
          jurisdiction?: Database["public"]["Enums"]["jurisdiction_type"]
          landmark_status?: string | null
          last_synced_at?: string | null
          latitude?: number | null
          legal_adult_use?: boolean | null
          local_law?: string | null
          loft_law?: boolean | null
          longitude?: number | null
          lot_area_sqft?: number | null
          max_floor_area_ratio?: number | null
          nta_name?: string | null
          number_of_buildings?: number | null
          number_of_floors?: number | null
          occupancy_classification?: string | null
          occupancy_group?: string | null
          office_area_sqft?: number | null
          other_area_sqft?: number | null
          overlay_district?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          portfolio_id?: string | null
          primary_use_group?: string | null
          professional_cert_restricted?: boolean | null
          residential_area_sqft?: number | null
          retail_area_sqft?: number | null
          sms_enabled?: boolean | null
          special_district?: string | null
          special_place_name?: string | null
          special_status?: string | null
          sro_restricted?: boolean | null
          storage_area_sqft?: number | null
          stories?: number | null
          ta_restricted?: boolean | null
          ub_restricted?: boolean | null
          unused_far?: number | null
          updated_at?: string
          use_type?: string | null
          user_id?: string
          year_altered_1?: number | null
          year_altered_2?: number | null
          year_built?: number | null
          zoning_district?: string | null
          zoning_map?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      property_activity_log: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          property_id: string
          title: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          property_id: string
          title: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          property_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_activity_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_documents: {
        Row: {
          created_at: string
          description: string | null
          document_name: string
          document_type: string
          expiration_date: string | null
          file_size_bytes: number | null
          file_type: string | null
          file_url: string
          id: string
          is_current: boolean | null
          metadata: Json | null
          property_id: string
          updated_at: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_name: string
          document_type: string
          expiration_date?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_current?: boolean | null
          metadata?: Json | null
          property_id: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          document_name?: string
          document_type?: string
          expiration_date?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_current?: boolean | null
          metadata?: Json | null
          property_id?: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_at: string
          invited_by: string | null
          property_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          property_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          property_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_members_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          coi_expiration_date: string | null
          created_at: string
          id: string
          name: string
          phone_number: string | null
          status: string | null
          trade_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coi_expiration_date?: string | null
          created_at?: string
          id?: string
          name: string
          phone_number?: string | null
          status?: string | null
          trade_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coi_expiration_date?: string | null
          created_at?: string
          id?: string
          name?: string
          phone_number?: string | null
          status?: string | null
          trade_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      violations: {
        Row: {
          agency: Database["public"]["Enums"]["agency_type"]
          certification_due_date: string | null
          created_at: string
          cure_due_date: string | null
          daily_penalty_amount: number | null
          description_raw: string | null
          hearing_date: string | null
          id: string
          is_stop_work_order: boolean | null
          is_vacate_order: boolean | null
          issued_date: string
          penalty_amount: number | null
          penalty_paid: boolean | null
          penalty_text: string | null
          property_id: string
          respondent_address: string | null
          respondent_name: string | null
          severity: string | null
          source: string | null
          status: Database["public"]["Enums"]["violation_status"]
          synced_at: string | null
          updated_at: string
          violation_class: string | null
          violation_number: string
        }
        Insert: {
          agency: Database["public"]["Enums"]["agency_type"]
          certification_due_date?: string | null
          created_at?: string
          cure_due_date?: string | null
          daily_penalty_amount?: number | null
          description_raw?: string | null
          hearing_date?: string | null
          id?: string
          is_stop_work_order?: boolean | null
          is_vacate_order?: boolean | null
          issued_date: string
          penalty_amount?: number | null
          penalty_paid?: boolean | null
          penalty_text?: string | null
          property_id: string
          respondent_address?: string | null
          respondent_name?: string | null
          severity?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["violation_status"]
          synced_at?: string | null
          updated_at?: string
          violation_class?: string | null
          violation_number: string
        }
        Update: {
          agency?: Database["public"]["Enums"]["agency_type"]
          certification_due_date?: string | null
          created_at?: string
          cure_due_date?: string | null
          daily_penalty_amount?: number | null
          description_raw?: string | null
          hearing_date?: string | null
          id?: string
          is_stop_work_order?: boolean | null
          is_vacate_order?: boolean | null
          issued_date?: string
          penalty_amount?: number | null
          penalty_paid?: boolean | null
          penalty_text?: string | null
          property_id?: string
          respondent_address?: string | null
          respondent_name?: string | null
          severity?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["violation_status"]
          synced_at?: string | null
          updated_at?: string
          violation_class?: string | null
          violation_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "violations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          created_at: string
          id: string
          linked_violation_id: string | null
          property_id: string
          scope: string
          status: Database["public"]["Enums"]["work_order_status"]
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          linked_violation_id?: string | null
          property_id: string
          scope: string
          status?: Database["public"]["Enums"]["work_order_status"]
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          linked_violation_id?: string | null
          property_id?: string
          scope?: string
          status?: Database["public"]["Enums"]["work_order_status"]
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_linked_violation_id_fkey"
            columns: ["linked_violation_id"]
            isOneToOne: false
            referencedRelation: "violations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      agency_type:
        | "DOB"
        | "ECB"
        | "FDNY"
        | "HPD"
        | "DEP"
        | "DOT"
        | "DSNY"
        | "LPC"
        | "DOF"
      jurisdiction_type: "NYC" | "NON_NYC"
      violation_status: "open" | "in_progress" | "closed"
      work_order_status: "open" | "in_progress" | "awaiting_docs" | "completed"
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
      agency_type: [
        "DOB",
        "ECB",
        "FDNY",
        "HPD",
        "DEP",
        "DOT",
        "DSNY",
        "LPC",
        "DOF",
      ],
      jurisdiction_type: ["NYC", "NON_NYC"],
      violation_status: ["open", "in_progress", "closed"],
      work_order_status: ["open", "in_progress", "awaiting_docs", "completed"],
    },
  },
} as const
