// Trilha C — preparação do input e normalização da resposta da IA de parecer.
// Puro (sem fetch) — a server function fica em rti-parecer-ai-server.ts.

export interface ParecerNcResumo {
  numero: number;
  descricao: string;
  recomendacao: string | null;
  prioridade: number;
}

export interface ParecerInput {
  cliente: string;
  titulo: string;
  normas: string;
  totalNcs: number;
  porPrioridade: Record<number, number>;
  itens: ParecerNcResumo[];
}

export interface ParecerSugestao {
  parecer: string;
  resumoExecutivo: string;
}

const MAX_ITENS = 60;
const MAX_DESC = 300;

export function buildParecerInput(
  ident: { clienteNome: string; titulo: string; normas: string },
  ncs: { numero: number; descricao: string; recomendacao: string | null; prioridade: number }[],
): ParecerInput {
  const porPrioridade: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const nc of ncs) porPrioridade[nc.prioridade] = (porPrioridade[nc.prioridade] ?? 0) + 1;
  const itens = [...ncs]
    .sort((a, b) => b.prioridade - a.prioridade || a.numero - b.numero)
    .slice(0, MAX_ITENS)
    .map((nc) => ({
      numero: nc.numero,
      descricao: nc.descricao.slice(0, MAX_DESC),
      recomendacao: nc.recomendacao ? nc.recomendacao.slice(0, MAX_DESC) : null,
      prioridade: nc.prioridade,
    }));
  return {
    cliente: ident.clienteNome,
    titulo: ident.titulo,
    normas: ident.normas,
    totalNcs: ncs.length,
    porPrioridade,
    itens,
  };
}

export function normalizeParecerResponse(raw: unknown): ParecerSugestao {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return { parecer: str(obj.parecer), resumoExecutivo: str(obj.resumo_executivo) };
}
