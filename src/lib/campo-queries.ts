import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { RtiArea, RtiNc, RtiReport } from "./rti";
import {
  caminhoAbaixoDoSetor,
  normalizarEstrutura,
  resizeImage,
  setorDoNo,
  type EstruturaLinha,
  type FieldFinding,
  type FieldInspection,
  type FieldNode,
  type FieldPhoto,
  type FieldPoint,
  type NivelArvore,
  type RtiModoFalha,
} from "./campo";

export const campoKeys = {
  modos: ["rti_modos_falha"] as const,
  inspections: ["field_inspections"] as const,
  inspection: (id: string) => ["field_inspections", id] as const,
  nodes: (inspectionId: string) => ["field_nodes", inspectionId] as const,
  points: (inspectionId: string) => ["field_points", inspectionId] as const,
  point: (id: string) => ["field_point", id] as const,
  findings: (pointId: string) => ["field_findings", pointId] as const,
  inspectionFindings: (inspectionId: string) => ["field_findings_inspecao", inspectionId] as const,
  photos: (pointId: string) => ["field_photos", pointId] as const,
};

// ── Modos de falha (base padrão, editável) ───────────────────────────────────

export function useModosFalha() {
  return useQuery({
    queryKey: campoKeys.modos,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rti_modos_falha")
        .select("*")
        .order("ordem")
        .order("label");
      if (error) throw error;
      return data as unknown as RtiModoFalha[];
    },
  });
}

export function useUpsertModoFalha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<RtiModoFalha, "id" | "created_at" | "updated_at"> & { id?: string },
    ) => {
      const { data, error } = await supabase
        .from("rti_modos_falha")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RtiModoFalha;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: campoKeys.modos }),
  });
}

export function useDeleteModoFalha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { count, error } = await supabase
        .from("rti_modos_falha")
        .delete({ count: "exact" })
        .eq("id", id);
      if (error) throw error;
      if ((count ?? 0) === 0) throw new Error("Sem permissão para excluir este registro.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: campoKeys.modos }),
  });
}

export function useArchiveModoFalha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rti_modos_falha")
        .update({ ativo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: campoKeys.modos }),
  });
}

// ── Inspeções de campo ───────────────────────────────────────────────────────

export function useFieldInspections() {
  return useQuery({
    queryKey: campoKeys.inspections,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_inspections")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as FieldInspection[];
    },
  });
}

export function useFieldInspection(id?: string) {
  return useQuery({
    queryKey: campoKeys.inspection(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_inspections")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as FieldInspection;
    },
  });
}

export function useUpsertFieldInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<FieldInspection> & { titulo: string; id?: string }) => {
      const { data, error } = await supabase
        .from("field_inspections")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as FieldInspection;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["field_inspections"] }),
  });
}

export function useSetArquivadaCampo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      arquivada_campo,
      status,
    }: {
      id: string;
      arquivada_campo: boolean;
      status?: string;
    }) => {
      const update: { arquivada_campo: boolean; status?: string } = { arquivada_campo };
      if (status !== undefined) update.status = status;
      const { error } = await supabase.from("field_inspections").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["field_inspections"] }),
  });
}

export function useDeleteFieldInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inspectionId: string) => {
      // Remove os arquivos de foto do storage antes do cascade
      const { data: points } = await supabase
        .from("field_points")
        .select("id")
        .eq("inspection_id", inspectionId);
      const pointIds = (points ?? []).map((p) => p.id);
      if (pointIds.length > 0) {
        const paths: string[] = [];
        for (let i = 0; i < pointIds.length; i += 200) {
          const { data: photos } = await supabase
            .from("field_photos")
            .select("file_path")
            .in("point_id", pointIds.slice(i, i + 200));
          for (const ph of photos ?? []) paths.push(ph.file_path);
        }
        for (let i = 0; i < paths.length; i += 100) {
          await supabase.storage.from("rti-evidencias").remove(paths.slice(i, i + 100));
        }
      }
      const { error } = await supabase.from("field_inspections").delete().eq("id", inspectionId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ── Árvore (nós) ─────────────────────────────────────────────────────────────

export function useFieldNodes(inspectionId?: string) {
  return useQuery({
    queryKey: campoKeys.nodes(inspectionId ?? ""),
    enabled: !!inspectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_nodes")
        .select("*")
        .eq("inspection_id", inspectionId!)
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return data as unknown as FieldNode[];
    },
  });
}

export function useUpsertFieldNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Partial<FieldNode> & {
        inspection_id: string;
        nivel: NivelArvore;
        nome: string;
        id?: string;
      },
    ) => {
      const { data, error } = await supabase
        .from("field_nodes")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as FieldNode;
    },
    onSuccess: (n) => qc.invalidateQueries({ queryKey: campoKeys.nodes(n.inspection_id) }),
  });
}

