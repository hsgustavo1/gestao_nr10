// ── RTI — Relatório Técnico das Inspeções: tipos, constantes e helpers ──────
// Plano de ação das não conformidades (NCs) apontadas na inspeção das
// instalações elétricas (NR-10). Prioridades P1→P4, onde P4 é a mais grave.

import type { NormaRef } from "./normas/types";

export const RTI_NC_STATUSES = ["pendente", "em_andamento", "concluida"] as const;
export type RtiNcStatus = (typeof RTI_NC_STATUSES)[number];

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
export type RtiPrioridade = (typeof RTI_PRIORIDADES)[number];

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
export type RtiTipoExecucao = (typeof RTI_TIPOS_EXECUCAO)[number];

export const RTI_TIPO_EXECUCAO_LABELS: Record<RtiTipoExecucao, string> = {
  os: "OS (manutenção)",
  investimento: "Investimento",
};

export const RTI_TIPO_EXECUCAO_SHORT: Record<RtiTipoExecucao, string> = {
  os: "OS",
  investimento: "Invest.",
};

export const RTI_EVIDENCIA_TIPOS = ["constatacao", "correcao"] as const;
export type RtiEvidenciaTipo = (typeof RTI_EVIDENCIA_TIPOS)[number];

export const RTI_EVIDENCIA_TIPO_LABELS: Record<RtiEvidenciaTipo, string> = {
  constatacao: "Constatação da NC",
  correcao: "Evidência da correção",
};

// ── Tipos das tabelas ────────────────────────────────────────────────────────

export type RtiReport = {
  id: string;
  titulo: string;
  empresa_auditora: string | null;
  /** Emissor da ART do RTI (opcional). Pode diferir de coletores/entregador/criador. */
  responsavel_tecnico_rti: string | null;
  responsavel_plano: string | null;
  /** Lista deduplicada de field_points.collected_by_name no momento da composição. */
  coletores_campo: string[] | null;
  /** Responsáveis de campo adicionados manualmente na entrega. */
  responsaveis_campo_extra: string[] | null;
  /** Nome de quem entregou o relatório. */
  responsavel_relatorio: string | null;
  /** Número da ART emitida para o RTI (opcional). */
  art_numero?: string | null;
  /** Path do arquivo da ART no bucket rti-evidencias (opcional). */
  art_arquivo_path?: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  norma_versao: string;
  report_path: string | null;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  entregue_em?: string | null;
  entregue_por_org?: string | null;
};

export type RtiArea = {
  id: string;
  report_id: string;
  nome: string;
  ordem: number;
  created_at: string;
  entregue_em?: string | null;
  entregue_por_org?: string | null;
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
  titulo: string | null;
  normas: NormaRef[];
  gravidade_nr28_override: number | null;
  concluida_em: string | null;
  finding_id: string | null;
  created_at: string;
  updated_at: string;
  entregue_em?: string | null;
  entregue_por_org?: string | null;
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
  entregue_em?: string | null;
  entregue_por_org?: string | null;
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
  "vencido",
  "sem_prazo",
  "semana",
  "30dias",
  "90dias",
  "mais90",
] as const;
export type RtiPrazoBucket = (typeof RTI_PRAZO_BUCKETS)[number];

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
    (new Date(nc.prazo + "T00:00:00").getTime() - new Date(hoje + "T00:00:00").getTime()) /
      86400000,
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

// ── Filtro de custo (Plano de Ação) ──────────────────────────────────────────
// "informado" = custo planejado preenchido (inclui 0); "sem" = não informado
// (null); "zero" = custo planejado igual a 0. A tela de Custos usa "informado"
// para o atalho "Ver no Plano".

export const RTI_CUSTO_FILTROS = ["all", "informado", "comvalor", "zero", "sem"] as const;
export type RtiCustoFiltro = (typeof RTI_CUSTO_FILTROS)[number];

export const RTI_CUSTO_FILTRO_LABELS: Record<RtiCustoFiltro, string> = {
  all: "Custo: todos",
  informado: "Com custo informado",
  comvalor: "Com custo (> R$ 0)",
  zero: "Custo zero",
  sem: "Sem custo informado",
};

/**
 * Predicado do filtro de custo do Plano.
 * "informado" = custo preenchido (inclui 0); "comvalor" = custo > 0;
 * "zero" = custo = 0; "sem" = custo não informado (null).
 */
export function matchCustoFiltro(
  nc: Pick<RtiNc, "custo_planejado">,
  modo: RtiCustoFiltro,
): boolean {
  const cp = nc.custo_planejado;
  switch (modo) {
    case "informado":
      return cp != null;
    case "comvalor":
      return cp != null && cp > 0;
    case "zero":
      return cp === 0;
    case "sem":
      return cp == null;
    default:
      return true;
  }
}

