import { CLAUSULAS_NR10_2019 } from "./nr10-clausulas-2019";
import { CLAUSULAS_NR10_2026 } from "./nr10-clausulas-2026";
import { NR28_GRAVIDADE } from "./nr28-gravidade";
import type { ClausulaNR10, InfracaoNR28, NormaRef, NormaVersao } from "./types";

export * from "./types";
export { CLAUSULAS_NR10_2019 } from "./nr10-clausulas-2019";
export { CLAUSULAS_NR10_2026 } from "./nr10-clausulas-2026";
export { NR28_GRAVIDADE } from "./nr28-gravidade";
export { NBR_REFS } from "./nbr-refs";

// Fronteira de vigência da nova NR-10 (Portaria 737/2026): 01/06/2027.
export const VIGENCIA_NR10_2026 = new Date("2027-06-01T00:00:00Z");

const REGISTRY: Record<NormaVersao, ClausulaNR10[]> = {
  "nr10:2019": CLAUSULAS_NR10_2019,
  "nr10:2026": CLAUSULAS_NR10_2026,
};

// O Anexo II da NR-28 só existe chaveado na numeração 2019. A versão 2026 fica
// sem mapa (gravidade indisponível) até o governo re-publicar a tabela.
const NR28_POR_VERSAO: Partial<Record<NormaVersao, InfracaoNR28[]>> = {
  "nr10:2019": NR28_GRAVIDADE,
};

/** Versão da NR-10 vigente numa data (fronteira 01/06/2027). */
export function normaVersaoVigente(data: Date): NormaVersao {
  return data.getTime() >= VIGENCIA_NR10_2026.getTime() ? "nr10:2026" : "nr10:2019";
}

/** Cláusulas da versão indicada. */
export function clausulasNR10(versao: NormaVersao): ClausulaNR10[] {
  return REGISTRY[versao];
}

/**
 * `item` casa `base` se for igual ou for subitem/alínea dele.
 * "10.2.4.g" casa "10.2.4"; "10.2.40" NÃO casa "10.2.4" (guarda pelo ponto).
 */
export function itemCasaBase(item: string, base: string): boolean {
  return item === base || item.startsWith(base + ".");
}

/** Referência válida? NR-10: casa um item do catálogo da versão. NBR/outra: texto não-vazio. */
export function validarNormaRef(ref: NormaRef, versao: NormaVersao): boolean {
  if (ref.tipo !== "nr10") return ref.ref.trim().length > 0;
  return clausulasNR10(versao).some((c) => itemCasaBase(ref.ref, c.item));
}

/**
 * Gravidade NR-28 derivada dos itens NR-10 citados: o MÁXIMO das linhas casadas
 * rege. `null` se a versão não tem mapa (2026) ou nenhuma ref NR-10 casa.
 */
export function gravidadeNR28(
  normas: NormaRef[],
  versao: NormaVersao,
): { gravidade: 1 | 2 | 3 | 4; codigos: string[]; area: "S" | "M" } | null {
  const mapa = NR28_POR_VERSAO[versao];
  if (!mapa) return null;
  const itensNr10 = normas.filter((n) => n.tipo === "nr10").map((n) => n.ref);
  const casadas = mapa.filter((linha) =>
    itensNr10.some((it) => linha.itens.some((base) => itemCasaBase(it, base))),
  );
  if (casadas.length === 0) return null;
  const gravidade = Math.max(...casadas.map((l) => l.gravidade)) as 1 | 2 | 3 | 4;
  const codigos = [...new Set(casadas.map((l) => l.codigo).filter((c) => c.length > 0))];
  // Área da(s) linha(s) de maior gravidade; desempate por "S".
  const daMaior = casadas.filter((l) => l.gravidade === gravidade);
  const area: "S" | "M" = daMaior.some((l) => l.area === "S") ? "S" : "M";
  return { gravidade, codigos, area };
}

/** Gravidade efetiva = override manual ?? derivada. `null` = indisponível. */
export function gravidadeEfetiva(
  nc: { normas: NormaRef[]; gravidade_nr28_override: number | null },
  versao: NormaVersao,
): number | null {
  if (nc.gravidade_nr28_override != null) return nc.gravidade_nr28_override;
  return gravidadeNR28(nc.normas, versao)?.gravidade ?? null;
}
