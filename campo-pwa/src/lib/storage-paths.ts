// Mirror mínimo de src/lib/storage-paths.ts (app principal) para o STAGING da foto
// de campo. Drift conhecido e aceito (mesma política de campo.ts). O `slugify` DEVE
// bater com o do app para que a pasta {slug(org.nome)}-{orgId} seja idêntica à que a
// composição do RTI usa — senão a foto não seria localizada no mesmo prefixo.

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Pasta da empresa: slug do nome (se houver) + id completo. */
export function orgFolderName(orgId: string, orgNome?: string | null): string {
  const slug = slugify(orgNome ?? "");
  return slug ? `${slug}-${orgId}` : orgId;
}

/** Identificador de pasta da inspeção no staging: slug do título (≤40) + 8 primeiros do id. */
export function inspecaoSlug(inspection: { id: string; titulo?: string | null }): string {
  const id8 = inspection.id.slice(0, 8);
  const base = slugify(inspection.titulo ?? "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return base ? `${base}-${id8}` : `insp-${id8}`;
}

/** {slug(org.nome)}-{orgId}/inspecoes/{inspecaoSlug}/{fileId}.{ext} */
export function inspecaoStagingPath(
  orgId: string,
  inspection: { id: string; titulo?: string | null },
  fileId: string,
  ext: string,
  orgNome?: string | null,
): string {
  return `${orgFolderName(orgId, orgNome)}/inspecoes/${inspecaoSlug(inspection)}/${fileId}.${ext}`;
}
