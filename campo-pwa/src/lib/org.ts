// Orgs do usuário no PWA.
//
// O org_id das RAÍZES (field_inspections) precisa ser informado quando o usuário
// pode operar em 2+ orgs (consultor que gerencia vários clientes) — senão a
// trigger fn_default_org_id deixa NULL e o INSERT viola NOT NULL no servidor.
//
// IMPORTANTE: a fonte é `organizations` (não `org_memberships`). O consultor
// GERENCIA clientes via managed_by_org_id sem ser MEMBRO deles — a RLS de
// `organizations` já devolve "membro direto + filhas (parent) + clientes
// (managed_by)". Usar org_memberships só traria a consultoria, fazendo a
// inspeção subir na consultoria em vez de no cliente.
//
// Cacheado em localStorage para uso offline (1º login é online → sync popula).

import { supabase } from "./supabase";

const ORGS_KEY = "campo_orgs"; // lista completa {id, nome, tipo, ...}
const IDS_KEY = "campo_org_ids"; // legado: só ids (retrocompat de getActiveOrgId)
const ACTIVE_KEY = "campo_active_org_id";

export interface OrgLite {
  id: string;
  nome: string;
  tipo: "consultoria" | "cliente" | "unidade";
  managed_by_org_id: string | null;
  parent_org_id: string | null;
}

/** Busca as orgs do usuário (online) e atualiza o cache local. Silencioso offline. */
export async function refreshOrgContext(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, nome, tipo, managed_by_org_id, parent_org_id");
    if (error || !data) return;
    const orgs = data as OrgLite[];
    const ids = [...new Set(orgs.map((o) => o.id))];
    localStorage.setItem(ORGS_KEY, JSON.stringify(orgs));
    localStorage.setItem(IDS_KEY, JSON.stringify(ids));
    // Se só há uma org operável, ela é a ativa. Se há várias, mantém a seleção
    // anterior caso ainda seja válida; senão cai na primeira operável.
    const operable = operableFrom(orgs);
    const active = localStorage.getItem(ACTIVE_KEY);
    if (operable.length === 1) {
      localStorage.setItem(ACTIVE_KEY, operable[0].id);
    } else if (operable.length > 1 && (!active || !operable.some((o) => o.id === active))) {
      localStorage.setItem(ACTIVE_KEY, operable[0].id);
    }
  } catch {
    // Offline ou sem sessão — mantém o cache existente.
  }
}

/** Orgs onde uma inspeção pode existir: tudo menos a consultoria (que só gerencia). */
function operableFrom(orgs: OrgLite[]): OrgLite[] {
  const leaves = orgs.filter((o) => o.tipo !== "consultoria");
  // Defesa: se por algum motivo só veio a consultoria, não trava o usuário.
  return leaves.length > 0 ? leaves : orgs;
}

/** Lista (do cache) de orgs para as quais o usuário pode criar inspeção. */
export function getOperableOrgs(): OrgLite[] {
  try {
    const raw = localStorage.getItem(ORGS_KEY);
    if (!raw) return [];
    return operableFrom(JSON.parse(raw) as OrgLite[]);
  } catch {
    return [];
  }
}

/** org_id ativo (do cache). undefined se nunca sincronizou online neste aparelho. */
export function getActiveOrgId(): string | undefined {
  return localStorage.getItem(ACTIVE_KEY) ?? undefined;
}

/** Limpa o cache de org (chamar no logout). */
export function clearOrgContext(): void {
  localStorage.removeItem(ORGS_KEY);
  localStorage.removeItem(IDS_KEY);
  localStorage.removeItem(ACTIVE_KEY);
}
