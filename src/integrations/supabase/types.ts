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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      archive_documents: {
        Row: {
          content_type: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          finding_id: string
          id: string
          source_document_id: string | null
        }
        Insert: {
          content_type: string
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          finding_id: string
          id?: string
          source_document_id?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          finding_id?: string
          id?: string
          source_document_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archive_documents_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "archive_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      archive_findings: {
        Row: {
          archive_month: number
          archive_year: number
          created_at: string
          description: string
          finding_number: string
          id: string
          project_key: string
          project_name: string
          source_project_id: string | null
          title: string
        }
        Insert: {
          archive_month: number
          archive_year: number
          created_at?: string
          description?: string
          finding_number: string
          id?: string
          project_key: string
          project_name: string
          source_project_id?: string | null
          title: string
        }
        Update: {
          archive_month?: number
          archive_year?: number
          created_at?: string
          description?: string
          finding_number?: string
          id?: string
          project_key?: string
          project_name?: string
          source_project_id?: string | null
          title?: string
        }
        Relationships: []
      }
      auditors: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          position: string | null
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          position?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          position?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      follow_up_access: {
        Row: {
          created_at: string
          expires_at: string
          follow_up_project_id: string
          id: string
          item_id: string | null
          recipient_role: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          follow_up_project_id: string
          id?: string
          item_id?: string | null
          recipient_role: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          follow_up_project_id?: string
          id?: string
          item_id?: string | null
          recipient_role?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_access_follow_up_project_id_fkey"
            columns: ["follow_up_project_id"]
            isOneToOne: false
            referencedRelation: "follow_up_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_access_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "follow_up_items"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_documents: {
        Row: {
          content_type: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          submission_id: string
        }
        Insert: {
          content_type: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          submission_id: string
        }
        Update: {
          content_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_documents_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "follow_up_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_items: {
        Row: {
          created_at: string
          description: string
          due_date: string | null
          executor_email: string
          executor_name: string
          follow_up_project_id: string
          id: string
          review_note: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          due_date?: string | null
          executor_email: string
          executor_name: string
          follow_up_project_id: string
          id?: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          due_date?: string | null
          executor_email?: string
          executor_name?: string
          follow_up_project_id?: string
          id?: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_items_follow_up_project_id_fkey"
            columns: ["follow_up_project_id"]
            isOneToOne: false
            referencedRelation: "follow_up_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_projects: {
        Row: {
          created_at: string
          id: string
          project_id: string | null
          project_name: string
          responsible_email: string
          responsible_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id?: string | null
          project_name: string
          responsible_email: string
          responsible_name: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string | null
          project_name?: string
          responsible_email?: string
          responsible_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_submissions: {
        Row: {
          access_id: string | null
          author_role: string
          created_at: string
          description: string
          id: string
          item_id: string
        }
        Insert: {
          access_id?: string | null
          author_role: string
          created_at?: string
          description: string
          id?: string
          item_id: string
        }
        Update: {
          access_id?: string | null
          author_role?: string
          created_at?: string
          description?: string
          id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_submissions_access_id_fkey"
            columns: ["access_id"]
            isOneToOne: false
            referencedRelation: "follow_up_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_submissions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "follow_up_items"
            referencedColumns: ["id"]
          },
        ]
      }
      iso_documents: {
        Row: {
          content_type: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          object_id: string
        }
        Insert: {
          content_type: string
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          object_id: string
        }
        Update: {
          content_type?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          object_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "iso_documents_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "iso_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      iso_objects: {
        Row: {
          archive_year: number
          created_at: string
          id: string
          object_name: string
        }
        Insert: {
          archive_year: number
          created_at?: string
          id?: string
          object_name: string
        }
        Update: {
          archive_year?: number
          created_at?: string
          id?: string
          object_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          auditor_id: string
          created_at: string
          id: string
          project_id: string
          role: string | null
        }
        Insert: {
          auditor_id: string
          created_at?: string
          id?: string
          project_id: string
          role?: string | null
        }
        Update: {
          auditor_id?: string
          created_at?: string
          id?: string
          project_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_auditor_id_fkey"
            columns: ["auditor_id"]
            isOneToOne: false
            referencedRelation: "auditors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stages: {
        Row: {
          id: string
          project_id: string
          sort_order: number
          stage_key: string
          target_date: string | null
        }
        Insert: {
          id?: string
          project_id: string
          sort_order?: number
          stage_key: string
          target_date?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          sort_order?: number
          stage_key?: string
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          auditee: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          period_end: string | null
          period_start: string | null
          status: string
        }
        Insert: {
          auditee?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          period_end?: string | null
          period_start?: string | null
          status?: string
        }
        Update: {
          auditee?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          period_end?: string | null
          period_start?: string | null
          status?: string
        }
        Relationships: []
      }
      stage_documents: {
        Row: {
          content_type: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          stage_id: string
          updated_at: string
        }
        Insert: {
          content_type: string
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          stage_id: string
          updated_at?: string
        }
        Update: {
          content_type?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_documents_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_tasks: {
        Row: {
          auditor_id: string | null
          created_at: string
          done_at: string | null
          due_date: string | null
          id: string
          is_done: boolean
          stage_id: string
          title: string
        }
        Insert: {
          auditor_id?: string | null
          created_at?: string
          done_at?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean
          stage_id: string
          title: string
        }
        Update: {
          auditor_id?: string | null
          created_at?: string
          done_at?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean
          stage_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_tasks_auditor_id_fkey"
            columns: ["auditor_id"]
            isOneToOne: false
            referencedRelation: "auditors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_opname_documents: {
        Row: {
          content_type: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          item_id: string
        }
        Insert: {
          content_type: string
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          item_id: string
        }
        Update: {
          content_type?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_opname_documents_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_opname_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_opname_items: {
        Row: {
          actual_quantity: number | null
          created_at: string
          description: string
          id: string
          parent_id: string | null
          quantity: number
          rab_id: string
          sort_order: number
          unit: string
          unit_price: number
        }
        Insert: {
          actual_quantity?: number | null
          created_at?: string
          description: string
          id?: string
          parent_id?: string | null
          quantity?: number
          rab_id: string
          sort_order?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          actual_quantity?: number | null
          created_at?: string
          description?: string
          id?: string
          parent_id?: string | null
          quantity?: number
          rab_id?: string
          sort_order?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_opname_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "stock_opname_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_opname_items_rab_id_fkey"
            columns: ["rab_id"]
            isOneToOne: false
            referencedRelation: "stock_opname_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_opname_projects: {
        Row: {
          auditor_name: string
          completed_at: string | null
          created_at: string
          disposition_number: string
          division_location: string
          id: string
          project_name: string
          responsible_name: string
          status: string
        }
        Insert: {
          auditor_name?: string
          completed_at?: string | null
          created_at?: string
          disposition_number?: string
          division_location?: string
          id?: string
          project_name: string
          responsible_name?: string
          status?: string
        }
        Update: {
          auditor_name?: string
          completed_at?: string | null
          created_at?: string
          disposition_number?: string
          division_location?: string
          id?: string
          project_name?: string
          responsible_name?: string
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
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
      finish_archived_project: {
        Args: { _finding_id: string; _project_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      submit_follow_up: {
        Args: {
          _access_id: string
          _description: string
          _documents: Json
          _item_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "internal_audit" | "purchasing"
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
    Enums: {
      app_role: ["internal_audit", "purchasing"],
    },
  },
} as const
