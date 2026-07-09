// "Mais usados no topo": frequência local de modos de falha (spec §5.1).
// Conta sobre os achados existentes no Dexie — custo zero, sem telemetria.

import type { RtiModoFalha } from "@/lib/types";

export function contarUsoModos(
  findings: Array<{ modo_falha_id: string | null }>,
): Map<string, number> {
  const uso = new Map<string, number>();
  for (const f of findings) {
    if (!f.modo_falha_id) continue;
    uso.set(f.modo_falha_id, (uso.get(f.modo_falha_id) ?? 0) + 1);
  }
  return uso;
}

export function maisUsados(
  modos: RtiModoFalha[],
  uso: Map<string, number>,
  n: number,
): RtiModoFalha[] {
  return modos
    .filter((m) => (uso.get(m.id) ?? 0) > 0)
    .sort((a, b) => (uso.get(b.id) ?? 0) - (uso.get(a.id) ?? 0))
    .slice(0, n);
}
