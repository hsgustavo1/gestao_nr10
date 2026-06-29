import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type {
  Employee,
  NR10Training,
  WorkAuthorization,
  WorkInstruction,
  ITTraining,
  TrainingCertificate,
} from "./qualificacoes";

// ── Query Keys ───────────────────────────────────────────────────────────────
export const qualKeys = {
  employees: ["employees"] as const,
  employee: (id: string) => ["employees", id] as const,
  nr10: (employeeId?: string) => ["nr10_trainings", employeeId] as const,
  authorizations: ["work_authorizations"] as const,
  instructions: ["work_instructions"] as const,
  itTrainings: (employeeId?: string) => ["it_trainings", employeeId] as const,
};

// ── Employees ────────────────────────────────────────────────────────────────
export function useEmployees(statusFilter: "ativo" | "afastado" | "desligado" | "all" = "ativo") {
  const { currentOrgId } = useAuth();
  return useQuery({
    queryKey: [...qualKeys.employees, statusFilter, currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      let q = supabase.from("employees").select("*").eq("org_id", currentOrgId!);
      if (statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }
      const { data, error } = await q.order("name");
      if (error) throw error;
      return data as Employee[];
    },
  });
}

export function useUpsertEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Employee> & { name: string; matricula: string }) => {
      const { data, error } = await supabase
        .from("employees")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qualKeys.employees }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qualKeys.employees }),
  });
}

// ── NR-10 Trainings ──────────────────────────────────────────────────────────
export function useNR10Trainings(employeeId?: string) {
  const { currentOrgId } = useAuth();
  return useQuery({
    queryKey: [...qualKeys.nr10(employeeId), currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      let q = supabase.from("nr10_trainings").select("*").eq("org_id", currentOrgId!);
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data, error } = await q;
      if (error) throw error;
      return data as NR10Training[];
    },
  });
}

export function useUpsertNR10Training() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<NR10Training, "id" | "created_at" | "updated_at"> & { id?: string },
    ) => {
      const { data, error } = await supabase
        .from("nr10_trainings")
        .upsert(payload, { onConflict: "employee_id,training_type,category" })
        .select()
        .single();
      if (error) throw error;
      // Nova reciclagem limpa a flag de reciclagem extraordinária pendente
      // (gatilhos: retorno de afastamento > 3 meses, mudança de função).
      if (payload.category === "reciclagem") {
        await supabase
          .from("employees")
          .update({ reciclagem_requerida: false, reciclagem_motivo: null })
          .eq("id", payload.employee_id);
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nr10_trainings"] });
      qc.invalidateQueries({ queryKey: qualKeys.employees });
    },
  });
}

/** Registro de treinamento em turma: um upsert por colaborador selecionado. */
export function useRegistrarTurma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employeeIds,
      training,
    }: {
      employeeIds: string[];
      training: Omit<NR10Training, "id" | "created_at" | "updated_at" | "employee_id">;
    }) => {
      const rows = employeeIds.map((employee_id) => ({ ...training, employee_id }));
      const { error } = await supabase
        .from("nr10_trainings")
        .upsert(rows, { onConflict: "employee_id,training_type,category" });
      if (error) throw error;
      // Reciclagem em turma também limpa a flag de reciclagem extraordinária
      if (training.category === "reciclagem" && employeeIds.length > 0) {
        await supabase
          .from("employees")
          .update({ reciclagem_requerida: false, reciclagem_motivo: null })
          .in("id", employeeIds);
      }
      return rows.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nr10_trainings"] });
      qc.invalidateQueries({ queryKey: qualKeys.employees });
    },
  });
}

// ── Work Authorizations ───────────────────────────────────────────────────────
// NOTE: is_current is a new column added by migration 20260608300000_authorization_archive.sql.
// Supabase generated types will include it once the migration is applied and types are regenerated.
// Until then, we cast through unknown to satisfy the type checker.

