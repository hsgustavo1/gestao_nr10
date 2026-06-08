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
      configuracoes: {
        Row: {
          chave: string
          updated_at: string
          updated_by: string | null
          valor: string | null
        }
        Insert: {
          chave: string
          updated_at?: string
          updated_by?: string | null
          valor?: string | null
        }
        Update: {
          chave?: string
          updated_at?: string
          updated_by?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean
          classificacao: string | null
          created_at: string
          crea_cft: string | null
          diploma: string | null
          diploma_conclusao: string | null
          escolaridade: string | null
          funcao: string | null
          id: string
          matricula: string
          name: string
          setor: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          classificacao?: string | null
          created_at?: string
          crea_cft?: string | null
          diploma?: string | null
          diploma_conclusao?: string | null
          escolaridade?: string | null
          funcao?: string | null
          id?: string
          matricula: string
          name: string
          setor?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          classificacao?: string | null
          created_at?: string
          crea_cft?: string | null
          diploma?: string | null
          diploma_conclusao?: string | null
          escolaridade?: string | null
          funcao?: string | null
          id?: string
          matricula?: string
          name?: string
          setor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      it_trainings: {
        Row: {
          conclusao_date: string | null
          created_at: string
          employee_id: string
          id: string
          instruction_id: string
          status: string
          updated_at: string
        }
        Insert: {
          conclusao_date?: string | null
          created_at?: string
          employee_id: string
          id?: string
          instruction_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          conclusao_date?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          instruction_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_trainings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_trainings_instruction_id_fkey"
            columns: ["instruction_id"]
            isOneToOne: false
            referencedRelation: "work_instructions"
            referencedColumns: ["id"]
          },
        ]
      }
      nr10_trainings: {
        Row: {
          art: string | null
          category: string
          created_at: string
          employee_id: string
          id: string
          responsavel_tecnico: string | null
          training_date: string | null
          training_type: string
          updated_at: string
          valid: boolean
        }
        Insert: {
          art?: string | null
          category: string
          created_at?: string
          employee_id: string
          id?: string
          responsavel_tecnico?: string | null
          training_date?: string | null
          training_type: string
          updated_at?: string
          valid?: boolean
        }
        Update: {
          art?: string | null
          category?: string
          created_at?: string
          employee_id?: string
          id?: string
          responsavel_tecnico?: string | null
          training_date?: string | null
          training_type?: string
          updated_at?: string
          valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "nr10_trainings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      padlock_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          id: string
          new_data: Json | null
          notes: string | null
          padlock_code: string
          padlock_id: string
          previous_data: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          notes?: string | null
          padlock_code: string
          padlock_id: string
          previous_data?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          notes?: string | null
          padlock_code?: string
          padlock_id?: string
          previous_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "padlock_events_padlock_id_fkey"
            columns: ["padlock_id"]
            isOneToOne: false
            referencedRelation: "padlocks"
            referencedColumns: ["id"]
          },
        ]
      }
      padlock_report_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          id: string
          notes: string | null
          padlock_code: string
          padlock_id: string
          report_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          padlock_code: string
          padlock_id: string
          report_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          padlock_code?: string
          padlock_id?: string
          report_id?: string
        }
        Relationships: []
      }
      padlock_reports: {
        Row: {
          created_at: string
          id: string
          message: string
          padlock_code: string
          padlock_id: string
          reporter_contact: string | null
          reporter_name: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_by_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          padlock_code: string
          padlock_id: string
          reporter_contact?: string | null
          reporter_name?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_by_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          padlock_code?: string
          padlock_id?: string
          reporter_contact?: string | null
          reporter_name?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_by_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      padlock_violations: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          document_path: string
          id: string
          reason: string
          requester: string
          sector: string
          violation_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          document_path: string
          id?: string
          reason: string
          requester: string
          sector: string
          violation_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          document_path?: string
          id?: string
          reason?: string
          requester?: string
          sector?: string
          violation_date?: string
        }
        Relationships: []
      }
      padlocks: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          applied_by_name: string | null
          cancellation_detail: string | null
          cancellation_reason: string | null
          cancelled: boolean
          cancelled_at: string | null
          cancelled_by: string | null
          code: string
          color: Database["public"]["Enums"]["padlock_color"]
          created_at: string
          created_by: string | null
          due_at: string | null
          id: string
          location: string | null
          notes: string | null
          number: number
          owner_name: string | null
          owner_phone: string | null
          owner_registration: string | null
          owner_role: string | null
          owner_sector: string | null
          reason: string | null
          status: Database["public"]["Enums"]["padlock_status"]
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          applied_by_name?: string | null
          cancellation_detail?: string | null
          cancellation_reason?: string | null
          cancelled?: boolean
          cancelled_at?: string | null
          cancelled_by?: string | null
          code: string
          color: Database["public"]["Enums"]["padlock_color"]
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          number: number
          owner_name?: string | null
          owner_phone?: string | null
          owner_registration?: string | null
          owner_role?: string | null
          owner_sector?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["padlock_status"]
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          applied_by_name?: string | null
          cancellation_detail?: string | null
          cancellation_reason?: string | null
          cancelled?: boolean
          cancelled_at?: string | null
          cancelled_by?: string | null
          code?: string
          color?: Database["public"]["Enums"]["padlock_color"]
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          number?: number
          owner_name?: string | null
          owner_phone?: string | null
          owner_registration?: string | null
          owner_role?: string | null
          owner_sector?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["padlock_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_authorizations: {
        Row: {
          abrangencia: string | null
          authorization_date: string | null
          created_at: string
          employee_id: string
          funcao: string | null
          id: string
          level: string
          updated_at: string
          valid: boolean
        }
        Insert: {
          abrangencia?: string | null
          authorization_date?: string | null
          created_at?: string
          employee_id: string
          funcao?: string | null
          id?: string
          level: string
          updated_at?: string
          valid?: boolean
        }
        Update: {
          abrangencia?: string | null
          authorization_date?: string | null
          created_at?: string
          employee_id?: string
          funcao?: string | null
          id?: string
          level?: string
          updated_at?: string
          valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "work_authorizations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      work_instructions: {
        Row: {
          code: string
          created_at: string
          id: string
          title: string | null
          updated_at: string
          validity_months: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          validity_months?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          validity_months?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "apoio"
      padlock_color: "azul" | "amarelo" | "latao" | "vermelho"
      padlock_status: "disponivel" | "aplicado"
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
      app_role: ["admin", "apoio"],
      padlock_color: ["azul", "amarelo", "latao", "vermelho"],
      padlock_status: ["disponivel", "aplicado"],
    },
  },
} as const
