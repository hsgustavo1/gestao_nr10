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

export function getPessoasAccess(ctx: ScopedGateContext): ScopedAccess {
  const hasGestao = ctx.hasEntitlement("gestao_completa");
  const canView = ctx.isStaff || hasGestao;
  const canEdit = canView && (ctx.isStaff || ctx.hasOrgRole("member"));
  const canAdmin = canView && (ctx.isAdmin || ctx.hasOrgRole("admin"));
  return { canView, canEdit, canAdmin };
}

export function getRtiCampoAccess(ctx: ScopedGateContext): ScopedAccess {
  const legacy = ctx.hasEntitlement("rti_pwa"); // retrocompatibilidade
  const hasRtiEntitlement = legacy || ctx.hasEntitlement("rti") || ctx.hasEntitlement("gestao_completa");
  const hasCampoEntitlement = legacy || ctx.hasEntitlement("campo_pwa") || ctx.hasEntitlement("gestao_completa");
  const canView = ctx.isStaff || hasRtiEntitlement;
  const canEdit = canView && (ctx.isStaff || hasCampoEntitlement) && (ctx.isStaff || ctx.hasOrgRole("member"));
  const canAdmin = canView && (ctx.isAdmin || ctx.hasOrgRole("admin"));

  return { canView, canEdit, canAdmin };
}

const ORG_RANK: Record<OrgRole, number> = { viewer: 1, member: 2, admin: 3, owner: 4 };
const rank = (r: OrgRole | null): number => (r ? ORG_RANK[r] : 0);

export type SealActor = {
  isStaff: boolean;
  isPlatformAdmin: boolean;
  hasEntitlement: (module: string) => boolean;
  /** papel direto na org DO registro (a org-cliente dona) */
  directOrgRole: OrgRole | null;
  /** maior papel na cadeia gestora (managed_by/parent) — o consultor */
  managerOrgRole: OrgRole | null;
  /** papel direto numa org arbitrária (para entregue_por_org) */
  roleInOrg: (orgId: string) => OrgRole | null;
};

export type SealedRecord = {
  entregue_em: string | null;
  entregue_por_org: string | null;
};

export type RecordAccess = {
  canView: boolean;
  canEditOperacional: boolean;
  canEditTecnico: boolean;
  canDelete: boolean;
  canEntregar: boolean;
  sealed: boolean;
};

export function getRecordAccess(ctx: SealActor, record: SealedRecord): RecordAccess {
  const hasRti = ctx.hasEntitlement("rti_pwa") || ctx.hasEntitlement("rti") || ctx.hasEntitlement("gestao_completa");
  const canView = ctx.isStaff || ctx.isPlatformAdmin || hasRti;

  const editRank = Math.max(rank(ctx.directOrgRole), rank(ctx.managerOrgRole));
  const canEditModule =
    canView && (ctx.isStaff || ctx.isPlatformAdmin || editRank >= ORG_RANK.member);

  const authorRank = record.entregue_por_org ? rank(ctx.roleInOrg(record.entregue_por_org)) : 0;
  const canBypass =
    ctx.isStaff ||
    ctx.isPlatformAdmin ||
    rank(ctx.directOrgRole) >= ORG_RANK.owner ||
    rank(ctx.managerOrgRole) >= ORG_RANK.member ||
    authorRank >= ORG_RANK.member;

  const sealed = record.entregue_em != null;

  return {
    canView,
    canEditOperacional: canEditModule,
    canEditTecnico: canEditModule && (!sealed || canBypass),
    canDelete: canEditModule && (!sealed || canBypass),
    canEntregar: canView && !sealed && canBypass,
    sealed,
  };
}

export type EmpresaAdminAccess = {
  canCreate: boolean;
  canEditOrg: boolean;
  canManageEntitlements: boolean;
  canDeactivate: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
};

type EmpresaGateContext = {
  isPlatformAdmin: boolean;
  hasOrgRole: (min: OrgRole) => boolean;
};

/** Gate de UI da tela de gestão de empresas. Criação, entitlements e desativação
 * são decisões da plataforma (só platform admin). Editar dados e gerenciar
 * usuários cobrem também o consultor admin da carteira. A barreira real é o
 * banco (RLS + autz das RPCs); este gate é só UX. */
export function getEmpresaAdminAccess(ctx: EmpresaGateContext): EmpresaAdminAccess {
  const pa = ctx.isPlatformAdmin;
  const orgAdmin = pa || ctx.hasOrgRole("admin");
  return {
    canCreate: pa,
    canManageEntitlements: pa,
    canDeactivate: pa,
    canDelete: pa,
    canEditOrg: orgAdmin,
    canManageUsers: orgAdmin,
  };
}