export function useWorkAuthorizations() {
  const { currentOrgId } = useAuth();
  return useQuery({
    queryKey: [...qualKeys.authorizations, currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const q = supabase
        .from("work_authorizations")
        .select("*, employees(name, matricula, setor)")
        .eq("org_id", currentOrgId!);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (q as any).eq("is_current", true);
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertAuthorization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<WorkAuthorization, "id" | "created_at" | "updated_at" | "is_current"> & {
        id?: string;
      },
    ) => {
      const wa = supabase.from("work_authorizations");

      // Archive the current authorization for this employee
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (wa.update({ is_current: false } as any) as any)
        .eq("employee_id", payload.employee_id)
        .eq("is_current", true);

      // Insert new authorization as current
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (wa.insert({ ...payload, is_current: true } as any) as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qualKeys.authorizations });
      qc.invalidateQueries({ queryKey: ["authorization_history"] });
    },
  });
}

export function useAuthorizationHistory(employeeId: string) {
  return useQuery({
    queryKey: ["authorization_history", employeeId],
    queryFn: async () => {
      const q = supabase.from("work_authorizations").select("*").eq("employee_id", employeeId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (q as any)
        .eq("is_current", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as WorkAuthorization[];
    },
    enabled: !!employeeId,
  });
}

// ── Work Instructions ─────────────────────────────────────────────────────────
export function useWorkInstructions() {
  const { currentOrgId } = useAuth();
  return useQuery({
    queryKey: [...qualKeys.instructions, currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_instructions")
        .select("*")
        .eq("org_id", currentOrgId!)
        .order("code");
      if (error) throw error;
      return data as WorkInstruction[];
    },
  });
}

export function useUpsertInstruction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<WorkInstruction> & { code: string }) => {
      const { data, error } = await supabase
        .from("work_instructions")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qualKeys.instructions }),
  });
}

// ── IT Trainings ──────────────────────────────────────────────────────────────
export function useITTrainings(employeeId?: string) {
  const { currentOrgId } = useAuth();
  return useQuery({
    queryKey: [...qualKeys.itTrainings(employeeId), currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      let q = supabase
        .from("it_trainings")
        .select("*, work_instructions(code, title)")
        .eq("org_id", currentOrgId!);
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertITTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<ITTraining, "id" | "created_at" | "updated_at"> & { id?: string },
    ) => {
      const { data, error } = await supabase
        .from("it_trainings")
        .upsert(payload, { onConflict: "employee_id,instruction_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it_trainings"] });
    },
  });
}

