import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  RtiArea, RtiNc, RtiNcEvidencia, RtiNcHistorico, RtiReport,
} from "./rti";

export const rtiKeys = {
  reports: ["rti_reports"] as const,
  areas: (reportId?: string) => ["rti_areas", reportId ?? "all"] as const,
  ncs: (reportId?: string) => ["rti_ncs", reportId ?? "all"] as const,
  nc: (id: string) => ["rti_nc", id] as const,
  evidencias: (ncId: string) => ["rti_nc_evidencias", ncId] as const,
  historico: (ncId: string) => ["rti_nc_historico", ncId] as const,
};

/** Busca paginada para contornar o limite de 1000 linhas por request. */
async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

// ── Relatórios ───────────────────────────────────────────────────────────────

export function useRtiReports() {
  return useQuery({
    queryKey: rtiKeys.reports,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rti_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RtiReport[];
    },
  });
}

export function useUpsertRtiReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<RtiReport, "id" | "created_at" | "updated_at"> & { id?: string },
    ) => {
      const { data, error } = await supabase
        .from("rti_reports")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as RtiReport;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: rtiKeys.reports }),
  });
}

export function useDeleteRtiReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => {
      // Remove arquivos de evidências do storage antes do cascade
      const ncs = await fetchAllRows<{ id: string }>((from, to) =>
        supabase.from("rti_ncs").select("id").eq("report_id", reportId).range(from, to),
      );
      if (ncs.length > 0) {
        const ncIds = ncs.map((n) => n.id);
        const paths: string[] = [];
        for (let i = 0; i < ncIds.length; i += 200) {
          const { data } = await supabase
            .from("rti_nc_evidencias")
            .select("file_path")
            .in("nc_id", ncIds.slice(i, i + 200));
          for (const e of data ?? []) paths.push(e.file_path);
        }
        for (let i = 0; i < paths.length; i += 100) {
          await supabase.storage.from("rti-evidencias").remove(paths.slice(i, i + 100));
        }
      }
      const { error } = await supabase.from("rti_reports").delete().eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ── Áreas ────────────────────────────────────────────────────────────────────

export function useRtiAreas(reportId?: string) {
  return useQuery({
    queryKey: rtiKeys.areas(reportId),
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rti_areas")
        .select("*")
        .eq("report_id", reportId!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data as RtiArea[];
    },
  });
}

export function useCreateRtiArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { report_id: string; nome: string; ordem: number }) => {
      const { data, error } = await supabase
        .from("rti_areas")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as RtiArea;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rti_areas"] }),
  });
}

// ── NCs ──────────────────────────────────────────────────────────────────────

export function useRtiNcs(reportId?: string) {
  return useQuery({
    queryKey: rtiKeys.ncs(reportId),
    enabled: !!reportId,
    queryFn: async () => {
      return fetchAllRows<RtiNc>((from, to) =>
        supabase
          .from("rti_ncs")
          .select("*")
          .eq("report_id", reportId!)
          .order("numero", { ascending: true })
          .range(from, to),
      );
    },
  });
}

/** Todas as NCs de todos os relatórios (visões agregadas: dossiê, conformidade). */
export function useAllRtiNcs() {
  return useQuery({
    queryKey: rtiKeys.ncs(),
    queryFn: async () => {
      return fetchAllRows<RtiNc>((from, to) =>
        supabase
          .from("rti_ncs")
          .select("*")
          .order("numero", { ascending: true })
          .range(from, to),
      );
    },
  });
}

export function useRtiNc(id?: string) {
  return useQuery({
    queryKey: rtiKeys.nc(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rti_ncs")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as RtiNc;
    },
  });
}

function invalidateNcs(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["rti_ncs"] });
  qc.invalidateQueries({ queryKey: ["rti_nc"] });
}

export function useCreateRtiNc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<RtiNc, "id" | "created_at" | "updated_at">,
    ) => {
      const { data, error } = await supabase
        .from("rti_ncs")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as RtiNc;
    },
    onSuccess: () => invalidateNcs(qc),
  });
}

export function useUpdateRtiNc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<RtiNc> & { id: string }) => {
      const { data, error } = await supabase
        .from("rti_ncs")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as RtiNc;
    },
    onSuccess: () => invalidateNcs(qc),
  });
}

