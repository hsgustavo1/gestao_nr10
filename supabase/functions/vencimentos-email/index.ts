// Edge Function: digest semanal por organização (trilha D — D2, 2026-07-09)
//
// Para cada org CLIENTE ativa: agrega vencimentos (capacitações NR-10, ITs,
// prontuário, inspeções, ensaios de EPI e ASOs) e ações do plano RTI com prazo
// crítico, e envia um resumo por e-mail (Resend) para os ADMINS da org
// (profiles.email, menos opt-outs em profiles.digest_optout).
//
// Regras: só envia se houver pendência; idempotente por (org, semana ISO) via
// digest_log; falha em uma org não derruba o lote. LGPD: nunca lista resultado
// de ASO — só o vencimento.
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY  — chave da API do Resend (https://resend.com)
//   ALERT_FROM      — remetente verificado (ex.: alertas@suaempresa.com.br)
//   ALERT_EMAILS    — (opcional) cópia de supervisão do founder, separada por vírgula
//
// Agendada por pg_cron 'digest-semanal' (segunda 11:00 UTC) — migration
// 20260709120000_digest_semanal.sql.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const HORIZON_DAYS = 30;
const PINE = "#0C3326";

type Item = { kind: string; title: string; subject: string; dueDate: string; daysLeft: number };
type NcItem = { numero: number; descricao: string; prazo: string; daysLeft: number };

function daysLeft(iso: string): number {
  const due = new Date(iso + "T12:00:00");
  return Math.floor((due.getTime() - Date.now()) / 86_400_000);
}

function addYearsISO(iso: string, years: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Segunda-feira ISO da semana corrente (chave de idempotência). */
function semanaISO(): string {
  const d = new Date();
  const dow = (d.getUTCDay() + 6) % 7; // 0 = segunda
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

const TRAINING_LABELS: Record<string, string> = {
  nr10_basico: "NR-10 Básico",
  nr10_areas_classificadas: "NR-10 Áreas Classificadas",
  sep: "SEP",
};

/** Pendências da org (espelha as regras de buildVencimentos do app — D-D6). */
async function pendenciasDaOrg(supabase: SupabaseClient, orgId: string) {
  const items: Item[] = [];
  const push = (kind: string, title: string, subject: string, dueDate: string) => {
    const dl = daysLeft(dueDate);
    if (dl <= HORIZON_DAYS) items.push({ kind, title, subject, dueDate, daysLeft: dl });
  };

  const { data: employees = [] } = await supabase
    .from("employees")
    .select("id, name, matricula")
    .eq("org_id", orgId)
    .eq("status", "ativo");
  const empById = new Map((employees ?? []).map((e) => [e.id, e]));

  // 1) Capacitações NR-10 (validade 2 anos sobre a data mais recente por tipo)
  const { data: trainings = [] } = await supabase
    .from("nr10_trainings")
    .select("employee_id, training_type, training_date")
    .eq("org_id", orgId);
  const latest = new Map<string, string>();
  for (const t of trainings ?? []) {
    if (!t.training_date) continue;
    const key = `${t.employee_id}|${t.training_type}`;
    if (!latest.has(key) || t.training_date > latest.get(key)!) latest.set(key, t.training_date);
  }
  for (const [key, date] of latest) {
    const [empId, type] = key.split("|");
    const emp = empById.get(empId);
    if (!emp) continue;
    push(
      "Capacitação",
      TRAINING_LABELS[type] ?? type,
      `${emp.name} (${emp.matricula})`,
      addYearsISO(date, 2),
    );
  }

  // 2) ITs (conclusão + validade da instrução)
  const { data: its = [] } = await supabase
    .from("it_trainings")
    .select("employee_id, conclusao_date, work_instructions(code, title, validity_months)")
    .eq("org_id", orgId);
  for (const it of (its ?? []) as Array<{
    employee_id: string;
    conclusao_date: string | null;
    work_instructions: { code: string; title: string | null; validity_months: number } | null;
  }>) {
    if (!it.conclusao_date) continue;
    const emp = empById.get(it.employee_id);
    if (!emp) continue;
    const months = it.work_instructions?.validity_months ?? 24;
    push(
      "IT",
      `IT ${it.work_instructions?.code ?? ""}`,
      `${emp.name} (${emp.matricula})`,
      addMonthsISO(it.conclusao_date, months),
    );
  }

  // 3) Prontuário
  const { data: docs = [] } = await supabase
    .from("nr10_documents")
    .select("title, category, validity_date")
    .eq("org_id", orgId)
    .not("validity_date", "is", null);
  for (const d of docs ?? []) push("Prontuário", d.title, d.category, d.validity_date);

  // 4) Inspeções
  const { data: inspections = [] } = await supabase
    .from("inspections")
    .select("inspection_type, equipment, sector, validity_date")
    .eq("org_id", orgId)
    .not("validity_date", "is", null);
  for (const i of inspections ?? []) {
    push(
      "Inspeção",
      `${i.inspection_type.toUpperCase()} — ${i.equipment}`,
      i.sector ?? "—",
      i.validity_date,
    );
  }

  // 5) Ensaios de EPI (último aprovado + intervalo)
  const { data: epis = [] } = await supabase
    .from("epis")
    .select("id, epi_type, serial_number, test_interval_months")
    .eq("org_id", orgId)
    .eq("active", true);
  const epiIds = (epis ?? []).map((e) => e.id);
  const lastTest = new Map<string, { test_date: string; result: string }>();
  if (epiIds.length > 0) {
    const { data: tests = [] } = await supabase
      .from("epi_tests")
      .select("epi_id, test_date, result")
      .in("epi_id", epiIds)
      .order("test_date", { ascending: false });
    for (const t of tests ?? []) if (!lastTest.has(t.epi_id)) lastTest.set(t.epi_id, t);
  }
  for (const e of epis ?? []) {
    const last = lastTest.get(e.id);
    if (!last || last.result !== "aprovado") continue;
    push(
      "EPI",
      `${e.epi_type}${e.serial_number ? ` (${e.serial_number})` : ""}`,
      "Ensaio dielétrico",
      addMonthsISO(last.test_date, e.test_interval_months),
    );
  }

  // 6) ASOs (mais recente por colaborador ativo; nunca expõe resultado — LGPD)
  const { data: asos = [] } = await supabase
    .from("asos")
    .select("employee_id, exam_date, validity_date, tipo")
    .eq("org_id", orgId);
  const latestAso = new Map<string, { exam_date: string; validity_date: string; tipo: string }>();
  for (const a of asos ?? []) {
    const cur = latestAso.get(a.employee_id);
    if (!cur || a.exam_date > cur.exam_date) latestAso.set(a.employee_id, a);
  }
  for (const [empId, aso] of latestAso) {
    const emp = empById.get(empId);
    if (!emp) continue;
    push("ASO", `ASO ${aso.tipo}`, `${emp.name} (${emp.matricula})`, aso.validity_date);
  }

  items.sort((a, b) => a.daysLeft - b.daysLeft);

  // 7) Ações do plano RTI com prazo crítico, agrupadas por responsável
  const { data: rtiNcs = [] } = await supabase
    .from("rti_ncs")
    .select("numero, descricao, responsavel, prazo, status")
    .eq("org_id", orgId)
    .neq("status", "concluida")
    .not("prazo", "is", null);
  const ncsByResp = new Map<string, NcItem[]>();
  for (const nc of rtiNcs ?? []) {
    const dl = daysLeft(nc.prazo);
    if (dl > HORIZON_DAYS) continue;
    const resp = (nc.responsavel ?? "").trim() || "Sem responsável definido";
    const arr = ncsByResp.get(resp) ?? [];
    arr.push({ numero: nc.numero, descricao: nc.descricao ?? "", prazo: nc.prazo, daysLeft: dl });
    ncsByResp.set(resp, arr);
  }
  for (const arr of ncsByResp.values()) arr.sort((a, b) => a.daysLeft - b.daysLeft);

  return { items, ncsByResp };
}

/** E-mails dos admins/owners da org que não fizeram opt-out. */
async function destinatariosDaOrg(supabase: SupabaseClient, orgId: string): Promise<string[]> {
  const { data: members = [] } = await supabase
    .from("org_memberships")
    .select("user_id, org_role")
    .eq("org_id", orgId)
    .in("org_role", ["admin", "owner"]);
  const ids = (members ?? []).map((m) => m.user_id);
  if (ids.length === 0) return [];
  const { data: profiles = [] } = await supabase
    .from("profiles")
    .select("id, email, digest_optout")
    .in("id", ids);
  return (profiles ?? [])
    .filter((p) => p.email && !p.digest_optout)
    .map((p) => p.email as string);
}

function htmlDigest(orgNome: string, items: Item[], ncsByResp: Map<string, NcItem[]>): string {
  const expired = items.filter((i) => i.daysLeft < 0);
  const expiring = items.filter((i) => i.daysLeft >= 0);
  const totalNcs = Array.from(ncsByResp.values()).reduce((s, a) => s + a.length, 0);

  const row = (i: Item) =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${i.kind}</td>` +
    `<td style="padding:6px 10px;border-bottom:1px solid #eee">${i.title}</td>` +
    `<td style="padding:6px 10px;border-bottom:1px solid #eee">${i.subject}</td>` +
    `<td style="padding:6px 10px;border-bottom:1px solid #eee;white-space:nowrap">${i.dueDate.split("-").reverse().join("/")}</td>` +
    `<td style="padding:6px 10px;border-bottom:1px solid #eee;color:${i.daysLeft < 0 ? "#dc2626" : "#d97706"};font-weight:600;white-space:nowrap">` +
    `${i.daysLeft < 0 ? `vencido há ${Math.abs(i.daysLeft)} d` : `vence em ${i.daysLeft} d`}</td></tr>`;

  const ncSection =
    totalNcs === 0
      ? ""
      : `
      <h3 style="color:${PINE};margin-top:24px">Plano de ação RTI — ${totalNcs} ação(ões) com prazo crítico</h3>
      ${Array.from(ncsByResp.entries())
        .map(
          ([resp, ncs]) => `
        <p style="margin:10px 0 4px;font-weight:600">${resp} — ${ncs.length} ação(ões)</p>
        <table style="border-collapse:collapse;width:100%;font-size:13px">
          <tbody>${ncs
            .map(
              (nc) =>
                `<tr><td style="padding:4px 10px;border-bottom:1px solid #eee;white-space:nowrap">NC ${nc.numero}</td>` +
                `<td style="padding:4px 10px;border-bottom:1px solid #eee">${nc.descricao.slice(0, 90)}${nc.descricao.length > 90 ? "…" : ""}</td>` +
                `<td style="padding:4px 10px;border-bottom:1px solid #eee;white-space:nowrap">${nc.prazo.split("-").reverse().join("/")}</td>` +
                `<td style="padding:4px 10px;border-bottom:1px solid #eee;color:${nc.daysLeft < 0 ? "#dc2626" : "#d97706"};font-weight:600;white-space:nowrap">` +
                `${nc.daysLeft < 0 ? `vencida há ${Math.abs(nc.daysLeft)} d` : `vence em ${nc.daysLeft} d`}</td></tr>`,
            )
            .join("")}</tbody>
        </table>`,
        )
        .join("")}`;

  return `
    <div style="font-family:system-ui,sans-serif;max-width:720px">
      <h2 style="color:${PINE}">Conforme. — Resumo semanal · ${orgNome}</h2>
      <p><strong style="color:#dc2626">${expired.length} vencido(s)</strong> ·
         <strong style="color:#d97706">${expiring.length} vencendo em ${HORIZON_DAYS} dias</strong>
         ${totalNcs > 0 ? ` · <strong style="color:${PINE}">${totalNcs} ação(ões) RTI críticas</strong>` : ""}</p>
      ${
        items.length === 0
          ? ""
          : `
      <table style="border-collapse:collapse;width:100%;font-size:13px">
        <thead><tr style="background:${PINE};color:#fff">
          <th style="padding:8px 10px;text-align:left">Tipo</th>
          <th style="padding:8px 10px;text-align:left">Item</th>
          <th style="padding:8px 10px;text-align:left">Referente a</th>
          <th style="padding:8px 10px;text-align:left">Vencimento</th>
          <th style="padding:8px 10px;text-align:left">Situação</th>
        </tr></thead>
        <tbody>${items.map(row).join("")}</tbody>
      </table>`
      }
      ${ncSection}
      <p style="color:#666;font-size:12px">E-mail automático do sistema Conforme. Acesse sua central de
      vencimentos para detalhes. Para deixar de receber este resumo, solicite ao seu consultor.</p>
    </div>`;
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("ALERT_FROM") ?? "Conforme <onboarding@resend.dev>";
  const supervisao = (Deno.env.get("ALERT_EMAILS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const semana = semanaISO();

  const { data: orgs = [], error: orgErr } = await supabase
    .from("organizations")
    .select("id, nome")
    .eq("tipo", "cliente")
    .eq("ativa", true);
  if (orgErr) {
    return new Response(JSON.stringify({ ok: false, error: orgErr.message }), { status: 500 });
  }

  const resultado: Array<Record<string, unknown>> = [];

  for (const org of orgs ?? []) {
    try {
      // Idempotência: já enviado nesta semana → pula (cron reexecutado não duplica).
      const { data: jaEnviado } = await supabase
        .from("digest_log")
        .select("id")
        .eq("org_id", org.id)
        .eq("semana", semana)
        .maybeSingle();
      if (jaEnviado) {
        resultado.push({ org: org.nome, skipped: "já enviado nesta semana" });
        continue;
      }

      const { items, ncsByResp } = await pendenciasDaOrg(supabase, org.id);
      const totalNcs = Array.from(ncsByResp.values()).reduce((s, a) => s + a.length, 0);
      if (items.length === 0 && totalNcs === 0) {
        resultado.push({ org: org.nome, skipped: "sem pendências" });
        continue;
      }

      const to = await destinatariosDaOrg(supabase, org.id);
      if (to.length === 0 && supervisao.length === 0) {
        resultado.push({ org: org.nome, skipped: "sem destinatários" });
        continue;
      }
      if (!resendKey) {
        // Sem chave: NÃO grava digest_log — envia na próxima execução com chave.
        resultado.push({ org: org.nome, skipped: "RESEND_API_KEY não configurada" });
        continue;
      }

      const expired = items.filter((i) => i.daysLeft < 0).length;
      const expiring = items.length - expired;
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: to.length > 0 ? to : supervisao,
          ...(to.length > 0 && supervisao.length > 0 ? { bcc: supervisao } : {}),
          subject: `[Conforme] ${org.nome}: ${expired} vencido(s), ${expiring} vencendo${totalNcs > 0 ? ` e ${totalNcs} ação(ões) críticas` : ""} — resumo semanal`,
          html: htmlDigest(org.nome, items, ncsByResp),
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        resultado.push({ org: org.nome, sent: false, error: err });
        continue; // falha de envio não grava log — retenta na próxima execução
      }

      await supabase.from("digest_log").insert({
        org_id: org.id,
        semana,
        destinatarios: to.length > 0 ? to : supervisao,
      });
      resultado.push({ org: org.nome, sent: true, destinatarios: to.length || supervisao.length });
    } catch (err) {
      // Falha em uma org não derruba o lote.
      resultado.push({ org: org.nome, sent: false, error: String(err) });
    }
  }

  return new Response(JSON.stringify({ ok: true, semana, orgs: resultado }), {
    headers: { "Content-Type": "application/json" },
  });
});
