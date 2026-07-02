// Nomes de path do bucket rti-evidencias. Puro (sem Supabase) — testável isolado.
// Esquema (2026-07-02): um prefixo por relatório, arquivo nomeado por NC e índice.
//   {orgId}/{reportSlug}/nc-{ncNum}-{idx}.{ext}

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

export function evidenciaFolder(
  orgId: string,
  report: { id: string; titulo?: string | null },
): string {
  return `${orgId}/${reportSlug(report)}`;
}

export function evidenciaFileName(ncNum: number, idx: number, ext: string): string {
  return `nc-${ncNum}-${idx}.${ext}`;
}

export function evidenciaPath(
  orgId: string,
  report: { id: string; titulo?: string | null },
  ncNum: number,
  idx: number,
  ext: string,
): string {
  return `${evidenciaFolder(orgId, report)}/${evidenciaFileName(ncNum, idx, ext)}`;
}

/** Maior índice já usado para uma NC, dado os nomes de arquivo do prefixo. 0 se nenhum. */
export function maiorIndiceEvidencia(names: string[], ncNum: number): number {
  const re = new RegExp(`^nc-${ncNum}-(\\d+)\\.`);
  let max = 0;
  for (const name of names) {
    const m = re.exec(name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}
