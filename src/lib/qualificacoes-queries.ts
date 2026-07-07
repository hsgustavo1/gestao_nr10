import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { resizeImage } from "@/lib/campo";
import { mensagemUploadAmigavel } from "@/lib/upload";
import { slugify } from "@/lib/storage-paths";
import type {
  Employee,
  EmployeeFormacao,
  EmployeePlh,
  EmployeeCreaAnuidade,
  NR10Training,
  WorkAuthorization,
  WorkInstruction,
  ITTraining,
  TrainingCertificate,
  TrainingType,
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
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async (payload: Partial<Employee> & { name: string; matricula: string }) => {
      // Colunas de data no Postgres rejeitam string vazia — o form envia "" quando o campo fica em branco.
      const normalized = {
        ...payload,
        diploma_conclusao: payload.diploma_conclusao || null,
      };
      const body = !normalized.id && currentOrgId ? { ...normalized, org_id: currentOrgId } : normalized;
      const { data, error } = await supabase
        .from("employees")
        .upsert(body as never, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qualKeys.employees }),
  });
}

export type EmployeeDocKind = "diploma" | "historico";

/** Pasta do colaborador no bucket: slug do nome + id (identifica visualmente no Storage). */
function employeeDocFolder(employee: { id: string; name: string }): string {
  return `${slugify(employee.name)}-${employee.id}`;
}

/** Pasta da formação dentro do colaborador: slug do texto da formação + id. */
function formacaoDocFolder(formacaoId: string, formacaoTexto: string): string {
  const slug = slugify(formacaoTexto);
  return slug ? `${slug}-${formacaoId}` : formacaoId;
}

/** Anexa diploma ou histórico escolar de uma formação (bucket "certificates", uma subpasta por formação). */
export async function uploadFormacaoDoc(
  employee: { id: string; name: string },
  formacaoId: string,
  formacaoTexto: string,
  kind: EmployeeDocKind,
  file: File,
): Promise<string> {
  const resized = await resizeImage(file, 1024);
  const ext = resized.name.split(".").pop() ?? "pdf";
  const path = `${employeeDocFolder(employee)}/${formacaoDocFolder(formacaoId, formacaoTexto)}/${kind}.${ext}`;
  const { error } = await supabase.storage.from("certificates").upload(path, resized, {
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw new Error(mensagemUploadAmigavel(error));
  return path;
}

export function employeeDocUrl(path: string): string {
  const { data } = supabase.storage.from("certificates").getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteEmployeeDoc(path: string): Promise<void> {
  const { error } = await supabase.storage.from("certificates").remove([path]);
  if (error) throw new Error(mensagemUploadAmigavel(error));
}

// ── Formações (Escolaridade) ────────────────────────────────────────────────
const FORMACAO_DOC_COLUMN: Record<EmployeeDocKind, "diploma_arquivo_path" | "historico_arquivo_path"> = {
  diploma: "diploma_arquivo_path",
  historico: "historico_arquivo_path",
};

/** Todas as formações da org, agrupadas por colaborador — usado no resumo da listagem. */
export function useFormacoesByOrg() {
  const { currentOrgId } = useAuth();
  return useQuery({
    queryKey: ["employee_formacoes", "by_org", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_formacoes")
        .select("*")
        .eq("org_id", currentOrgId!)
        .order("created_at");
      if (error) throw error;
      const byEmployee = new Map<string, EmployeeFormacao[]>();
      for (const row of data as EmployeeFormacao[]) {
        const list = byEmployee.get(row.employee_id) ?? [];
        list.push(row);
        byEmployee.set(row.employee_id, list);
      }
      return byEmployee;
    },
  });
}

export function useEmployeeFormacoes(employeeId?: string) {
  return useQuery({
    queryKey: ["employee_formacoes", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_formacoes")
        .select("*")
        .eq("employee_id", employeeId!)
        .order("created_at");
      if (error) throw error;
      return data as EmployeeFormacao[];
    },
  });
}

export function useAddFormacao() {
  const qc = useQueryClient();
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async ({ employeeId, formacao }: { employeeId: string; formacao: string }) => {
      const { data, error } = await supabase
        .from("employee_formacoes")
        .insert({ employee_id: employeeId, org_id: currentOrgId!, formacao } as never)
        .select()
        .single();
      if (error) throw error;
      return data as EmployeeFormacao;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["employee_formacoes", vars.employeeId] }),
  });
}

