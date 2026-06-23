import type { OrgTipo } from "@/lib/auth-context";

export const TIPO_LABEL: Record<OrgTipo, string> = {
  consultoria: "Consultoria",
  cliente: "Cliente",
  unidade: "Unidade",
};

/** Catálogo de módulos (entitlements). A ordem define a exibição nos checkboxes. */
export const MODULES = [
  { key: "rti", label: "RTI" },
  { key: "campo_pwa", label: "Campo (PWA)" },
  { key: "loto", label: "LOTO" },
  { key: "pessoas", label: "Pessoas" },
] as const;

export const MODULE_LABEL: Record<string, string> = {
  ...Object.fromEntries(MODULES.map((m) => [m.key, m.label])),
  rti_pwa: "RTI + Campo (PWA)", // legado
  gestao_completa: "Gestão completa", // legado
};
