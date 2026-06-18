import type { OrgRole } from "@/lib/auth-context";

type ScopedGateContext = {
  isStaff: boolean;
  isAdmin: boolean;
  hasEntitlement: (module: string) => boolean;
  hasOrgRole: (min: OrgRole) => boolean;
};

export type ScopedAccess = {
  canView: boolean;
  canEdit: boolean;
  canAdmin: boolean;
};

export function getRtiCampoAccess(ctx: ScopedGateContext): ScopedAccess {
  const hasRtiEntitlement = ctx.hasEntitlement("rti_pwa") || ctx.hasEntitlement("gestao_completa");
  const canView = ctx.isStaff || hasRtiEntitlement;
  const canEdit = canView && (ctx.isStaff || ctx.hasOrgRole("member"));
  const canAdmin = canView && (ctx.isAdmin || ctx.hasOrgRole("admin"));

  return { canView, canEdit, canAdmin };
}