export function useUpdateFormacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      employeeId,
      formacao,
      diploma_conclusao,
    }: {
      id: string;
      employeeId: string;
      formacao: string;
      diploma_conclusao: string | null;
    }) => {
      const { error } = await supabase
        .from("employee_formacoes")
        .update({ formacao, diploma_conclusao: diploma_conclusao || null } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["employee_formacoes", vars.employeeId] }),
  });
}

export function useDeleteFormacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      employeeId,
      diploma_arquivo_path,
      historico_arquivo_path,
    }: {
      id: string;
      employeeId: string;
      diploma_arquivo_path: string | null;
      historico_arquivo_path: string | null;
    }) => {
      // Remove os anexos do Storage antes da linha — a policy de DELETE em storage.objects
      // exige fn_employee_editable, que depende do employee_id ainda existir na tabela filha.
      const paths = [diploma_arquivo_path, historico_arquivo_path].filter((p): p is string => !!p);
      if (paths.length) {
        const { error: storageError } = await supabase.storage.from("certificates").remove(paths);
        if (storageError) throw new Error(mensagemUploadAmigavel(storageError));
      }
      const { error } = await supabase.from("employee_formacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["employee_formacoes", vars.employeeId] }),
  });
}

/** Anexa (ou substitui) o diploma/histórico escolar de uma formação e grava o caminho no registro. */
export function useAttachFormacaoDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employee,
      formacaoId,
      formacaoTexto,
      kind,
      file,
    }: {
      employee: { id: string; name: string };
      formacaoId: string;
      formacaoTexto: string;
      kind: EmployeeDocKind;
      file: File;
    }) => {
      const path = await uploadFormacaoDoc(employee, formacaoId, formacaoTexto, kind, file);
      const column = FORMACAO_DOC_COLUMN[kind];
      const { error } = await supabase
        .from("employee_formacoes")
        .update({ [column]: path } as never)
        .eq("id", formacaoId);
      if (error) throw error;
      return path;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["employee_formacoes", vars.employee.id] }),
  });
}

/** Remove o anexo (diploma/histórico) do Storage e limpa o caminho na formação. */
export function useRemoveFormacaoDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employeeId,
      formacaoId,
      kind,
      path,
    }: {
      employeeId: string;
      formacaoId: string;
      kind: EmployeeDocKind;
      path: string;
    }) => {
      await deleteEmployeeDoc(path);
      const column = FORMACAO_DOC_COLUMN[kind];
      const { error } = await supabase
        .from("employee_formacoes")
        .update({ [column]: null } as never)
        .eq("id", formacaoId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["employee_formacoes", vars.employeeId] }),
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

// ── PLH (Profissional Legalmente Habilitado) ────────────────────────────────
export type PlhDocKind = "termo_nomeacao" | "art_cargo_funcao";

const PLH_DOC_COLUMN: Record<PlhDocKind, "termo_nomeacao_arquivo_path" | "art_cargo_funcao_arquivo_path"> = {
  termo_nomeacao: "termo_nomeacao_arquivo_path",
  art_cargo_funcao: "art_cargo_funcao_arquivo_path",
};

