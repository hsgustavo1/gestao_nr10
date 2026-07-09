import { describe, expect, test } from "vitest";
import {
  defaultIdentificacao,
  mergeNcOverrides,
  proximaVersao,
  relatorioPdfPath,
  resumoPorPrioridade,
  type NcParaPdf,
  type NcsOverrides,
} from "../rti-relatorio";

const nc = (over: Partial<NcParaPdf>): NcParaPdf => ({
  id: "nc-1",
  numero: 1,
  areaNome: "Subestação",
  descricao: "Painel sem identificação",
  recomendacao: "Identificar conforme NR-10",
  prioridade: 3,
  tipoExecucao: "os",
  osNumero: null,
  custoPlanejado: 0,
  fotos: [],
  ...over,
});

describe("mergeNcOverrides", () => {
  test("sem overrides devolve as NCs ordenadas por numero", () => {
    const out = mergeNcOverrides([nc({ id: "b", numero: 2 }), nc({ id: "a", numero: 1 })], {});
    expect(out.map((n) => n.numero)).toEqual([1, 2]);
  });

  test("override de texto substitui descricao/recomendacao sem tocar o resto", () => {
    const overrides: NcsOverrides = { "nc-1": { descricao: "Texto revisado" } };
    const out = mergeNcOverrides([nc({})], overrides);
    expect(out[0].descricao).toBe("Texto revisado");
    expect(out[0].recomendacao).toBe("Identificar conforme NR-10");
  });

  test("incluir=false remove a NC do relatório", () => {
    const overrides: NcsOverrides = { "nc-1": { incluir: false } };
    expect(mergeNcOverrides([nc({})], overrides)).toHaveLength(0);
  });

  test("fotosExcluidas filtra fotos pelo id", () => {
    const fotos = [
      { id: "f1", url: "u1", legenda: null },
      { id: "f2", url: "u2", legenda: null },
    ];
    const out = mergeNcOverrides([nc({ fotos })], { "nc-1": { fotosExcluidas: ["f1"] } });
    expect(out[0].fotos.map((f) => f.id)).toEqual(["f2"]);
  });
});

describe("resumoPorPrioridade", () => {
  test("agrega quantidade e custo por prioridade, da mais grave (P4) para a mais leve", () => {
    const linhas = resumoPorPrioridade([
      nc({ prioridade: 4, custoPlanejado: 100 }),
      nc({ id: "x", numero: 2, prioridade: 4, custoPlanejado: 50 }),
      nc({ id: "y", numero: 3, prioridade: 1, custoPlanejado: 10 }),
    ]);
    expect(linhas[0]).toMatchObject({ prioridade: 4, quantidade: 2, custoPlanejado: 150 });
    expect(linhas.at(-1)).toMatchObject({ prioridade: 1, quantidade: 1, custoPlanejado: 10 });
    expect(linhas).toHaveLength(4); // sempre as 4 linhas, mesmo zeradas
  });
});

describe("versões e path do PDF", () => {
  test("proximaVersao começa em 1 e incrementa a maior", () => {
    expect(proximaVersao([])).toBe(1);
    expect(proximaVersao([{ versao: 1 }, { versao: 3 }])).toBe(4);
  });

  test("relatorioPdfPath usa a pasta de evidências do report + subpasta relatorios", () => {
    const path = relatorioPdfPath(
      "11111111-2222-3333-4444-555555555555",
      { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", titulo: "RTI Usina" },
      2,
      "Cliente X",
    );
    expect(path).toBe(
      "cliente-x-11111111-2222-3333-4444-555555555555/rti-usina-aaaaaaaa/relatorios/relatorio-v02.pdf",
    );
  });
});

describe("defaultIdentificacao", () => {
  test("pré-preenche do report e usa normas padrão", () => {
    const ident = defaultIdentificacao(
      {
        titulo: "RTI Usina",
        empresa_auditora: "Cliente X",
        responsavel_tecnico_rti: "Eng. Fulano",
        art_numero: "ART-123",
        periodo_inicio: "2026-07-01",
        periodo_fim: "2026-07-03",
      },
      "Consultoria Y",
    );
    expect(ident.titulo).toBe("RTI Usina");
    expect(ident.clienteNome).toBe("Cliente X");
    expect(ident.responsavelTecnico).toBe("Eng. Fulano");
    expect(ident.artNumero).toBe("ART-123");
    expect(ident.normas).toContain("NR-10");
  });
});
