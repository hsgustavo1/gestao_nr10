import { differenceInDays } from "date-fns";

// ── Categorias do Prontuário das Instalações Elétricas (NR-10 10.2.3/10.2.4) ──

export const PIE_CATEGORIES = [
  "esquema_unifilar",
  "procedimentos",
  "inspecoes_spda_aterramento",
  "especificacao_epi_epc",
  "qualificacao_trabalhadores",
  "testes_isolacao",
  "certificacao_areas_classificadas",
  "relatorio_inspecoes",
  "outros",
] as const;

export type PIECategory = typeof PIE_CATEGORIES[number];

export const PIE_CATEGORY_LABELS: Record<PIECategory, string> = {
  esquema_unifilar: "Esquema unifilar atualizado",
  procedimentos: "Procedimentos e instruções técnicas e administrativas",
  inspecoes_spda_aterramento: "Inspeções e medições do SPDA e aterramentos",
  especificacao_epi_epc: "Especificação dos EPC e EPI",
  qualificacao_trabalhadores: "Qualificação, habilitação, capacitação e autorização",
  testes_isolacao: "Testes de isolação elétrica de EPI e EPC",
  certificacao_areas_classificadas: "Certificações de equipamentos em áreas classificadas",
  relatorio_inspecoes: "Relatório técnico das inspeções (recomendações e cronograma)",
  outros: "Outros documentos",
};

/** Referência ao item da norma para exibição no checklist. */
export const PIE_CATEGORY_NORM_REF: Record<PIECategory, string> = {
  esquema_unifilar: "10.2.3",
  procedimentos: "10.2.4 a",
  inspecoes_spda_aterramento: "10.2.4 b",
  especificacao_epi_epc: "10.2.4 c",
  qualificacao_trabalhadores: "10.2.4 d",
  testes_isolacao: "10.2.4 e",
  certificacao_areas_classificadas: "10.2.4 f",
  relatorio_inspecoes: "10.2.4 g",
  outros: "—",
};

/** Categorias exigidas pela norma (entram no checklist de completude). */
export const PIE_REQUIRED_CATEGORIES = PIE_CATEGORIES.filter(
  (c) => c !== "outros",
) as PIECategory[];

/**
 * Categoria coberta pelo módulo Pessoas (treinamentos, autorizações e ITs já
 * são gerenciados lá); no checklist aparece como "integrada".
 */
export const PIE_INTEGRATED_CATEGORY: PIECategory = "qualificacao_trabalhadores";

// ── Tipos de domínio ─────────────────────────────────────────────────────────

export type NR10Document = {
  id: string;
  category: PIECategory;
  title: string;
  description: string | null;
  document_date: string | null;
  validity_date: string | null;
  file_path: string | null;
  responsavel: string | null;
  art: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

// ── Status de validade ───────────────────────────────────────────────────────

export type DocExpiryStatus = "ok" | "expiring" | "expired" | "perennial";

/** Status do documento: vencido, vencendo (≤ 90 dias), ok ou sem validade. */
export function docExpiryStatus(validityDate: string | null): DocExpiryStatus {
  if (!validityDate) return "perennial";
  const daysLeft = differenceInDays(new Date(validityDate + "T12:00:00"), new Date());
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 90) return "expiring";
  return "ok";
}

export const DOC_STATUS_LABELS: Record<DocExpiryStatus, string> = {
  ok: "Válido",
  expiring: "Vencendo",
  expired: "Vencido",
  perennial: "Sem validade",
};

/**
 * Completude do prontuário: uma categoria exigida está atendida quando possui
 * ao menos um documento não vencido; a categoria integrada ao módulo Pessoas
 * conta como atendida automaticamente.
 */
export function prontuarioCompleteness(docs: NR10Document[]): {
  covered: PIECategory[];
  missing: PIECategory[];
  percent: number;
} {
  const covered: PIECategory[] = [];
  const missing: PIECategory[] = [];
  for (const cat of PIE_REQUIRED_CATEGORIES) {
    if (cat === PIE_INTEGRATED_CATEGORY) {
      covered.push(cat);
      continue;
    }
    const hasValid = docs.some(
      (d) => d.category === cat && docExpiryStatus(d.validity_date) !== "expired",
    );
    if (hasValid) covered.push(cat);
    else missing.push(cat);
  }
  const percent = Math.round((covered.length / PIE_REQUIRED_CATEGORIES.length) * 100);
  return { covered, missing, percent };
}
