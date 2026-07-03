// Varredura de órfãos do bucket rti-evidencias. Roda com service role (a Edge Runtime
// injeta SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY automaticamente — ignora RLS e o trigger
// protect_delete). Remove objetos SEM referência em rti_nc_evidencias / field_photos /
// rti_reports.report_path. Idempotente. Chamada por cron (ver migration de agendamento).
//
// Autenticação: verify_jwt=true no deploy (checagem de plataforma do Supabase) — só aceita
// chamadas com um JWT assinado válido do projeto (a própria chave anon do pg_cron serve;
// não expõe nenhum privilégio além de "é uma requisição legítima deste projeto"). A operação
// privilegiada (apagar do Storage) usa a service-role key injetada, nunca exposta ao chamador.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "rti-evidencias";

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Lista recursiva do bucket (prefixos por org/relatório + legado)
  const objetos: string[] = [];
  async function listar(prefix: string) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
    if (error) throw error;
    for (const o of data ?? []) {
      const full = prefix ? `${prefix}/${o.name}` : o.name;
      if (o.id === null) await listar(full); // pasta → desce
      else objetos.push(full);
    }
  }
  await listar("");

  // 2. Conjunto de paths referenciados
  const refs = new Set<string>();
  for (const tabela of ["rti_nc_evidencias", "field_photos"] as const) {
    const { data } = await supabase.from(tabela).select("file_path");
    for (const r of data ?? []) if (r.file_path) refs.add(r.file_path);
  }
  const { data: reports } = await supabase
    .from("rti_reports")
    .select("report_path")
    .not("report_path", "is", null);
  for (const r of reports ?? []) if (r.report_path) refs.add(r.report_path);

  // 3. Remove os órfãos
  const orfaos = objetos.filter((p) => !refs.has(p));
  let removidos = 0;
  for (let i = 0; i < orfaos.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(orfaos.slice(i, i + 100));
    if (error) throw error;
    removidos += orfaos.slice(i, i + 100).length;
  }

  return new Response(
    JSON.stringify({ objetos: objetos.length, referenciados: refs.size, removidos }),
    { headers: { "content-type": "application/json" } },
  );
});