export function useDeleteFieldNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (node: { id: string; inspection_id: string }) => {
      // Remove fotos do storage dos pontos sob este nó (e descendentes via cascade no banco).
      // Como o cascade do banco apaga pontos/fotos, buscamos os arquivos antes.
      const { data: descPoints } = await supabase
        .from("field_points")
        .select("id, node_id")
        .eq("inspection_id", node.inspection_id);
      // Limita à subárvore: como não temos recursão no cliente aqui, removemos as fotos
      // de TODOS os pontos cujo node_id seja o nó ou descendente. Para simplicidade e
      // segurança, deixamos o cascade do banco apagar registros; limpamos o storage só
      // dos pontos diretamente no nó (descendentes mais profundos são raros e o arquivo
      // órfão é tolerável). Aqui removemos os do próprio nó.
      const pointIds = (descPoints ?? []).filter((p) => p.node_id === node.id).map((p) => p.id);
      if (pointIds.length > 0) {
        const { data: photos } = await supabase
          .from("field_photos")
          .select("file_path")
          .in("point_id", pointIds);
        const paths = (photos ?? []).map((p) => p.file_path);
        if (paths.length > 0) await supabase.storage.from("rti-evidencias").remove(paths);
      }
      const { error } = await supabase.from("field_nodes").delete().eq("id", node.id);
      if (error) throw error;
      return node;
    },
    onSuccess: (node) => {
      qc.invalidateQueries({ queryKey: campoKeys.nodes(node.inspection_id) });
      qc.invalidateQueries({ queryKey: campoKeys.points(node.inspection_id) });
      qc.invalidateQueries({ queryKey: campoKeys.inspectionFindings(node.inspection_id) });
    },
  });
}

/** Cria a árvore a partir de linhas Setor/Ativo/Componente (dedupe + reaproveita nós existentes). */
export async function bulkCreateNodes(
  inspectionId: string,
  linhasBrutas: EstruturaLinha[],
): Promise<number> {
  const linhas = normalizarEstrutura(linhasBrutas);
  if (linhas.length === 0) return 0;

  const { data: existentes } = await supabase
    .from("field_nodes")
    .select("*")
    .eq("inspection_id", inspectionId);
  const nodes = (existentes ?? []) as unknown as FieldNode[];

  // Índice por "parentId|nome" para evitar duplicar
  const keyOf = (parentId: string | null, nome: string) =>
    `${parentId ?? ""}|${nome.toLowerCase()}`;
  const byKey = new Map<string, FieldNode>();
  for (const n of nodes) byKey.set(keyOf(n.parent_id, n.nome), n);
  const ordemPorParent = new Map<string | null, number>();
  for (const n of nodes) {
    const cur = ordemPorParent.get(n.parent_id ?? null) ?? 0;
    ordemPorParent.set(n.parent_id ?? null, Math.max(cur, n.ordem));
  }

  let criados = 0;
  async function garante(
    parentId: string | null,
    nivel: NivelArvore,
    nome: string,
  ): Promise<string> {
    const k = keyOf(parentId, nome);
    const ja = byKey.get(k);
    if (ja) return ja.id;
    const ordem = (ordemPorParent.get(parentId) ?? 0) + 1;
    ordemPorParent.set(parentId, ordem);
    const { data, error } = await supabase
      .from("field_nodes")
      .insert({ inspection_id: inspectionId, parent_id: parentId, nivel, nome, ordem })
      .select()
      .single();
    if (error) throw error;
    const novo = data as unknown as FieldNode;
    byKey.set(k, novo);
    criados += 1;
    return novo.id;
  }

  for (const l of linhas) {
    const setorId = await garante(null, "setor", l.setor);
    if (l.ativo) {
      const ativoId = await garante(setorId, "ativo", l.ativo);
      if (l.componente) await garante(ativoId, "componente", l.componente);
    }
  }
  return criados;
}

