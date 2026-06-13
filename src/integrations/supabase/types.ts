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
      asos: {
        Row: {
          apto_eletricidade: boolean
          created_at: string
          created_by_name: string | null
          employee_id: string
          exam_date: string
          file_path: string | null
          id: string
          medico: string | null
          notes: string | null
          restricoes: string | null
          resultado: string
          tipo: string
          updated_at: string
          validity_date: string
        }
        Insert: {
          apto_eletricidade?: boolean
          created_at?: string
          created_by_name?: string | null
          employee_id: string
          exam_date: string
          file_path?: string | null
          id?: string
          medico?: string | null
          notes?: string | null
          restricoes?: string | null
          resultado?: string
          tipo?: string
          updated_at?: string
          validity_date: string
        }
        Update: {
          apto_eletricidade?: boolean
          created_at?: string
          created_by_name?: string | null
          employee_id?: string
          exam_date?: string
          file_path?: string | null
          id?: string
          medico?: string | null
          notes?: string | null
          restricoes?: string | null
          resultado?: string
          tipo?: string
          updated_at?: string
          validity_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "asos_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      compliance_snapshots: {
        Row: {
          created_at: string
          id: string
          payload: Json
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          snapshot_date: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          snapshot_date?: string
        }
        Relationships: []
      }
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
      electrical_incidents: {
        Row: {
          acoes_tomadas: string | null
          causa_raiz: string | null
          created_at: string
          created_by_name: string | null
          descricao: string
          envolvidos: string | null
          file_path: string | null
          gravidade: string
          id: string
          local: string | null
          occurred_at: string
          setor: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          acoes_tomadas?: string | null
          causa_raiz?: string | null
          created_at?: string
          created_by_name?: string | null
          descricao: string
          envolvidos?: string | null
          file_path?: string | null
          gravidade?: string
          id?: string
          local?: string | null
          occurred_at: string
          setor?: string | null
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          acoes_tomadas?: string | null
          causa_raiz?: string | null
          created_at?: string
          created_by_name?: string | null
          descricao?: string
          envolvidos?: string | null
          file_path?: string | null
          gravidade?: string
          id?: string
          local?: string | null
          occurred_at?: string
          setor?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean
          afastado_desde: string | null
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
          reciclagem_motivo: string | null
          reciclagem_requerida: boolean
          retorno_em: string | null
          setor: string | null
          status: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          afastado_desde?: string | null
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
          reciclagem_motivo?: string | null
          reciclagem_requerida?: boolean
          retorno_em?: string | null
          setor?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          afastado_desde?: string | null
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
          reciclagem_motivo?: string | null
          reciclagem_requerida?: boolean
          retorno_em?: string | null
          setor?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      epi_tests: {
        Row: {
          certificate_path: string | null
          created_at: string
          epi_id: string
          id: string
          laboratory: string | null
          notes: string | null
          result: string
          test_date: string
        }
        Insert: {
          certificate_path?: string | null
          created_at?: string
          epi_id: string
          id?: string
          laboratory?: string | null
          notes?: string | null
          result?: string
          test_date: string
        }
        Update: {
          certificate_path?: string | null
          created_at?: string
          epi_id?: string
          id?: string
          laboratory?: string | null
          notes?: string | null
          result?: string
          test_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_tests_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "epis"
            referencedColumns: ["id"]
          },
        ]
      }
      epis: {
        Row: {
          acquisition_date: string | null
          active: boolean
          ca: string | null
          created_at: string
          description: string | null
          employee_id: string | null
          epi_class: string | null
          epi_type: string
          id: string
          notes: string | null
          sector: string | null
          serial_number: string | null
          test_interval_months: number
          updated_at: string
        }
        Insert: {
          acquisition_date?: string | null
          active?: boolean
          ca?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string | null
          epi_class?: string | null
          epi_type: string
          id?: string
          notes?: string | null
          sector?: string | null
          serial_number?: string | null
          test_interval_months?: number
          updated_at?: string
        }
        Update: {
          acquisition_date?: string | null
          active?: boolean
          ca?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string | null
          epi_class?: string | null
          epi_type?: string
          id?: string
          notes?: string | null
          sector?: string | null
          serial_number?: string | null
          test_interval_months?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epis_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      field_findings: {
        Row: {
          created_at: string
          descricao: string
          id: string
          modo_falha_id: string | null
          observacao: string | null
          point_id: string
          prioridade: number
          recomendacao: string | null
          tipo_execucao: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          modo_falha_id?: string | null
          observacao?: string | null
          point_id: string
          prioridade?: number
          recomendacao?: string | null
          tipo_execucao?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          modo_falha_id?: string | null
          observacao?: string | null
          point_id?: string
          prioridade?: number
          recomendacao?: string | null
          tipo_execucao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_findings_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "field_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_findings_modo_falha_id_fkey"
            columns: ["modo_falha_id"]
            isOneToOne: false
            referencedRelation: "rti_modos_falha"
            referencedColumns: ["id"]
          },
        ]
      }
      field_inspections: {
        Row: {
          cliente: string | null
          created_at: string
          created_by_name: string | null
          data_inspecao: string
          engenheiro: string | null
          id: string
          local: string | null
          notes: string | null
          report_id: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          cliente?: string | null
          created_at?: string
          created_by_name?: string | null
          data_inspecao?: string
          engenheiro?: string | null
          id?: string
          local?: string | null
          notes?: string | null
          report_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          cliente?: string | null
          created_at?: string
          created_by_name?: string | null
          data_inspecao?: string
          engenheiro?: string | null
          id?: string
          local?: string | null
          notes?: string | null
          report_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_inspections_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "rti_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      field_nodes: {
        Row: {
          created_at: string
          id: string
          inspection_id: string
          nivel: string
          nome: string
          ordem: number
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspection_id: string
          nivel: string
          nome: string
          ordem?: number
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          inspection_id?: string
          nivel?: string
          nome?: string
          ordem?: number
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_nodes_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "field_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "field_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      field_photos: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          legenda: string | null
          ordem: number
          point_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          legenda?: string | null
          ordem?: number
          point_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          legenda?: string | null
          ordem?: number
          point_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_photos_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "field_points"
            referencedColumns: ["id"]
          },
        ]
      }
      field_points: {
        Row: {
          created_at: string
          id: string
          inspection_id: string
          node_id: string
          observacoes: string | null
          ordem: number
          titulo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspection_id: string
          node_id: string
          observacoes?: string | null
          ordem?: number
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          inspection_id?: string
          node_id?: string
          observacoes?: string | null
          ordem?: number
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_points_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "field_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_points_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "field_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_actions: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          inspection_id: string
          responsible: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          inspection_id: string
          responsible?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          inspection_id?: string
          responsible?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_actions_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          art: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          equipment: string
          id: string
          inspection_date: string
          inspection_type: string
          notes: string | null
          report_path: string | null
          responsavel: string | null
          result: string
          sector: string | null
          updated_at: string
          validity_date: string | null
        }
        Insert: {
          art?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          equipment: string
          id?: string
          inspection_date: string
          inspection_type: string
          notes?: string | null
          report_path?: string | null
          responsavel?: string | null
          result?: string
          sector?: string | null
          updated_at?: string
          validity_date?: string | null
        }
        Update: {
          art?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          equipment?: string
          id?: string
          inspection_date?: string
          inspection_type?: string
          notes?: string | null
          report_path?: string | null
          responsavel?: string | null
          result?: string
          sector?: string | null
          updated_at?: string
          validity_date?: string | null
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
      nr10_documents: {
        Row: {
          art: string | null
          category: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          description: string | null
          document_date: string | null
          file_path: string | null
          id: string
          responsavel: string | null
          title: string
          updated_at: string
          validity_date: string | null
        }
        Insert: {
          art?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          document_date?: string | null
          file_path?: string | null
          id?: string
          responsavel?: string | null
          title: string
          updated_at?: string
          validity_date?: string | null
        }
        Update: {
          art?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          document_date?: string | null
          file_path?: string | null
          id?: string
          responsavel?: string | null
          title?: string
          updated_at?: string
          validity_date?: string | null
        }
        Relationships: []
      }
      nr10_document_versions: {
        Row: {
          created_at: string
          document_date: string | null
          document_id: string
          file_name: string | null
          file_path: string
          id: string
          replaced_by_name: string | null
          validity_date: string | null
        }
        Insert: {
          created_at?: string
          document_date?: string | null
          document_id: string
          file_name?: string | null
          file_path: string
          id?: string
          replaced_by_name?: string | null
          validity_date?: string | null
        }
        Update: {
          created_at?: string
          document_date?: string | null
          document_id?: string
          file_name?: string | null
          file_path?: string
          id?: string
          replaced_by_name?: string | null
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nr10_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "nr10_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      nr10_trainings: {
        Row: {
          art: string | null
          carga_horaria: number | null
          category: string
          conteudo_programatico: string | null
          created_at: string
          employee_id: string
          entidade: string | null
          id: string
          instrutor: string | null
          responsavel_tecnico: string | null
          training_date: string | null
          training_type: string
          updated_at: string
          valid: boolean
        }
        Insert: {
          art?: string | null
          carga_horaria?: number | null
          category: string
          conteudo_programatico?: string | null
          created_at?: string
          employee_id: string
          entidade?: string | null
          id?: string
          instrutor?: string | null
          responsavel_tecnico?: string | null
          training_date?: string | null
          training_type: string
          updated_at?: string
          valid?: boolean
        }
        Update: {
          art?: string | null
          carga_horaria?: number | null
          category?: string
          conteudo_programatico?: string | null
          created_at?: string
          employee_id?: string
          entidade?: string | null
          id?: string
          instrutor?: string | null
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
      rti_areas: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          report_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          report_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rti_areas_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "rti_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      rti_modos_falha: {
        Row: {
          ativo: boolean
          categoria: string
          codigo: string
          created_at: string
          descricao_padrao: string
          id: string
          label: string
          normas: Json
          ordem: number
          prioridade_sugerida: number
          recomendacao_padrao: string | null
          tipo_execucao_sugerido: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          codigo: string
          created_at?: string
          descricao_padrao: string
          id?: string
          label: string
          normas?: Json
          ordem?: number
          prioridade_sugerida?: number
          recomendacao_padrao?: string | null
          tipo_execucao_sugerido?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          codigo?: string
          created_at?: string
          descricao_padrao?: string
          id?: string
          label?: string
          normas?: Json
          ordem?: number
          prioridade_sugerida?: number
          recomendacao_padrao?: string | null
          tipo_execucao_sugerido?: string
          updated_at?: string
        }
        Relationships: []
      }
      rti_nc_evidencias: {
        Row: {
          created_at: string
          created_by_name: string | null
          descricao: string | null
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          nc_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          created_by_name?: string | null
          descricao?: string | null
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          nc_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          created_by_name?: string | null
          descricao?: string | null
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          nc_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rti_nc_evidencias_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "rti_ncs"
            referencedColumns: ["id"]
          },
        ]
      }
      rti_nc_historico: {
        Row: {
          autor_nome: string | null
          created_at: string
          id: string
          nc_id: string
          texto: string
          tipo: string
        }
        Insert: {
          autor_nome?: string | null
          created_at?: string
          id?: string
          nc_id: string
          texto: string
          tipo?: string
        }
        Update: {
          autor_nome?: string | null
          created_at?: string
          id?: string
          nc_id?: string
          texto?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rti_nc_historico_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "rti_ncs"
            referencedColumns: ["id"]
          },
        ]
      }
      rti_ncs: {
        Row: {
          area_id: string
          concluida_em: string | null
          created_at: string
          custo_planejado: number | null
          custo_realizado: number | null
          descricao: string
          finding_id: string | null
          id: string
          numero: number
          os_numero: string | null
          prazo: string | null
          prioridade: number
          progresso: number
          recomendacao: string | null
          report_id: string
          responsavel: string | null
          situacao_atual: string | null
          status: string
          tipo_execucao: string
          updated_at: string
        }
        Insert: {
          area_id: string
          concluida_em?: string | null
          created_at?: string
          custo_planejado?: number | null
          custo_realizado?: number | null
          descricao: string
          finding_id?: string | null
          id?: string
          numero: number
          os_numero?: string | null
          prazo?: string | null
          prioridade?: number
          progresso?: number
          recomendacao?: string | null
          report_id: string
          responsavel?: string | null
          situacao_atual?: string | null
          status?: string
          tipo_execucao?: string
          updated_at?: string
        }
        Update: {
          area_id?: string
          concluida_em?: string | null
          created_at?: string
          custo_planejado?: number | null
          custo_realizado?: number | null
          descricao?: string
          finding_id?: string | null
          id?: string
          numero?: number
          os_numero?: string | null
          prazo?: string | null
          prioridade?: number
          progresso?: number
          recomendacao?: string | null
          report_id?: string
          responsavel?: string | null
          situacao_atual?: string | null
          status?: string
          tipo_execucao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rti_ncs_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "rti_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rti_ncs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "rti_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      rti_reports: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          empresa_auditora: string | null
          id: string
          notes: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          report_path: string | null
          responsavel_auditoria: string | null
          responsavel_plano: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          empresa_auditora?: string | null
          id?: string
          notes?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          report_path?: string | null
          responsavel_auditoria?: string | null
          responsavel_plano?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          empresa_auditora?: string | null
          id?: string
          notes?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          report_path?: string | null
          responsavel_auditoria?: string | null
          responsavel_plano?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_certificates: {
        Row: {
          id: string; employee_id: string; nr10_training_id: string | null;
          training_type: string | null; category: string | null;
          file_url: string; file_name: string | null; issue_date: string | null;
          source_file: string | null; pages_in_source: string | null;
          uploaded_at: string; created_at: string;
        };
        Insert: {
          id?: string; employee_id: string; nr10_training_id?: string | null;
          training_type?: string | null; category?: string | null;
          file_url: string; file_name?: string | null; issue_date?: string | null;
          source_file?: string | null; pages_in_source?: string | null;
          uploaded_at?: string; created_at?: string;
        };
        Update: Partial<{
          nr10_training_id: string | null; training_type: string | null;
          category: string | null; file_url: string; file_name: string | null;
          issue_date: string | null; source_file: string | null; pages_in_source: string | null;
        }>;
        Relationships: [];
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
          is_current: boolean
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
          is_current?: boolean
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
          is_current?: boolean
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