/** Anexa termo de nomeação ou ART de cargo/função (bucket "certificates", subpasta "plh" do colaborador). */
export async function uploadPlhDoc(
  employee: { id: string; name: string },
  kind: PlhDocKind,
  file: File,
): Promise<string> {
  const resized = await resizeImage(file, 1024);
  const ext = resized.name.split(".").pop() ?? "pdf";
  const path = `${employeeDocFolder(employee)}/plh/${kind}.${ext}`;
  const { error } = await supabase.storage.from("certificates").upload(path, resized, {
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw new Error(mensagemUploadAmigavel(error));
  return path;
}

export function useEmployeePlh(employeeId?: string) {
  return useQuery({
    queryKey: ["employee_plh", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_plh")
        .select("*")
        .eq("employee_id", employeeId!)
        .maybeSingle();
      if (error) throw error;
      return data as EmployeePlh | null;
    },
  });
}

/** Todos os registros de PLH da org, indexados por colaborador — usado na visão agregada de Habilitação. */
export function usePlhByOrg() {
  const { currentOrgId } = useAuth();
  return useQuery({
    queryKey: ["employee_plh", "by_org", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_plh").select("*").eq("org_id", currentOrgId!);
      if (error) throw error;
      return new Map((data as EmployeePlh[]).map((row) => [row.employee_id, row]));
    },
  });
}

export function useUpsertEmployeePlh() {
  const qc = useQueryClient();
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      employeeId: string;
      termo_nomeacao_data: string | null;
      art_cargo_funcao: string | null;
    }) => {
      const { data, error } = await supabase
        .from("employee_plh")
        .upsert(
          {
            employee_id: payload.employeeId,
            org_id: currentOrgId!,
            termo_nomeacao_data: payload.termo_nomeacao_data || null,
            art_cargo_funcao: payload.art_cargo_funcao || null,
          } as never,
          { onConflict: "employee_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data as EmployeePlh;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["employee_plh", vars.employeeId] }),
  });
}

/** Anexa (ou substitui) o termo de nomeação/ART e grava o caminho no registro de PLH. */
export function useAttachPlhDoc() {
  const qc = useQueryClient();
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async ({
      employee,
      kind,
      file,
    }: {
      employee: { id: string; name: string };
      kind: PlhDocKind;
      file: File;
    }) => {
      const path = await uploadPlhDoc(employee, kind, file);
      const column = PLH_DOC_COLUMN[kind];
      const { error } = await supabase
        .from("employee_plh")
        .upsert({ employee_id: employee.id, org_id: currentOrgId!, [column]: path } as never, {
          onConflict: "employee_id",
        });
      if (error) throw error;
      return path;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["employee_plh", vars.employee.id] }),
  });
}

export function useRemovePlhDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, kind, path }: { employeeId: string; kind: PlhDocKind; path: string }) => {
      await deleteEmployeeDoc(path);
      const column = PLH_DOC_COLUMN[kind];
      const { error } = await supabase.from("employee_plh").update({ [column]: null } as never).eq(
        "employee_id",
        employeeId,
      );
      if (error) throw error;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["employee_plh", vars.employeeId] }),
  });
}

// ── Anuidades CREA/CFT ───────────────────────────────────────────────────────
export function useCreaAnuidades(employeeId?: string) {
  return useQuery({
    queryKey: ["employee_crea_anuidades", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_crea_anuidades")
        .select("*")
        .eq("employee_id", employeeId!)
        .order("ano", { ascending: false });
      if (error) throw error;
      return data as EmployeeCreaAnuidade[];
    },
  });
}

/** Todas as anuidades da org, agrupadas por colaborador — usado na visão agregada de Habilitação. */
export function useCreaAnuidadesByOrg() {
  const { currentOrgId } = useAuth();
  return useQuery({
    queryKey: ["employee_crea_anuidades", "by_org", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_crea_anuidades")
        .select("*")
        .eq("org_id", currentOrgId!);
      if (error) throw error;
      const byEmployee = new Map<string, EmployeeCreaAnuidade[]>();
      for (const row of data as EmployeeCreaAnuidade[]) {
        const list = byEmployee.get(row.employee_id) ?? [];
        list.push(row);
        byEmployee.set(row.employee_id, list);
      }
      return byEmployee;
    },
  });
}

export function useAddCreaAnuidade() {
  const qc = useQueryClient();
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async ({
      employeeId,
      ano,
      validade_ate,
    }: {
      employeeId: string;
      ano: number;
      validade_ate?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("employee_crea_anuidades")
        .insert({
          employee_id: employeeId,
          org_id: currentOrgId!,
          ano,
          validade_ate: validade_ate || null,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as EmployeeCreaAnuidade;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["employee_crea_anuidades", vars.employeeId] }),
  });
}

export function useUpdateCreaAnuidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      employeeId,
      validade_ate,
    }: {
      id: string;
      employeeId: string;
      validade_ate: string | null;
    }) => {
      const { error } = await supabase
        .from("employee_crea_anuidades")
        .update({ validade_ate: validade_ate || null } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["employee_crea_anuidades", vars.employeeId] }),
  });
}

export function useDeleteCreaAnuidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      employeeId,
      comprovante_arquivo_path,
    }: {
      id: string;
      employeeId: string;
      comprovante_arquivo_path: string | null;
    }) => {
      if (comprovante_arquivo_path) await deleteEmployeeDoc(comprovante_arquivo_path);
      const { error } = await supabase.from("employee_crea_anuidades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["employee_crea_anuidades", vars.employeeId] }),
  });
}

