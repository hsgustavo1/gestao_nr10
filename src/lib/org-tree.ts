import type { Org } from "@/lib/auth-context";

/** Achata as orgs acessíveis numa lista ordenada com profundidade, montando a
 * hierarquia: consultoria → clientes gerenciados (managed_by) e empresa-mãe →
 * unidades (parent). Tolerante a ciclos/órfãos. Genérica para aceitar linhas
 * que estendem Org (ex.: com `ativa` e entitlements). */
export function buildOrgTree<T extends Org>(orgs: T[]): { org: T; depth: number }[] {
  const parentIdOf = (o: Org) => o.managed_by_org_id ?? o.parent_org_id ?? null;
  const hasVisibleParent = (o: Org) => {
    const pid = parentIdOf(o);
    return pid !== null && orgs.some((p) => p.id === pid);
  };
  const childrenOf = (id: string) => orgs.filter((o) => o.id !== id && parentIdOf(o) === id);
  const out: { org: T; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (o: T, depth: number) => {
    if (seen.has(o.id)) return;
    seen.add(o.id);
    out.push({ org: o, depth });
    for (const c of childrenOf(o.id)) walk(c, depth + 1);
  };
  for (const r of orgs.filter((o) => !hasVisibleParent(o))) walk(r, 0);
  for (const o of orgs) if (!seen.has(o.id)) out.push({ org: o, depth: 0 }); // órfãos/ciclos
  return out;
}
