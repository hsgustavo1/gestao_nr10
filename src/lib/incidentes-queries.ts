import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ElectricalIncident } from "./incidentes";

export function useIncidents() {
  return useQuery({
    queryKey: ["electrical_incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("electrical_incidents")
        .select("*")
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ElectricalIncident[];
    },
  });
}

export function useUpsertIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<ElectricalIncident, "id" | "created_at" | "updated_at"> & { id?: string },
    ) => {
      const { data, error } = await supabase
        .from("electrical_incidents")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as ElectricalIncident;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["electrical_incidents"] }),
  });
}

export function useDeleteIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (incident: { id: string; file_path: string | null }) => {
      const { error } = await supabase.from("electrical_incidents").delete().eq("id", incident.id);
      if (error) throw error;
      if (incident.file_path) {
        await supabase.storage.from("inspection-docs").remove([incident.file_path]);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["electrical_incidents"] }),
  });
}

// ── Arquivos (bucket inspection-docs, pasta incidents/) ──────────────────────

export async function uploadIncidentFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `incidents/${crypto.randomUUID()}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("inspection-docs").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export function incidentFileUrl(path: string): string {
  const { data } = supabase.storage.from("inspection-docs").getPublicUrl(path);
  return data.publicUrl;
}
