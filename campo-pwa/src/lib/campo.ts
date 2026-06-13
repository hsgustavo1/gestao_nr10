// Generic tree helpers now live in packages/campo-core.
// LocalNode-specific helpers remain here because they need the exact LocalNode
// return type from @/db/dexie.
export {
  proximoNivel,
  labelDoTipo,
  filhosDoNo,
  modosPorCategoria,
  formatNormas,
} from '@gestao/campo-core'

import type { LocalNode } from '@/db/dexie'
import { nodePath } from '@gestao/campo-core'

/** Re-exported for call sites that import nodePath from @/lib/campo. */
export { nodePath }

/** Nó-setor (raiz) do caminho de um nó. */
export function setorDoNo(nodeId: string, allNodes: LocalNode[]): LocalNode | null {
  const path = nodePath(nodeId, allNodes)
  return (path[0] as LocalNode | undefined) ?? null
}

/** Nomes abaixo do setor (ativo › componente) — usado como prefixo de NC. */
export function caminhoAbaixoDoSetor(nodeId: string, allNodes: LocalNode[]): string {
  const path = nodePath(nodeId, allNodes)
  return path
    .slice(1)
    .map((n) => n.nome)
    .join(' › ')
}