/** Setores distintos já usados nos relatórios RTI reais (base histórica p/ sugestão). */
export function useSetoresHistoricos() {
  return useQuery({
    queryKey: ["rti_areas_distintas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rti_areas").select("nome").order("nome");
      if (error) throw error;
      const set = new Set<string>();
      for (const a of (data ?? []) as { nome: string }[]) {
        const n = a.nome?.trim();
        if (n) set.add(n);
      }
      return [...set].sort((a, b) => a.localeCompare(b));
    },
  });
}

// ── Carga de estrutura por planilha (modelo + parse) ─────────────────────────

/** Gera e baixa a planilha-modelo de estrutura (Setor/Ativo/Componente). */
export function baixarPlanilhaModeloEstrutura(setoresReferencia: string[] = []) {
  const wb = XLSX.utils.book_new();
  const estrutura = [
    { Setor: "SE 02 - EXTRAÇÃO", Ativo: "CCM-02", Componente: "Gaveta G4" },
    { Setor: "SE 02 - EXTRAÇÃO", Ativo: "QGBT", Componente: "" },
    { Setor: "CALDEIRA", Ativo: "", Componente: "" },
  ];
  const ws = XLSX.utils.json_to_sheet(estrutura, { header: ["Setor", "Ativo", "Componente"] });
  ws["!cols"] = [{ wch: 32 }, { wch: 24 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws, "Estrutura");

  if (setoresReferencia.length > 0) {
    const ref = XLSX.utils.json_to_sheet(
      setoresReferencia.map((s) => ({ "Setores de referência (RTI atual)": s })),
    );
    ref["!cols"] = [{ wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ref, "Setores de referência");
  }
  XLSX.writeFile(wb, "modelo-estrutura-rti.xlsx");
}

/** Lê uma planilha de estrutura e retorna as linhas Setor/Ativo/Componente. */
export async function parsePlanilhaEstrutura(file: File): Promise<EstruturaLinha[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const norm = (v: unknown) => String(v ?? "").trim();
  const pick = (row: Record<string, unknown>, ...nomes: string[]) => {
    for (const key of Object.keys(row)) {
      const k = key.trim().toLowerCase();
      if (nomes.some((n) => k === n || k.startsWith(n))) return norm(row[key]);
    }
    return "";
  };
  return rows
    .map((r) => ({
      setor: pick(r, "setor"),
      ativo: pick(r, "ativo") || null,
      componente: pick(r, "componente", "compon") || null,
    }))
    .filter((l) => l.setor);
}

// ── Pontos de coleta ─────────────────────────────────────────────────────────

export type FieldPointWithCounts = FieldPoint & { _fotos: number; _achados: number };

export function useFieldPoints(inspectionId?: string) {
  return useQuery({
    queryKey: campoKeys.points(inspectionId ?? ""),
    enabled: !!inspectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_points")
        .select("*, field_findings(id), field_photos(id)")
        .eq("inspection_id", inspectionId!)
        .order("ordem")
        .order("created_at");
      if (error) throw error;
      type Raw = FieldPoint & { field_findings: { id: string }[]; field_photos: { id: string }[] };
      return (data as unknown as Raw[]).map((p) => ({
        ...p,
        _fotos: p.field_photos?.length ?? 0,
        _achados: p.field_findings?.length ?? 0,
      })) as FieldPointWithCounts[];
    },
  });
}

export function useFieldPoint(id?: string) {
  return useQuery({
    queryKey: campoKeys.point(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_points")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as FieldPoint;
    },
  });
}

export function useUpsertFieldPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Partial<FieldPoint> & { inspection_id: string; node_id: string; id?: string },
    ) => {
      const { data, error } = await supabase
        .from("field_points")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as FieldPoint;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: campoKeys.points(p.inspection_id) });
      qc.invalidateQueries({ queryKey: campoKeys.point(p.id) });
    },
  });
}

