import type { RtiTipoExecucao } from "./rti";

// ── Coleta em Campo (RTI) — tipos e constantes ───────────────────────────────
// O engenheiro consultor coleta em campo (fotos + modos de falha pré-mapeados,
// com entrada manual quando o modo não existe) e o sistema compõe o RTI.

export type NormaRef = { norma: string; item: string };

export type RtiModoFalha = {
  id: string;
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
export type FieldInspectionStatus = typeof FIELD_INSPECTION_STATUSES[number];

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
  titulo: string;
  cliente: string | null;
  local: string | null;
  engenheiro: string | null;
  data_inspecao: string;
  status: FieldInspectionStatus;
  report_id: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type FieldPoint = {
  id: string;
  inspection_id: string;
  area_nome: string;
  nome: string;
  ordem: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type FieldFinding = {
  id: string;
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

export type FieldPhoto = {
  id: string;
  finding_id: string;
  file_path: string;
  file_name: string;
  legenda: string | null;
  created_at: string;
};

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

// ── Redimensionamento de fotos no cliente ────────────────────────────────────
// Fotos de campo saem do celular com 8–20 MB; reduzimos para ~1600px JPEG
// antes do upload (conexão de campo costuma ser ruim).

export async function resizeImage(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
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
