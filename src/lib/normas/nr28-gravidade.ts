import type { InfracaoNR28 } from "./types";

// NR-28 Anexo II — linhas que classificam itens da NR-10.
// CHAVEADO NA NUMERAÇÃO NR-10:2019 (o governo ainda não re-chaveou p/ 2026).
// A gravidade da NC deriva do MÁXIMO das linhas casadas (ver gravidadeNR28).
export const NR28_GRAVIDADE: InfracaoNR28[] = [
  { itens: ["10.2.1"], codigo: "", gravidade: 4, area: "S" },
  { itens: ["10.2.4"], codigo: "210178-5", gravidade: 2, area: "S" },
  { itens: ["10.4.1"], codigo: "", gravidade: 4, area: "S" },
  { itens: ["10.8.5", "10.8.6"], codigo: "", gravidade: 2, area: "S" },
];
