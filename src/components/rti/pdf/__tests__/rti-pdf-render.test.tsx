import { describe, expect, test } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { RtiPdfDocument } from "../RtiPdfDocument";
import { buildPdfModel, type NcParaPdf } from "@/lib/rti-relatorio";

const nc = (over: Partial<NcParaPdf>): NcParaPdf => ({
  id: "nc-1",
  numero: 1,
  areaNome: "Subestação",
  descricao: "Painel sem identificação de circuitos.",
  recomendacao: "Identificar conforme NR-10.",
  prioridade: 3,
  tipoExecucao: "os",
  osNumero: null,
  custoPlanejado: 0,
  fotos: [],
  titulo: null,
  normas: [],
  situacaoAtual: null,
  ...over,
});

describe("RtiPdfDocument", () => {
  test("renderiza um PDF válido sem lançar", async () => {
    const model = buildPdfModel({
      identificacao: {
        titulo: "RTI Usina",
        clienteNome: "Cliente X",
        local: "Unidade A",
        periodoInicio: "2026-07-01",
        periodoFim: "2026-07-03",
        responsavelTecnico: "Eng. Fulano",
        artNumero: "ART-123",
        normas: "NR-10; NBR 5410",
        introducao: "Introdução.",
        metodologia: "Metodologia.",
      },
      branding: null,
      ncs: [
        nc({
          id: "a",
          numero: 1,
          areaNome: "Moagem",
          titulo: "Painel sem identificação",
          normas: [{ tipo: "nr10", ref: "10.2.4.g" }],
          situacaoAtual: "Aguardando peça",
        }),
        nc({ id: "b", numero: 2, areaNome: "Subestação" }),
      ],
      overrides: {},
      parecer: "Parecer técnico.\nSegundo parágrafo.",
      resumoExecutivo: "Resumo executivo.",
    });

    const buffer = await renderToBuffer(<RtiPdfDocument model={model} />);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
