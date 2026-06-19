import { describe, expect, it } from "vitest";
import { getRtiCampoAccess, getRecordAccess, getEmpresaAdminAccess } from "../tenancy-gates";

const ctx = ({
  isStaff = false,
  isAdmin = false,
  entitlements = [],
  roles = [],
}: {
  isStaff?: boolean;
  isAdmin?: boolean;
  entitlements?: string[];
  roles?: string[];
}) => {
  const rank = { viewer: 1, member: 2, admin: 3, owner: 4 } as const;
  return {
    isStaff,
    isAdmin,
    hasEntitlement: (module: string) => entitlements.includes(module),
    hasOrgRole: (min: "viewer" | "member" | "admin" | "owner") =>
      roles.some((role) => rank[role as keyof typeof rank] >= rank[min]),
  };
};

describe("getRtiCampoAccess", () => {
  it("preserva staff legado mesmo sem entitlement carregado", () => {
    expect(getRtiCampoAccess(ctx({ isStaff: true }))).toEqual({
      canView: true,
      canEdit: true,
      canAdmin: false,
    });
  });

  it("preserva admin legado como operador e administrador", () => {
    expect(getRtiCampoAccess(ctx({ isStaff: true, isAdmin: true }))).toEqual({
      canView: true,
      canEdit: true,
      canAdmin: true,
    });
  });

  it("permite cliente member com rti_pwa editar RTI/Campo sem papel global", () => {
    expect(getRtiCampoAccess(ctx({ entitlements: ["rti_pwa"], roles: ["member"] }))).toEqual({
      canView: true,
      canEdit: true,
      canAdmin: false,
    });
  });

  it("permite cliente admin com rti_pwa executar ações administrativas do fluxo", () => {
    expect(getRtiCampoAccess(ctx({ entitlements: ["rti_pwa"], roles: ["admin"] }))).toEqual({
      canView: true,
      canEdit: true,
      canAdmin: true,
    });
  });

  it("viewer do cliente com rti_pwa: visualiza, mas não edita nem administra", () => {
    expect(getRtiCampoAccess(ctx({ entitlements: ["rti_pwa"], roles: ["viewer"] }))).toEqual({
      canView: true,
      canEdit: false,
      canAdmin: false,
    });
  });

  it("bloqueia org sem entitlement mesmo que tenha papel local", () => {
    expect(getRtiCampoAccess(ctx({ roles: ["admin"] }))).toEqual({
      canView: false,
      canEdit: false,
      canAdmin: false,
    });
  });
});

const RANK = { viewer: 1, member: 2, admin: 3, owner: 4 } as const;
type R = keyof typeof RANK;

const sealCtx = ({
  isStaff = false,
  isPlatformAdmin = false,
  entitlements = ["rti_pwa"],
  direct = null,
  manager = null,
  memberships = {},
}: {
  isStaff?: boolean;
  isPlatformAdmin?: boolean;
  entitlements?: string[];
  direct?: R | null;
  manager?: R | null;
  memberships?: Record<string, R>;
}) => ({
  isStaff,
  isPlatformAdmin,
  hasEntitlement: (m: string) => entitlements.includes(m),
  directOrgRole: direct,
  managerOrgRole: manager,
  roleInOrg: (orgId: string) => memberships[orgId] ?? null,
});

const sealed = { entregue_em: "2026-06-19T00:00:00Z", entregue_por_org: "consultoria-1" };
const rascunho = { entregue_em: null, entregue_por_org: null };

describe("getRecordAccess", () => {
  it("admin-padrão do cliente: edita rotina, NÃO edita técnico nem entrega (selado)", () => {
    const a = getRecordAccess(sealCtx({ direct: "admin" }), sealed);
    expect(a.canView).toBe(true);
    expect(a.canEditOperacional).toBe(true);
    expect(a.canEditTecnico).toBe(false);
    expect(a.canDelete).toBe(false);
    expect(a.canEntregar).toBe(false);
  });

  it("admin-geral (owner) do cliente: bypassa o selo", () => {
    const a = getRecordAccess(sealCtx({ direct: "owner" }), sealed);
    expect(a.canEditTecnico).toBe(true);
    expect(a.canDelete).toBe(true);
  });

  it("consultor (membro da org autora): bypassa o selo e pode entregar rascunho", () => {
    const a = getRecordAccess(
      sealCtx({ direct: "member", manager: "owner", memberships: { "consultoria-1": "owner" } }),
      sealed,
    );
    expect(a.canEditTecnico).toBe(true);
    const draft = getRecordAccess(sealCtx({ manager: "owner" }), rascunho);
    expect(draft.canEntregar).toBe(true);
  });

  it("dono (platform admin): bypassa tudo", () => {
    const a = getRecordAccess(sealCtx({ isPlatformAdmin: true }), sealed);
    expect(a.canEditTecnico).toBe(true);
    expect(a.canEntregar).toBe(false); // já entregue
  });

  it("viewer: só lê", () => {
    const a = getRecordAccess(sealCtx({ direct: "viewer" }), sealed);
    expect(a.canEditOperacional).toBe(false);
    expect(a.canEditTecnico).toBe(false);
  });

  it("relatório em rascunho: admin-padrão edita técnico (sem selo)", () => {
    const a = getRecordAccess(sealCtx({ direct: "admin" }), rascunho);
    expect(a.canEditTecnico).toBe(true);
  });
});

const empresaCtx = ({
  isPlatformAdmin = false,
  roles = [],
}: {
  isPlatformAdmin?: boolean;
  roles?: string[];
}) => {
  const rank = { viewer: 1, member: 2, admin: 3, owner: 4 } as const;
  return {
    isPlatformAdmin,
    hasOrgRole: (min: "viewer" | "member" | "admin" | "owner") =>
      isPlatformAdmin || roles.some((role) => rank[role as keyof typeof rank] >= rank[min]),
  };
};

describe("getEmpresaAdminAccess", () => {
  it("platform admin: pode tudo", () => {
    expect(getEmpresaAdminAccess(empresaCtx({ isPlatformAdmin: true }))).toEqual({
      canCreate: true,
      canEditOrg: true,
      canManageEntitlements: true,
      canDeactivate: true,
      canManageUsers: true,
    });
  });

  it("consultor (admin): edita e gerencia usuários, mas NÃO cria/entitlements/desativa", () => {
    expect(getEmpresaAdminAccess(empresaCtx({ roles: ["admin"] }))).toEqual({
      canCreate: false,
      canEditOrg: true,
      canManageEntitlements: false,
      canDeactivate: false,
      canManageUsers: true,
    });
  });

  it("member: nada", () => {
    expect(getEmpresaAdminAccess(empresaCtx({ roles: ["member"] }))).toEqual({
      canCreate: false,
      canEditOrg: false,
      canManageEntitlements: false,
      canDeactivate: false,
      canManageUsers: false,
    });
  });

  it("viewer: nada", () => {
    expect(getEmpresaAdminAccess(empresaCtx({ roles: ["viewer"] }))).toEqual({
      canCreate: false,
      canEditOrg: false,
      canManageEntitlements: false,
      canDeactivate: false,
      canManageUsers: false,
    });
  });
});
