// Autor (usuário logado) que coleta os dados em campo neste device.
//
// Cacheado em localStorage a partir da sessão Supabase (mesmo padrão de
// org.ts) — evita repetir uma chamada de sessão em todo ponto criado, e
// mantém o nome disponível mesmo se o refresh de sessão falhar
// momentaneamente offline.

import { supabase } from "./supabase";

const ACTOR_ID_KEY = "campo_actor_id";
const ACTOR_NAME_KEY = "campo_actor_name";

/** Lê a sessão atual e atualiza o cache do autor. Chamar 1x por navegação autenticada. */
export async function cacheActor(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return;
    const name = (user.user_metadata?.full_name as string | undefined) || user.email || null;
    localStorage.setItem(ACTOR_ID_KEY, user.id);
    if (name) localStorage.setItem(ACTOR_NAME_KEY, name);
    else localStorage.removeItem(ACTOR_NAME_KEY);
  } catch {
    // Offline ou sessão inválida — mantém o cache existente.
  }
}

/** id do autor cacheado, ou null se nunca logou neste device. */
export function getActorId(): string | null {
  return localStorage.getItem(ACTOR_ID_KEY);
}

/** Nome do autor cacheado, ou null se nunca logou neste device. */
export function getActorName(): string | null {
  return localStorage.getItem(ACTOR_NAME_KEY);
}

/** Limpa o cache do autor (chamar no logout). */
export function clearActor(): void {
  localStorage.removeItem(ACTOR_ID_KEY);
  localStorage.removeItem(ACTOR_NAME_KEY);
}
