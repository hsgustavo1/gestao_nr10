import { describe, expect, it } from "vitest";
import { getRtiCampoAccess } from "../tenancy-gates";

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

  it("bloqueia org sem entitlement mesmo que tenha papel local", () => {
    expect(getRtiCampoAccess(ctx({ roles: ["admin"] }))).toEqual({
      canView: false,
      canEdit: false,
      canAdmin: false,
    });
  });
});
