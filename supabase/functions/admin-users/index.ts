// Edge function: admin-users
// Operações administrativas que exigem service role (criar/remover usuários do auth).
// Validação: o caller precisa estar autenticado E possuir role 'admin' (via has_role).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action =
  | { type: "create"; email: string; password: string; display_name?: string; role: "admin" | "apoio" }
  | { type: "delete"; user_id: string }
  | { type: "reset_password"; email: string }
  | { type: "update"; user_id: string; email?: string; display_name?: string; password?: string };

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

    // Verifica role admin via RPC has_role
    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: userRes.user.id,
      _role: "admin",
    });
    if (roleErr) return json({ error: "Role check failed: " + roleErr.message }, 500);
    if (!isAdmin) return json({ error: "Forbidden: admin role required" }, 403);

    const action = (await req.json()) as Action;

    // Cliente admin com service role para operações privilegiadas
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    if (action.type === "create") {
      const email = (action.email ?? "").trim().toLowerCase();
      const password = action.password ?? "";
      const displayName = (action.display_name ?? email.split("@")[0]).trim();
      const role = action.role;
      if (!email || !password) return json({ error: "Email e senha são obrigatórios" }, 400);
      if (password.length < 8) return json({ error: "A senha deve ter pelo menos 8 caracteres" }, 400);
      if (role !== "admin" && role !== "apoio") return json({ error: "Role inválida" }, 400);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (createErr || !created.user) return json({ error: createErr?.message ?? "Erro ao criar" }, 400);

      // Garante profile (trigger handle_new_user já cuida, mas reforçamos display_name)
      await admin.from("profiles").upsert({
        id: created.user.id,
        email,
        display_name: displayName,
      });

      // Atribui role inicial
      await admin.from("user_roles").insert({ user_id: created.user.id, role });

      return json({ ok: true, user: { id: created.user.id, email } });
    }

    if (action.type === "delete") {
      if (!action.user_id) return json({ error: "user_id é obrigatório" }, 400);
      if (action.user_id === userRes.user.id) {
        return json({ error: "Você não pode remover a si mesmo" }, 400);
      }
      // Remove roles e profile primeiro (FK não cascateia daqui), depois auth user
      await admin.from("user_roles").delete().eq("user_id", action.user_id);
      await admin.from("profiles").delete().eq("id", action.user_id);
      const { error: delErr } = await admin.auth.admin.deleteUser(action.user_id);
      if (delErr) return json({ error: delErr.message }, 400);
      return json({ ok: true });
    }

    if (action.type === "reset_password") {
      if (!action.email) return json({ error: "email é obrigatório" }, 400);
      const { error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: action.email,
      });
      if (linkErr) return json({ error: linkErr.message }, 400);
      return json({ ok: true });
    }

    if (action.type === "update") {
      if (!action.user_id) return json({ error: "user_id é obrigatório" }, 400);
      const updates: { email?: string; password?: string; user_metadata?: Record<string, unknown> } = {};
      const newEmail = action.email?.trim().toLowerCase();
      const newName = action.display_name?.trim();
      if (newEmail) updates.email = newEmail;
      if (action.password) {
        if (action.password.length < 8) return json({ error: "Senha deve ter pelo menos 8 caracteres" }, 400);
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