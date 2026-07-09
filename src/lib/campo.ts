import type { RtiTipoExecucao } from "./rti";

// ── Coleta em Campo (RTI) v2 — árvore hierárquica + fluxo foto-primeiro ──────
// O engenheiro consultor coleta em campo organizando por uma árvore
// Setor → Ativo → Componente. Ele "estaciona" num nível e cria pontos de
// coleta sucessivos: cada ponto = fotos + 1..N modos de falha (achados).

export type NormaRef = { norma: string; item: string };

export type RtiModoFalha = {
  id: string;
  org_id: string | null;
  /** Disponível para todas as empresas (catálogo da dona do app). */
  publico: boolean;
  codigo: string;
  label: string;
  categoria: string;
  descricao_padrao: string;
  recomendacao_padrao: string | null;
  prioridade_sugerida: number;
  tipo_execucao_sugerido: RtiTipoExecucao;
  normas: NormaRef[];
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export const FIELD_INSPECTION_STATUSES = ["em_andamento", "finalizada", "importada"] as const;
export type FieldInspectionStatus = (typeof FIELD_INSPECTION_STATUSES)[number];

export const FIELD_INSPECTION_STATUS_LABELS: Record<FieldInspectionStatus, string> = {
  em_andamento: "Em andamento",
  finalizada: "Finalizada",
  importada: "RTI composto",
};

export const FIELD_INSPECTION_STATUS_BADGE: Record<FieldInspectionStatus, string> = {
  em_andamento: "border-amber-300 bg-amber-50 text-amber-700",
  finalizada: "border-blue-300 bg-blue-50 text-blue-700",
  importada: "border-emerald-300 bg-emerald-50 text-emerald-700",
};

export type FieldInspection = {
  id: string;
  org_id?: string; // multi-tenancy: coluna autoritativa do servidor (ver campo-core/types.ts)
  titulo: string;
  cliente: string | null;
  local: string | null;
  engenheiro: string | null;
  data_inspecao: string;
  status: FieldInspectionStatus;
  report_id: string | null;
  notes: string | null;
  /** Segmento industrial (trilha A) — dispara sugestão de modelo de estrutura. */
  segmento?: string | null;
  created_by_name: string | null;
  arquivada_campo: boolean; // arquivada no campo (oculta da lista do PWA, sem apagar no servidor)
  // Visibilidade por entrega (migração 20260620100000): procedência + estado de
  // entrega. created_by_org_id é server-set; entregue_em libera a leitura ao cliente.
  created_by_org_id?: string | null;
  entregue_em?: string | null;
  entregue_por_org?: string | null;
  created_at: string;
  updated_at: string;
};

// ── Árvore Setor → Ativo → Componente ────────────────────────────────────────

export const NIVEIS_ARVORE = ["setor", "ativo", "componente"] as const;
export type NivelArvore = (typeof NIVEIS_ARVORE)[number];

export const NIVEL_LABEL: Record<NivelArvore, string> = {
  setor: "Setor",
  ativo: "Ativo",
  componente: "Componente",
};

export const NIVEL_LABEL_PLURAL: Record<NivelArvore, string> = {
  setor: "Setores",
  ativo: "Ativos",
  componente: "Componentes",
};

/** Próximo nível abaixo (setor→ativo→componente); componente é o último. */
export function proximoNivel(nivel: NivelArvore | null): NivelArvore | null {
  if (nivel === null) return "setor";
  if (nivel === "setor") return "ativo";
  if (nivel === "ativo") return "componente";
  return null; // componente não tem filho
}

export type FieldNode = {
  id: string;
  org_id?: string;
  inspection_id: string;
  parent_id: string | null;
  nivel: NivelArvore;
  nome: string;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type FieldPoint = {
  id: string;
  org_id?: string;
  inspection_id: string;
  node_id: string;
  titulo: string | null;
  observacoes: string | null;
  ordem: number;
  /** Quem estava logado quando o ponto foi criado — null em dados pré-migração. */
  collected_by_user_id: string | null;
  collected_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type FieldFinding = {
  id: string;
  org_id?: string;
  point_id: string;
  modo_falha_id: string | null; // null = entrada manual do consultor
  descricao: string;
  recomendacao: string | null;
  prioridade: number;
  tipo_execucao: RtiTipoExecucao;
  observacao: string | null;
  created_at: string;
  updated_at: string;
};

/** Achado manual em edição na UI (antes de virar field_finding). */
export type AchadoNovoUI = {
  descricao: string;
  recomendacao: string | null;
  prioridade: number;
  tipo_execucao: RtiTipoExecucao;
  observacao: string | null;
};

export type FieldPhoto = {
  id: string;
  org_id?: string;
  point_id: string;
  file_path: string;
  file_name: string;
  legenda: string | null;
  ordem: number;
  /** NC evidenciada por esta foto (null = foto geral do ponto ou pré-migração). */
  finding_id: string | null;
  /** Posição no momento da captura (null = GPS indisponível/negado). */
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy: number | null;
  created_at: string;
};

// ── Helpers da árvore ────────────────────────────────────────────────────────

/** Caminho do setor (raiz) até o nó informado, inclusive. */
export function nodePath(nodeId: string, byId: Map<string, FieldNode>): FieldNode[] {
  const path: FieldNode[] = [];
  let cur: FieldNode | undefined = byId.get(nodeId);
  let guard = 0;
  while (cur && guard++ < 10) {
    path.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return path;
}

/** Nó-setor (raiz) do caminho de um nó. */
export function setorDoNo(nodeId: string, byId: Map<string, FieldNode>): FieldNode | null {
  const path = nodePath(nodeId, byId);
  return path[0] ?? null;
}

/** Nomes abaixo do setor (ativo › componente) — usado como prefixo da NC. */
export function caminhoAbaixoDoSetor(nodeId: string, byId: Map<string, FieldNode>): string {
  const path = nodePath(nodeId, byId);
  return path
    .slice(1)
    .map((n) => n.nome)
    .join(" › ");
}

/**
 * Lista deduplicada de coletores de campo (field_points.collected_by_name),
 * na ordem de primeira aparição. null quando nenhum ponto tem coletor
 * registrado (dado legado pré-migração, ou lista vazia).
 */
export function coletoresCampoDe(points: FieldPoint[]): string[] | null {
  const nomes: string[] = [];
  for (const p of points) {
    if (p.collected_by_name && !nomes.includes(p.collected_by_name)) {
      nomes.push(p.collected_by_name);
    }
  }
  return nomes.length > 0 ? nomes : null;
}

/** Filhos diretos de um nó (parentId null = setores na raiz). */
export function filhosDoNo(parentId: string | null, nodes: FieldNode[]): FieldNode[] {
  return nodes
    .filter((n) => (n.parent_id ?? null) === parentId)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
}

/** Agrupa modos de falha ativos por categoria, na ordem do seed. */
export function modosPorCategoria(modos: RtiModoFalha[]): Map<string, RtiModoFalha[]> {
  const map = new Map<string, RtiModoFalha[]>();
  for (const m of [...modos].sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label))) {
    if (!m.ativo) continue;
    const arr = map.get(m.categoria);
    if (arr) arr.push(m);
    else map.set(m.categoria, [m]);
  }
  return map;
}

/** Formata as referências normativas de um modo de falha (ex.: "NBR 5410 6.4 · NR-10 10.2.8"). */
export function formatNormas(normas: NormaRef[]): string {
  return normas
    .map((n) => (n.item && n.item !== "—" ? `${n.norma} ${n.item}` : n.norma))
    .join(" · ");
}

// ── Carga de estrutura por planilha ──────────────────────────────────────────

/** Linha da planilha de carga da árvore. */
export type EstruturaLinha = { setor: string; ativo: string | null; componente: string | null };

/** Deduplica e ordena as linhas de carga, ignorando vazias. */
export function normalizarEstrutura(linhas: EstruturaLinha[]): EstruturaLinha[] {
  const seen = new Set<string>();
  const out: EstruturaLinha[] = [];
  for (const l of linhas) {
    const setor = l.setor?.trim();
    if (!setor) continue;
    const ativo = l.ativo?.trim() || null;
    const componente = ativo ? l.componente?.trim() || null : null; // componente exige ativo
    const key = `${setor}|${ativo ?? ""}|${componente ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ setor, ativo, componente });
  }
  return out;
}

// ── Redimensionamento de fotos no cliente ────────────────────────────────────
// Fotos saem do celular/câmera com 8–20 MB; reduzimos para ~1024px JPEG antes do
// upload. Além da conexão de campo ruim, isso segura o crescimento do storage do
// Supabase (decisão de MVP em 2026-07-02: alvo 1024px em todos os uploads).
// Não-imagens (PDF) passam intactas; qualquer falha cai no original.

export async function resizeImage(file: File, maxDim = 1024, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    // Qualquer falha no resize não pode impedir a coleta: sobe o original.
    return file;
  }
}

/**
 * Fotos que evidenciam um achado específico (trilha C, usa o finding_id da trilha B):
 * se o achado tem fotos vinculadas, só elas entram; senão, as fotos soltas do ponto
 * (finding_id null) servem de evidência compartilhada. Foto vinculada a OUTRO achado
 * nunca entra.
 */
export function fotosParaAchado<T extends { finding_id: string | null }>(
  fotosDoPonto: T[],
  findingId: string,
): T[] {
  const vinculadas = fotosDoPonto.filter((f) => f.finding_id === findingId);
  if (vinculadas.length > 0) return vinculadas;
  return fotosDoPonto.filter((f) => !f.finding_id);
}
