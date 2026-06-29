import { describe, expect, it } from "vitest";
import {
  computeBudget,
  computeAndamentoPorCusto,
  matchCustoFiltro,
  type RtiNcStatus,
} from "../rti";

// Blinda a aritmética do orçamento (realizado vs em aberto, estouro/economia,
// projeção) e a agregação de andamento por custo do dashboard. São funções
// puras que alimentam a tela de Custos e o Dashboard RTI.

type NcCusto = {
  status: RtiNcStatus;
  custo_planejado: number | null;
  custo_realizado: number | null;
};

const nc = (
  status: RtiNcStatus,
  custo_planejado: number | null,
  custo_realizado: number | null = null,
): NcCusto => ({ status, custo_planejado, custo_realizado });

describe("computeBudget", () => {
  it("recorte vazio → tudo zero", () => {
    const b = computeBudget([]);
    expect(b).toEqual({
      realizado: 0,
      emAberto: 0,
      estourado: 0,
      economizado: 0,
      saldoLiquido: 0,
      planejadoTotal: 0,
      projecaoTotal: 0,
      desvioProjecao: 0,
      concluidasComCusto: 0,
      concluidasCustoZero: 0,
    });
  });

  it("concluída sem planejado → assume planejado=real=0 (custo zero)", () => {
    const b = computeBudget([nc("concluida", null)]);
    expect(b.planejadoTotal).toBe(0);
    expect(b.realizado).toBe(0);
    expect(b.concluidasCustoZero).toBe(1);
    expect(b.concluidasComCusto).toBe(0);
    expect(b.projecaoTotal).toBe(0);
  });

  it("concluída sem planejado mas com real explícito → planejado=0, real conta", () => {
    const b = computeBudget([nc("concluida", null, 500)]);
    expect(b.planejadoTotal).toBe(0);
    expect(b.realizado).toBe(500);
    expect(b.estourado).toBe(500);
    expect(b.concluidasComCusto).toBe(1);
  });

  it("não-concluída sem planejado → ignorada", () => {
    const b = computeBudget([nc("pendente", null)]);
    expect(b.planejadoTotal).toBe(0);
    expect(b.emAberto).toBe(0);
    expect(b.projecaoTotal).toBe(0);
  });

  it("não-concluída sem realizado vira em aberto; com realizado conta como realizado", () => {
    const b = computeBudget([nc("pendente", 1000), nc("em_andamento", 500, 200)]);
    expect(b.emAberto).toBe(1000);
    expect(b.realizado).toBe(200);
    expect(b.economizado).toBe(300); // 200 realizado vs 500 planejado → economia
    expect(b.planejadoTotal).toBe(1500);
    expect(b.projecaoTotal).toBe(1200); // 200 + 1000
    expect(b.desvioProjecao).toBe(-300);
  });

  it("concluída com estouro: realizado > planejado", () => {
    const b = computeBudget([nc("concluida", 1000, 1300)]);
    expect(b.realizado).toBe(1300);
    expect(b.estourado).toBe(300);
    expect(b.economizado).toBe(0);
    expect(b.saldoLiquido).toBe(300);
    expect(b.projecaoTotal).toBe(1300);
    expect(b.desvioProjecao).toBe(300);
  });

  it("concluída com economia: realizado < planejado", () => {
    const b = computeBudget([nc("concluida", 1000, 700)]);
    expect(b.realizado).toBe(700);
    expect(b.estourado).toBe(0);
    expect(b.economizado).toBe(300);
    expect(b.saldoLiquido).toBe(-300);
    expect(b.desvioProjecao).toBe(-300);
  });

  it("misto: estouro e economia se compensam no saldo líquido", () => {
    const b = computeBudget([
      nc("concluida", 1000, 1300), // +300
      nc("concluida", 1000, 700),  // -300
      nc("pendente", 500),          // em aberto
    ]);
    expect(b.realizado).toBe(2000);
    expect(b.estourado).toBe(300);
    expect(b.economizado).toBe(300);
    expect(b.saldoLiquido).toBe(0);
    expect(b.emAberto).toBe(500);
    expect(b.planejadoTotal).toBe(2500);
    expect(b.projecaoTotal).toBe(2500);
    expect(b.desvioProjecao).toBe(0);
  });

  it("concluída sem real → assume real = planejado (sem estouro/economia)", () => {
    const b = computeBudget([nc("concluida", 1000, null)]);
    expect(b.realizado).toBe(1000);
    expect(b.estourado).toBe(0);
    expect(b.economizado).toBe(0);
    expect(b.saldoLiquido).toBe(0);
    expect(b.projecaoTotal).toBe(1000);
    expect(b.desvioProjecao).toBe(0);
    expect(b.concluidasComCusto).toBe(1);
  });

  it("custo zero concluído conta como custo zero", () => {
    const b = computeBudget([nc("concluida", 0, 0)]);
    expect(b.realizado).toBe(0);
    expect(b.concluidasCustoZero).toBe(1);
    expect(b.concluidasComCusto).toBe(0);
    expect(b.saldoLiquido).toBe(0);
    expect(b.planejadoTotal).toBe(0);
  });

  it("concluída sem real e custo zero → custo zero sem desvio", () => {
    const b = computeBudget([nc("concluida", 0, null)]);
    expect(b.realizado).toBe(0);
    expect(b.concluidasCustoZero).toBe(1);
    expect(b.saldoLiquido).toBe(0);
  });
});

