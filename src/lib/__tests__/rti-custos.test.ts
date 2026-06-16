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
      realizadoAInformar: 0,
    });
  });

  it("NC sem custo planejado (null) não entra no R$", () => {
    const b = computeBudget([nc("concluida", null, 500)]);
    expect(b.planejadoTotal).toBe(0);
    expect(b.realizado).toBe(0);
    expect(b.projecaoTotal).toBe(0);
  });

  it("não-concluídas (pendente/andamento) viram orçamento em aberto pelo planejado", () => {
    const b = computeBudget([nc("pendente", 1000), nc("em_andamento", 500, 200)]);
    // em andamento assume o previsto: ignora o realizado parcial
    expect(b.emAberto).toBe(1500);
    expect(b.realizado).toBe(0);
    expect(b.planejadoTotal).toBe(1500);
    expect(b.projecaoTotal).toBe(1500);
    expect(b.desvioProjecao).toBe(0);
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
      nc("concluida", 1000, 700), // -300
      nc("pendente", 500), // em aberto
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

  it("concluída sem realizado informado → 'a informar', fora do saldo, projeção usa planejado", () => {
    const b = computeBudget([nc("concluida", 1000, null)]);
    expect(b.realizado).toBe(0);
    expect(b.realizadoAInformar).toBe(1);
    expect(b.estourado).toBe(0);
    expect(b.economizado).toBe(0);
    expect(b.saldoLiquido).toBe(0);
    expect(b.projecaoTotal).toBe(1000); // não subestima
    expect(b.desvioProjecao).toBe(0);
  });

  it("custo zero concluído conta como informado sem desvio", () => {
    const b = computeBudget([nc("concluida", 0, 0)]);
    expect(b.realizado).toBe(0);
    expect(b.realizadoAInformar).toBe(0);
    expect(b.saldoLiquido).toBe(0);
    expect(b.planejadoTotal).toBe(0);
  });
});

describe("computeAndamentoPorCusto", () => {
  it("segmenta por com-custo (>0) e custo-zero, excluindo não informado (null)", () => {
    const r = computeAndamentoPorCusto([
      nc("concluida", 1000),
      nc("pendente", 500),
      nc("concluida", 0),
      nc("em_andamento", 0),
      nc("concluida", null), // excluída
      nc("pendente", null), // excluída
    ]);
    expect(r.comCusto).toEqual({ total: 2, concluidas: 1 });
    expect(r.custoZero).toEqual({ total: 2, concluidas: 1 });
  });

  it("recorte vazio → grupos zerados", () => {
    expect(computeAndamentoPorCusto([])).toEqual({
      comCusto: { total: 0, concluidas: 0 },
      custoZero: { total: 0, concluidas: 0 },
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

  it("'sem' só null; 'zero' só igual a 0", () => {
    expect(matchCustoFiltro({ custo_planejado: null }, "sem")).toBe(true);
    expect(matchCustoFiltro({ custo_planejado: 0 }, "sem")).toBe(false);
    expect(matchCustoFiltro({ custo_planejado: 0 }, "zero")).toBe(true);
    expect(matchCustoFiltro({ custo_planejado: 5 }, "zero")).toBe(false);
  });
});
