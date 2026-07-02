import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { resizeImage } from "@/lib/campo";
import { mensagemUploadAmigavel, removerArquivosOrfaos } from "@/lib/upload";
import type { RtiArea, RtiNc, RtiNcEvidencia, RtiNcHistorico, RtiReport } from "./rti";
import type { RtiSnapshotRow } from "./rti-snapshots";

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
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
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
  const { currentOrgId } = useAuth();
  return useQuery({
    queryKey: [...rtiKeys.reports, currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rti_reports")
        .select("*")
        .eq("org_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RtiReport[];
    },
  });
}

/** Snapshots mensais do plano de ação (Evolução). RLS filtra por org + entrega:
 * cliente só recebe o histórico de relatórios já entregues. A agregação por mês
 * / filtro por relatório acontece no cliente (aggregateSnapshotsByMonth). */
export function useRtiSnapshots() {
  const { currentOrgId } = useAuth();
  return useQuery({
    queryKey: ["rti_snapshots", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rti_snapshots")
        .select("id, org_id, report_id, snapshot_date, payload")
        .eq("org_id", currentOrgId!)
        .order("snapshot_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RtiSnapshotRow[];
    },
  });
}

export function useUpsertRtiReport() {
  const qc = useQueryClient();
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async (
      payload: Omit<RtiReport, "id" | "created_at" | "updated_at"> & { id?: string },
    ) => {
      // Ao criar (sem id), carimba a org ativa — fn_default_org_id só cobre usuário
      // de 1 org; consultor/platform admin precisam do org_id explícito.
      const body = !payload.id && currentOrgId ? { ...payload, org_id: currentOrgId } : payload;
      const { data, error } = await supabase
        .from("rti_reports")
        .upsert(body as never, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as RtiReport;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: rtiKeys.reports }),
  });
}

export function useEntregarRtiReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, orgId }: { reportId: string; orgId: string }) => {
      const { error } = await (supabase as any).rpc("fn_entregar_rti_report", {
        _report_id: reportId,
        _entregue_por_org: orgId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rtiKeys.reports });
      qc.invalidateQueries({ queryKey: ["rti_ncs"] });
    },
  });
}

