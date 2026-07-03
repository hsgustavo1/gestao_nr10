// Nomes de path do bucket rti-evidencias. Puro (sem Supabase) — testável isolado.
// Esquema (2026-07-02): um prefixo por relatório, arquivo nomeado por NC e índice.
//   {orgSlug-orgId}/{reportSlug}/nc-{ncNum}-{idx}.{ext}
// Números com zero-padding (nc-0010-01) para ordenação natural crescente na
// listagem do bucket — sem isso "nc-10-1" viria antes de "nc-2-1" alfabeticamente.

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // não-alfanumérico → hífen
    .replace(/^-+|-+$/g, ""); // apara hífens das pontas
}

/** Identificador de pasta do relatório: slug do título (≤40) + 8 primeiros do id. */
export function reportSlug(report: { id: string; titulo?: string | null }): string {
  const id8 = report.id.slice(0, 8);
  const base = slugify(report.titulo ?? "").slice(0, 40).replace(/-+$/, "");
  return base ? `${base}-${id8}` : `rti-${id8}`;
}

/** Pasta de organização: slug do nome (se houver) + id completo, para localizar a empresa na listagem do bucket. */
export function orgFolderName(orgId: string, orgNome?: string | null): string {
  const slug = slugify(orgNome ?? "");
  return slug ? `${slug}-${orgId}` : orgId;
}

export function evidenciaFolder(
  orgId: string,
  report: { id: string; titulo?: string | null },
  orgNome?: string | null,
): string {
  return `${orgFolderName(orgId, orgNome)}/${reportSlug(report)}`;
}

export function evidenciaFileName(ncNum: number, idx: number, ext: string): string {
  const nc = String(ncNum).padStart(4, "0");
  const i = String(idx).padStart(2, "0");
  return `nc-${nc}-${i}.${ext}`;
}

export function evidenciaPath(
  orgId: string,
  report: { id: string; titulo?: string | null },
  ncNum: number,
  idx: number,
  ext: string,
  orgNome?: string | null,
): string {
  return `${evidenciaFolder(orgId, report, orgNome)}/${evidenciaFileName(ncNum, idx, ext)}`;
}

/** Maior índice já usado para uma NC, dado os nomes de arquivo do prefixo. 0 se nenhum. */
export function maiorIndiceEvidencia(names: string[], ncNum: number): number {
  // "0*" tolera tanto o formato antigo sem padding (nc-10-1) quanto o novo (nc-0010-01).
  const re = new RegExp(`^nc-0*${ncNum}-(\\d+)\\.`);
  let max = 0;
  for (const name of names) {
    const m = re.exec(name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}
