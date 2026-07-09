// Trilha A — React Query + Supabase dos modelos de estrutura.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { bulkCreateNodes } from "@/lib/campo-queries";
import { linhasFromArvore, type ArvoreNo } from "@/lib/estrutura-modelos";

export interface EstruturaModelo {
  id: string;
  nome: string;
  segmento: string;
  descricao: string | null;
  arvore: ArvoreNo[];
  publicado: boolean;
  origem_inspecao_id: string | null;
  created_at: string;
  updated_at: string;
}

const parse = (row: Record<string, unknown>): EstruturaModelo =>
  ({ ...row, arvore: (row.arvore ?? []) as ArvoreNo[] }) as EstruturaModelo;

/** Modelos publicados de um segmento (consumo na criação de inspeção). */
export function useModelosDoSegmento(segmento?: string | null) {
  return useQuery({
    queryKey: ["estrutura_modelos", "segmento", segmento?.trim().toLowerCase() ?? "none"],
    enabled: !!segmento?.trim(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estrutura_modelos")
        .select("*")
        .eq("publicado", true)
        .ilike("segmento", segmento!.trim())
        .order("nome");
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map(parse);
    },
  });
}

/** Todos os modelos (painel de curadoria — platform admin enxerga rascunhos via RLS). */
export function useModelosAdmin() {
  return useQuery({
    queryKey: ["estrutura_modelos", "admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estrutura_modelos")
        .select("*")
        .order("segmento")
        .order("nome");
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map(parse);
    },
  });
}

/** Segmentos distintos (autocomplete): dos modelos + inspeções visíveis. */
export function useSegmentosExistentes() {
  return useQuery({
    queryKey: ["segmentos_existentes"],
    queryFn: async () => {
      const set = new Set<string>();
      const { data: modelos } = await supabase.from("estrutura_modelos").select("segmento");
      for (const m of (modelos ?? []) as { segmento: string }[]) {
        if (m.segmento?.trim()) set.add(m.segmento.trim());
      }
      const { data: insps } = await supabase
        .from("field_inspections")
        .select("segmento")
        .not("segmento", "is", null);
      for (const i of (insps ?? []) as { segmento: string | null }[]) {
        if (i.segmento?.trim()) set.add(i.segmento.trim());
      }
      return [...set].sort((a, b) => a.localeCompare(b));
    },
  });
}

/** Estruturas candidatas à curadoria: inspeções com contagem de nós (platform admin). */
export function useEstruturasParaCurar() {
  return useQuery({
    queryKey: ["estruturas_para_curar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_inspections")
        .select("id, titulo, cliente, segmento, org_id, created_at, field_nodes(id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      type Raw = {
        id: string;
        titulo: string;
        cliente: string | null;
        segmento: string | null;
        org_id: string | null;
        created_at: string;
        field_nodes: { id: string }[];
      };
      return ((data ?? []) as unknown as Raw[])
        .map((r) => ({ ...r, nos: r.field_nodes?.length ?? 0 }))
        .filter((r) => r.nos > 0);
    },
  });
}

/** Nós de uma inspeção (para montar a árvore no editor de promoção). */
export function useNodesDaInspecao(inspectionId?: string) {
  return useQuery({
    queryKey: ["field_nodes_curadoria", inspectionId ?? "none"],
    enabled: !!inspectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_nodes")
        .select("id, parent_id, nivel, nome, ordem")
        .eq("inspection_id", inspectionId!)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        parent_id: string | null;
        nivel: string;
        nome: string;
        ordem: number;
      }[];
    },
  });
}

export function useSaveModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: {
      id?: string;
      nome: string;
      segmento: string;
      descricao: string | null;
      arvore: ArvoreNo[];
      publicado: boolean;
      origem_inspecao_id?: string | null;
    }) => {
      const payload = {
        nome: m.nome,
        segmento: m.segmento,
        descricao: m.descricao,
        arvore: m.arvore as never,
        publicado: m.publicado,
        origem_inspecao_id: m.origem_inspecao_id ?? null,
      };
      if (m.id) {
        const { error } = await supabase
          .from("estrutura_modelos")
          .update(payload as never)
          .eq("id", m.id);
        if (error) throw error;
        return m.id;
      }
      const { data, error } = await supabase
        .from("estrutura_modelos")
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estrutura_modelos"] });
      qc.invalidateQueries({ queryKey: ["segmentos_existentes"] });
    },
  });
}

export function useSetPublicado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; publicado: boolean }) => {
      const { error } = await supabase
        .from("estrutura_modelos")
        .update({ publicado: args.publicado } as never)
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estrutura_modelos"] }),
  });
}

export function useDeleteModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estrutura_modelos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estrutura_modelos"] }),
  });
}

/** Aplicar = copiar (D-A5): expande a árvore em field_nodes novos; soma, nunca substitui. */
export async function aplicarModelo(inspectionId: string, arvore: ArvoreNo[]): Promise<number> {
  return bulkCreateNodes(inspectionId, linhasFromArvore(arvore));
}