// ── Batch import (used by xlsx import page) ───────────────────────────────────
export async function batchImportQualificacoes(payload: {
  // status (employees), employee_id e is_current são resolvidos internamente:
  // employee_id vem do mapeamento por matrícula; is_current é definido no insert;
  // status usa o default do banco ('ativo') preservando afastados/desligados em reimportações.
  employees: Omit<Employee, "id" | "created_at" | "updated_at" | "status">[];
  nr10Trainings: Array<
    Omit<NR10Training, "id" | "created_at" | "updated_at" | "employee_id"> & { matricula: string }
  >;
  authorizations: Array<
    Omit<WorkAuthorization, "id" | "created_at" | "updated_at" | "employee_id" | "is_current"> & {
      matricula: string;
    }
  >;
  instructions: Omit<WorkInstruction, "id" | "created_at" | "updated_at">[];
  itTrainings: {
    matricula: string;
    instructionCode: string;
    status: string;
    conclusao_date: string | null;
    org_id: string;
  }[];
}) {
  // Step 1: upsert employees, get back IDs mapped by matricula
  const { data: empData, error: empErr } = await supabase
    .from("employees")
    .upsert(payload.employees, { onConflict: "matricula,org_id" })
    .select("id, matricula");
  if (empErr) throw empErr;

  const matriculaToId = Object.fromEntries(
    (empData as { id: string; matricula: string }[]).map((e) => [e.matricula, e.id]),
  );

  // Step 2: upsert work_instructions
  if (payload.instructions.length > 0) {
    const { error } = await supabase
      .from("work_instructions")
      .upsert(payload.instructions, { onConflict: "code" });
    if (error) throw error;
  }

  // Step 3: upsert nr10_trainings (attach employee_id via matricula)
  if (payload.nr10Trainings.length > 0) {
    const rows = payload.nr10Trainings
      .filter((t) => matriculaToId[t.matricula])
      .map(({ matricula: _m, ...rest }) => ({ ...rest, employee_id: matriculaToId[_m] }));
    if (rows.length > 0) {
      const { error } = await supabase
        .from("nr10_trainings")
        .upsert(rows, { onConflict: "employee_id,training_type,category" });
      if (error) throw error;
    }
  }

  // Step 4: archive + insert work_authorizations (attach employee_id via matricula)
  if (payload.authorizations.length > 0) {
    const rows = payload.authorizations
      .filter((a) => matriculaToId[a.matricula])
      .map(({ matricula: _m, ...rest }) => ({ ...rest, employee_id: matriculaToId[_m] }));
    if (rows.length > 0) {
      const employeeIds = rows.map((r) => r.employee_id);
      // Archive current authorizations for affected employees
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("work_authorizations").update({ is_current: false } as any) as any)
        .in("employee_id", employeeIds)
        .eq("is_current", true);
      // Insert new authorizations as current

      const { error } = await (supabase
        .from("work_authorizations")
        .insert(rows.map((r) => ({ ...r, is_current: true })) as any) as any);
      if (error) throw error;
    }
  }

  // Step 5: fetch instruction codes → IDs
  const { data: instrData } = await supabase.from("work_instructions").select("id, code");
  const codeToId = Object.fromEntries(
    ((instrData ?? []) as { id: string; code: string }[]).map((i) => [i.code, i.id]),
  );

  // Step 6: upsert it_trainings
  const itRows = payload.itTrainings
    .filter((t) => matriculaToId[t.matricula] && codeToId[t.instructionCode])
    .map((t) => ({
      employee_id: matriculaToId[t.matricula],
      instruction_id: codeToId[t.instructionCode],
      status: t.status,
      conclusao_date: t.conclusao_date,
      org_id: t.org_id,
    }));
  if (itRows.length > 0) {
    const { error } = await supabase
      .from("it_trainings")
      .upsert(itRows, { onConflict: "employee_id,instruction_id" });
    if (error) throw error;
  }

  return matriculaToId;
}

// ── Training Certificates ────────────────────────────────────────────────────

export function useCertificates(employeeId?: string, trainingId?: string) {
  return useQuery({
    queryKey: ["training_certificates", employeeId, trainingId],
    queryFn: async () => {
      let q = supabase
        .from("training_certificates")
        .select("*")
        .order("uploaded_at", { ascending: false });
      if (employeeId) q = q.eq("employee_id", employeeId);
      if (trainingId) q = q.eq("nr10_training_id", trainingId);
      const { data, error } = await q;
      if (error) throw error;
      return data as TrainingCertificate[];
    },
    enabled: !!(employeeId || trainingId),
  });
}

export function useInsertCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<TrainingCertificate, "id" | "uploaded_at" | "created_at">) => {
      const { data, error } = await supabase
        .from("training_certificates")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["training_certificates", vars.employee_id] });
    },
  });
}

export function useDeleteCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, employeeId }: { id: string; employeeId: string }) => {
      const { error } = await supabase.from("training_certificates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["training_certificates", vars.employeeId] });
    },
  });
}

export async function uploadCertificateFile(
  employeeId: string,
  file: File,
  suffix?: string,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `${employeeId}/${Date.now()}${suffix ? `_${suffix}` : ""}.${ext}`;
  const { error } = await supabase.storage.from("certificates").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("certificates").getPublicUrl(path);
  return data.publicUrl;
}
