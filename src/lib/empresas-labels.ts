import type { OrgTipo } from "@/lib/auth-context";

export const TIPO_LABEL: Record<OrgTipo, string> = {
  consultoria: "Consultoria",
  cliente: "Cliente",
  unidade: "Unidade",
};

/** Catálogo de módulos (entitlements). A ordem define a exibição nos checkboxes. */
export const MODULES = [
  { key: "rti_pwa", label: "RTI + Campo (PWA)" },
  { key: "gestao_completa", label: "Gestão completa" },
  { key: "loto", label: "LOTO" },
] as const;

export const MODULE_LABEL: Record<string, string> = Object.fromEntries(
  MODULES.map((m) => [m.key, m.label]),
);
