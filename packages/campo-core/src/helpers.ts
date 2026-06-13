// Generic tree helpers for the campo domain.
// These accept FieldNode (base type) — LocalNode is structurally compatible
// (LocalNode = FieldNode & { _synced: boolean }), so call sites in campo-pwa
// can pass LocalNode[] without casting.

import type { FieldNode, NodeType, RtiModoFalha, NormaRef } from './types'

// ── Árvore Setor → Ativo → Componente ────────────────────────────────────────

/** Próximo nível abaixo (setor→ativo→componente); componente não tem filho. */
export function proximoNivel(tipo: NodeType | null): NodeType | null {
  if (tipo === null) return 'setor'
  if (tipo === 'setor') return 'ativo'
  if (tipo === 'ativo') return 'componente'
  return null
}

/** Rótulo legível para cada nível da árvore. */
export function labelDoTipo(tipo: NodeType | null): string {
  if (tipo === 'setor') return 'Setor'
  if (tipo === 'ativo') return 'Ativo'
  if (tipo === 'componente') return 'Componente'
  return 'Item'
}

// ── Helpers de navegação na árvore ───────────────────────────────────────────

/**
 * Caminho do setor (raiz) até o nó informado, inclusive.
 * Aceita o array completo de FieldNode e constrói o Map internamente.
 */
export function nodePath(nodeId: string, allNodes: FieldNode[]): FieldNode[] {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]))
  const path: FieldNode[] = []
  let current = nodeMap.get(nodeId)
  let guard = 0
  while (current && guard++ < 10) {
    path.unshift(current)
    current = current.parent_id ? nodeMap.get(current.parent_id) : undefined
  }
  return path
}

/** Filhos diretos de um nó (parentId null = setores na raiz), ordenados por ordem e nome. */
export function filhosDoNo<T extends FieldNode>(parentId: string | null, allNodes: T[]): T[] {
  return allNodes
    .filter((n) => n.parent_id === parentId)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
}

// ── Modos de falha ────────────────────────────────────────────────────────────

/** Agrupa modos de falha ativos por categoria, na ordem do seed. */
export function modosPorCategoria(modos: RtiModoFalha[]): Map<string, RtiModoFalha[]> {
  const map = new Map<string, RtiModoFalha[]>()
  for (const m of [...modos].sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label))) {
    if (!m.ativo) continue
    const arr = map.get(m.categoria)
    if (arr) arr.push(m)
    else map.set(m.categoria, [m])
  }
  return map
}

/** Formata as referências normativas de um modo de falha (ex.: "NBR 5410 6.4 · NR-10 10.2.8"). */
export function formatNormas(normas: NormaRef[]): string {
  return normas
    .map((n) => (n.item && n.item !== '—' ? `${n.norma} ${n.item}` : n.norma))
    .join(' · ')
}
