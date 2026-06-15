// Org ativa do usuário no PWA.
//
// O org_id das RAÍZES (field_inspections) precisa ser informado quando o usuário
// pertence a 2+ orgs (consultor que gerencia vários clientes) — senão a trigger
// fn_default_org_id deixa NULL e o INSERT viola NOT NULL no servidor.
//
// Para usuário single-org a trigger do banco resolve sozinha; mesmo assim
// cacheamos a org para deixar o registro local completo e o path de Storage
// escopado por org.
//
// Fonte: org_memberships (RLS permite o usuário ler as próprias). Cacheado em
// localStorage para uso offline. Seletor de org no PWA (multi-org) = Fase 2.

import { supabase } from './supabase'

const ORGS_KEY = 'campo_org_ids'
const ACTIVE_KEY = 'campo_active_org_id'

/** Busca as orgs do usuário (online) e atualiza o cache local. Silencioso offline. */
export async function refreshOrgContext(): Promise<void> {
  try {
    const { data, error } = await supabase.from('org_memberships').select('org_id')
    if (error || !data) return
    const ids = [...new Set(data.map((m: { org_id: string }) => m.org_id))]
    localStorage.setItem(ORGS_KEY, JSON.stringify(ids))
    // Se só há uma org, ela é a ativa. Se há várias, mantém a seleção anterior
    // caso ainda seja válida; senão cai na primeira (seletor completo = Fase 2).
    const active = localStorage.getItem(ACTIVE_KEY)
    if (ids.length === 1) {
      localStorage.setItem(ACTIVE_KEY, ids[0])
    } else if (ids.length > 1 && (!active || !ids.includes(active))) {
      localStorage.setItem(ACTIVE_KEY, ids[0])
    }
  } catch {
    // Offline ou sem sessão — mantém o cache existente.
  }
}

/** org_id ativo (do cache). undefined se nunca sincronizou online neste aparelho. */
export function getActiveOrgId(): string | undefined {
  return localStorage.getItem(ACTIVE_KEY) ?? undefined
}

/** Limpa o cache de org (chamar no logout). */
export function clearOrgContext(): void {
  localStorage.removeItem(ORGS_KEY)
  localStorage.removeItem(ACTIVE_KEY)
}
