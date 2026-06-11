// Tree helpers for campo-pwa — logic mirrors src/lib/campo.ts in the main app,
// adapted to work with LocalNode arrays (IndexedDB / Dexie) instead of Map lookups.

import type { LocalNode } from '@/db/dexie'
import type { NodeType, RtiModoFalha, NormaRef } from '@/lib/types'

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
 * Aceita o array completo de LocalNode e constrói o Map internamente.
 */
export function nodePath(nodeId: string, allNodes: LocalNode[]): LocalNode[] {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]))
  const path: LocalNode[] = []
  let current = nodeMap.get(nodeId)
  let guard = 0
  while (current && guard++ < 10) {
    path.unshift(current)
    current = current.parent_id ? nodeMap.get(current.parent_id) : undefined
  }
  return path
}

/** Nó-setor (raiz) do caminho de um nó. */
export function setorDoNo(nodeId: string, allNodes: LocalNode[]): LocalNode | null {
  const path = nodePath(nodeId, allNodes)
  return path[0] ?? null
}

/** Nomes abaixo do setor (ativo › componente) — usado como prefixo de NC. */
export function caminhoAbaixoDoSetor(nodeId: string, allNodes: LocalNode[]): string {
  const path = nodePath(nodeId, allNodes)
  return path
    .slice(1)
    .map((n) => n.nome)
    .join(' › ')
}

/** Filhos diretos de um nó (parentId null = setores na raiz), ordenados por ordem e nome. */
export function filhosDoNo(parentId: string | null, allNodes: LocalNode[]): LocalNode[] {
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
