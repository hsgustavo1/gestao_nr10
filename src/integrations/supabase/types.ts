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
          org_id: string
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
          org_id: string
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
          org_id?: string
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
          {
            foreignKeyName: "asos_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_snapshots: {
        Row: {
          created_at: string
          id: string
          org_id: string
          payload: Json
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          payload: Json
          snapshot_date: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          payload?: Json
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_snapshots_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          org_id: string
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
          org_id: string
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
          org_id?: string
          setor?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "electrical_incidents_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          afastado_desde: string | null
          classificacao: string | null
          crea_cft: string | null
          created_at: string
          created_by_org_id: string | null
          diploma: string | null
          diploma_conclusao: string | null
          escolaridade: string | null
          funcao: string | null
          id: string
          matricula: string
          name: string
          org_id: string
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
          crea_cft?: string | null
          created_at?: string
          created_by_org_id?: string | null
          diploma?: string | null
          diploma_conclusao?: string | null
          escolaridade?: string | null
          funcao?: string | null
          id?: string
          matricula: string
          name: string
          org_id: string
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
          crea_cft?: string | null
          created_at?: string
          created_by_org_id?: string | null
          diploma?: string | null
          diploma_conclusao?: string | null
          escolaridade?: string | null
          funcao?: string | null
          id?: string
          matricula?: string
          name?: string
          org_id?: string
          reciclagem_motivo?: string | null
          reciclagem_requerida?: boolean
          retorno_em?: string | null
          setor?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_created_by_org_id_fkey"
            columns: ["created_by_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_tests: {
        Row: {
          certificate_path: string | null
          created_at: string
          epi_id: string
          id: string
          laboratory: string | null
          notes: string | null
          org_id: string
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
          org_id: string
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
          org_id?: string
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
          {
            foreignKeyName: "epi_tests_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string
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
          org_id: string
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
          org_id?: string
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
          {
            foreignKeyName: "epis_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string
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
          org_id: string
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
          org_id?: string
          point_id?: string
          prioridade?: number
          recomendacao?: string | null
          tipo_execucao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_findings_modo_falha_id_fkey"
            columns: ["modo_falha_id"]
            isOneToOne: false
            referencedRelation: "rti_modos_falha"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_findings_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_findings_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "field_points"
            referencedColumns: ["id"]
          },
        ]
      }
      field_inspections: {
        Row: {
          arquivada_campo: boolean
          cliente: string | null
          created_at: string
          created_by_name: string | null
          created_by_org_id: string | null
          data_inspecao: string
          engenheiro: string | null
          entregue_em: string | null
          entregue_por_org: string | null
          id: string
          local: string | null
          notes: string | null
          org_id: string
          report_id: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          arquivada_campo?: boolean
          cliente?: string | null
          created_at?: string
          created_by_name?: string | null
          created_by_org_id?: string | null
          data_inspecao?: string
          engenheiro?: string | null
          entregue_em?: string | null
          entregue_por_org?: string | null
          id?: string
          local?: string | null
          notes?: string | null
          org_id: string
          report_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          arquivada_campo?: boolean
          cliente?: string | null
          created_at?: string
          created_by_name?: string | null
          created_by_org_id?: string | null
          data_inspecao?: string
          engenheiro?: string | null
          entregue_em?: string | null
          entregue_por_org?: string | null
          id?: string
          local?: string | null
          notes?: string | null
          org_id?: string
          report_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_inspections_created_by_org_id_fkey"
            columns: ["created_by_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_inspections_entregue_por_org_fkey"
            columns: ["entregue_por_org"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_inspections_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          org_id: string
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
          org_id: string
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
          org_id?: string
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
            foreignKeyName: "field_nodes_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string
          point_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          legenda?: string | null
          ordem?: number
          org_id: string
          point_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          legenda?: string | null
          ordem?: number
          org_id?: string
          point_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_photos_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          org_id: string
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
          org_id: string
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
          org_id?: string
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
          {
            foreignKeyName: "field_points_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string
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
          org_id: string
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
          org_id?: string
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
          {
            foreignKeyName: "inspection_actions_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string
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
          org_id: string
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
          org_id?: string
          report_path?: string | null
          responsavel?: string | null
          result?: string
          sector?: string | null
          updated_at?: string
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      it_trainings: {
        Row: {
          conclusao_date: string | null
          created_at: string
          employee_id: string
          id: string
          instruction_id: string
          org_id: string
          status: string
          updated_at: string
        }
        Insert: {
          conclusao_date?: string | null
          created_at?: string
          employee_id: string
          id?: string
          instruction_id: string
          org_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          conclusao_date?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          instruction_id?: string
          org_id?: string
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
          {
            foreignKeyName: "it_trainings_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nr10_document_versions: {
        Row: {
          created_at: string
          document_date: string | null
          document_id: string
          file_name: string | null
          file_path: string
          id: string
          org_id: string
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
          org_id: string
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
          org_id?: string
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
          {
            foreignKeyName: "nr10_document_versions_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string
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
          org_id: string
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
          org_id?: string
          responsavel?: string | null
          title?: string
          updated_at?: string
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nr10_documents_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nr10_trainings: {
        Row: {
          art: string | null
          art_arquivo_url: string | null
          carga_horaria: number | null
          category: string
          conteudo_programatico: string | null
          created_at: string
          employee_id: string
          entidade: string | null
          id: string
          instrutor: string | null
          org_id: string
          responsavel_tecnico: string | null
          training_date: string | null
          training_type: string
          updated_at: string
          valid: boolean
        }
        Insert: {
          art?: string | null
          art_arquivo_url?: string | null
          carga_horaria?: number | null
          category: string
          conteudo_programatico?: string | null
          created_at?: string
          employee_id: string
          entidade?: string | null
          id?: string
          instrutor?: string | null
          org_id: string
          responsavel_tecnico?: string | null
          training_date?: string | null
          training_type: string
          updated_at?: string
          valid?: boolean
        }
        Update: {
          art?: string | null
          art_arquivo_url?: string | null
          carga_horaria?: number | null
          category?: string
          conteudo_programatico?: string | null
          created_at?: string
          employee_id?: string
          entidade?: string | null
          id?: string
          instrutor?: string | null
          org_id?: string
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
          {
            foreignKeyName: "nr10_trainings_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_entitlements: {
        Row: {
          created_at: string
          module: string
          org_id: string
        }
        Insert: {
          created_at?: string
          module: string
          org_id: string
        }
        Update: {
          created_at?: string
          module?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_entitlements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          org_role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          org_role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          org_role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_public_tokens: {
        Row: {
          created_at: string
          org_id: string
          token: string
        }
        Insert: {
          created_at?: string
          org_id: string
          token?: string
        }
        Update: {
          created_at?: string
          org_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_public_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          ativa: boolean
          created_at: string
          id: string
          is_root: boolean
          managed_by_org_id: string | null
          nome: string
          parent_org_id: string | null
          tipo: Database["public"]["Enums"]["org_tipo"]
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          id?: string
          is_root?: boolean
          managed_by_org_id?: string | null
          nome: string
          parent_org_id?: string | null
          tipo?: Database["public"]["Enums"]["org_tipo"]
        }
        Update: {
          ativa?: boolean
          created_at?: string
          id?: string
          is_root?: boolean
          managed_by_org_id?: string | null
          nome?: string
          parent_org_id?: string | null
          tipo?: Database["public"]["Enums"]["org_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "organizations_managed_by_org_id_fkey"
            columns: ["managed_by_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string
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
          org_id: string
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
          org_id?: string
          padlock_code?: string
          padlock_id?: string
          previous_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "padlock_events_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          org_id: string
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
          org_id: string
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
          org_id?: string
          padlock_code?: string
          padlock_id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "padlock_report_events_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      padlock_reports: {
        Row: {
          created_at: string
          id: string
          message: string
          org_id: string
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
          org_id: string
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
          org_id?: string
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
        Relationships: [
          {
            foreignKeyName: "padlock_reports_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      padlock_violations: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          document_path: string
          id: string
          org_id: string
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
          org_id: string
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
          org_id?: string
          reason?: string
          requester?: string
          sector?: string
          violation_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "padlock_violations_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          org_id: string
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
          org_id: string
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
          org_id?: string
          owner_name?: string | null
          owner_phone?: string | null
          owner_registration?: string | null
          owner_role?: string | null
          owner_sector?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["padlock_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "padlocks_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
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
          entregue_em: string | null
          entregue_por_org: string | null
          id: string
          nome: string
          ordem: number
          org_id: string
          report_id: string
        }
        Insert: {
          created_at?: string
          entregue_em?: string | null
          entregue_por_org?: string | null
          id?: string
          nome: string
          ordem?: number
          org_id: string
          report_id: string
        }
        Update: {
          created_at?: string
          entregue_em?: string | null
          entregue_por_org?: string | null
          id?: string
          nome?: string
          ordem?: number
          org_id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rti_areas_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          org_id: string
          prioridade_sugerida: number
          publico: boolean
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
          org_id: string
          prioridade_sugerida?: number
          publico?: boolean
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
          org_id?: string
          prioridade_sugerida?: number
          publico?: boolean
          recomendacao_padrao?: string | null
          tipo_execucao_sugerido?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rti_modos_falha_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rti_nc_evidencias: {
        Row: {
          created_at: string
          created_by_name: string | null
          descricao: string | null
          entregue_em: string | null
          entregue_por_org: string | null
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          nc_id: string
          org_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          created_by_name?: string | null
          descricao?: string | null
          entregue_em?: string | null
          entregue_por_org?: string | null
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          nc_id: string
          org_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          created_by_name?: string | null
          descricao?: string | null
          entregue_em?: string | null
          entregue_por_org?: string | null
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          nc_id?: string
          org_id?: string
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
          {
            foreignKeyName: "rti_nc_evidencias_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string
          texto: string
          tipo: string
        }
        Insert: {
          autor_nome?: string | null
          created_at?: string
          id?: string
          nc_id: string
          org_id: string
          texto: string
          tipo?: string
        }
        Update: {
          autor_nome?: string | null
          created_at?: string
          id?: string
          nc_id?: string
          org_id?: string
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
          {
            foreignKeyName: "rti_nc_historico_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          entregue_em: string | null
          entregue_por_org: string | null
          finding_id: string | null
          id: string
          numero: number
          org_id: string
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
          entregue_em?: string | null
          entregue_por_org?: string | null
          finding_id?: string | null
          id?: string
          numero: number
          org_id: string
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
          entregue_em?: string | null
          entregue_por_org?: string | null
          finding_id?: string | null
          id?: string
          numero?: number
          org_id?: string
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
            foreignKeyName: "rti_ncs_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "field_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rti_ncs_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          created_by_org_id: string | null
          empresa_auditora: string | null
          entregue_em: string | null
          entregue_por_org: string | null
          id: string
          notes: string | null
          org_id: string
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
          created_by_org_id?: string | null
          empresa_auditora?: string | null
          entregue_em?: string | null
          entregue_por_org?: string | null
          id?: string
          notes?: string | null
          org_id: string
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
          created_by_org_id?: string | null
          empresa_auditora?: string | null
          entregue_em?: string | null
          entregue_por_org?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          report_path?: string | null
          responsavel_auditoria?: string | null
          responsavel_plano?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rti_reports_created_by_org_id_fkey"
            columns: ["created_by_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rti_reports_entregue_por_org_fkey"
            columns: ["entregue_por_org"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rti_reports_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rti_snapshots: {
        Row: {
          created_at: string
          id: string
          org_id: string
          payload: Json
          report_id: string
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          payload: Json
          report_id: string
          snapshot_date: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          payload?: Json
          report_id?: string
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "rti_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rti_snapshots_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "rti_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      seal_policy: {
        Row: {
          allow_delete: boolean
          frozen_columns: string[]
          row_filter: string | null
          table_name: string
        }
        Insert: {
          allow_delete?: boolean
          frozen_columns?: string[]
          row_filter?: string | null
          table_name: string
        }
        Update: {
          allow_delete?: boolean
          frozen_columns?: string[]
          row_filter?: string | null
          table_name?: string
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
          is_current: boolean
          level: string
          org_id: string
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
          org_id: string
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
          org_id?: string
          updated_at?: string
          valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "work_authorizations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_authorizations_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_instructions: {
        Row: {
          code: string
          created_at: string
          id: string
          org_id: string
          title: string | null
          updated_at: string
          validity_months: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          org_id: string
          title?: string | null
          updated_at?: string
          validity_months?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          org_id?: string
          title?: string | null
          updated_at?: string
          validity_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_instructions_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_org: {
        Args: { _org_id: string; _uid: string }
        Returns: boolean
      }
      can_publish_modo_falha: { Args: never; Returns: boolean }
      can_write_modo_falha: { Args: { _org_id: string }; Returns: boolean }
      fn_can_bypass_seal: {
        Args: { _entregue_por_org: string; _row_org: string; _uid: string }
        Returns: boolean
      }
      fn_capture_rti_snapshots: { Args: { _data?: string }; Returns: number }
      fn_create_org: {
        Args: {
          p_entitlements: string[]
          p_managed_by: string
          p_nome: string
          p_parent: string
          p_tipo: Database["public"]["Enums"]["org_tipo"]
        }
        Returns: string
      }
      fn_creator_org: { Args: { _uid: string }; Returns: string }
      fn_delete_org: { Args: { p_org: string }; Returns: undefined }
      fn_delivery_visible: {
        Args: {
          _created_by_org: string
          _entregue_em: string
          _org_id: string
          _uid: string
        }
        Returns: boolean
      }
      fn_employee_editable: {
        Args: { _employee_id: string; _uid: string }
        Returns: boolean
      }
      fn_entregar_inspecao: {
        Args: { _entregue_por_org: string; _inspection_id: string }
        Returns: undefined
      }
      fn_entregar_rti_report: {
        Args: { _entregue_por_org: string; _report_id: string }
        Returns: undefined
      }
      fn_inspection_delivery_visible: {
        Args: { _inspection_id: string; _uid: string }
        Returns: boolean
      }
      fn_nc_delivery_visible: {
        Args: { _nc_id: string; _uid: string }
        Returns: boolean
      }
      fn_org_is_manager: {
        Args: { _org_id: string; _uid: string }
        Returns: boolean
      }
      fn_point_delivery_visible: {
        Args: { _point_id: string; _uid: string }
        Returns: boolean
      }
      fn_report_delivery_visible: {
        Args: { _report_id: string; _uid: string }
        Returns: boolean
      }
      fn_set_org_active: {
        Args: { p_ativa: boolean; p_org: string }
        Returns: undefined
      }
      fn_set_org_entitlements: {
        Args: { p_entitlements: string[]; p_org: string }
        Returns: undefined
      }
      fn_update_org: {
        Args: {
          p_managed_by: string
          p_nome: string
          p_org: string
          p_parent: string
        }
        Returns: undefined
      }
      has_entitlement: {
        Args: { _module: string; _org_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: { _uid: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      org_role_at_least: {
        Args: {
          _min: Database["public"]["Enums"]["org_role"]
          _org_id: string
          _uid: string
        }
        Returns: boolean
      }
      org_role_rank: {
        Args: { _role: Database["public"]["Enums"]["org_role"] }
        Returns: number
      }
      shares_org: { Args: { _a: string; _b: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "apoio"
      org_role: "viewer" | "member" | "admin" | "owner"
      org_tipo: "consultoria" | "cliente" | "unidade"
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
      org_role: ["viewer", "member", "admin", "owner"],
      org_tipo: ["consultoria", "cliente", "unidade"],
      padlock_color: ["azul", "amarelo", "latao", "vermelho"],
      padlock_status: ["disponivel", "aplicado"],
    },
  },
} as const
