import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Inspection, InspectionAction, InspectionType } from "./inspecoes";

export const inspecaoKeys = {
  inspections: (type?: InspectionType) => ["inspections", type ?? "all"] as const,
  actions: (inspectionId?: string) => ["inspection_actions", inspectionId ?? "all"] as const,
};

export function useInspections(type?: InspectionType) {
  return useQuery({
    queryKey: inspecaoKeys.inspections(type),
    queryFn: async () => {
      let q = supabase.from("inspections").select("*");
      if (type) q = q.eq("inspection_type", type);
      const { data, error } = await q.order("inspection_date", { ascending: false });
      if (error) throw error;
      return data as Inspection[];
    },
  });
}

export function useUpsertInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<Inspection, "id" | "created_at" | "updated_at"> & { id?: string },
    ) => {
      const { data, error } = await supabase
        .from("inspections")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as Inspection;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inspections"] }),
  });
}

export function useDeleteInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (insp: { id: string; report_path: string | null }) => {
      const { error } = await supabase.from("inspections").delete().eq("id", insp.id);
      if (error) throw error;
      if (insp.report_path) {
        await supabase.storage.from("inspection-docs").remove([insp.report_path]);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inspections"] }),
  });
}

// ── Plano de ação ────────────────────────────────────────────────────────────

export function useInspectionActions(inspectionId?: string) {
  return useQuery({
    queryKey: inspecaoKeys.actions(inspectionId),
    queryFn: async () => {
      let q = supabase.from("inspection_actions").select("*");
      if (inspectionId) q = q.eq("inspection_id", inspectionId);
      const { data, error } = await q.order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as InspectionAction[];
    },
  });
}

/** Todas as ações abertas, com a inspeção relacionada (para o painel de pendências). */
export function useOpenActions(type?: InspectionType) {
  return useQuery({
    queryKey: ["inspection_actions_open", type ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("inspection_actions")
        .select("*, inspections(inspection_type, equipment, sector)")
        .neq("status", "concluida");
      const { data, error } = await q.order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      const rows = data as Array<InspectionAction & {
        inspections: { inspection_type: InspectionType; equipment: string; sector: string | null } | null;
      }>;
      return type ? rows.filter((r) => r.inspections?.inspection_type === type) : rows;
    },
  });
}

export function useUpsertInspectionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<InspectionAction, "id" | "created_at" | "updated_at"> & { id?: string },
    ) => {
      const { data, error } = await supabase
        .from("inspection_actions")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as InspectionAction;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspection_actions"] });
      qc.invalidateQueries({ queryKey: ["inspection_actions_open"] });
    },
  });
}

export function useDeleteInspectionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inspection_actions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspection_actions"] });
      qc.invalidateQueries({ queryKey: ["inspection_actions_open"] });
    },
  });
}

// ── Arquivos ─────────────────────────────────────────────────────────────────

export async function uploadInspectionReport(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `${crypto.randomUUID()}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("inspection-docs").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export function inspectionReportUrl(path: string): string {
  const { data } = supabase.storage.from("inspection-docs").getPublicUrl(path);
  return data.publicUrl;
}
