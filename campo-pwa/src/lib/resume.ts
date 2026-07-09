// Retomada de contexto: última posição de trabalho (inspeção→ponto), com expiry.
// Spec cofre e portão §6.2. Sem mudança de schema — localStorage basta.

const KEY = "campo-resume";
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12h

export type ResumePoint = {
  inspectionId: string;
  /** Texto humano do banner: "Subestação 2 → QGBT-03". */
  label: string;
  /** Rota completa para navegar de volta. */
  path: string;
  at: string; // ISO
};

export function saveResume(p: ResumePoint, storage: Storage = localStorage): void {
  try {
    storage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage cheio/indisponível — retomada é conveniência, nunca erro */
  }
}

export function getResume(
  now: number = Date.now(),
  storage: Storage = localStorage,
): ResumePoint | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ResumePoint;
    if (!p?.path || !p?.at) return null;
    if (now - Date.parse(p.at) > MAX_AGE_MS) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearResume(storage: Storage = localStorage): void {
  try {
    storage.removeItem(KEY);
  } catch {
    /* idem */
  }
}
