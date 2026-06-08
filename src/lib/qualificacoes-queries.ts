import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Employee, NR10Training, WorkAuthorization, WorkInstruction, ITTraining } from "./qualificacoes";

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
export function useEmployees() {
  return useQuery({
    queryKey: qualKeys.employees,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("active", true)
        .order("name");
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
      const { error } = await supabase.from("employees").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qualKeys.employees }),
  });
}

// ── NR-10 Trainings ──────────────────────────────────────────────────────────
export function useNR10Trainings(employeeId?: string) {
  return useQuery({
    queryKey: qualKeys.nr10(employeeId),
    queryFn: async () => {
      let q = supabase.from("nr10_trainings").select("*");
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
    mutationFn: async (payload: Omit<NR10Training, "id" | "created_at" | "updated_at"> & { id?: string }) => {
      const { data, error } = await supabase
        .from("nr10_trainings")
        .upsert(payload, { onConflict: "employee_id,training_type,category" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nr10_trainings"] });
    },
  });
}

// ── Work Authorizations ───────────────────────────────────────────────────────
export function useWorkAuthorizations() {
  return useQuery({
    queryKey: qualKeys.authorizations,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_authorizations")
        .select("*, employees(name, matricula, setor)");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertAuthorization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<WorkAuthorization, "id" | "created_at" | "updated_at"> & { id?: string }) => {
      const { data, error } = await supabase
        .from("work_authorizations")
        .upsert(payload, { onConflict: "employee_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qualKeys.authorizations }),
  });
}

// ── Work Instructions ─────────────────────────────────────────────────────────
export function useWorkInstructions() {
  return useQuery({
    queryKey: qualKeys.instructions,
    queryFn: async () => {
      const { data, error } = await supabase.from("work_instructions").select("*").order("code");
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
  return useQuery({
    queryKey: qualKeys.itTrainings(employeeId),
    queryFn: async () => {
      let q = supabase.from("it_trainings").select("*, work_instructions(code, title)");
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
    mutationFn: async (payload: Omit<ITTraining, "id" | "created_at" | "updated_at"> & { id?: string }) => {
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
  employees: Omit<Employee, "id" | "created_at" | "updated_at">[];
  nr10Trainings: Array<Omit<NR10Training, "id" | "created_at" | "updated_at"> & { matricula: string }>;
  authorizations: Array<Omit<WorkAuthorization, "id" | "created_at" | "updated_at"> & { matricula: string }>;
  instructions: Omit<WorkInstruction, "id" | "created_at" | "updated_at">[];
  itTrainings: { matricula: string; instructionCode: string; status: string; conclusao_date: string | null }[];
}) {
  // Step 1: upsert employees, get back IDs mapped by matricula
  const { data: empData, error: empErr } = await supabase
    .from("employees")
    .upsert(payload.employees, { onConflict: "matricula" })
    .select("id, matricula");
  if (empErr) throw empErr;

  const matriculaToId = Object.fromEntries(
    (empData as { id: string; matricula: string }[]).map((e) => [e.matricula, e.id])
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

  // Step 4: upsert work_authorizations (attach employee_id via matricula)
  if (payload.authorizations.length > 0) {
    const rows = payload.authorizations
      .filter((a) => matriculaToId[a.matricula])
      .map(({ matricula: _m, ...rest }) => ({ ...rest, employee_id: matriculaToId[_m] }));
    if (rows.length > 0) {
      const { error } = await supabase
        .from("work_authorizations")
        .upsert(rows, { onConflict: "employee_id" });
      if (error) throw error;
    }
  }

  // Step 5: fetch instruction codes → IDs
  const { data: instrData } = await supabase.from("work_instructions").select("id, code");
  const codeToId = Object.fromEntries(
    ((instrData ?? []) as { id: string; code: string }[]).map((i) => [i.code, i.id])
  );

  // Step 6: upsert it_trainings
  const itRows = payload.itTrainings
    .filter((t) => matriculaToId[t.matricula] && codeToId[t.instructionCode])
    .map((t) => ({
      employee_id: matriculaToId[t.matricula],
      instruction_id: codeToId[t.instructionCode],
      status: t.status,
      conclusao_date: t.conclusao_date,
    }));
  if (itRows.length > 0) {
    const { error } = await supabase
      .from("it_trainings")
      .upsert(itRows, { onConflict: "employee_id,instruction_id" });
    if (error) throw error;
  }

  return matriculaToId;
}