export function useDeleteRtiReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => {
      // 1. Coleta paths: PDF do relatório + evidências de todas as NCs
      const paths: string[] = [];
      const { data: rep } = await supabase
        .from("rti_reports")
        .select("report_path")
        .eq("id", reportId)
        .maybeSingle();
      if (rep?.report_path) paths.push(rep.report_path);

      const ncs = await fetchAllRows<{ id: string }>((from, to) =>
        supabase.from("rti_ncs").select("id").eq("report_id", reportId).range(from, to),
      );
      const ncIds = ncs.map((n) => n.id);
      for (let i = 0; i < ncIds.length; i += 200) {
        const { data } = await supabase
          .from("rti_nc_evidencias")
          .select("file_path")
          .in("nc_id", ncIds.slice(i, i + 200));
        for (const e of data ?? []) paths.push(e.file_path);
      }

      // 2. Apaga as linhas de negócio (cascade cuida das NCs/evidências)
      const { count, error } = await supabase
        .from("rti_reports")
        .delete({ count: "exact" })
        .eq("id", reportId);
      if (error) throw error;
      if ((count ?? 0) === 0)
        throw new Error(
          "Sem permissão para excluir este relatório. Relatórios entregues por consultor externo só podem ser removidos pelo próprio consultor.",
        );

      // 3. Remove do Storage só o que ficou sem referência
      await removerArquivosOrfaos(paths);
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
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async (payload: { report_id: string; nome: string; ordem: number }) => {
      const body = currentOrgId ? { ...payload, org_id: currentOrgId } : payload;
      const { data, error } = await supabase
        .from("rti_areas")
        .insert(body as never)
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
    refetchOnMount: "always",
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

/** Todas as NCs da org ativa (visões agregadas: dossiê, conformidade). */
export function useAllRtiNcs() {
  const { currentOrgId } = useAuth();
  return useQuery({
    queryKey: [...rtiKeys.ncs(), currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      return fetchAllRows<RtiNc>((from, to) =>
        supabase
          .from("rti_ncs")
          .select("*")
          .eq("org_id", currentOrgId!)
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
      const { data, error } = await supabase.from("rti_ncs").select("*").eq("id", id!).single();
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
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async (payload: Omit<RtiNc, "id" | "created_at" | "updated_at">) => {
      const body = currentOrgId ? { ...payload, org_id: currentOrgId } : payload;
      const { data, error } = await supabase
        .from("rti_ncs")
        .insert(body as never)
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
      const { error } = await supabase.from("rti_ncs").delete().eq("id", ncId);
      if (error) throw error;
      await removerArquivosOrfaos(paths);
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
      const rows = await fetchAllRows<{ nc_id: string; tipo: string; file_name: string }>(
        (from, to) =>
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
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async (payload: Omit<RtiNcEvidencia, "id" | "created_at">) => {
      const body = currentOrgId ? { ...payload, org_id: currentOrgId } : payload;
      const { data, error } = await supabase
        .from("rti_nc_evidencias")
        .insert(body as never)
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

export function useUpdateRtiEvidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      nc_id,
      descricao,
    }: {
      id: string;
      nc_id: string;
      descricao: string | null;
    }) => {
      const { error } = await supabase.from("rti_nc_evidencias").update({ descricao }).eq("id", id);
      if (error) throw error;
      return { id, nc_id, descricao };
    },
    onSuccess: (ev) => {
      qc.invalidateQueries({ queryKey: rtiKeys.evidencias(ev.nc_id) });
    },
  });
}

export function useDeleteRtiEvidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ev: { id: string; nc_id: string; file_path: string }) => {
      const { error } = await supabase.from("rti_nc_evidencias").delete().eq("id", ev.id);
      if (error) throw error;
      await removerArquivosOrfaos([ev.file_path]);
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
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async (payload: Omit<RtiNcHistorico, "id" | "created_at">) => {
      const body = currentOrgId ? { ...payload, org_id: currentOrgId } : payload;
      const { data, error } = await supabase
        .from("rti_nc_historico")
        .insert(body as never)
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
  // Carimba o mesmo org_id das NCs (fn_default_org_id só cobre usuário de 1 org).
  const { data: ncsData } = await supabase.from("rti_ncs").select("id, org_id").in("id", ncIds);
  const orgIdByNc = new Map((ncsData ?? []).map((n) => [n.id, n.org_id as string | undefined]));
  const rows = ncIds.map((nc_id) => ({
    nc_id,
    tipo,
    texto,
    autor_nome: autorNome,
    org_id: orgIdByNc.get(nc_id),
  }));
  for (let i = 0; i < rows.length; i += 200) {
    await supabase.from("rti_nc_historico").insert(rows.slice(i, i + 200) as never);
  }
}

// ── Arquivos (bucket rti-evidencias) ─────────────────────────────────────────

export async function uploadRtiFile(file: File, prefix = "evidencias"): Promise<string> {
  const resized = await resizeImage(file, 1024);
  const ext = resized.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("rti-evidencias").upload(path, resized, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(mensagemUploadAmigavel(error));
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
  ncIds,
  files,
  tipo,
  descricao,
  autorNome,
  onProgress,
}: {
  ncIds: string[];
  files: File[];
  tipo: RtiNcEvidencia["tipo"];
  descricao: string | null;
  autorNome: string | null;
  onProgress?: (done: number, total: number) => void;
}) {
  // Carimba o mesmo org_id das NCs (fn_default_org_id só cobre usuário de 1 org).
  const { data: ncsData } = await supabase.from("rti_ncs").select("id, org_id").in("id", ncIds);
  const orgIdByNc = new Map((ncsData ?? []).map((n) => [n.id, n.org_id as string | undefined]));

  const total = ncIds.length * files.length;
  let done = 0;
  for (const ncId of ncIds) {
    const rows: (Omit<RtiNcEvidencia, "id" | "created_at"> & { org_id?: string })[] = [];
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
        org_id: orgIdByNc.get(ncId),
      });
      done += 1;
      onProgress?.(done, total);
    }
    const { error } = await supabase.from("rti_nc_evidencias").insert(rows as never);
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
  /** Org ativa — carimbada no relatório; áreas/NCs herdam via trigger no banco. */
  orgId?: string | null;
  onProgress?: (done: number, total: number) => void;
};

export async function batchImportRti({ report, areas, ncs, orgId, onProgress }: RtiImportPayload) {
  // 1) Relatório
  const reportRow = { ...report } as typeof report & { org_id?: string };
  if (orgId) reportRow.org_id = orgId;
  const { data: rep, error: repErr } = await supabase
    .from("rti_reports")
    .insert(reportRow as never)
    .select()
    .single();
  if (repErr) throw repErr;
  const reportId = (rep as RtiReport).id;

  // 2) Áreas
  const { data: areaRows, error: areaErr } = await supabase
    .from("rti_areas")
    .insert(areas.map((a) => ({ ...a, report_id: reportId, ...(orgId ? { org_id: orgId } : {}) })) as never)
    .select();
  if (areaErr) throw areaErr;
  const areaIdByNome = new Map((areaRows as RtiArea[]).map((a) => [a.nome, a.id]));

  // 3) NCs em lotes
  const rows = ncs.map((nc) => ({
    report_id: reportId,
    ...(orgId ? { org_id: orgId } : {}),
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
      .upsert(chunk as never, { onConflict: "report_id,numero", ignoreDuplicates: true });
    if (error) throw error;
    onProgress?.(Math.min(i + 200, rows.length), rows.length);
  }

  return reportId;
}
