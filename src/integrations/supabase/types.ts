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
      applications: {
        Row: {
          agency: string
          applicant_name: string | null
          application_number: string
          application_type: string
          approval_date: string | null
          created_at: string
          description: string | null
          dwelling_units: number | null
          estimated_cost: number | null
          expiration_date: string | null
          filing_date: string | null
          floor_area: number | null
          id: string
          job_type: string | null
          notes: string | null
          owner_name: string | null
          property_id: string
          raw_data: Json | null
          source: string
          status: string | null
          stories: number | null
          synced_at: string | null
          updated_at: string
          work_type: string | null
        }
        Insert: {
          agency?: string
          applicant_name?: string | null
          application_number: string
          application_type: string
          approval_date?: string | null
          created_at?: string
          description?: string | null
          dwelling_units?: number | null
          estimated_cost?: number | null
          expiration_date?: string | null
          filing_date?: string | null
          floor_area?: number | null
          id?: string
          job_type?: string | null
          notes?: string | null
          owner_name?: string | null
          property_id: string
          raw_data?: Json | null
          source?: string
          status?: string | null
          stories?: number | null
          synced_at?: string | null
          updated_at?: string
          work_type?: string | null
        }
        Update: {
          agency?: string
          applicant_name?: string | null
          application_number?: string
          application_type?: string
          approval_date?: string | null
          created_at?: string
          description?: string | null
          dwelling_units?: number | null
          estimated_cost?: number | null
          expiration_date?: string | null
          filing_date?: string | null
          floor_area?: number | null
          id?: string
          job_type?: string | null
          notes?: string | null
          owner_name?: string | null
          property_id?: string
          raw_data?: Json | null
          source?: string
          status?: string | null
          stories?: number | null
          synced_at?: string | null
          updated_at?: string
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      change_log: {
        Row: {
          change_type: string
          created_at: string
          description: string | null
          entity_id: string
          entity_label: string | null
          entity_type: string
          id: string
          new_value: string | null
          notified: boolean
          previous_value: string | null
          property_id: string
          user_id: string
        }
        Insert: {
          change_type: string
          created_at?: string
          description?: string | null
          entity_id: string
          entity_label?: string | null
          entity_type: string
          id?: string
          new_value?: string | null
          notified?: boolean
          previous_value?: string | null
          property_id: string
          user_id: string
        }
        Update: {
          change_type?: string
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_label?: string | null
          entity_type?: string
          id?: string
          new_value?: string | null
          notified?: boolean
          previous_value?: string | null
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_requirements: {
        Row: {
          applicability_reason: string | null
          created_at: string
          cycle_year: number | null
          description: string | null
          due_date: string | null
          filing_deadline: string | null
          id: string
          last_filed_date: string | null
          local_law: string
          next_due_date: string | null
          notes: string | null
          penalty_amount: number | null
          penalty_description: string | null
          property_id: string
          requirement_name: string
          status: string
          updated_at: string
        }
        Insert: {
          applicability_reason?: string | null
          created_at?: string
          cycle_year?: number | null
          description?: string | null
          due_date?: string | null
          filing_deadline?: string | null
          id?: string
          last_filed_date?: string | null
          local_law: string
          next_due_date?: string | null
          notes?: string | null
          penalty_amount?: number | null
          penalty_description?: string | null
          property_id: string
          requirement_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          applicability_reason?: string | null
          created_at?: string
          cycle_year?: number | null
          description?: string | null
          due_date?: string | null
          filing_deadline?: string | null
          id?: string
          last_filed_date?: string | null
          local_law?: string
          next_due_date?: string | null
          notes?: string | null
          penalty_amount?: number | null
          penalty_description?: string | null
          property_id?: string
          requirement_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_requirements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_scores: {
        Row: {
          calculated_at: string
          compliance_details: Json | null
          compliance_score: number
          created_at: string
          grade: string
          id: string
          property_id: string
          resolution_details: Json | null
          resolution_score: number
          score: number
          updated_at: string
          user_id: string
          violation_details: Json | null
          violation_score: number
        }
        Insert: {
          calculated_at?: string
          compliance_details?: Json | null
          compliance_score?: number
          created_at?: string
          grade?: string
          id?: string
          property_id: string
          resolution_details?: Json | null
          resolution_score?: number
          score?: number
          updated_at?: string
          user_id: string
          violation_details?: Json | null
          violation_score?: number
        }
        Update: {
          calculated_at?: string
          compliance_details?: Json | null
          compliance_score?: number
          created_at?: string
          grade?: string
          id?: string
          property_id?: string
          resolution_details?: Json | null
          resolution_score?: number
          score?: number
          updated_at?: string
          user_id?: string
          violation_details?: Json | null
          violation_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "compliance_scores_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_reports: {
        Row: {
          address: string
          ai_analysis: string | null
          applications_data: Json | null
          bbl: string | null
          bin: string | null
          building_data: Json | null
          created_at: string
          general_notes: string | null
          id: string
          line_item_notes: Json | null
          orders_data: Json | null
          pdf_url: string | null
          prepared_by: string | null
          prepared_for: string
          report_date: string
          status: string
          updated_at: string
          user_id: string
          violations_data: Json | null
        }
        Insert: {
          address: string
          ai_analysis?: string | null
          applications_data?: Json | null
          bbl?: string | null
          bin?: string | null
          building_data?: Json | null
          created_at?: string
          general_notes?: string | null
          id?: string
          line_item_notes?: Json | null
          orders_data?: Json | null
          pdf_url?: string | null
          prepared_by?: string | null
          prepared_for: string
          report_date?: string
          status?: string
          updated_at?: string
          user_id: string
          violations_data?: Json | null
        }
        Update: {
          address?: string
          ai_analysis?: string | null
          applications_data?: Json | null
          bbl?: string | null
          bin?: string | null
          building_data?: Json | null
          created_at?: string
          general_notes?: string | null
          id?: string
          line_item_notes?: Json | null
          orders_data?: Json | null
          pdf_url?: string | null
          prepared_by?: string | null
          prepared_for?: string
          report_date?: string
          status?: string
          updated_at?: string
          user_id?: string
          violations_data?: Json | null
        }
        Relationships: []
      }
      email_log: {
        Row: {
          email_type: string
          id: string
          metadata: Json | null
          recipient_email: string | null
          sent_at: string
          subject: string
          user_id: string
        }
        Insert: {
          email_type: string
          id?: string
          metadata?: Json | null
          recipient_email?: string | null
          sent_at?: string
          subject: string
          user_id: string
        }
        Update: {
          email_type?: string
          id?: string
          metadata?: Json | null
          recipient_email?: string | null
          sent_at?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      email_preferences: {
        Row: {
          created_at: string
          digest_day: string
          digest_frequency: string
          email: string | null
          id: string
          notify_expirations: boolean
          notify_new_applications: boolean
          notify_new_violations: boolean
          notify_status_changes: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_day?: string
          digest_frequency?: string
          email?: string | null
          id?: string
          notify_expirations?: boolean
          notify_new_applications?: boolean
          notify_new_violations?: boolean
          notify_status_changes?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_day?: string
          digest_frequency?: string
          email?: string | null
          id?: string
          notify_expirations?: boolean
          notify_new_applications?: boolean
          notify_new_violations?: boolean
          notify_status_changes?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lease_conversations: {
        Row: {
          created_at: string
          document_id: string
          id: string
          last_message_at: string | null
          property_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          last_message_at?: string | null
          property_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          last_message_at?: string | null
          property_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_conversations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "property_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_conversations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_messages: {
        Row: {
          citations: Json | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          citations?: Json | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          citations?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "lease_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          priority: Database["public"]["Enums"]["notification_priority"]
          property_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          property_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          property_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      oath_hearings: {
        Row: {
          amount_paid: number | null
          balance_due: number | null
          created_at: string
          disposition: string | null
          disposition_date: string | null
          hearing_date: string | null
          hearing_status: string | null
          id: string
          last_synced_at: string | null
          penalty_amount: number | null
          penalty_paid: boolean | null
          property_id: string | null
          raw_data: Json | null
          summons_number: string
          updated_at: string
          violation_id: string | null
        }
        Insert: {
          amount_paid?: number | null
          balance_due?: number | null
          created_at?: string
          disposition?: string | null
          disposition_date?: string | null
          hearing_date?: string | null
          hearing_status?: string | null
          id?: string
          last_synced_at?: string | null
          penalty_amount?: number | null
          penalty_paid?: boolean | null
          property_id?: string | null
          raw_data?: Json | null
          summons_number: string
          updated_at?: string
          violation_id?: string | null
        }
        Update: {
          amount_paid?: number | null
          balance_due?: number | null
          created_at?: string
          disposition?: string | null
          disposition_date?: string | null
          hearing_date?: string | null
          hearing_status?: string | null
          id?: string
          last_synced_at?: string | null
          penalty_amount?: number | null
          penalty_paid?: boolean | null
          property_id?: string | null
          raw_data?: Json | null
          summons_number?: string
          updated_at?: string
          violation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oath_hearings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oath_hearings_violation_id_fkey"
            columns: ["violation_id"]
            isOneToOne: false
            referencedRelation: "violations"
            referencedColumns: ["id"]
          },
        ]
      }
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
          license_id: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          license_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          license_id?: string | null
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
          last_checked_at: string | null
          last_synced_at: string | null
          latitude: number | null
          legal_adult_use: boolean | null
          local_law: string | null
          loft_law: boolean | null
          longitude: number | null
          lot_area_sqft: number | null
          max_floor_area_ratio: number | null
          monitoring_enabled: boolean | null
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
          last_checked_at?: string | null
          last_synced_at?: string | null
          latitude?: number | null
          legal_adult_use?: boolean | null
          local_law?: string | null
          loft_law?: boolean | null
          longitude?: number | null
          lot_area_sqft?: number | null
          max_floor_area_ratio?: number | null
          monitoring_enabled?: boolean | null
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
          last_checked_at?: string | null
          last_synced_at?: string | null
          latitude?: number | null
          legal_adult_use?: boolean | null
          local_law?: string | null
          loft_law?: boolean | null
          longitude?: number | null
          lot_area_sqft?: number | null
          max_floor_area_ratio?: number | null
          monitoring_enabled?: boolean | null
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
      property_ai_conversations: {
        Row: {
          created_at: string
          id: string
          property_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_ai_conversations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "property_ai_conversations"
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
          extracted_text: string | null
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
          extracted_text?: string | null
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
          extracted_text?: string | null
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
          amount_paid: number | null
          balance_due: number | null
          certification_due_date: string | null
          complaint_category: string | null
          complaint_number: string | null
          created_at: string
          cure_due_date: string | null
          daily_penalty_amount: number | null
          description_raw: string | null
          disposition_code: string | null
          disposition_comments: string | null
          hearing_date: string | null
          id: string
          is_stop_work_order: boolean | null
          is_vacate_order: boolean | null
          issued_date: string
          notes: string | null
          oath_status: string | null
          penalty_amount: number | null
          penalty_paid: boolean | null
          penalty_text: string | null
          priority: string | null
          property_id: string
          respondent_address: string | null
          respondent_name: string | null
          severity: string | null
          source: string | null
          status: Database["public"]["Enums"]["violation_status"]
          suppressed: boolean | null
          suppression_reason: string | null
          synced_at: string | null
          updated_at: string
          violation_category: string | null
          violation_class: string | null
          violation_number: string
          violation_type: string | null
        }
        Insert: {
          agency: Database["public"]["Enums"]["agency_type"]
          amount_paid?: number | null
          balance_due?: number | null
          certification_due_date?: string | null
          complaint_category?: string | null
          complaint_number?: string | null
          created_at?: string
          cure_due_date?: string | null
          daily_penalty_amount?: number | null
          description_raw?: string | null
          disposition_code?: string | null
          disposition_comments?: string | null
          hearing_date?: string | null
          id?: string
          is_stop_work_order?: boolean | null
          is_vacate_order?: boolean | null
          issued_date: string
          notes?: string | null
          oath_status?: string | null
          penalty_amount?: number | null
          penalty_paid?: boolean | null
          penalty_text?: string | null
          priority?: string | null
          property_id: string
          respondent_address?: string | null
          respondent_name?: string | null
          severity?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["violation_status"]
          suppressed?: boolean | null
          suppression_reason?: string | null
          synced_at?: string | null
          updated_at?: string
          violation_category?: string | null
          violation_class?: string | null
          violation_number: string
          violation_type?: string | null
        }
        Update: {
          agency?: Database["public"]["Enums"]["agency_type"]
          amount_paid?: number | null
          balance_due?: number | null
          certification_due_date?: string | null
          complaint_category?: string | null
          complaint_number?: string | null
          created_at?: string
          cure_due_date?: string | null
          daily_penalty_amount?: number | null
          description_raw?: string | null
          disposition_code?: string | null
          disposition_comments?: string | null
          hearing_date?: string | null
          id?: string
          is_stop_work_order?: boolean | null
          is_vacate_order?: boolean | null
          issued_date?: string
          notes?: string | null
          oath_status?: string | null
          penalty_amount?: number | null
          penalty_paid?: boolean | null
          penalty_text?: string | null
          priority?: string | null
          property_id?: string
          respondent_address?: string | null
          respondent_name?: string | null
          severity?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["violation_status"]
          suppressed?: boolean | null
          suppression_reason?: string | null
          synced_at?: string | null
          updated_at?: string
          violation_category?: string | null
          violation_class?: string | null
          violation_number?: string
          violation_type?: string | null
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
      calculate_compliance_score: {
        Args: { p_property_id: string }
        Returns: Json
      }
      generate_deadline_reminders: { Args: never; Returns: undefined }
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
      notification_priority: "critical" | "high" | "normal" | "low"
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
      notification_priority: ["critical", "high", "normal", "low"],
      violation_status: ["open", "in_progress", "closed"],
      work_order_status: ["open", "in_progress", "awaiting_docs", "completed"],
    },
  },
} as const
