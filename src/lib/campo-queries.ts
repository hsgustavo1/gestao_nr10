import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RtiArea, RtiNc, RtiReport } from "./rti";
import {
  resizeImage,
  type FieldFinding, type FieldInspection, type FieldPhoto, type FieldPoint, type RtiModoFalha,
} from "./campo";

export const campoKeys = {
  modos: ["rti_modos_falha"] as const,
  inspections: ["field_inspections"] as const,
  inspection: (id: string) => ["field_inspections", id] as const,
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
      const { error } = await supabase.from("rti_modos_falha").delete().eq("id", id);
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
    mutationFn: async (
      payload: Partial<FieldInspection> & { titulo: string; id?: string },
    ) => {
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

export function useDeleteFieldInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inspectionId: string) => {
      // Remove os arquivos de foto do storage antes do cascade
      const { data: photos } = await supabase
        .from("field_photos")
        .select("file_path, field_findings!inner(point_id, field_points!inner(inspection_id))")
        .eq("field_findings.field_points.inspection_id", inspectionId);
      const paths = (photos ?? []).map((p) => p.file_path);
      for (let i = 0; i < paths.length; i += 100) {
        await supabase.storage.from("rti-evidencias").remove(paths.slice(i, i + 100));
      }
      const { error } = await supabase.from("field_inspections").delete().eq("id", inspectionId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ── Pontos de coleta ─────────────────────────────────────────────────────────

export function useFieldPoints(inspectionId?: string) {
  return useQuery({
    queryKey: campoKeys.points(inspectionId ?? ""),
    enabled: !!inspectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_points")
        .select("*")
        .eq("inspection_id", inspectionId!)
        .order("ordem")
        .order("created_at");
      if (error) throw error;
      return data as unknown as FieldPoint[];
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
      payload: Partial<FieldPoint> & { inspection_id: string; area_nome: string; nome: string; id?: string },
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
        .select("file_path, field_findings!inner(point_id)")
        .eq("field_findings.point_id", point.id);
      const paths = (photos ?? []).map((p) => p.file_path);
      if (paths.length > 0) {
        await supabase.storage.from("rti-evidencias").remove(paths);
      }
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

export type FieldFindingWithPoint = FieldFinding & {
  field_points: Pick<FieldPoint, "inspection_id" | "area_nome" | "nome" | "ordem" | "created_at">;
};

/** Todos os achados de uma inspeção (resumo e composição do RTI). */
export function useInspectionFindings(inspectionId?: string) {
  return useQuery({
    queryKey: campoKeys.inspectionFindings(inspectionId ?? ""),
    enabled: !!inspectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_findings")
        .select("*, field_points!inner(inspection_id, area_nome, nome, ordem, created_at)")
        .eq("field_points.inspection_id", inspectionId!);
      if (error) throw error;
      return data as unknown as FieldFindingWithPoint[];
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
    },
  });
}

export function useDeleteFieldFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (finding: { id: string; point_id: string }) => {
      const { data: photos } = await supabase
        .from("field_photos")
        .select("file_path")
        .eq("finding_id", finding.id);
      const paths = (photos ?? []).map((p) => p.file_path);
      if (paths.length > 0) {
        await supabase.storage.from("rti-evidencias").remove(paths);
      }
      const { error } = await supabase.from("field_findings").delete().eq("id", finding.id);
      if (error) throw error;
      return finding;
    },
    onSuccess: (f) => {
      qc.invalidateQueries({ queryKey: campoKeys.findings(f.point_id) });
      qc.invalidateQueries({ queryKey: campoKeys.photos(f.point_id) });
      qc.invalidateQueries({ queryKey: ["field_findings_inspecao"] });
    },
  });
}

// ── Fotos ────────────────────────────────────────────────────────────────────

/** Fotos de todos os achados de um ponto (agrupadas no cliente por finding_id). */
export function usePointPhotos(pointId?: string) {
  return useQuery({
    queryKey: campoKeys.photos(pointId ?? ""),
    enabled: !!pointId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_photos")
        .select("*, field_findings!inner(point_id)")
        .eq("field_findings.point_id", pointId!)
        .order("created_at");
      if (error) throw error;
      return data as unknown as (FieldPhoto & { field_findings: { point_id: string } })[];
    },
  });
}

/** Redimensiona (~1600px) e sobe a foto para o bucket rti-evidencias (pasta campo/). */
export async function uploadFieldPhoto(file: File): Promise<{ path: string; name: string }> {
  const resized = await resizeImage(file);
  const ext = resized.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `campo/${crypto.randomUUID()}.${ext}`;
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
    mutationFn: async (payload: Omit<FieldPhoto, "id" | "created_at"> & { point_id: string }) => {
      const { point_id, ...row } = payload;
      const { data, error } = await supabase
        .from("field_photos")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return { ...(data as unknown as FieldPhoto), point_id };
    },
    onSuccess: (p) => qc.invalidateQueries({ queryKey: campoKeys.photos(p.point_id) }),
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
    onSuccess: (p) => qc.invalidateQueries({ queryKey: campoKeys.photos(p.point_id) }),
  });
}

// ── Composição do RTI a partir da coleta ─────────────────────────────────────

export type ComporRtiDestino =
  | { mode: "novo" }
  | { mode: "existente"; reportId: string };

