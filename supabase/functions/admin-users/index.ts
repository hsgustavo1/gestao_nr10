// Edge function: admin-users
// Operações administrativas que exigem service role (criar/remover usuários do auth).
// Validação: o caller precisa estar autenticado E possuir role 'admin' (via has_role).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type OrgRole = "owner" | "admin" | "member" | "viewer";

type Action =
  | {
      type: "create";
      email: string;
      password: string;
      display_name?: string;
      // Papel global legado (single-tenant). Opcional quando org_id é informado.
      role?: "admin" | "apoio";
      // Multi-tenancy: vincula o novo usuário a uma org com um papel de org.
      org_id?: string;
      org_role?: OrgRole;
    }
  // Lista os usuários de uma org (membros + profiles + papéis globais). Privilegiado
  // porque o RLS de `profiles` (shares_org) esconde usuários de orgs que o caller
  // gerencia mas não é co-membro (caso do consultor sobre o cliente).
  | { type: "list"; org_id: string }
  // org_id opcional em delete/reset/update: quando presente, a autz é por org
  // (org_role_at_least admin) + verificação de que o alvo pertence à org.
  | { type: "delete"; user_id: string; org_id?: string }
  | { type: "reset_password"; email: string; redirect_to?: string; org_id?: string }
  | {
      type: "update";
      user_id: string;
      email?: string;
      display_name?: string;
      password?: string;
      org_id?: string;
    };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_PUBLISHABLE_KEY =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_PUBLISHABLE_KEY) {
      return json({ error: "Server misconfigured: missing Supabase env vars" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    // Cliente "as caller" — valida o JWT do solicitante
    const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return json({ error: "Invalid session" }, 401);
    const callerId = userRes.user.id;

    const action = (await req.json()) as Action;

    // Autorização escopada por org:
    //  - platform admin pode tudo (cross-tenant);
    //  - criar usuário PARA uma org exige org_role_at_least(admin) naquela org
    //    (cobre consultor que gerencia o cliente, via can_access/org_role_at_least);
    //  - sem org_id, cai no papel global legado (has_role admin) — compat single-tenant.
    // org_id escopa a autorização em qualquer ação que o aceite.
    const actionOrgId =
      "org_id" in action ? (action as { org_id?: string }).org_id : undefined;

    const { data: platformAdmin } = await userClient.rpc("is_platform_admin", { _uid: callerId });
    let authorized = platformAdmin === true;
    if (!authorized) {
      if (actionOrgId) {
        const { data: orgOk, error: orgErr } = await userClient.rpc("org_role_at_least", {
          _uid: callerId,
          _org_id: actionOrgId,
          _min: "admin",
        });
        if (orgErr) return json({ error: "Org role check failed: " + orgErr.message }, 500);
        authorized = orgOk === true;
      } else {
        const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
          _user_id: callerId,
          _role: "admin",
        });
        if (roleErr) return json({ error: "Role check failed: " + roleErr.message }, 500);
        authorized = isAdmin === true;
      }
    }
    if (!authorized) return json({ error: "Forbidden: admin role required" }, 403);

    // Cliente admin com service role para operações privilegiadas
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Quando a autz é por org (não platform admin), o usuário-alvo precisa pertencer
    // à org — senão um admin de org A poderia mirar um usuário de outra org só passando
    // o org_id que administra. Platform admin e caminho global legado pulam a checagem.
    const targetMustBeInOrg = Boolean(actionOrgId) && platformAdmin !== true;
    async function assertUserInOrg(targetUserId: string): Promise<boolean> {
      if (!targetMustBeInOrg) return true;
      const { data } = await admin
        .from("org_memberships")
        .select("user_id")
        .eq("org_id", actionOrgId)
        .eq("user_id", targetUserId)
        .maybeSingle();
      return Boolean(data);
    }

    if (action.type === "list") {
      if (!actionOrgId) return json({ error: "org_id é obrigatório" }, 400);
      const { data: mems, error: memErr } = await admin
        .from("org_memberships")
        .select("user_id, org_role")
        .eq("org_id", actionOrgId);
      if (memErr) return json({ error: memErr.message }, 500);
      const ids = (mems ?? []).map((m: { user_id: string }) => m.user_id);
      if (ids.length === 0) return json({ ok: true, users: [] });

      const [{ data: profs }, { data: gRoles }] = await Promise.all([
        admin.from("profiles").select("id, email, display_name").in("id", ids),
        admin.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);

      const roleMap = new Map<string, string[]>();
      (gRoles ?? []).forEach((r: { user_id: string; role: string }) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
      const orgRoleMap = new Map(
        (mems ?? []).map((m: { user_id: string; org_role: string }) => [m.user_id, m.org_role]),
      );
      const profMap = new Map(
        (profs ?? []).map((p: { id: string; email: string | null; display_name: string | null }) => [
          p.id,
          p,
        ]),
      );

      const users = ids.map((id: string) => {
        const p = profMap.get(id);
        return {
          id,
          email: p?.email ?? null,
          display_name: p?.display_name ?? null,
          org_role: orgRoleMap.get(id) ?? null,
          roles: roleMap.get(id) ?? [],
        };
      });
      return json({ ok: true, users });
    }

    if (action.type === "create") {
      const email = (action.email ?? "").trim().toLowerCase();
      const password = action.password ?? "";
      const displayName = (action.display_name ?? email.split("@")[0]).trim();
      const role = action.role;
      const orgId = action.org_id;
      const orgRole = action.org_role ?? "member";
      if (!email || !password) return json({ error: "Email e senha são obrigatórios" }, 400);
      if (password.length < 8)
        return json({ error: "A senha deve ter pelo menos 8 caracteres" }, 400);
      // Papel global é opcional agora (multi-tenancy usa org_role). Se vier, valida.
      if (role !== undefined && role !== "admin" && role !== "apoio") {
        return json({ error: "Role inválida" }, 400);
      }
      if (!orgId && !role) {
        return json({ error: "Informe org_id (multi-tenant) ou role (global)" }, 400);
      }
      const validOrgRoles = ["owner", "admin", "member", "viewer"];
      if (action.org_role !== undefined && !validOrgRoles.includes(action.org_role)) {
        return json({ error: "org_role inválido" }, 400);
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (createErr || !created.user)
        return json({ error: createErr?.message ?? "Erro ao criar" }, 400);

      // Garante profile (trigger handle_new_user já cuida, mas reforçamos display_name)
      await admin.from("profiles").upsert({
        id: created.user.id,
        email,
        display_name: displayName,
      });

      // Papel global legado (opcional). Mantém compat com o painel single-tenant.
      if (role) {
        await admin.from("user_roles").insert({ user_id: created.user.id, role });
      }

      // Multi-tenancy: vincula o novo usuário à org informada.
      if (orgId) {
        const { error: memErr } = await admin
          .from("org_memberships")
          .insert({ user_id: created.user.id, org_id: orgId, org_role: orgRole });
        if (memErr)
          return json(
            { error: "Usuário criado, mas falhou o vínculo de org: " + memErr.message },
            500,
          );
      }

      return json({ ok: true, user: { id: created.user.id, email, org_id: orgId ?? null } });
    }

    if (action.type === "delete") {
      if (!action.user_id) return json({ error: "user_id é obrigatório" }, 400);
      if (action.user_id === userRes.user.id) {
        return json({ error: "Você não pode remover a si mesmo" }, 400);
      }
      if (!(await assertUserInOrg(action.user_id))) {
        return json({ error: "Usuário não pertence a esta organização" }, 403);
      }

      // Delete escopado por org (consultor/admin de org): remove só o vínculo daquela
      // org. Só apaga o usuário do auth se ele não sobrar em nenhuma outra org nem
      // tiver papel global — evita derrubar um usuário multi-org de outro tenant.
      if (targetMustBeInOrg) {
        await admin
          .from("org_memberships")
          .delete()
          .eq("user_id", action.user_id)
          .eq("org_id", actionOrgId);
        const [{ data: remMems }, { data: remRoles }] = await Promise.all([
          admin.from("org_memberships").select("org_id").eq("user_id", action.user_id),
          admin.from("user_roles").select("role").eq("user_id", action.user_id),
        ]);
        const orphan = (remMems ?? []).length === 0 && (remRoles ?? []).length === 0;
        if (orphan) {
          await admin.from("profiles").delete().eq("id", action.user_id);
          const { error: delErr } = await admin.auth.admin.deleteUser(action.user_id);
          if (delErr) return json({ error: delErr.message }, 400);
        }
        return json({ ok: true, removed_from_org: true, deleted_user: orphan });
      }

      // Delete global legado (platform admin / admin global): remove tudo.
      await admin.from("user_roles").delete().eq("user_id", action.user_id);
      await admin.from("org_memberships").delete().eq("user_id", action.user_id);
      await admin.from("profiles").delete().eq("id", action.user_id);
      const { error: delErr } = await admin.auth.admin.deleteUser(action.user_id);
      if (delErr) return json({ error: delErr.message }, 400);
      return json({ ok: true, deleted_user: true });
    }

    if (action.type === "reset_password") {
      if (!action.email) return json({ error: "email é obrigatório" }, 400);
      // Escopo por org: o alvo (por e-mail) precisa pertencer à org.
      if (targetMustBeInOrg) {
        const { data: prof } = await admin
          .from("profiles")
          .select("id")
          .eq("email", action.email.trim().toLowerCase())
          .maybeSingle();
        if (!prof || !(await assertUserInOrg(prof.id))) {
          return json({ error: "Usuário não pertence a esta organização" }, 403);
        }
      }
      // Usa o cliente público para DISPARAR o e-mail (generateLink só gera link, não envia)
      const publicClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false },
      });
      const { error: resetErr } = await publicClient.auth.resetPasswordForEmail(
        action.email,
        action.redirect_to ? { redirectTo: action.redirect_to } : undefined,
      );
      if (resetErr) return json({ error: resetErr.message }, 400);
      return json({ ok: true });
    }

    if (action.type === "update") {
      if (!action.user_id) return json({ error: "user_id é obrigatório" }, 400);
      if (!(await assertUserInOrg(action.user_id))) {
        return json({ error: "Usuário não pertence a esta organização" }, 403);
      }
      const updates: {
        email?: string;
        password?: string;
        user_metadata?: Record<string, unknown>;
      } = {};
      const newEmail = action.email?.trim().toLowerCase();
      const newName = action.display_name?.trim();
      if (newEmail) updates.email = newEmail;
      if (action.password) {
        if (action.password.length < 8)
          return json({ error: "Senha deve ter pelo menos 8 caracteres" }, 400);
        updates.password = action.password;
      }
      if (newName !== undefined) updates.user_metadata = { display_name: newName };
      if (Object.keys(updates).length > 0) {
        const { error: upErr } = await admin.auth.admin.updateUserById(action.user_id, updates);
        if (upErr) return json({ error: upErr.message }, 400);
      }
      const profilePatch: Record<string, unknown> = {};
      if (newEmail) profilePatch.email = newEmail;
      if (newName !== undefined) profilePatch.display_name = newName;
      if (Object.keys(profilePatch).length > 0) {
        await admin.from("profiles").update(profilePatch).eq("id", action.user_id);
      }
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return json({ error: msg }, 500);
  }
});
