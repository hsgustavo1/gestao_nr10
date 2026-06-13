// ── RTI — Relatório Técnico das Inspeções: tipos, constantes e helpers ──────
// Plano de ação das não conformidades (NCs) apontadas na inspeção das
// instalações elétricas (NR-10). Prioridades P1→P4, onde P4 é a mais grave.

export const RTI_NC_STATUSES = ["pendente", "em_andamento", "concluida"] as const;
export type RtiNcStatus = typeof RTI_NC_STATUSES[number];

export const RTI_NC_STATUS_LABELS: Record<RtiNcStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

export const RTI_NC_STATUS_BADGE: Record<RtiNcStatus, string> = {
  pendente: "border-red-300 bg-red-50 text-red-700",
  em_andamento: "border-amber-300 bg-amber-50 text-amber-700",
  concluida: "border-emerald-300 bg-emerald-50 text-emerald-700",
};

export const RTI_PRIORIDADES = [1, 2, 3, 4] as const;
export type RtiPrioridade = typeof RTI_PRIORIDADES[number];

/** P4 é a mais grave (convenção do relatório da auditoria). */
export const RTI_PRIORIDADE_LABELS: Record<RtiPrioridade, string> = {
  1: "P1 — Baixa",
  2: "P2 — Moderada",
  3: "P3 — Alta",
  4: "P4 — Crítica",
};

export const RTI_PRIORIDADE_BADGE: Record<RtiPrioridade, string> = {
  1: "border-slate-300 bg-slate-50 text-slate-700",
  2: "border-yellow-300 bg-yellow-50 text-yellow-700",
  3: "border-orange-300 bg-orange-50 text-orange-700",
  4: "border-red-300 bg-red-50 text-red-700",
};

export const RTI_PRIORIDADE_COLORS: Record<RtiPrioridade, string> = {
  1: "#94a3b8",
  2: "#eab308",
  3: "#f97316",
  4: "#ef4444",
};

export const RTI_TIPOS_EXECUCAO = ["os", "investimento"] as const;
export type RtiTipoExecucao = typeof RTI_TIPOS_EXECUCAO[number];

export const RTI_TIPO_EXECUCAO_LABELS: Record<RtiTipoExecucao, string> = {
  os: "OS (manutenção)",
  investimento: "Investimento",
};

export const RTI_TIPO_EXECUCAO_SHORT: Record<RtiTipoExecucao, string> = {
  os: "OS",
  investimento: "Invest.",
};

export const RTI_EVIDENCIA_TIPOS = ["constatacao", "correcao"] as const;
export type RtiEvidenciaTipo = typeof RTI_EVIDENCIA_TIPOS[number];

export const RTI_EVIDENCIA_TIPO_LABELS: Record<RtiEvidenciaTipo, string> = {
  constatacao: "Constatação da NC",
  correcao: "Evidência da correção",
};

// ── Tipos das tabelas ────────────────────────────────────────────────────────

export type RtiReport = {
  id: string;
  titulo: string;
  empresa_auditora: string | null;
  responsavel_auditoria: string | null;
  responsavel_plano: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  report_path: string | null;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type RtiArea = {
  id: string;
  report_id: string;
  nome: string;
  ordem: number;
  created_at: string;
};

export type RtiNc = {
  id: string;
  report_id: string;
  area_id: string;
  numero: number;
  descricao: string;
  recomendacao: string | null;
  prioridade: number;
  responsavel: string | null;
  status: RtiNcStatus;
  progresso: number;
  prazo: string | null;
  tipo_execucao: RtiTipoExecucao;
  os_numero: string | null;
  /** null = custo não informado; 0 = custo zero explícito (sem barreira financeira). */
  custo_planejado: number | null;
  custo_realizado: number | null;
  situacao_atual: string | null;
  concluida_em: string | null;
  finding_id: string | null;
  created_at: string;
  updated_at: string;
};

export type RtiNcEvidencia = {
  id: string;
  nc_id: string;
  tipo: RtiEvidenciaTipo;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  descricao: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type RtiNcHistorico = {
  id: string;
  nc_id: string;
  tipo: "comentario" | "alteracao";
  texto: string;
  autor_nome: string | null;
  created_at: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Custo foi informado (inclui zero explícito). null/undefined = não informado. */
export function custoInformado(value: number | null | undefined): value is number {
  return value != null;
}

/** Soma de custo tratando "não informado" (null) como 0 para totais. */
export function custoNum(value: number | null | undefined): number {
  return Number(value) || 0;
}

/** NC com prazo vencido (prazo passado e não concluída). */
export function ncPrazoVencido(nc: Pick<RtiNc, "prazo" | "status">): boolean {
  if (!nc.prazo || nc.status === "concluida") return false;
  return nc.prazo < new Date().toISOString().slice(0, 10);
}

/** NC com prazo nos próximos `dias` dias (e não concluída). */
export function ncPrazoProximo(nc: Pick<RtiNc, "prazo" | "status">, dias = 30): boolean {
  if (!nc.prazo || nc.status === "concluida") return false;
  const hoje = new Date().toISOString().slice(0, 10);
  const limite = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
  return nc.prazo >= hoje && nc.prazo <= limite;
}

// ── Faixas de prazo (para o dashboard) ───────────────────────────────────────
// Classifica NCs em aberto pela proximidade do vencimento. NCs concluídas não
// entram nesta análise (o prazo já não importa).

export const RTI_PRAZO_BUCKETS = [
  "vencido", "sem_prazo", "semana", "30dias", "90dias", "mais90",
] as const;
export type RtiPrazoBucket = typeof RTI_PRAZO_BUCKETS[number];

export const RTI_PRAZO_BUCKET_LABELS: Record<RtiPrazoBucket, string> = {
  vencido: "Vencido",
  sem_prazo: "Prazo não definido",
  semana: "Vence na próxima semana",
  "30dias": "Vence em 30 dias",
  "90dias": "Vence em 90 dias",
  mais90: "Vence em mais de 90 dias",
};

export const RTI_PRAZO_BUCKET_COLORS: Record<RtiPrazoBucket, string> = {
  vencido: "#b91c1c",
  sem_prazo: "#94a3b8",
  semana: "#ef4444",
  "30dias": "#f59e0b",
  "90dias": "#eab308",
  mais90: "#10b981",
};

/** Em qual faixa de prazo a NC se encontra (somente NCs em aberto). */
export function ncPrazoBucket(nc: Pick<RtiNc, "prazo" | "status">): RtiPrazoBucket {
  if (!nc.prazo) return "sem_prazo";
  const hoje = new Date().toISOString().slice(0, 10);
  if (nc.prazo < hoje) return "vencido";
  const dias = Math.floor(
    (new Date(nc.prazo + "T00:00:00").getTime() - new Date(hoje + "T00:00:00").getTime()) / 86400000,
  );
  if (dias <= 7) return "semana";
  if (dias <= 30) return "30dias";
  if (dias <= 90) return "90dias";
  return "mais90";
}

export function clampPrioridade(p: number): RtiPrioridade {
  if (p <= 1) return 1;
  if (p >= 4) return 4;
  return p as RtiPrioridade;
}
