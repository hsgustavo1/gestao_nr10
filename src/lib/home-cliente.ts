// Trilha D — cards de pendência da home do cliente. Puro, TDD.
import type { VencimentoItem } from "./vencimentos";

export interface NcResumo {
  prioridade: number;
  status: string; // 'pendente' | 'em_andamento' | 'concluida'
  prazo: string | null; // yyyy-mm-dd
}

export type Severidade = "critico" | "atencao" | "ok";

export interface CardPendencia {
  id: "vencidos" | "vencendo30" | "ncs_graves" | "acoes_atrasadas";
  titulo: string;
  quantidade: number;
  severidade: Severidade;
  to: string; // link acionável
  descricao: string;
}

const sev = (qtd: number, quandoTem: Severidade): Severidade => (qtd === 0 ? "ok" : quandoTem);

export function cardsPendencias(args: {
  vencimentos: VencimentoItem[];
  ncs: NcResumo[];
  hoje: Date;
}): CardPendencia[] {
  const hojeIso = args.hoje.toISOString().slice(0, 10);
  const vencidos = args.vencimentos.filter((v) => v.status === "expired").length;
  const vencendo30 = args.vencimentos.filter(
    (v) => v.status === "expiring" && v.daysLeft >= 0 && v.daysLeft <= 30,
  ).length;
  const abertas = args.ncs.filter((n) => n.status !== "concluida");
  const ncsGraves = abertas.filter((n) => n.prioridade >= 3).length;
  const acoesAtrasadas = abertas.filter((n) => n.prazo !== null && n.prazo < hojeIso).length;

  return [
    {
      id: "vencidos",
      titulo: "Vencidos",
      quantidade: vencidos,
      severidade: sev(vencidos, "critico"),
      to: "/vencimentos",
      descricao: "Treinamentos, ASOs, ensaios e documentos já vencidos",
    },
    {
      id: "vencendo30",
      titulo: "Vencendo em 30 dias",
      quantidade: vencendo30,
      severidade: sev(vencendo30, "atencao"),
      to: "/vencimentos",
      descricao: "O que precisa de agenda ainda neste mês",
    },
    {
      id: "ncs_graves",
      titulo: "NCs de prioridade alta",
      quantidade: ncsGraves,
      severidade: sev(ncsGraves, "atencao"),
      to: "/rti/plano",
      descricao: "Não conformidades P3/P4 ainda abertas",
    },
    {
      id: "acoes_atrasadas",
      titulo: "Ações atrasadas",
      quantidade: acoesAtrasadas,
      severidade: sev(acoesAtrasadas, "critico"),
      to: "/rti/plano",
      descricao: "Ações do plano com prazo estourado",
    },
  ];
}
