// Limpa objetos órfãos do bucket de evidências (rti-evidencias).
//
// Contexto: o Supabase bloqueia DELETE direto em storage.objects (trigger
// protect_delete) — a remoção precisa passar pela Storage API com a service-role
// key. Em 2026-06-23 o bucket tinha 383 imagens órfãs (~867 MB) sem nenhuma linha
// em field_photos / rti_nc_evidencias (relatórios de teste apagados sem limpar o
// Storage). Este script remove APENAS objetos sem referência no banco.
//
// Uso (PowerShell, na raiz do projeto):
//   $env:SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="<service-role key do dashboard>"
//   node scripts/cleanup-orphan-evidencias.mjs            # dry-run (só lista)
//   node scripts/cleanup-orphan-evidencias.mjs --apply    # apaga de verdade
//
// Requer @supabase/supabase-js (já presente no projeto).

import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "rti-evidencias";
const APPLY = process.argv.includes("--apply");

if (!URL || !KEY) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// Lista recursiva de todos os objetos do bucket (a API pagina por prefixo).
async function listAll(prefix = "") {
  const out = [];
  let offset = 0;
  const limit = 1000;
  for (;;) {
    const { data, error } = await sb.storage
      .from(BUCKET)
      .list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      // Pastas vêm sem metadata/id; desce um nível.
      if (item.id === null || item.metadata === null) {
        out.push(...(await listAll(path)));
      } else {
        out.push(path);
      }
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

// Caminhos ainda referenciados no banco (segurança extra: nunca apagar em uso).
async function referencedPaths() {
  const ref = new Set();
  for (const [table, col] of [
    ["field_photos", "file_path"],
    ["rti_nc_evidencias", "file_path"],
  ]) {
    const { data, error } = await sb.from(table).select(col);
    if (error) throw error;
    for (const row of data ?? []) if (row[col]) ref.add(row[col]);
  }
  return ref;
}

const all = await listAll();
const referenced = await referencedPaths();
const orphans = all.filter((p) => !referenced.has(p));

console.log(`Bucket ${BUCKET}: ${all.length} objetos, ${referenced.size} referenciados, ${orphans.length} órfãos.`);

if (orphans.length === 0) {
  console.log("Nada a remover.");
  process.exit(0);
}

if (!APPLY) {
  console.log("DRY-RUN — rode com --apply para remover. Exemplos:");
  console.log(orphans.slice(0, 10).join("\n"));
  process.exit(0);
}

// Remove em lotes (limite prático da API).
let removed = 0;
for (let i = 0; i < orphans.length; i += 100) {
  const lote = orphans.slice(i, i + 100);
  const { error } = await sb.storage.from(BUCKET).remove(lote);
  if (error) {
    console.error("Erro ao remover lote:", error.message);
    process.exit(1);
  }
  removed += lote.length;
  console.log(`Removidos ${removed}/${orphans.length}…`);
}
console.log(`Concluído: ${removed} objetos órfãos removidos.`);