describe("computeAndamentoPorCusto", () => {
  it("segmenta em com-custo (>0), custo-zero (=0) e sem-custo (null)", () => {
    const r = computeAndamentoPorCusto([
      nc("concluida", 1000),
      nc("pendente", 500),
      nc("concluida", 0),
      nc("em_andamento", 0),
      nc("concluida", null),
      nc("pendente", null),
    ]);
    expect(r.comCusto).toEqual({ total: 2, concluidas: 1 });
    expect(r.custoZero).toEqual({ total: 2, concluidas: 1 });
    expect(r.semCusto).toEqual({ total: 2, concluidas: 1 });
  });

  it("recorte vazio → grupos zerados", () => {
    expect(computeAndamentoPorCusto([])).toEqual({
      comCusto: { total: 0, concluidas: 0 },
      custoZero: { total: 0, concluidas: 0 },
      semCusto: { total: 0, concluidas: 0 },
    });
  });
});

describe("matchCustoFiltro", () => {
  it("'all' aceita qualquer NC", () => {
    expect(matchCustoFiltro({ custo_planejado: null }, "all")).toBe(true);
    expect(matchCustoFiltro({ custo_planejado: 0 }, "all")).toBe(true);
    expect(matchCustoFiltro({ custo_planejado: 10 }, "all")).toBe(true);
  });

  it("'informado' inclui custo zero, exclui null", () => {
    expect(matchCustoFiltro({ custo_planejado: 0 }, "informado")).toBe(true);
    expect(matchCustoFiltro({ custo_planejado: 10 }, "informado")).toBe(true);
    expect(matchCustoFiltro({ custo_planejado: null }, "informado")).toBe(false);
  });

  it("'comvalor' só custo > 0 (exclui zero e null)", () => {
    expect(matchCustoFiltro({ custo_planejado: 10 }, "comvalor")).toBe(true);
    expect(matchCustoFiltro({ custo_planejado: 0 }, "comvalor")).toBe(false);
    expect(matchCustoFiltro({ custo_planejado: null }, "comvalor")).toBe(false);
  });

  it("'sem' só null; 'zero' só igual a 0", () => {
    expect(matchCustoFiltro({ custo_planejado: null }, "sem")).toBe(true);
    expect(matchCustoFiltro({ custo_planejado: 0 }, "sem")).toBe(false);
    expect(matchCustoFiltro({ custo_planejado: 0 }, "zero")).toBe(true);
    expect(matchCustoFiltro({ custo_planejado: 5 }, "zero")).toBe(false);
  });
});
