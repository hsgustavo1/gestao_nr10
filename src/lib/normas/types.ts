// Catálogo de normas — tipos puros. Sem Supabase/React; versiona com o código.

export type NormaVersao = "nr10:2019" | "nr10:2026";

export interface ClausulaNR10 {
  item: string; // "10.2.4" ou "10.2.4.g"
  titulo: string; // rótulo curto do requisito
  capitulo: string; // "10.2"
  grupo?: string; // rótulo humano do bloco, ex.: "Prontuário"
}

export interface InfracaoNR28 {
  itens: string[]; // itens-base da NR-10 cobertos pela linha, ex.: ["10.2.4"]
  codigo: string; // código de infração do Anexo II (ex.: "210178-5"); "" se ainda não transcrito
  gravidade: 1 | 2 | 3 | 4;
  area: "S" | "M"; // Segurança | Medicina do Trabalho
}

export type NormaRefTipo = "nr10" | "nbr" | "outra";

export interface NormaRef {
  tipo: NormaRefTipo;
  ref: string; // nr10: item ("10.2.4.g"); nbr/outra: texto livre ("NBR 5410 6.1.8.1")
}

export interface NbrRef {
  norma: string; // "NBR 5410"
  item: string; // "6.1.8.1" ou "" para citar a norma inteira
  descricao: string; // rótulo humano do requisito citado
}