export function useDeleteFieldPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (point: { id: string; inspection_id: string }) => {
      const { data: photos } = await supabase
        .from("field_photos")
        .select("file_path")
        .eq("point_id", point.id);
      const paths = (photos ?? []).map((p) => p.file_path);
      if (paths.length > 0) await supabase.storage.from("rti-evidencias").remove(paths);
      const { error } = await supabase.from("field_points").delete().eq("id", point.id);
      if (error) throw error;
      return point;
    },
    onSuccess: (point) => {
      qc.invalidateQueries({ queryKey: campoKeys.points(point.inspection_id) });
      qc.invalidateQueries({ queryKey: campoKeys.inspectionFindings(point.inspection_id) });
    },
  });
}

// ── Achados (findings) ───────────────────────────────────────────────────────

export function useFieldFindings(pointId?: string) {
  return useQuery({
    queryKey: campoKeys.findings(pointId ?? ""),
    enabled: !!pointId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_findings")
        .select("*")
        .eq("point_id", pointId!)
        .order("created_at");
      if (error) throw error;
      return data as unknown as FieldFinding[];
    },
  });
}

export type InspectionFinding = FieldFinding & {
  field_points: Pick<FieldPoint, "inspection_id" | "node_id" | "titulo" | "ordem" | "created_at">;
};

/** Todos os achados de uma inspeção (resumo e composição do RTI). */
export function useInspectionFindings(inspectionId?: string) {
  return useQuery({
    queryKey: campoKeys.inspectionFindings(inspectionId ?? ""),
    enabled: !!inspectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_findings")
        .select("*, field_points!inner(inspection_id, node_id, titulo, ordem, created_at)")
        .eq("field_points.inspection_id", inspectionId!);
      if (error) throw error;
      return data as unknown as InspectionFinding[];
    },
  });
}

export function useUpsertFieldFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Partial<FieldFinding> & { point_id: string; descricao: string; id?: string },
    ) => {
      const { data, error } = await supabase
        .from("field_findings")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as FieldFinding;
    },
    onSuccess: (f) => {
      qc.invalidateQueries({ queryKey: campoKeys.findings(f.point_id) });
      qc.invalidateQueries({ queryKey: ["field_findings_inspecao"] });
      qc.invalidateQueries({ queryKey: ["field_points"] });
    },
  });
}

export function useDeleteFieldFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (finding: { id: string; point_id: string }) => {
      // Unlink rti_ncs that reference this finding before deleting to avoid FK violation.
      await supabase.from("rti_ncs").update({ finding_id: null }).eq("finding_id", finding.id);
      const { error } = await supabase.from("field_findings").delete().eq("id", finding.id);
      if (error) throw error;
      return finding;
    },
    onSuccess: (f) => {
      qc.invalidateQueries({ queryKey: campoKeys.findings(f.point_id) });
      qc.invalidateQueries({ queryKey: ["field_findings_inspecao"] });
      qc.invalidateQueries({ queryKey: ["field_points"] });
    },
  });
}

// ── Fotos (ancoradas no ponto) ───────────────────────────────────────────────

export function usePointPhotos(pointId?: string) {
  return useQuery({
    queryKey: campoKeys.photos(pointId ?? ""),
    enabled: !!pointId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_photos")
        .select("*")
        .eq("point_id", pointId!)
        .order("ordem")
        .order("created_at");
      if (error) throw error;
      return data as unknown as FieldPhoto[];
    },
  });
}

/** Redimensiona (~1600px) e sobe a foto para o bucket rti-evidencias.
 * Path escopado por org ({org_id}/campo/…) quando orgId é informado; senão usa o
 * legado `campo/…` (sem regressão). Prepara isolamento + storage frio futuro. */