// ── Orçamento / execução (tela de Custos) ────────────────────────────────────
// Separa o que já é realizado final (concluídas, com estouro/economia líquidos)
// do que ainda é orçamento em aberto (não concluídas, assumidas no previsto).
// Só entram NCs com custo planejado informado (custo zero conta como 0).

export type RtiBudget = {
  /** Σ custo_realizado efetivo das concluídas (null→planejado) + não-concluídas com real. */
  realizado: number;
  /** Σ custo_planejado das não-concluídas sem realizado (previsto a gastar). */
  emAberto: number;
  /** Σ max(0, realizado − planejado) nas concluídas. */
  estourado: number;
  /** Σ max(0, planejado − realizado) nas concluídas. */
  economizado: number;
  /** estourado − economizado (>0 estouro, <0 economia). */
  saldoLiquido: number;
  /** Σ custo_planejado efetivo de todas as NCs consideradas. */
  planejadoTotal: number;
  /** realizado + emAberto. */
  projecaoTotal: number;
  /** projecaoTotal − planejadoTotal. */
  desvioProjecao: number;
  /** nº de concluídas com custo efetivo > 0. */
  concluidasComCusto: number;
  /** nº de concluídas com custo efetivo = 0 (planejado e real ambos zero). */
  concluidasCustoZero: number;
};

export function computeBudget(
  ncs: readonly Pick<RtiNc, "status" | "custo_planejado" | "custo_realizado">[],
): RtiBudget {
  let realizado = 0;
  let emAberto = 0;
  let estourado = 0;
  let economizado = 0;
  let planejadoTotal = 0;
  let concluidasComCusto = 0;
  let concluidasCustoZero = 0;

  for (const nc of ncs) {
    const isConcluida = nc.status === "concluida";

    // Planejado efetivo: concluída sem planejado → assume 0; não-concluída sem planejado → pula
    let planejado = nc.custo_planejado;
    if (planejado == null) {
      if (!isConcluida) continue;
      planejado = 0;
    }
    planejadoTotal += planejado;

    // Real efetivo: concluída sem real → assume real = planejado
    let real = nc.custo_realizado;
    if (real == null && isConcluida) real = planejado;

    if (real != null) {
      realizado += real;
      const desvio = real - planejado;
      if (desvio > 0) estourado += desvio;
      else economizado += -desvio;
      if (isConcluida) {
        if (real === 0 && planejado === 0) concluidasCustoZero += 1;
        else concluidasComCusto += 1;
      }
    } else {
      // Não concluída, sem real → em aberto pelo planejado
      emAberto += planejado;
    }
  }

  const saldoLiquido = estourado - economizado;
  const projecaoTotal = realizado + emAberto;
  return {
    realizado,
    emAberto,
    estourado,
    economizado,
    saldoLiquido,
    planejadoTotal,
    projecaoTotal,
    desvioProjecao: projecaoTotal - planejadoTotal,
    concluidasComCusto,
    concluidasCustoZero,
  };
}

// ── Andamento por custo (Dashboard RTI) ──────────────────────────────────────
// Progresso de conclusão segmentado por atribuição de custo: com investimento
// (>0), sem investimento (custo zero) e sem custo atribuído (não informado).
// As três relações são apresentadas para não dar a falsa impressão de que só
// existem ações com custo atribuído e custo zero a executar.

export type RtiAndamentoCusto = {
  comCusto: { total: number; concluidas: number };
  custoZero: { total: number; concluidas: number };
  semCusto: { total: number; concluidas: number };
};

export function computeAndamentoPorCusto(
  ncs: readonly Pick<RtiNc, "status" | "custo_planejado">[],
): RtiAndamentoCusto {
  const comCusto = { total: 0, concluidas: 0 };
  const custoZero = { total: 0, concluidas: 0 };
  const semCusto = { total: 0, concluidas: 0 };
  for (const nc of ncs) {
    const cp = nc.custo_planejado;
    const bucket = cp == null ? semCusto : cp > 0 ? comCusto : custoZero;
    bucket.total += 1;
    if (nc.status === "concluida") bucket.concluidas += 1;
  }
  return { comCusto, custoZero, semCusto };
}

/**
 * Lista final de "Responsáveis pela inspeção em campo" exibida/gravada.
 * Une os coletores automáticos do PWA (`coletores_campo`, travados) com os
 * nomes adicionados manualmente na entrega (`responsaveis_campo_extra`),
 * aparando espaços, descartando vazios e deduplicando por igualdade exata.
 * Ordem: automáticos primeiro, depois manuais.
 */
export function responsaveisInspecaoCampo(
  coletores: string[] | null,
  extras: string[] | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const nome of [...(coletores ?? []), ...(extras ?? [])]) {
    const t = (nome ?? "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Rótulo singular/plural do campo de responsáveis de campo. */
export function labelResponsaveisCampo(count: number): string {
  return count > 1
    ? "Responsáveis pela inspeção em campo"
    : "Responsável pela inspeção em campo";
}