export function useAttachAnuidadeDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employee,
      anuidadeId,
      ano,
      file,
    }: {
      employee: { id: string; name: string };
      anuidadeId: string;
      ano: number;
      file: File;
    }) => {
      const resized = await resizeImage(file, 1024);
      const ext = resized.name.split(".").pop() ?? "pdf";
      const path = `${employeeDocFolder(employee)}/plh/anuidade-${ano}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("certificates").upload(path, resized, {
        cacheControl: "3600",
        upsert: true,
      });
      if (uploadError) throw new Error(mensagemUploadAmigavel(uploadError));
      const { error } = await supabase
        .from("employee_crea_anuidades")
        .update({ comprovante_arquivo_path: path } as never)
        .eq("id", anuidadeId);
      if (error) throw error;
      return path;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["employee_crea_anuidades", vars.employee.id] }),
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
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async (
      payload: Omit<NR10Training, "id" | "created_at" | "updated_at"> & { id?: string },
    ) => {
      const body = !payload.id && currentOrgId ? { ...payload, org_id: currentOrgId } : payload;
      const { data, error } = await supabase
        .from("nr10_trainings")
        .upsert(body as never, { onConflict: "employee_id,training_type,category" })
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
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async ({
      employeeIds,
      training,
    }: {
      employeeIds: string[];
      training: Omit<NR10Training, "id" | "created_at" | "updated_at" | "employee_id">;
    }) => {
      const rows = employeeIds.map((employee_id) => ({
        ...training,
        employee_id,
        ...(currentOrgId ? { org_id: currentOrgId } : {}),
      }));
      const { error } = await supabase
        .from("nr10_trainings")
        .upsert(rows as never, { onConflict: "employee_id,training_type,category" });
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
  const { currentOrgId } = useAuth();
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

      // Insert new authorization as current — carimba a org ativa (fn_default_org_id
      // só cobre usuário de 1 org; consultor/platform admin precisam do org_id explícito).
      // payload.id (quando presente) é o id da autorização anterior sendo editada — ela
      // é arquivada acima (is_current: false), não reaproveitada, senão o insert abaixo
      // colide com a mesma primary key e falha com "duplicate key value".
      const { id: _previousId, ...rest } = payload;
      const body = currentOrgId ? { ...rest, org_id: currentOrgId } : rest;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (wa.insert({ ...body, is_current: true } as any) as any)
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
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async (payload: Partial<WorkInstruction> & { code: string }) => {
      const body = !payload.id && currentOrgId ? { ...payload, org_id: currentOrgId } : payload;
      const { data, error } = await supabase
        .from("work_instructions")
        .upsert(body as never, { onConflict: "id" })
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
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async (
      payload: Omit<ITTraining, "id" | "created_at" | "updated_at"> & { id?: string },
    ) => {
      const body = !payload.id && currentOrgId ? { ...payload, org_id: currentOrgId } : payload;
      const { data, error } = await supabase
        .from("it_trainings")
        .upsert(body as never, { onConflict: "employee_id,instruction_id" })
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
    // Carimbado pelo caller (admin.qualificacoes.carga.tsx) só na hora da importação —
    // ausente durante o parse da planilha.
    org_id?: string;
  }[];
}) {
  // Step 1: upsert employees, get back IDs mapped by matricula
  const { data: empData, error: empErr } = await supabase
    .from("employees")
    .upsert(payload.employees as never, { onConflict: "matricula,org_id" })
    .select("id, matricula");
  if (empErr) throw empErr;

  const matriculaToId = Object.fromEntries(
    (empData as { id: string; matricula: string }[]).map((e) => [e.matricula, e.id]),
  );

  // Step 2: upsert work_instructions
  if (payload.instructions.length > 0) {
    const { error } = await supabase
      .from("work_instructions")
      .upsert(payload.instructions as never, { onConflict: "code,org_id" });
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
        .upsert(rows as never, { onConflict: "employee_id,training_type,category" });
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
      .upsert(itRows as never, { onConflict: "employee_id,instruction_id" });
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
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async (
      payload: Omit<TrainingCertificate, "id" | "uploaded_at" | "created_at" | "org_id">,
    ) => {
      if (!currentOrgId) throw new Error("Selecione uma organização antes de importar certificados.");
      const { data, error } = await supabase
        .from("training_certificates")
        .insert({ ...payload, org_id: currentOrgId } as never)
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

/**
 * Importa um certificado (já recortado) fazendo-o "conversar" com a aba
 * Capacitações: sobe o arquivo na pasta do colaborador, encontra o treinamento
 * correspondente (colaborador + tipo + categoria — chave única em nr10_trainings)
 * ou cria um novo, e insere o certificado VINCULADO a esse treinamento — assim o
 * pop-up do treinamento passa a exibi-lo. Em conflito de data, a data do
 * certificado prevalece; carga horária só preenche se o treino não tiver.
 */
export async function importCertificateAsTraining(params: {
  employee: { id: string; name: string; matricula: string };
  orgId: string;
  trainingType: TrainingType;
  category: "formacao" | "reciclagem";
  issueDate: string | null;
  workloadHours: number | null;
  file: File;
  baseName: string;
  sourceLabel: string;
  pagesInSource: string;
}): Promise<void> {
  const { url } = await uploadCertificateForEmployee(params.employee, params.file, params.baseName);

  // 1) Treino correspondente (chave única employee_id+training_type+category).
  const { data: existing, error: selErr } = await supabase
    .from("nr10_trainings")
    .select("id, carga_horaria")
    .eq("employee_id", params.employee.id)
    .eq("training_type", params.trainingType)
    .eq("category", params.category)
    .eq("org_id", params.orgId)
    .maybeSingle();
  if (selErr) throw selErr;

  let trainingId: string;
  if (existing) {
    trainingId = existing.id as string;
    // Atualiza sem sobrescrever dados já preenchidos: data do certificado prevalece;
    // carga horária só entra se estiver vazia no treino.
    const patch: Record<string, unknown> = {};
    if (params.issueDate) patch.training_date = params.issueDate;
    if (existing.carga_horaria == null && params.workloadHours != null) {
      patch.carga_horaria = params.workloadHours;
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("nr10_trainings")
        .update(patch as never)
        .eq("id", trainingId);
      if (error) throw error;
    }
  } else {
    const { data, error } = await supabase
      .from("nr10_trainings")
      .insert({
        employee_id: params.employee.id,
        org_id: params.orgId,
        training_type: params.trainingType,
        category: params.category,
        training_date: params.issueDate,
        carga_horaria: params.workloadHours,
        valid: true, // certificado anexado é a evidência de que o treino ocorreu
      } as never)
      .select("id")
      .single();
    if (error) throw error;
    trainingId = data.id as string;
  }

  // 2) Certificado vinculado ao treinamento.
  const { error: certErr } = await supabase.from("training_certificates").insert({
    employee_id: params.employee.id,
    org_id: params.orgId,
    nr10_training_id: trainingId,
    training_type: params.trainingType,
    category: params.category,
    file_url: url,
    file_name: `${params.baseName}.pdf`,
    issue_date: params.issueDate,
    source_file: params.sourceLabel,
    pages_in_source: params.pagesInSource,
  } as never);
  if (certErr) throw certErr;
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
  const resized = await resizeImage(file, 1024);
  const ext = resized.name.split(".").pop() ?? "pdf";
  const path = `${employeeId}/${Date.now()}${suffix ? `_${suffix}` : ""}.${ext}`;
  const { error } = await supabase.storage.from("certificates").upload(path, resized, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(mensagemUploadAmigavel(error));
  const { data } = supabase.storage.from("certificates").getPublicUrl(path);
  return data.publicUrl;
}

/** Pasta de certificados do colaborador: {matricula}_{slug(nome)} — junta todos os certificados dele. */
function certificateEmployeeFolder(employee: { name: string; matricula: string }): string {
  return `${employee.matricula}_${slugify(employee.name)}`;
}

/**
 * Sobe um certificado JÁ RECORTADO (só as páginas do colaborador) para a pasta
 * {matricula}_{nome}/ do bucket, agrupando todos os certificados do colaborador
 * no mesmo nível hierárquico. `baseName` identifica o certificado dentro da pasta.
 */
export async function uploadCertificateForEmployee(
  employee: { name: string; matricula: string },
  file: File,
  baseName: string,
): Promise<{ url: string; path: string }> {
  const resized = await resizeImage(file, 1024);
  const ext = resized.name.split(".").pop() ?? "pdf";
  const path = `${certificateEmployeeFolder(employee)}/${baseName}.${ext}`;
  const { error } = await supabase.storage.from("certificates").upload(path, resized, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(mensagemUploadAmigavel(error));
  const { data } = supabase.storage.from("certificates").getPublicUrl(path);
  return { url: data.publicUrl, path };
}
