import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { EPI, EPITest } from "./epis";

export const epiKeys = {
  epis: ["epis"] as const,
  tests: (epiId?: string) => ["epi_tests", epiId ?? "all"] as const,
};

export type EPIWithEmployee = EPI & {
  employees: { name: string; matricula: string; setor: string | null } | null;
};

export function useEPIs(includeInactive = false) {
  const { currentOrgId } = useAuth();
  return useQuery({
    queryKey: [...epiKeys.epis, includeInactive, currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      let q = supabase
        .from("epis")
        .select("*, employees(name, matricula, setor)")
        .eq("org_id", currentOrgId!);
      if (!includeInactive) q = q.eq("active", true);
      const { data, error } = await q.order("epi_type").order("serial_number");
      if (error) throw error;
      return data as unknown as EPIWithEmployee[];
    },
  });
}

export function useUpsertEPI() {
  const qc = useQueryClient();
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async (
      payload: Omit<EPI, "id" | "created_at" | "updated_at"> & { id?: string },
    ) => {
      // Ao criar (sem id), carimba a org ativa — fn_default_org_id só cobre usuário
      // de 1 org; consultor/platform admin precisam do org_id explícito.
      const body = !payload.id && currentOrgId ? { ...payload, org_id: currentOrgId } : payload;
      const { data, error } = await supabase
        .from("epis")
        .upsert(body as never, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as EPI;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: epiKeys.epis }),
  });
}

export function useDeleteEPI() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("epis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: epiKeys.epis }),
  });
}

// ── Ensaios ──────────────────────────────────────────────────────────────────

export function useEPITests(epiId?: string) {
  return useQuery({
    queryKey: epiKeys.tests(epiId),
    queryFn: async () => {
      let q = supabase.from("epi_tests").select("*");
      if (epiId) q = q.eq("epi_id", epiId);
      const { data, error } = await q.order("test_date", { ascending: false });
      if (error) throw error;
      return data as EPITest[];
    },
  });
}

export function useInsertEPITest() {
  const qc = useQueryClient();
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async (payload: Omit<EPITest, "id" | "created_at">) => {
      const body = currentOrgId ? { ...payload, org_id: currentOrgId } : payload;
      const { data, error } = await supabase
        .from("epi_tests")
        .insert(body as never)
        .select()
        .single();
      if (error) throw error;
      return data as EPITest;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["epi_tests"] }),
  });
}

export function useDeleteEPITest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (test: { id: string; certificate_path: string | null }) => {
      const { error } = await supabase.from("epi_tests").delete().eq("id", test.id);
      if (error) throw error;
      if (test.certificate_path) {
        await supabase.storage.from("epi-docs").remove([test.certificate_path]);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["epi_tests"] }),
  });
}

// ── Arquivos ─────────────────────────────────────────────────────────────────

export async function uploadEPICertificate(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `${crypto.randomUUID()}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("epi-docs").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export function epiCertificateUrl(path: string): string {
  const { data } = supabase.storage.from("epi-docs").getPublicUrl(path);
  return data.publicUrl;
}
