import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { ASO } from "./asos";

export const asoKeys = {
  asos: (employeeId?: string) => ["asos", employeeId ?? "all"] as const,
};

export type ASOWithEmployee = ASO & {
  employees: { name: string; matricula: string; setor: string | null } | null;
};

export function useASOs(employeeId?: string) {
  const { currentOrgId } = useAuth();
  return useQuery({
    queryKey: [...asoKeys.asos(employeeId), currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      let q = supabase
        .from("asos")
        .select("*, employees(name, matricula, setor)")
        .eq("org_id", currentOrgId!);
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data, error } = await q.order("exam_date", { ascending: false });
      if (error) throw error;
      return data as unknown as ASOWithEmployee[];
    },
  });
}

export function useUpsertASO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<ASO, "id" | "created_at" | "updated_at"> & { id?: string },
    ) => {
      const { data, error } = await supabase
        .from("asos")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as ASO;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asos"] }),
  });
}

export function useDeleteASO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (aso: { id: string; file_path: string | null }) => {
      const { error } = await supabase.from("asos").delete().eq("id", aso.id);
      if (error) throw error;
      if (aso.file_path) {
        await supabase.storage.from("aso-docs").remove([aso.file_path]);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asos"] }),
  });
}

// ── Arquivos ─────────────────────────────────────────────────────────────────

export async function uploadASOFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `${crypto.randomUUID()}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("aso-docs").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export function asoFileUrl(path: string): string {
  const { data } = supabase.storage.from("aso-docs").getPublicUrl(path);
  return data.publicUrl;
}