export type ComporRtiResult = {
  reportId: string;
  ncsCriadas: number;
  fotosCopiadas: number;
};

/**
 * Compõe o RTI a partir de uma coleta de campo finalizada:
 * cria (ou reaproveita) o relatório, cria as áreas que faltam, numera as NCs
 * em sequência e copia as fotos como evidências de constatação. Os arquivos
 * são COPIADOS no storage para que a coleta permaneça íntegra e independente.
 */
export async function comporRti({
  inspection, destino, actorName, onProgress,
}: {
  inspection: FieldInspection;
  destino: ComporRtiDestino;
  actorName: string | null;
  onProgress?: (etapa: string, done: number, total: number) => void;
}): Promise<ComporRtiResult> {
  // 1) Carrega a coleta completa
  const { data: pointsData, error: pErr } = await supabase
    .from("field_points")
    .select("*")
    .eq("inspection_id", inspection.id)
    .order("ordem")
    .order("created_at");
  if (pErr) throw pErr;
  const points = (pointsData ?? []) as unknown as FieldPoint[];

  const pointIds = points.map((p) => p.id);
  if (pointIds.length === 0) throw new Error("A coleta não possui pontos de inspeção.");

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
    .in("finding_id", findings.map((f) => f.id));
  if (phErr) throw phErr;
  const photos = (photosData ?? []) as unknown as FieldPhoto[];
  const photosByFinding = new Map<string, FieldPhoto[]>();
  for (const ph of photos) {
    const arr = photosByFinding.get(ph.finding_id);
    if (arr) arr.push(ph);
    else photosByFinding.set(ph.finding_id, [ph]);
  }

  // 2) Relatório de destino
  let reportId: string;
  if (destino.mode === "existente") {
    reportId = destino.reportId;
  } else {
    const { data: rep, error: rErr } = await supabase
      .from("rti_reports")
      .insert({
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

  // 3) Áreas (cria as que faltam, casando por nome)
  const { data: areasData, error: aErr } = await supabase
    .from("rti_areas")
    .select("*")
    .eq("report_id", reportId);
  if (aErr) throw aErr;
  const areaIdByNome = new Map((areasData as RtiArea[]).map((a) => [a.nome, a.id]));
  let maxOrdem = (areasData as RtiArea[]).reduce((m, a) => Math.max(m, a.ordem), 0);
  const areasFaltantes = [...new Set(points.map((p) => p.area_nome.trim()))]
    .filter((nome) => !areaIdByNome.has(nome));
  for (const nome of areasFaltantes) {
    maxOrdem += 1;
    const { data: area, error } = await supabase
      .from("rti_areas")
      .insert({ report_id: reportId, nome, ordem: maxOrdem })
      .select()
      .single();
    if (error) throw error;
    areaIdByNome.set(nome, (area as RtiArea).id);
  }

  // 4) Numeração sequencial a partir do maior número existente no relatório
  const { data: maxData } = await supabase
    .from("rti_ncs")
    .select("numero")
    .eq("report_id", reportId)
    .order("numero", { ascending: false })
    .limit(1);
  let numero = (maxData?.[0]?.numero ?? 0) as number;

  // 5) Cria as NCs (uma por achado), na ordem dos pontos
  const pointById = new Map(points.map((p) => [p.id, p]));
  const ordered = [...findings].sort((a, b) => {
    const pa = pointById.get(a.point_id)!;
    const pb = pointById.get(b.point_id)!;
    return pa.ordem - pb.ordem || pa.created_at.localeCompare(pb.created_at) || a.created_at.localeCompare(b.created_at);
  });

  let ncsCriadas = 0;
  let fotosCopiadas = 0;
  const totalEtapas = ordered.length + photos.length;
  let done = 0;

  for (const finding of ordered) {
    const point = pointById.get(finding.point_id)!;
    numero += 1;
    const descricao =
      `${point.nome}: ${finding.descricao}` +
      (finding.observacao?.trim() ? `\n\nObservação de campo: ${finding.observacao.trim()}` : "");

    const { data: ncData, error: ncErr } = await supabase
      .from("rti_ncs")
      .insert({
        report_id: reportId,
        area_id: areaIdByNome.get(point.area_nome.trim())!,
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
        situacao_atual: null,
        concluida_em: null,
      })
      .select()
      .single();
    if (ncErr) throw ncErr;
    const nc = ncData as RtiNc;
    ncsCriadas += 1;
    done += 1;
    onProgress?.("Criando NCs", done, totalEtapas);

    // 6) Fotos do achado → evidências de constatação (cópia independente)
    for (const ph of photosByFinding.get(finding.id) ?? []) {
      const ext = ph.file_path.split(".").pop() ?? "jpg";
      const novoPath = `evidencias/${crypto.randomUUID()}.${ext}`;
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
      texto: `NC composta a partir da coleta em campo "${inspection.titulo}" (ponto: ${point.nome})`,
      autor_nome: actorName,
    });
  }

  // 7) Marca a coleta como importada e vincula ao relatório
  const { error: upErr } = await supabase
    .from("field_inspections")
    .update({ status: "importada", report_id: reportId })
    .eq("id", inspection.id);
  if (upErr) throw upErr;

  return { reportId, ncsCriadas, fotosCopiadas };
}