export function useBulkUpdateRtiNcs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Partial<RtiNc> }) => {
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await supabase
          .from("rti_ncs")
          .update(patch)
          .in("id", ids.slice(i, i + 200));
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateNcs(qc),
  });
}

export function useDeleteRtiNc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ncId: string) => {
      const { data } = await supabase
        .from("rti_nc_evidencias")
        .select("file_path")
        .eq("nc_id", ncId);
      const paths = (data ?? []).map((e) => e.file_path);
      if (paths.length > 0) {
        await supabase.storage.from("rti-evidencias").remove(paths);
      }
      const { error } = await supabase.from("rti_ncs").delete().eq("id", ncId);
      if (error) throw error;
    },
    onSuccess: () => invalidateNcs(qc),
  });
}

// ── Evidências ───────────────────────────────────────────────────────────────

export function useRtiEvidencias(ncId?: string) {
  return useQuery({
    queryKey: rtiKeys.evidencias(ncId ?? ""),
    enabled: !!ncId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rti_nc_evidencias")
        .select("*")
        .eq("nc_id", ncId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RtiNcEvidencia[];
    },
  });
}

/** Contagem de evidências por NC do relatório (constatação/correção) — para a tabela do plano. */
export function useRtiEvidenciaIndex(reportId?: string) {
  return useQuery({
    queryKey: ["rti_nc_evidencias_index", reportId ?? "none"],
    enabled: !!reportId,
    queryFn: async () => {
      const rows = await fetchAllRows<{ nc_id: string; tipo: string }>((from, to) =>
        supabase
          .from("rti_nc_evidencias")
          .select("nc_id, tipo, rti_ncs!inner(report_id)")
          .eq("rti_ncs.report_id", reportId!)
          .range(from, to),
      );
      const index = new Map<string, { constatacao: number; correcao: number }>();
      for (const r of rows) {
        const entry = index.get(r.nc_id) ?? { constatacao: 0, correcao: 0 };
        if (r.tipo === "constatacao") entry.constatacao += 1;
        else entry.correcao += 1;
        index.set(r.nc_id, entry);
      }
      return index;
    },
  });
}

/** Nomes de arquivo já importados por NC/tipo (para deduplicar importação em massa). */
export function useRtiEvidenciaFileIndex(reportId?: string) {
  return useQuery({
    queryKey: ["rti_nc_evidencias_files", reportId ?? "none"],
    enabled: !!reportId,
    queryFn: async () => {
      const rows = await fetchAllRows<{ nc_id: string; tipo: string; file_name: string }>((from, to) =>
        supabase
          .from("rti_nc_evidencias")
          .select("nc_id, tipo, file_name, rti_ncs!inner(report_id)")
          .eq("rti_ncs.report_id", reportId!)
          .range(from, to),
      );
      return new Set(rows.map((r) => `${r.nc_id}|${r.tipo}|${r.file_name}`));
    },
  });
}

export function useAddRtiEvidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<RtiNcEvidencia, "id" | "created_at">,
    ) => {
      const { data, error } = await supabase
        .from("rti_nc_evidencias")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as RtiNcEvidencia;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: rtiKeys.evidencias(row.nc_id) });
      qc.invalidateQueries({ queryKey: ["rti_nc_evidencias_index"] });
    },
  });
}

export function useDeleteRtiEvidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ev: { id: string; nc_id: string; file_path: string }) => {
      await supabase.storage.from("rti-evidencias").remove([ev.file_path]);
      const { error } = await supabase.from("rti_nc_evidencias").delete().eq("id", ev.id);
      if (error) throw error;
      return ev;
    },
    onSuccess: (ev) => {
      qc.invalidateQueries({ queryKey: rtiKeys.evidencias(ev.nc_id) });
      qc.invalidateQueries({ queryKey: ["rti_nc_evidencias_index"] });
    },
  });
}

// ── Histórico ────────────────────────────────────────────────────────────────

export function useRtiHistorico(ncId?: string) {
  return useQuery({
    queryKey: rtiKeys.historico(ncId ?? ""),
    enabled: !!ncId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rti_nc_historico")
        .select("*")
        .eq("nc_id", ncId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RtiNcHistorico[];
    },
  });
}

export function useAddRtiHistorico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<RtiNcHistorico, "id" | "created_at">,
    ) => {
      const { data, error } = await supabase
        .from("rti_nc_historico")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as RtiNcHistorico;
    },
    onSuccess: (row) => qc.invalidateQueries({ queryKey: rtiKeys.historico(row.nc_id) }),
  });
}

