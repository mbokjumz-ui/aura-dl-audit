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
      auditors: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          position: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          position?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          position?: string | null
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
