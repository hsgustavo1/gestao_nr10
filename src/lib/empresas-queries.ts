import { supabase } from "@/integrations/supabase/client";
import type { Org, OrgTipo } from "@/lib/auth-context";

// Tabelas/RPCs de tenancy ainda não estão em types.ts (mantido à mão). Isolamos
// o acesso não-tipado aqui — mesmo padrão de auth-context.tsx — para o resto do
// app seguir tipado nas chamadas a estas funções.
const sb = supabase as unknown as {
  from: (t: string) => any;
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/** Linha de empresa para a tela de gestão: dados da org + status + módulos. */
export type EmpresaRow = Org & { ativa: boolean; entitlements: string[] };

/** Carrega as orgs visíveis pela RLS (platform admin vê tudo, inclusive inativas;
 * consultor vê a consultoria + clientes ativos geridos) com seus entitlements. */
export async function fetchEmpresas(): Promise<EmpresaRow[]> {
  const [orgRes, entRes] = await Promise.all([
    sb.from("organizations").select("id, nome, tipo, parent_org_id, managed_by_org_id, ativa"),
    sb.from("org_entitlements").select("org_id, module"),
  ]);
  if (orgRes.error) throw new Error(orgRes.error.message);

  const entMap = new Map<string, string[]>();
  ((entRes.data ?? []) as { org_id: string; module: string }[]).forEach((e) => {
    const arr = entMap.get(e.org_id) ?? [];
    arr.push(e.module);
    entMap.set(e.org_id, arr);
  });

  return ((orgRes.data ?? []) as (Org & { ativa: boolean | null })[]).map((o) => ({
    id: o.id,
    nome: o.nome,
    tipo: o.tipo,
    parent_org_id: o.parent_org_id,
    managed_by_org_id: o.managed_by_org_id,
    ativa: o.ativa ?? true,
    entitlements: entMap.get(o.id) ?? [],
  }));
}

export async function createOrg(input: {
  nome: string;
  tipo: OrgTipo;
  managedBy: string | null;
  parent: string | null;
  entitlements: string[];
}): Promise<string> {
  const { data, error } = await sb.rpc("fn_create_org", {
    p_nome: input.nome,
    p_tipo: input.tipo,
    p_managed_by: input.managedBy,
    p_parent: input.parent,
    p_entitlements: input.entitlements,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function updateOrg(input: {
  org: string;
  nome: string;
  managedBy: string | null;
  parent: string | null;
}): Promise<void> {
  const { error } = await sb.rpc("fn_update_org", {
    p_org: input.org,
    p_nome: input.nome,
    p_managed_by: input.managedBy,
    p_parent: input.parent,
  });
  if (error) throw new Error(error.message);
}

export async function setOrgEntitlements(org: string, entitlements: string[]): Promise<void> {
  const { error } = await sb.rpc("fn_set_org_entitlements", {
    p_org: org,
    p_entitlements: entitlements,
  });
  if (error) throw new Error(error.message);
}

export async function setOrgActive(org: string, ativa: boolean): Promise<void> {
  const { error } = await sb.rpc("fn_set_org_active", { p_org: org, p_ativa: ativa });
  if (error) throw new Error(error.message);
}

/** Exclui a empresa de vez (só platform admin). A RPC bloqueia se houver unidades
 * filhas, clientes geridos ou dados de domínio — nesse caso, desative em vez de excluir. */
export async function deleteOrg(org: string): Promise<void> {
  const { error } = await sb.rpc("fn_delete_org", { p_org: org });
  if (error) throw new Error(error.message);
}