/** Registra entradas em massa no histórico de várias NCs (uma entrada por NC). */
export async function logBulkHistorico(
  ncIds: string[],
  texto: string,
  autorNome: string | null,
  tipo: "comentario" | "alteracao" = "alteracao",
) {
  const rows = ncIds.map((nc_id) => ({ nc_id, tipo, texto, autor_nome: autorNome }));
  for (let i = 0; i < rows.length; i += 200) {
    await supabase.from("rti_nc_historico").insert(rows.slice(i, i + 200));
  }
}

// ── Arquivos (bucket rti-evidencias) ─────────────────────────────────────────

export async function uploadRtiFile(file: File, prefix = "evidencias"): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("rti-evidencias").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export function rtiFileUrl(path: string): string {
  const { data } = supabase.storage.from("rti-evidencias").getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Anexa um conjunto de arquivos a várias NCs de uma vez (ação em massa).
 * Cada arquivo é enviado uma vez por NC (cópia independente no storage), para
 * que a exclusão da evidência de uma NC não afete as demais.
 */
export async function bulkAttachRtiEvidencias({
  ncIds, files, tipo, descricao, autorNome, onProgress,
}: {
  ncIds: string[];
  files: File[];
  tipo: RtiNcEvidencia["tipo"];
  descricao: string | null;
  autorNome: string | null;
  onProgress?: (done: number, total: number) => void;
}) {
  const total = ncIds.length * files.length;
  let done = 0;
  for (const ncId of ncIds) {
    const rows: Omit<RtiNcEvidencia, "id" | "created_at">[] = [];
    for (const file of files) {
      const path = await uploadRtiFile(file);
      rows.push({
        nc_id: ncId,
        tipo,
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        descricao,
        created_by_name: autorNome,
      });
      done += 1;
      onProgress?.(done, total);
    }
    const { error } = await supabase.from("rti_nc_evidencias").insert(rows);
    if (error) throw error;
  }
}

// ── Importação em lote (planilha do plano de ação) ──────────────────────────

export type RtiImportNc = {
  numero: number;
  area: string;
  descricao: string;
  recomendacao: string | null;
  prioridade: number;
  responsavel: string | null;
  status: RtiNc["status"];
  progresso: number;
  prazo: string | null;
  tipo_execucao: RtiNc["tipo_execucao"];
  custo_planejado: number | null;
  custo_realizado: number | null;
  situacao_atual: string | null;
};

export type RtiImportPayload = {
  report: Omit<RtiReport, "id" | "created_at" | "updated_at" | "report_path" | "notes">;
  areas: { nome: string; ordem: number }[];
  ncs: RtiImportNc[];
  onProgress?: (done: number, total: number) => void;
};

export async function batchImportRti({ report, areas, ncs, onProgress }: RtiImportPayload) {
  // 1) Relatório
  const { data: rep, error: repErr } = await supabase
    .from("rti_reports")
    .insert(report)
    .select()
    .single();
  if (repErr) throw repErr;
  const reportId = (rep as RtiReport).id;

  // 2) Áreas
  const { data: areaRows, error: areaErr } = await supabase
    .from("rti_areas")
    .insert(areas.map((a) => ({ ...a, report_id: reportId })))
    .select();
  if (areaErr) throw areaErr;
  const areaIdByNome = new Map((areaRows as RtiArea[]).map((a) => [a.nome, a.id]));

  // 3) NCs em lotes
  const rows = ncs.map((nc) => ({
    report_id: reportId,
    area_id: areaIdByNome.get(nc.area)!,
    numero: nc.numero,
    descricao: nc.descricao,
    recomendacao: nc.recomendacao,
    prioridade: nc.prioridade,
    responsavel: nc.responsavel,
    status: nc.status,
    progresso: nc.progresso,
    prazo: nc.prazo,
    tipo_execucao: nc.tipo_execucao,
    custo_planejado: nc.custo_planejado,
    custo_realizado: nc.custo_realizado,
    situacao_atual: nc.situacao_atual,
    concluida_em: null,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase
      .from("rti_ncs")
      .upsert(chunk, { onConflict: "report_id,numero", ignoreDuplicates: true });
    if (error) throw error;
    onProgress?.(Math.min(i + 200, rows.length), rows.length);
  }

  return reportId;
}
