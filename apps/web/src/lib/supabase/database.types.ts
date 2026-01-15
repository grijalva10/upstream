export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      activities: {
        Row: {
          activity_at: string | null
          activity_type: string
          body_html: string | null
          body_text: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          direction: string | null
          email_template_id: string | null
          id: string
          metadata: Json | null
          property_id: string | null
          sequence_subscription_id: string | null
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          activity_at?: string | null
          activity_type: string
          body_html?: string | null
          body_text?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          direction?: string | null
          email_template_id?: string | null
          id?: string
          metadata?: Json | null
          property_id?: string | null
          sequence_subscription_id?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          activity_at?: string | null
          activity_type?: string
          body_html?: string | null
          body_text?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          direction?: string | null
          email_template_id?: string | null
          id?: string
          metadata?: Json | null
          property_id?: string | null
          sequence_subscription_id?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_sequence_subscription_id_fkey"
            columns: ["sequence_subscription_id"]
            isOneToOne: false
            referencedRelation: "sequence_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_definitions: {
        Row: {
          created_at: string | null
          description: string | null
          file_path: string | null
          id: string
          is_active: boolean | null
          model: string | null
          name: string
          tools: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          is_active?: boolean | null
          model?: string | null
          name: string
          tools?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          is_active?: boolean | null
          model?: string | null
          name?: string
          tools?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_execution_context: {
        Row: {
          agent_execution_id: string
          context_id: string
          context_type: string
          created_at: string | null
          id: string
        }
        Insert: {
          agent_execution_id: string
          context_id: string
          context_type: string
          created_at?: string | null
          id?: string
        }
        Update: {
          agent_execution_id?: string
          context_id?: string
          context_type?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_execution_context_agent_execution_id_fkey"
            columns: ["agent_execution_id"]
            isOneToOne: false
            referencedRelation: "agent_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_executions: {
        Row: {
          agent_definition_id: string | null
          agent_name: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          input_tokens: number | null
          metadata: Json | null
          metrics: Json | null
          output_tokens: number | null
          prompt: string | null
          response: string | null
          started_at: string | null
          status: string
          trigger_entity_id: string | null
          trigger_entity_type: string | null
        }
        Insert: {
          agent_definition_id?: string | null
          agent_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          metrics?: Json | null
          output_tokens?: number | null
          prompt?: string | null
          response?: string | null
          started_at?: string | null
          status?: string
          trigger_entity_id?: string | null
          trigger_entity_type?: string | null
        }
        Update: {
          agent_definition_id?: string | null
          agent_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          metrics?: Json | null
          output_tokens?: number | null
          prompt?: string | null
          response?: string | null
          started_at?: string | null
          status?: string
          trigger_entity_id?: string | null
          trigger_entity_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_executions_agent_definition_id_fkey"
            columns: ["agent_definition_id"]
            isOneToOne: false
            referencedRelation: "agent_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_executions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_feedback: {
        Row: {
          actual_outcome: Json | null
          adjustment_made: string | null
          agent_execution_id: string | null
          agent_name: string
          created_at: string
          criteria_type: string | null
          expected_outcome: Json | null
          feedback_text: string | null
          feedback_type: string
          final_outcome: Json | null
          id: string
          market_tags: string[] | null
        }
        Insert: {
          actual_outcome?: Json | null
          adjustment_made?: string | null
          agent_execution_id?: string | null
          agent_name: string
          created_at?: string
          criteria_type?: string | null
          expected_outcome?: Json | null
          feedback_text?: string | null
          feedback_type: string
          final_outcome?: Json | null
          id?: string
          market_tags?: string[] | null
        }
        Update: {
          actual_outcome?: Json | null
          adjustment_made?: string | null
          agent_execution_id?: string | null
          agent_name?: string
          created_at?: string
          criteria_type?: string | null
          expected_outcome?: Json | null
          feedback_text?: string | null
          feedback_type?: string
          final_outcome?: Json | null
          id?: string
          market_tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_feedback_agent_execution_id_fkey"
            columns: ["agent_execution_id"]
            isOneToOne: false
            referencedRelation: "agent_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_metric_definitions: {
        Row: {
          agent_name: string
          created_at: string | null
          description: string | null
          id: string
          metric_name: string
          metric_type: string
          unit: string | null
        }
        Insert: {
          agent_name: string
          created_at?: string | null
          description?: string | null
          id?: string
          metric_name: string
          metric_type: string
          unit?: string | null
        }
        Update: {
          agent_name?: string
          created_at?: string | null
          description?: string | null
          id?: string
          metric_name?: string
          metric_type?: string
          unit?: string | null
        }
        Relationships: []
      }
      calls: {
        Row: {
          action_items: Json | null
          call_prep_md: string | null
          contact_id: string
          created_at: string | null
          deal_id: string | null
          duration_minutes: number | null
          id: string
          notes_md: string | null
          outcome: string | null
          scheduled_at: string
          status: string
          updated_at: string | null
        }
        Insert: {
          action_items?: Json | null
          call_prep_md?: string | null
          contact_id: string
          created_at?: string | null
          deal_id?: string | null
          duration_minutes?: number | null
          id?: string
          notes_md?: string | null
          outcome?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          action_items?: Json | null
          call_prep_md?: string | null
          contact_id?: string
          created_at?: string | null
          deal_id?: string | null
          duration_minutes?: number | null
          id?: string
          notes_md?: string | null
          outcome?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          completed_at: string | null
          created_at: string | null
          email_1_body: string | null
          email_1_subject: string | null
          email_2_body: string | null
          email_2_delay_days: number | null
          email_2_subject: string | null
          email_3_body: string | null
          email_3_delay_days: number | null
          email_3_subject: string | null
          id: string
          name: string
          search_id: string
          send_window_end: string | null
          send_window_start: string | null
          started_at: string | null
          status: string
          timezone: string | null
          total_enrolled: number | null
          total_opened: number | null
          total_replied: number | null
          total_sent: number | null
          total_stopped: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          email_1_body?: string | null
          email_1_subject?: string | null
          email_2_body?: string | null
          email_2_delay_days?: number | null
          email_2_subject?: string | null
          email_3_body?: string | null
          email_3_delay_days?: number | null
          email_3_subject?: string | null
          id?: string
          name: string
          search_id: string
          send_window_end?: string | null
          send_window_start?: string | null
          started_at?: string | null
          status?: string
          timezone?: string | null
          total_enrolled?: number | null
          total_opened?: number | null
          total_replied?: number | null
          total_sent?: number | null
          total_stopped?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          email_1_body?: string | null
          email_1_subject?: string | null
          email_2_body?: string | null
          email_2_delay_days?: number | null
          email_2_subject?: string | null
          email_3_body?: string | null
          email_3_delay_days?: number | null
          email_3_subject?: string | null
          id?: string
          name?: string
          search_id?: string
          send_window_end?: string | null
          send_window_start?: string | null
          started_at?: string | null
          status?: string
          timezone?: string | null
          total_enrolled?: number | null
          total_opened?: number | null
          total_replied?: number | null
          total_sent?: number | null
          total_stopped?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
        ]
      }
      checkpoint_approvals: {
        Row: {
          approved_at: string | null
          checkpoint: string
          context: Json | null
          created_at: string
          data: Json
          feedback: string | null
          id: string
          processed_by: string | null
          rejected_at: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          checkpoint: string
          context?: Json | null
          created_at?: string
          data: Json
          feedback?: string | null
          id?: string
          processed_by?: string | null
          rejected_at?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          checkpoint?: string
          context?: Json | null
          created_at?: string
          data?: Json
          feedback?: string | null
          id?: string
          processed_by?: string | null
          rejected_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkpoint_approvals_checkpoint_fkey"
            columns: ["checkpoint"]
            isOneToOne: false
            referencedRelation: "checkpoint_settings"
            referencedColumns: ["checkpoint"]
          },
        ]
      }
      checkpoint_settings: {
        Row: {
          checkpoint: string
          created_at: string
          mode: string
          updated_at: string
        }
        Insert: {
          checkpoint: string
          created_at?: string
          mode?: string
          updated_at?: string
        }
        Update: {
          checkpoint?: string
          created_at?: string
          mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_criteria: {
        Row: {
          client_id: string
          created_at: string | null
          created_by: string | null
          criteria_json: Json
          generated_queries: Json | null
          id: string
          last_extracted_at: string | null
          name: string
          queries_generated_at: string | null
          queries_json: Json | null
          source_file: string | null
          status: string
          strategy_summary: string | null
          total_contacts: number | null
          total_properties: number | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by?: string | null
          criteria_json: Json
          generated_queries?: Json | null
          id?: string
          last_extracted_at?: string | null
          name: string
          queries_generated_at?: string | null
          queries_json?: Json | null
          source_file?: string | null
          status?: string
          strategy_summary?: string | null
          total_contacts?: number | null
          total_properties?: number | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          criteria_json?: Json
          generated_queries?: Json | null
          id?: string
          last_extracted_at?: string | null
          name?: string
          queries_generated_at?: string | null
          queries_json?: Json | null
          source_file?: string | null
          status?: string
          strategy_summary?: string | null
          total_contacts?: number | null
          total_properties?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_criteria_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_pipeline_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_criteria_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_criteria_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company_name: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          assigned_user_id: string | null
          broker_contact: string | null
          costar_company_id: string | null
          created_at: string | null
          has_broker: boolean | null
          id: string
          is_buyer: boolean | null
          is_seller: boolean | null
          lead_score: number | null
          name: string
          notes: string | null
          qualification_status: string | null
          source: string | null
          status: string
          status_changed_at: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          broker_contact?: string | null
          costar_company_id?: string | null
          created_at?: string | null
          has_broker?: boolean | null
          id?: string
          is_buyer?: boolean | null
          is_seller?: boolean | null
          lead_score?: number | null
          name: string
          notes?: string | null
          qualification_status?: string | null
          source?: string | null
          status?: string
          status_changed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          broker_contact?: string | null
          costar_company_id?: string | null
          created_at?: string | null
          has_broker?: boolean | null
          id?: string
          is_buyer?: boolean | null
          is_seller?: boolean | null
          lead_score?: number | null
          name?: string
          notes?: string | null
          qualification_status?: string | null
          source?: string | null
          status?: string
          status_changed_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string | null
          costar_person_id: string | null
          created_at: string | null
          email: string | null
          id: string
          is_buyer: boolean | null
          is_decision_maker: boolean | null
          is_seller: boolean | null
          last_contacted_at: string | null
          name: string
          phone: string | null
          status: string
          status_changed_at: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          costar_person_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_buyer?: boolean | null
          is_decision_maker?: boolean | null
          is_seller?: boolean | null
          last_contacted_at?: string | null
          name: string
          phone?: string | null
          status?: string
          status_changed_at?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          costar_person_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_buyer?: boolean | null
          is_decision_maker?: boolean | null
          is_seller?: boolean | null
          last_contacted_at?: string | null
          name?: string
          phone?: string | null
          status?: string
          status_changed_at?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_activity: {
        Row: {
          activity_type: string
          created_at: string | null
          created_by: string | null
          deal_id: string
          description: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          created_by?: string | null
          deal_id: string
          description?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          created_by?: string | null
          deal_id?: string
          description?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_activity_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_packages: {
        Row: {
          client_criteria_id: string | null
          company_id: string | null
          created_at: string | null
          extraction_list_id: string | null
          handed_off_at: string | null
          id: string
          package_json: Json
          property_id: string | null
          qualification_data_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          client_criteria_id?: string | null
          company_id?: string | null
          created_at?: string | null
          extraction_list_id?: string | null
          handed_off_at?: string | null
          id?: string
          package_json: Json
          property_id?: string | null
          qualification_data_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          client_criteria_id?: string | null
          company_id?: string | null
          created_at?: string | null
          extraction_list_id?: string | null
          handed_off_at?: string | null
          id?: string
          package_json?: Json
          property_id?: string | null
          qualification_data_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_packages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_packages_extraction_list_id_fkey"
            columns: ["extraction_list_id"]
            isOneToOne: false
            referencedRelation: "extraction_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_packages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_packages_qualification_data_id_fkey"
            columns: ["qualification_data_id"]
            isOneToOne: false
            referencedRelation: "qualification_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_packages_qualification_data_id_fkey"
            columns: ["qualification_data_id"]
            isOneToOne: false
            referencedRelation: "qualification_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          admin_notes: string | null
          asking_price: number | null
          cap_rate: number | null
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          decision_maker_confirmed: boolean | null
          display_id: string | null
          enrollment_id: string | null
          handed_off_at: string | null
          handed_off_to: string | null
          id: string
          investment_highlights: Json | null
          investment_summary: string | null
          lee_1031_x_deal_id: string | null
          lender_name: string | null
          loan_amount: number | null
          loan_maturity: string | null
          loan_rate: number | null
          motivation: string | null
          noi: number | null
          operating_statement_url: string | null
          other_docs: Json | null
          price_realistic: boolean | null
          property_id: string
          rent_roll_url: string | null
          search_id: string | null
          status: string
          timeline: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          asking_price?: number | null
          cap_rate?: number | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          decision_maker_confirmed?: boolean | null
          display_id?: string | null
          enrollment_id?: string | null
          handed_off_at?: string | null
          handed_off_to?: string | null
          id?: string
          investment_highlights?: Json | null
          investment_summary?: string | null
          lee_1031_x_deal_id?: string | null
          lender_name?: string | null
          loan_amount?: number | null
          loan_maturity?: string | null
          loan_rate?: number | null
          motivation?: string | null
          noi?: number | null
          operating_statement_url?: string | null
          other_docs?: Json | null
          price_realistic?: boolean | null
          property_id: string
          rent_roll_url?: string | null
          search_id?: string | null
          status?: string
          timeline?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          asking_price?: number | null
          cap_rate?: number | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          decision_maker_confirmed?: boolean | null
          display_id?: string | null
          enrollment_id?: string | null
          handed_off_at?: string | null
          handed_off_to?: string | null
          id?: string
          investment_highlights?: Json | null
          investment_summary?: string | null
          lee_1031_x_deal_id?: string | null
          lender_name?: string | null
          loan_amount?: number | null
          loan_maturity?: string | null
          loan_rate?: number | null
          motivation?: string | null
          noi?: number | null
          operating_statement_url?: string | null
          other_docs?: Json | null
          price_realistic?: boolean | null
          property_id?: string
          rent_roll_url?: string | null
          search_id?: string | null
          status?: string
          timeline?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
        ]
      }
      dnc_entries: {
        Row: {
          added_at: string | null
          added_by: string | null
          company_name: string | null
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          reason: string | null
          source: string | null
          source_email_id: string | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          company_name?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          reason?: string | null
          source?: string | null
          source_email_id?: string | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          company_name?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          reason?: string | null
          source?: string | null
          source_email_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dnc_entries_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dnc_entries_source_email_id_fkey"
            columns: ["source_email_id"]
            isOneToOne: false
            referencedRelation: "synced_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_drafts: {
        Row: {
          body: string
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          draft_type: string
          generated_by: string | null
          id: string
          in_reply_to_email_id: string | null
          property_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sent_activity_id: string | null
          sent_at: string | null
          status: string | null
          subject: string
          to_email: string
          to_name: string | null
          updated_at: string | null
        }
        Insert: {
          body: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          draft_type: string
          generated_by?: string | null
          id?: string
          in_reply_to_email_id?: string | null
          property_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_activity_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          to_email: string
          to_name?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          draft_type?: string
          generated_by?: string | null
          id?: string
          in_reply_to_email_id?: string | null
          property_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_activity_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          to_email?: string
          to_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_sent_activity_id_fkey"
            columns: ["sent_activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          activity_id: string
          created_at: string | null
          event_type: string
          id: string
          ip_address: unknown
          occurred_at: string | null
          url: string | null
          user_agent: string | null
        }
        Insert: {
          activity_id: string
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Update: {
          activity_id?: string
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      email_exclusions: {
        Row: {
          bounce_type: string | null
          created_at: string | null
          email: string
          id: string
          reason: string
          source_email_id: string | null
        }
        Insert: {
          bounce_type?: string | null
          created_at?: string | null
          email: string
          id?: string
          reason: string
          source_email_id?: string | null
        }
        Update: {
          bounce_type?: string | null
          created_at?: string | null
          email?: string
          id?: string
          reason?: string
          source_email_id?: string | null
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          attempts: number | null
          body_html: string | null
          body_text: string
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          in_reply_to_email_id: string | null
          job_type: string
          last_error: string | null
          max_attempts: number | null
          next_retry_at: string | null
          priority: number | null
          processed_at: string | null
          property_id: string | null
          scheduled_for: string | null
          sent_at: string | null
          sequence_id: string | null
          source: string | null
          status: string | null
          subject: string
          subscription_id: string | null
          to_email: string
          to_name: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          body_html?: string | null
          body_text: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          in_reply_to_email_id?: string | null
          job_type: string
          last_error?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          priority?: number | null
          processed_at?: string | null
          property_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          source?: string | null
          status?: string | null
          subject: string
          subscription_id?: string | null
          to_email: string
          to_name?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          body_html?: string | null
          body_text?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          in_reply_to_email_id?: string | null
          job_type?: string
          last_error?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          priority?: number | null
          processed_at?: string | null
          property_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          source?: string | null
          status?: string | null
          subject?: string
          subscription_id?: string | null
          to_email?: string
          to_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_in_reply_to_email_id_fkey"
            columns: ["in_reply_to_email_id"]
            isOneToOne: false
            referencedRelation: "synced_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "sequence_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sync_state: {
        Row: {
          folder: string
          id: string
          last_entry_id: string | null
          last_sync_at: string | null
          updated_at: string | null
        }
        Insert: {
          folder: string
          id?: string
          last_entry_id?: string | null
          last_sync_at?: string | null
          updated_at?: string | null
        }
        Update: {
          folder?: string
          id?: string
          last_entry_id?: string | null
          last_sync_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_template_variants: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_active: boolean | null
          opens: number | null
          positive_replies: number | null
          replies: number | null
          sends: number | null
          subject: string
          template_id: string | null
          variant_name: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          opens?: number | null
          positive_replies?: number | null
          replies?: number | null
          sends?: number | null
          subject: string
          template_id?: string | null
          variant_name: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          opens?: number | null
          positive_replies?: number | null
          replies?: number | null
          sends?: number | null
          subject?: string
          template_id?: string | null
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_template_variants_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string | null
          body_text: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          campaign_id: string
          contact_id: string
          created_at: string | null
          current_step: number | null
          email_1_opened_at: string | null
          email_1_sent_at: string | null
          email_2_opened_at: string | null
          email_2_sent_at: string | null
          email_3_opened_at: string | null
          email_3_sent_at: string | null
          flag_already_contacted_any: boolean | null
          flag_already_contacted_this: boolean | null
          flag_is_bounced: boolean | null
          flag_is_dnc: boolean | null
          id: string
          property_id: string
          replied_at: string | null
          reply_classification: string | null
          status: string
          stopped_at: string | null
          stopped_reason: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string | null
          current_step?: number | null
          email_1_opened_at?: string | null
          email_1_sent_at?: string | null
          email_2_opened_at?: string | null
          email_2_sent_at?: string | null
          email_3_opened_at?: string | null
          email_3_sent_at?: string | null
          flag_already_contacted_any?: boolean | null
          flag_already_contacted_this?: boolean | null
          flag_is_bounced?: boolean | null
          flag_is_dnc?: boolean | null
          id?: string
          property_id: string
          replied_at?: string | null
          reply_classification?: string | null
          status?: string
          stopped_at?: string | null
          stopped_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string | null
          current_step?: number | null
          email_1_opened_at?: string | null
          email_1_sent_at?: string | null
          email_2_opened_at?: string | null
          email_2_sent_at?: string | null
          email_3_opened_at?: string | null
          email_3_sent_at?: string | null
          flag_already_contacted_any?: boolean | null
          flag_already_contacted_this?: boolean | null
          flag_is_bounced?: boolean | null
          flag_is_dnc?: boolean | null
          id?: string
          property_id?: string
          replied_at?: string | null
          reply_classification?: string | null
          status?: string
          stopped_at?: string | null
          stopped_reason?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      exclusions: {
        Row: {
          created_at: string | null
          exclusion_type: string
          id: string
          reason: string
          source_message_id: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          exclusion_type: string
          id?: string
          reason: string
          source_message_id?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          exclusion_type?: string
          id?: string
          reason?: string
          source_message_id?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "exclusions_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "inbox_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_lists: {
        Row: {
          agent_execution_id: string | null
          client_criteria_id: string | null
          contact_count: number | null
          created_at: string | null
          extracted_at: string | null
          id: string
          name: string
          notes: string | null
          payload_json: Json | null
          property_count: number | null
          query_index: number | null
          query_name: string | null
          source_file: string | null
          sourcing_strategy_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          agent_execution_id?: string | null
          client_criteria_id?: string | null
          contact_count?: number | null
          created_at?: string | null
          extracted_at?: string | null
          id?: string
          name: string
          notes?: string | null
          payload_json?: Json | null
          property_count?: number | null
          query_index?: number | null
          query_name?: string | null
          source_file?: string | null
          sourcing_strategy_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_execution_id?: string | null
          client_criteria_id?: string | null
          contact_count?: number | null
          created_at?: string | null
          extracted_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          payload_json?: Json | null
          property_count?: number | null
          query_index?: number | null
          query_name?: string | null
          source_file?: string | null
          sourcing_strategy_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extraction_lists_client_criteria_id_fkey"
            columns: ["client_criteria_id"]
            isOneToOne: false
            referencedRelation: "client_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_lists_sourcing_strategy_id_fkey"
            columns: ["sourcing_strategy_id"]
            isOneToOne: false
            referencedRelation: "sourcing_strategies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_extraction_agent_execution"
            columns: ["agent_execution_id"]
            isOneToOne: false
            referencedRelation: "agent_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_messages: {
        Row: {
          action_taken: string | null
          body_html: string | null
          body_text: string | null
          classification: string | null
          classification_confidence: number | null
          classification_reasoning: string | null
          contact_id: string | null
          created_at: string | null
          enrollment_id: string | null
          from_email: string
          from_name: string | null
          id: string
          outlook_id: string | null
          property_id: string | null
          received_at: string
          status: string
          subject: string | null
          thread_id: string | null
          to_email: string | null
        }
        Insert: {
          action_taken?: string | null
          body_html?: string | null
          body_text?: string | null
          classification?: string | null
          classification_confidence?: number | null
          classification_reasoning?: string | null
          contact_id?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          from_email: string
          from_name?: string | null
          id?: string
          outlook_id?: string | null
          property_id?: string | null
          received_at: string
          status?: string
          subject?: string | null
          thread_id?: string | null
          to_email?: string | null
        }
        Update: {
          action_taken?: string | null
          body_html?: string | null
          body_text?: string | null
          classification?: string | null
          classification_confidence?: number | null
          classification_reasoning?: string | null
          contact_id?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          from_email?: string
          from_name?: string | null
          id?: string
          outlook_id?: string | null
          property_id?: string | null
          received_at?: string
          status?: string
          subject?: string | null
          thread_id?: string | null
          to_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      list_properties: {
        Row: {
          added_at: string | null
          extraction_list_id: string
          property_id: string
        }
        Insert: {
          added_at?: string | null
          extraction_list_id: string
          property_id: string
        }
        Update: {
          added_at?: string | null
          extraction_list_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_properties_extraction_list_id_fkey"
            columns: ["extraction_list_id"]
            isOneToOne: false
            referencedRelation: "extraction_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          bounding_box: Json | null
          created_at: string | null
          id: number
          name: string
          property_type_ids: number[] | null
          state: string | null
        }
        Insert: {
          bounding_box?: Json | null
          created_at?: string | null
          id: number
          name: string
          property_type_ids?: number[] | null
          state?: string | null
        }
        Update: {
          bounding_box?: Json | null
          created_at?: string | null
          id?: number
          name?: string
          property_type_ids?: number[] | null
          state?: string | null
        }
        Relationships: []
      }
      orchestrator_status: {
        Row: {
          config: Json | null
          created_at: string
          hostname: string | null
          id: string
          is_running: boolean
          last_heartbeat: string | null
          loops_enabled: Json | null
          pid: number | null
          started_at: string | null
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          hostname?: string | null
          id?: string
          is_running?: boolean
          last_heartbeat?: string | null
          loops_enabled?: Json | null
          pid?: number | null
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          hostname?: string | null
          id?: string
          is_running?: boolean
          last_heartbeat?: string | null
          loops_enabled?: Json | null
          pid?: number | null
          started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          building_class: string | null
          building_size_sqft: number | null
          costar_property_id: string | null
          created_at: string | null
          first_seen_at: string | null
          id: string
          last_seen_at: string | null
          lot_size_acres: number | null
          market_id: number | null
          percent_leased: number | null
          property_name: string | null
          property_type: string | null
          updated_at: string | null
          year_built: number | null
        }
        Insert: {
          address: string
          building_class?: string | null
          building_size_sqft?: number | null
          costar_property_id?: string | null
          created_at?: string | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          lot_size_acres?: number | null
          market_id?: number | null
          percent_leased?: number | null
          property_name?: string | null
          property_type?: string | null
          updated_at?: string | null
          year_built?: number | null
        }
        Update: {
          address?: string
          building_class?: string | null
          building_size_sqft?: number | null
          costar_property_id?: string | null
          created_at?: string | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          lot_size_acres?: number | null
          market_id?: number | null
          percent_leased?: number | null
          property_name?: string | null
          property_type?: string | null
          updated_at?: string | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      property_companies: {
        Row: {
          company_id: string
          first_seen_at: string | null
          ownership_pct: number | null
          property_id: string
          relationship: string
        }
        Insert: {
          company_id: string
          first_seen_at?: string | null
          ownership_pct?: number | null
          property_id: string
          relationship?: string
        }
        Update: {
          company_id?: string
          first_seen_at?: string | null
          ownership_pct?: number | null
          property_id?: string
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_companies_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_loans: {
        Row: {
          costar_loan_id: string | null
          created_at: string | null
          current_balance: number | null
          dscr_current: number | null
          first_seen_at: string | null
          id: string
          interest_rate: number | null
          interest_rate_type: string | null
          is_balloon_maturity: boolean | null
          is_modification: boolean | null
          last_seen_at: string | null
          lender_name: string | null
          loan_type: string | null
          ltv_current: number | null
          ltv_original: number | null
          maturity_date: string | null
          original_amount: number | null
          origination_date: string | null
          payment_status: string | null
          property_id: string
          special_servicing_status: string | null
          updated_at: string | null
          watchlist_status: string | null
        }
        Insert: {
          costar_loan_id?: string | null
          created_at?: string | null
          current_balance?: number | null
          dscr_current?: number | null
          first_seen_at?: string | null
          id?: string
          interest_rate?: number | null
          interest_rate_type?: string | null
          is_balloon_maturity?: boolean | null
          is_modification?: boolean | null
          last_seen_at?: string | null
          lender_name?: string | null
          loan_type?: string | null
          ltv_current?: number | null
          ltv_original?: number | null
          maturity_date?: string | null
          original_amount?: number | null
          origination_date?: string | null
          payment_status?: string | null
          property_id: string
          special_servicing_status?: string | null
          updated_at?: string | null
          watchlist_status?: string | null
        }
        Update: {
          costar_loan_id?: string | null
          created_at?: string | null
          current_balance?: number | null
          dscr_current?: number | null
          first_seen_at?: string | null
          id?: string
          interest_rate?: number | null
          interest_rate_type?: string | null
          is_balloon_maturity?: boolean | null
          is_modification?: boolean | null
          last_seen_at?: string | null
          lender_name?: string | null
          loan_type?: string | null
          ltv_current?: number | null
          ltv_original?: number | null
          maturity_date?: string | null
          original_amount?: number | null
          origination_date?: string | null
          payment_status?: string | null
          property_id?: string
          special_servicing_status?: string | null
          updated_at?: string | null
          watchlist_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_loans_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      qualification_data: {
        Row: {
          asking_price: number | null
          cap_rate: number | null
          company_id: string | null
          created_at: string | null
          decision_maker_confirmed: boolean | null
          decision_maker_name: string | null
          decision_maker_title: string | null
          email_count: number | null
          has_operating_statements: boolean | null
          has_rent_roll: boolean | null
          id: string
          last_response_at: string | null
          motivation: string | null
          noi: number | null
          packaged_at: string | null
          price_per_sf: number | null
          property_id: string | null
          qualified_at: string | null
          seller_priorities: string | null
          status: string | null
          timeline: string | null
          updated_at: string | null
        }
        Insert: {
          asking_price?: number | null
          cap_rate?: number | null
          company_id?: string | null
          created_at?: string | null
          decision_maker_confirmed?: boolean | null
          decision_maker_name?: string | null
          decision_maker_title?: string | null
          email_count?: number | null
          has_operating_statements?: boolean | null
          has_rent_roll?: boolean | null
          id?: string
          last_response_at?: string | null
          motivation?: string | null
          noi?: number | null
          packaged_at?: string | null
          price_per_sf?: number | null
          property_id?: string | null
          qualified_at?: string | null
          seller_priorities?: string | null
          status?: string | null
          timeline?: string | null
          updated_at?: string | null
        }
        Update: {
          asking_price?: number | null
          cap_rate?: number | null
          company_id?: string | null
          created_at?: string | null
          decision_maker_confirmed?: boolean | null
          decision_maker_name?: string | null
          decision_maker_title?: string | null
          email_count?: number | null
          has_operating_statements?: boolean | null
          has_rent_roll?: boolean | null
          id?: string
          last_response_at?: string | null
          motivation?: string | null
          noi?: number | null
          packaged_at?: string | null
          price_per_sf?: number | null
          property_id?: string | null
          qualified_at?: string | null
          seller_priorities?: string | null
          status?: string | null
          timeline?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qualification_data_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_data_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      search_properties: {
        Row: {
          created_at: string | null
          property_id: string
          search_id: string
        }
        Insert: {
          created_at?: string | null
          property_id: string
          search_id: string
        }
        Update: {
          created_at?: string | null
          property_id?: string
          search_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_properties_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
        ]
      }
      searches: {
        Row: {
          created_at: string | null
          criteria_json: Json
          id: string
          name: string
          payloads_json: Json | null
          source: string
          source_contact_id: string | null
          status: string
          strategy_summary: string | null
          total_companies: number | null
          total_contacts: number | null
          total_properties: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criteria_json: Json
          id?: string
          name: string
          payloads_json?: Json | null
          source?: string
          source_contact_id?: string | null
          status?: string
          strategy_summary?: string | null
          total_companies?: number | null
          total_contacts?: number | null
          total_properties?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criteria_json?: Json
          id?: string
          name?: string
          payloads_json?: Json | null
          source?: string
          source_contact_id?: string | null
          status?: string
          strategy_summary?: string | null
          total_companies?: number | null
          total_contacts?: number | null
          total_properties?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "searches_source_contact_id_fkey"
            columns: ["source_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      send_rate_tracking: {
        Row: {
          count: number | null
          id: string
          period_start: string
          period_type: string
          rate_limit_group: string | null
        }
        Insert: {
          count?: number | null
          id?: string
          period_start: string
          period_type: string
          rate_limit_group?: string | null
        }
        Update: {
          count?: number | null
          id?: string
          period_start?: string
          period_type?: string
          rate_limit_group?: string | null
        }
        Relationships: []
      }
      sequence_steps: {
        Row: {
          created_at: string | null
          created_by: string | null
          delay_seconds: number
          email_template_id: string | null
          id: string
          required: boolean | null
          sequence_id: string
          step_order: number
          step_type: string
          task_description: string | null
          threading: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          delay_seconds?: number
          email_template_id?: string | null
          id?: string
          required?: boolean | null
          sequence_id: string
          step_order: number
          step_type: string
          task_description?: string | null
          threading?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          delay_seconds?: number
          email_template_id?: string | null
          id?: string
          required?: boolean | null
          sequence_id?: string
          step_order?: number
          step_type?: string
          task_description?: string | null
          threading?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_steps_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_subscriptions: {
        Row: {
          awaiting_approval: boolean | null
          completed_at: string | null
          contact_id: string
          created_at: string | null
          current_step_id: string | null
          emails_sent: number | null
          id: string
          last_email_at: string | null
          last_response_classification: string | null
          next_step_at: string | null
          paused_reason: string | null
          property_id: string | null
          scheduled_sends: Json | null
          sequence_id: string
          started_at: string | null
          status: string
          stopped_reason: string | null
          updated_at: string | null
        }
        Insert: {
          awaiting_approval?: boolean | null
          completed_at?: string | null
          contact_id: string
          created_at?: string | null
          current_step_id?: string | null
          emails_sent?: number | null
          id?: string
          last_email_at?: string | null
          last_response_classification?: string | null
          next_step_at?: string | null
          paused_reason?: string | null
          property_id?: string | null
          scheduled_sends?: Json | null
          sequence_id: string
          started_at?: string | null
          status?: string
          stopped_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          awaiting_approval?: boolean | null
          completed_at?: string | null
          contact_id?: string
          created_at?: string | null
          current_step_id?: string | null
          emails_sent?: number | null
          id?: string
          last_email_at?: string | null
          last_response_classification?: string | null
          next_step_at?: string | null
          paused_reason?: string | null
          property_id?: string | null
          scheduled_sends?: Json | null
          sequence_id?: string
          started_at?: string | null
          status?: string
          stopped_reason?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_subscriptions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_subscriptions_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "sequence_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_subscriptions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_subscriptions_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          extraction_list_id: string | null
          humanize_timing: boolean | null
          humanize_variance_max: number | null
          humanize_variance_min: number | null
          id: string
          name: string
          schedule: Json | null
          send_window_end: string | null
          send_window_start: string | null
          simulate_breaks: boolean | null
          spacing_max_sec: number | null
          spacing_min_sec: number | null
          status: string
          stop_on_reply: boolean | null
          timezone: string | null
          updated_at: string | null
          weekdays_only: boolean | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          extraction_list_id?: string | null
          humanize_timing?: boolean | null
          humanize_variance_max?: number | null
          humanize_variance_min?: number | null
          id?: string
          name: string
          schedule?: Json | null
          send_window_end?: string | null
          send_window_start?: string | null
          simulate_breaks?: boolean | null
          spacing_max_sec?: number | null
          spacing_min_sec?: number | null
          status?: string
          stop_on_reply?: boolean | null
          timezone?: string | null
          updated_at?: string | null
          weekdays_only?: boolean | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          extraction_list_id?: string | null
          humanize_timing?: boolean | null
          humanize_variance_max?: number | null
          humanize_variance_min?: number | null
          id?: string
          name?: string
          schedule?: Json | null
          send_window_end?: string | null
          send_window_start?: string | null
          simulate_breaks?: boolean | null
          spacing_max_sec?: number | null
          spacing_min_sec?: number | null
          status?: string
          stop_on_reply?: boolean | null
          timezone?: string | null
          updated_at?: string | null
          weekdays_only?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sequences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequences_extraction_list_id_fkey"
            columns: ["extraction_list_id"]
            isOneToOne: false
            referencedRelation: "extraction_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      sourcing_strategies: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          filter_template: Json | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          filter_template?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          filter_template?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      synced_emails: {
        Row: {
          body_html: string | null
          body_text: string | null
          cc_emails: string[] | null
          classification: string | null
          classification_confidence: number | null
          classified_at: string | null
          classified_by: string | null
          created_at: string | null
          direction: string
          extracted_pricing: Json | null
          from_email: string | null
          from_name: string | null
          has_attachments: boolean | null
          id: string
          is_read: boolean | null
          linked_activity_id: string | null
          matched_company_id: string | null
          matched_contact_id: string | null
          needs_human_review: boolean | null
          needs_manual_review: boolean | null
          outlook_conversation_id: string | null
          outlook_entry_id: string
          received_at: string | null
          review_reason: string | null
          sent_at: string | null
          source_folder: string | null
          subject: string | null
          synced_at: string | null
          to_emails: string[] | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[] | null
          classification?: string | null
          classification_confidence?: number | null
          classified_at?: string | null
          classified_by?: string | null
          created_at?: string | null
          direction: string
          extracted_pricing?: Json | null
          from_email?: string | null
          from_name?: string | null
          has_attachments?: boolean | null
          id?: string
          is_read?: boolean | null
          linked_activity_id?: string | null
          matched_company_id?: string | null
          matched_contact_id?: string | null
          needs_human_review?: boolean | null
          needs_manual_review?: boolean | null
          outlook_conversation_id?: string | null
          outlook_entry_id: string
          received_at?: string | null
          review_reason?: string | null
          sent_at?: string | null
          source_folder?: string | null
          subject?: string | null
          synced_at?: string | null
          to_emails?: string[] | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[] | null
          classification?: string | null
          classification_confidence?: number | null
          classified_at?: string | null
          classified_by?: string | null
          created_at?: string | null
          direction?: string
          extracted_pricing?: Json | null
          from_email?: string | null
          from_name?: string | null
          has_attachments?: boolean | null
          id?: string
          is_read?: boolean | null
          linked_activity_id?: string | null
          matched_company_id?: string | null
          matched_contact_id?: string | null
          needs_human_review?: boolean | null
          needs_manual_review?: boolean | null
          outlook_conversation_id?: string | null
          outlook_entry_id?: string
          received_at?: string | null
          review_reason?: string | null
          sent_at?: string | null
          source_folder?: string | null
          subject?: string | null
          synced_at?: string | null
          to_emails?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "synced_emails_linked_activity_id_fkey"
            columns: ["linked_activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synced_emails_matched_company_id_fkey"
            columns: ["matched_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synced_emails_matched_contact_id_fkey"
            columns: ["matched_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          company_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          data: Json | null
          description: string | null
          due_date: string
          due_time: string | null
          email_id: string | null
          id: string
          priority: string | null
          property_id: string | null
          status: string | null
          title: string
          type: string
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          data?: Json | null
          description?: string | null
          due_date: string
          due_time?: string | null
          email_id?: string | null
          id?: string
          priority?: string | null
          property_id?: string | null
          status?: string | null
          title: string
          type: string
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          data?: Json | null
          description?: string | null
          due_date?: string
          due_time?: string | null
          email_id?: string | null
          id?: string
          priority?: string | null
          property_id?: string | null
          status?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "synced_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          role?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      worker_status: {
        Row: {
          config: Json | null
          current_job_id: string | null
          hostname: string | null
          id: string
          is_paused: boolean | null
          is_running: boolean | null
          jobs_failed: number | null
          jobs_processed: number | null
          last_heartbeat: string | null
          pid: number | null
          started_at: string | null
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          current_job_id?: string | null
          hostname?: string | null
          id?: string
          is_paused?: boolean | null
          is_running?: boolean | null
          jobs_failed?: number | null
          jobs_processed?: number | null
          last_heartbeat?: string | null
          pid?: number | null
          started_at?: string | null
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          current_job_id?: string | null
          hostname?: string | null
          id?: string
          is_paused?: boolean | null
          is_running?: boolean | null
          jobs_failed?: number | null
          jobs_processed?: number | null
          last_heartbeat?: string | null
          pid?: number | null
          started_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      agent_performance_summary: {
        Row: {
          agent_name: string | null
          avg_contact_yield_rate: number | null
          avg_contacts_found: number | null
          avg_duration_ms: number | null
          avg_properties_found: number | null
          avg_tokens: number | null
          failed_executions: number | null
          last_execution: string | null
          success_rate: number | null
          successful_executions: number | null
          total_executions: number | null
        }
        Relationships: []
      }
      approval_queue: {
        Row: {
          company_name: string | null
          context: string | null
          created_at: string | null
          generated_by: string | null
          item_id: string | null
          item_type: string | null
          property_address: string | null
          summary: string | null
          target: string | null
        }
        Relationships: []
      }
      client_pipeline_summary: {
        Row: {
          client_id: string | null
          client_name: string | null
          client_status: string | null
          criteria_count: number | null
          extraction_count: number | null
          last_extraction: string | null
          total_contacts: number | null
          total_properties: number | null
        }
        Relationships: []
      }
      qualification_pipeline: {
        Row: {
          asking_price: number | null
          building_size_sqft: number | null
          cap_rate: number | null
          company_name: string | null
          company_status: string | null
          created_at: string | null
          decision_maker_confirmed: boolean | null
          email_count: number | null
          id: string | null
          last_response_at: string | null
          motivation: string | null
          noi: number | null
          pipeline_status: string | null
          pricing_fields_filled: number | null
          property_address: string | null
          property_type: string | null
          qualified_at: string | null
          status: string | null
          timeline: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_send_rate_limit: {
        Args: {
          p_daily_limit?: number
          p_group?: string
          p_hourly_limit?: number
        }
        Returns: {
          can_send: boolean
          daily_count: number
          daily_remaining: number
          hourly_count: number
          hourly_remaining: number
          reason: string
        }[]
      }
      get_email_classification_counts: {
        Args: never
        Returns: {
          classification: string
          count: number
          needs_review_count: number
        }[]
      }
      get_email_folder_counts: {
        Args: never
        Returns: {
          count: number
          folder: string
        }[]
      }
      get_pgboss_jobs: {
        Args: {
          p_limit?: number
          p_name?: string
          p_offset?: number
          p_state?: string
        }
        Returns: {
          completed_on: string
          created_on: string
          data: Json
          dead_letter: string
          expire_in: string
          id: string
          keep_until: string
          name: string
          output: Json
          priority: number
          retry_backoff: boolean
          retry_count: number
          retry_delay: number
          retry_limit: number
          start_after: string
          started_on: string
          state: string
        }[]
      }
      get_pgboss_stats: {
        Args: never
        Returns: {
          active_count: number
          cancelled_count: number
          completed_count: number
          created_count: number
          expired_count: number
          failed_count: number
          retry_count: number
          total_jobs: number
        }[]
      }
      get_queue_stats: {
        Args: never
        Returns: {
          daily_count: number
          daily_limit: number
          failed_today: number
          hourly_count: number
          hourly_limit: number
          pending_count: number
          processing_count: number
          scheduled_count: number
          sent_today: number
        }[]
      }
      increment_send_count: { Args: { p_group?: string }; Returns: undefined }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