export async function uploadFieldPhoto(
  file: File,
  orgId?: string,
): Promise<{ path: string; name: string }> {
  const resized = await resizeImage(file);
  const ext = resized.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = orgId
    ? `${orgId}/campo/${crypto.randomUUID()}.${ext}`
    : `campo/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("rti-evidencias").upload(path, resized, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return { path, name: resized.name };
}

export function useAddFieldPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<FieldPhoto, "id" | "created_at">) => {
      const { data, error } = await supabase.from("field_photos").insert(payload).select().single();
      if (error) throw error;
      return data as unknown as FieldPhoto;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: campoKeys.photos(p.point_id) });
      qc.invalidateQueries({ queryKey: ["field_points"] });
    },
  });
}

export function useUpdateFieldPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: { id: string; point_id: string; legenda: string | null }) => {
      const { error } = await supabase
        .from("field_photos")
        .update({ legenda: photo.legenda })
        .eq("id", photo.id);
      if (error) throw error;
      return photo;
    },
    onSuccess: (p) => qc.invalidateQueries({ queryKey: campoKeys.photos(p.point_id) }),
  });
}

export function useDeleteFieldPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: { id: string; file_path: string; point_id: string }) => {
      await supabase.storage.from("rti-evidencias").remove([photo.file_path]);
      const { error } = await supabase.from("field_photos").delete().eq("id", photo.id);
      if (error) throw error;
      return photo;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: campoKeys.photos(p.point_id) });
      qc.invalidateQueries({ queryKey: ["field_points"] });
    },
  });
}

// ── Captura combinada (fluxo foto-primeiro) ──────────────────────────────────

export type AchadoNovo = {
  modo_falha_id: string | null;
  descricao: string;
  recomendacao: string | null;
  prioridade: number;
  tipo_execucao: "os" | "investimento";
  observacao: string | null;
};

/**
 * Cria um ponto de coleta com as fotos e os achados selecionados, de uma vez.
 * As fotos já vêm enviadas (paths); os achados viram registros field_findings.
 */
export function useCriarPontoComColeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      inspectionId: string;
      nodeId: string;
      titulo: string | null;
      observacoes: string | null;
      ordem: number;
      fotos: { path: string; name: string }[];
      achados: AchadoNovo[];
    }) => {
      const { data: pointData, error: pErr } = await supabase
        .from("field_points")
        .insert({
          inspection_id: args.inspectionId,
          node_id: args.nodeId,
          titulo: args.titulo,
          observacoes: args.observacoes,
          ordem: args.ordem,
        })
        .select()
        .single();
      if (pErr) throw pErr;
      const point = pointData as unknown as FieldPoint;

      if (args.fotos.length > 0) {
        const rows = args.fotos.map((f, i) => ({
          point_id: point.id,
          file_path: f.path,
          file_name: f.name,
          legenda: null,
          ordem: i,
        }));
        const { error } = await supabase.from("field_photos").insert(rows);
        if (error) throw error;
      }
      if (args.achados.length > 0) {
        const rows = args.achados.map((a) => ({ ...a, point_id: point.id }));
        const { error } = await supabase.from("field_findings").insert(rows);
        if (error) throw error;
      }
      return point;
    },
    onSuccess: (point) => {
      qc.invalidateQueries({ queryKey: campoKeys.points(point.inspection_id) });
      qc.invalidateQueries({ queryKey: campoKeys.inspectionFindings(point.inspection_id) });
    },
  });
}

// ── Composição do RTI a partir da coleta ─────────────────────────────────────

export type ComporRtiDestino = { mode: "novo" } | { mode: "existente"; reportId: string };

export type ComporRtiResult = { reportId: string; ncsCriadas: number; fotosCopiadas: number };

/**
 * Compõe o RTI a partir da coleta de campo: área = Setor; cada achado vira uma
 * NC com a descrição prefixada pelo caminho do ativo/componente; as fotos do
 * ponto são copiadas como evidência de constatação em cada NC daquele ponto.
 */
export async function comporRti({
  inspection,
  destino,
  actorName,
  onProgress,
}: {
  inspection: FieldInspection;
  destino: ComporRtiDestino;
  actorName: string | null;
  onProgress?: (etapa: string, done: number, total: number) => void;
}): Promise<ComporRtiResult> {
  // 1) Carrega árvore, pontos, achados e fotos
  const { data: nodesData, error: nErr } = await supabase
    .from("field_nodes")
    .select("*")
    .eq("inspection_id", inspection.id);
  if (nErr) throw nErr;
  const nodes = (nodesData ?? []) as unknown as FieldNode[];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const { data: pointsData, error: pErr } = await supabase
    .from("field_points")
    .select("*")
    .eq("inspection_id", inspection.id)
    .order("ordem")
    .order("created_at");
  if (pErr) throw pErr;
  const points = (pointsData ?? []) as unknown as FieldPoint[];
  if (points.length === 0) throw new Error("A coleta não possui pontos de inspeção.");

  const pointIds = points.map((p) => p.id);
  const { data: findingsData, error: fErr } = await supabase
    .from("field_findings")
    .select("*")
    .in("point_id", pointIds)
    .order("created_at");
  if (fErr) throw fErr;
  const findings = (findingsData ?? []) as unknown as FieldFinding[];
  if (findings.length === 0) throw new Error("A coleta não possui achados registrados.");

  const { data: photosData, error: phErr } = await supabase
    .from("field_photos")
    .select("*")
    .in("point_id", pointIds)
    .order("ordem");
  if (phErr) throw phErr;
  const photos = (photosData ?? []) as unknown as FieldPhoto[];
  const photosByPoint = new Map<string, FieldPhoto[]>();
  for (const ph of photos) {
    const arr = photosByPoint.get(ph.point_id);
    if (arr) arr.push(ph);
    else photosByPoint.set(ph.point_id, [ph]);
  }
  const findingsByPoint = new Map<string, FieldFinding[]>();
  for (const f of findings) {
    const arr = findingsByPoint.get(f.point_id);
    if (arr) arr.push(f);
    else findingsByPoint.set(f.point_id, [f]);
  }

  // 2) Relatório de destino
  let reportId: string;
  if (destino.mode === "existente") {
    reportId = destino.reportId;
  } else {
    const { data: rep, error: rErr } = await supabase
      .from("rti_reports")
      .insert({
        // Raiz do RTI herda a org da inspeção de origem; as NCs/áreas/evidências
        // cascateiam o org_id via trigger no banco. Ausente → trigger resolve (single-org).
        org_id: inspection.org_id ?? undefined,
        titulo: inspection.titulo,
        empresa_auditora: inspection.cliente,
        responsavel_auditoria: inspection.engenheiro,
        responsavel_plano: null,
        periodo_inicio: inspection.data_inspecao,
        periodo_fim: inspection.data_inspecao,
        notes: `Composto a partir da coleta em campo "${inspection.titulo}".`,
        created_by_name: actorName,
      })
      .select()
      .single();
    if (rErr) throw rErr;
    reportId = (rep as RtiReport).id;
  }

  // 3) Áreas (= Setores). Cria as que faltam.
  const { data: areasData, error: aErr } = await supabase
    .from("rti_areas")
    .select("*")
    .eq("report_id", reportId);
  if (aErr) throw aErr;
  const areaIdByNome = new Map((areasData as RtiArea[]).map((a) => [a.nome, a.id]));
  let maxOrdem = (areasData as RtiArea[]).reduce((m, a) => Math.max(m, a.ordem), 0);
  // Setor de cada ponto
  const setorNomeDoPonto = (p: FieldPoint) => setorDoNo(p.node_id, nodeById)?.nome ?? "Sem setor";
  const setoresFaltantes = [...new Set(points.map((p) => setorNomeDoPonto(p)))].filter(
    (nome) => !areaIdByNome.has(nome),
  );
  for (const nome of setoresFaltantes) {
    maxOrdem += 1;
    const { data: area, error } = await supabase
      .from("rti_areas")
      .insert({ report_id: reportId, nome, ordem: maxOrdem })
      .select()
      .single();
    if (error) throw error;
    areaIdByNome.set(nome, (area as RtiArea).id);
  }

  // 4) Numeração sequencial
  const { data: maxData } = await supabase
    .from("rti_ncs")
    .select("numero")
    .eq("report_id", reportId)
    .order("numero", { ascending: false })
    .limit(1);
  let numero = (maxData?.[0]?.numero ?? 0) as number;

  // 4b) Para re-compose em relatório existente: mapa finding_id → NC já criada.
  // Permite atualizar NCs existentes em vez de duplicar quando achados foram editados.
  const existingNcByFindingId = new Map<string, RtiNc>();
  if (destino.mode === "existente") {
    const { data: existingNcs } = await supabase
      .from("rti_ncs")
      .select("*")
      .eq("report_id", reportId)
      .not("finding_id", "is", null);
    for (const nc of (existingNcs ?? []) as RtiNc[]) {
      if (nc.finding_id) existingNcByFindingId.set(nc.finding_id, nc);
    }
  }

  // 5) Cria ou atualiza as NCs (uma por achado), na ordem dos pontos
  const ordered = [...points].sort(
    (a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at),
  );
  let ncsCriadas = 0;
  let ncsAtualizadas = 0;
  let fotosCopiadas = 0;
  const totalEtapas = findings.length + photos.length;
  let done = 0;

  for (const point of ordered) {
    const setorNome = setorNomeDoPonto(point);
    const prefixoAtivo = caminhoAbaixoDoSetor(point.node_id, nodeById);
    const prefixoPonto = [prefixoAtivo, point.titulo?.trim()].filter(Boolean).join(" — ");
    const fotosDoPonto = photosByPoint.get(point.id) ?? [];
    const achadosDoPonto = findingsByPoint.get(point.id) ?? [];

    for (const finding of achadosDoPonto) {
      const descricao = (prefixoPonto ? `${prefixoPonto}: ` : "") + finding.descricao;
      const situacaoAtual = finding.observacao?.trim() || null;
      const existingNc = existingNcByFindingId.get(finding.id);

      if (existingNc) {
        // Achado já foi exportado anteriormente — atualiza NC e registra no histórico
        const { error: updErr } = await supabase
          .from("rti_ncs")
          .update({
            descricao,
            recomendacao: finding.recomendacao,
            prioridade: finding.prioridade,
            tipo_execucao: finding.tipo_execucao,
            situacao_atual: situacaoAtual,
          })
          .eq("id", existingNc.id);
        if (updErr) throw updErr;
        await supabase.from("rti_nc_historico").insert({
          nc_id: existingNc.id,
          tipo: "alteracao",
          texto: `Achado revisado via recomposição da coleta em campo "${inspection.titulo}"`,
          autor_nome: actorName,
        });
        ncsAtualizadas += 1;
        done += 1;
        onProgress?.("Atualizando NCs", done, totalEtapas);
      } else {
        // Achado novo — cria NC e copia fotos
        numero += 1;
        const { data: ncData, error: ncErr } = await supabase
          .from("rti_ncs")
          .insert({
            report_id: reportId,
            area_id: areaIdByNome.get(setorNome)!,
            numero,
            descricao,
            recomendacao: finding.recomendacao,
            prioridade: finding.prioridade,
            responsavel: null,
            status: "pendente",
            progresso: 0,
            prazo: null,
            tipo_execucao: finding.tipo_execucao,
            os_numero: null,
            custo_planejado: null,
            custo_realizado: null,
            situacao_atual: situacaoAtual,
            concluida_em: null,
            finding_id: finding.id,
          })
          .select()
          .single();
        if (ncErr) throw ncErr;
        const nc = ncData as RtiNc;
        ncsCriadas += 1;
        done += 1;
        onProgress?.("Criando NCs", done, totalEtapas);

        // Fotos do ponto → evidência de constatação em cada NC (cópia independente)
        for (const ph of fotosDoPonto) {
          const ext = ph.file_path.split(".").pop() ?? "jpg";
          // Path escopado por org (fallback ao legado `evidencias/…` se a inspeção
          // não tiver org_id — mantém compatibilidade sem regressão).
          const novoPath = inspection.org_id
            ? `${inspection.org_id}/evidencias/${crypto.randomUUID()}.${ext}`
            : `evidencias/${crypto.randomUUID()}.${ext}`;
          const { error: cpErr } = await supabase.storage
            .from("rti-evidencias")
            .copy(ph.file_path, novoPath);
          if (cpErr) throw cpErr;
          const { error: evErr } = await supabase.from("rti_nc_evidencias").insert({
            nc_id: nc.id,
            tipo: "constatacao",
            file_path: novoPath,
            file_name: ph.file_name,
            mime_type: "image/jpeg",
            descricao: ph.legenda,
            created_by_name: actorName,
          });
          if (evErr) throw evErr;
          fotosCopiadas += 1;
          done += 1;
          onProgress?.("Copiando fotos", done, totalEtapas);
        }

        await supabase.from("rti_nc_historico").insert({
          nc_id: nc.id,
          tipo: "alteracao",
          texto: `NC composta a partir da coleta em campo "${inspection.titulo}" (${[setorNome, prefixoPonto].filter(Boolean).join(" › ")})`,
          autor_nome: actorName,
        });
      }
    }
  }

  // 6) Marca a coleta como importada
  const { error: upErr } = await supabase
    .from("field_inspections")
    .update({ status: "importada", report_id: reportId })
    .eq("id", inspection.id);
  if (upErr) throw upErr;

  return { reportId, ncsCriadas, fotosCopiadas };
}
