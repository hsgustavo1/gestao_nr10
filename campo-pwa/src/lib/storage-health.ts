// Saúde do armazenamento local: persistência garantida (anti-eviction do SO)
// e visibilidade do volume que existe SÓ no aparelho.
// Spec §3.1 (2026-07-08 cofre e portão): nunca bloquear a coleta; degradar avisando.

export type StorageEstimateLite = { usage: number; quota: number };

const LOW_ABS_BYTES = 500 * 1024 * 1024; // 500 MB
const LOW_PCT = 0.1;

export function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1).replace(".", ",").replace(",0", "")} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/** Mensagem de alerta quando o aparelho está enchendo; null quando ok/desconhecido. */
export function storageWarning(est: StorageEstimateLite | null): string | null {
  if (!est || !est.quota) return null;
  const free = est.quota - est.usage;
  if (free < LOW_ABS_BYTES || free / est.quota < LOW_PCT) {
    return `Armazenamento quase cheio (${formatBytes(free)} livres) — faça backup e sincronize`;
  }
  return null;
}

/** Pede persistência ao SO. Retorna o estado final (true = protegido contra eviction). */
export async function ensurePersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageEstimate(): Promise<StorageEstimateLite | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    if (usage == null || quota == null) return null;
    return { usage, quota };
  } catch {
    return null;
  }
}
