import { generateId } from "@/lib/uuid";
import { supabase } from "@/lib/supabase";
import { refreshOrgContext } from "@/lib/org";
import { db } from "@/db/dexie";
import type { SyncOperation, SyncQueueItem } from "@/db/dexie";

// Dexie table name → Supabase table name
const SUPABASE_TABLES: Record<string, string> = {
  inspections: "field_inspections",
  nodes: "field_nodes",
  points: "field_points",
  findings: "field_findings",
  photos: "field_photos",
};

// ── Download: Supabase → Dexie ────────────────────────────────────────────────

export async function downloadAll(): Promise<void> {
  // Atualiza a org ativa primeiro: registros criados a seguir já carimbam org_id
  // e o path de Storage fica escopado por org. Falha silenciosa se offline.
  await refreshOrgContext();
  await downloadModosFalha();
  await downloadInspections();
}

async function downloadModosFalha(): Promise<void> {
  const { data, error } = await supabase.from("rti_modos_falha").select("*").eq("ativo", true);
  if (error) throw error;
  await db.modos_falha.bulkPut(data ?? []);
}

async function downloadInspections(): Promise<void> {
  // RLS handles user filtering. arquivada_campo=true = arquivadas pelo inspetor no campo;
  // excluídas do download para despoluir o PWA sem apagar dados no servidor.
  const { data: inspections, error } = await supabase
    .from("field_inspections")
    .select("*")
    .eq("arquivada_campo", false)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (inspections ?? []).map((i) => ({ ...i, _synced: true as const }));

  // Reconcile deletions: bulkPut is an upsert — it never removes rows, so remote
  // deletes must be applied explicitly by diffing local vs. server IDs.
  const remoteIds = new Set(rows.map((i) => i.id));
  const localIds = (await db.inspections.toCollection().primaryKeys()) as string[];
  const deletedIds = localIds.filter((id) => !remoteIds.has(id));

  if (deletedIds.length > 0) {
    // Collect point IDs first — findings/photos only carry point_id, not inspection_id
    const orphanPointIds = (await db.points
      .where("inspection_id")
      .anyOf(deletedIds)
      .primaryKeys()) as string[];

    await Promise.all([
      db.inspections.bulkDelete(deletedIds),
      db.nodes.where("inspection_id").anyOf(deletedIds).delete(),
      db.points.where("inspection_id").anyOf(deletedIds).delete(),
      orphanPointIds.length > 0
        ? db.findings.where("point_id").anyOf(orphanPointIds).delete()
        : Promise.resolve(),
      orphanPointIds.length > 0
        ? db.photos.where("point_id").anyOf(orphanPointIds).delete()
        : Promise.resolve(),
    ]);
  }

  await db.inspections.bulkPut(rows);

  const activeIds = rows.filter((i) => i.status === "em_andamento").map((i) => i.id);

  if (activeIds.length > 0) {
    await downloadInspectionsData(activeIds);
  }
}

// Busca nodes/points/findings/photos de TODAS as inspeções ativas de uma vez.
// Reduz de N×2 chamadas sequenciais para 2 chamadas paralelas — crítico em mobile.
async function downloadInspectionsData(inspectionIds: string[]): Promise<void> {
  const [pointsRes, nodesRes] = await Promise.all([
    supabase.from("field_points").select("*").in("inspection_id", inspectionIds),
    supabase.from("field_nodes").select("*").in("inspection_id", inspectionIds),
  ]);
  if (pointsRes.error) throw pointsRes.error;
  if (nodesRes.error) throw nodesRes.error;

  const pointIds = (pointsRes.data ?? []).map((p: { id: string }) => p.id);

  const [findingsRes, photosRes] = await Promise.all([
    pointIds.length > 0
      ? supabase.from("field_findings").select("*").in("point_id", pointIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    pointIds.length > 0
      ? supabase
          .from("field_photos")
          .select("id, point_id, file_path, file_name, legenda, ordem, created_at")
          .in("point_id", pointIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);
  if (findingsRes.error) throw findingsRes.error;
  if (photosRes.error) throw photosRes.error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fd = findingsRes.data as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pd = photosRes.data as any[];

  await Promise.all([
    db.points.bulkPut((pointsRes.data ?? []).map((p) => ({ ...p, _synced: true }))),
    db.nodes.bulkPut((nodesRes.data ?? []).map((n) => ({ ...n, _synced: true }))),
    fd.length > 0
      ? db.findings.bulkPut(fd.map((f) => ({ ...f, _synced: true })))
      : Promise.resolve(),
    pd.length > 0
      ? db.photos.bulkPut(pd.map((p) => ({ ...p, blob: null, _synced: true })))
      : Promise.resolve(),
  ]);
}

// ── Enqueue: record local change for later upload ─────────────────────────────

export async function enqueue(
  table: "inspections" | "nodes" | "points" | "findings" | "photos",
  operation: SyncOperation,
  payload: unknown,
  localId: string,
): Promise<void> {
  await db.sync_queue.add({
    id: generateId(),
    operation,
    table,
    payload,
    local_id: localId,
    remote_id: null,
    attempts: 0,
    created_at: new Date().toISOString(),
    next_attempt_at: null,
    last_error: null,
  });
}

// ── Upload: sync_queue → Supabase ─────────────────────────────────────────────

/** Após esgotar as tentativas, o item vira dead-letter (visível na UI, não retentado). */
export const MAX_SYNC_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 5 * 60_000;

/** Atraso exponencial antes da próxima tentativa, dado o número de falhas acumuladas. */
function backoffDelayMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** (attempts - 1), BACKOFF_MAX_MS);
}

/** Item pode ser (re)tentado agora? (não esgotou tentativas e o backoff já venceu) */
function isReady(item: SyncQueueItem, now: number): boolean {
  if (item.attempts >= MAX_SYNC_ATTEMPTS) return false;
  if (!item.next_attempt_at) return true;
  return Date.parse(item.next_attempt_at) <= now;
}

// Trava de reentrância: vários gatilhos (online, heartbeat, botão) podem chamar
// processQueue ao mesmo tempo — sem isto, dois envios do mesmo item duplicariam.
let isProcessing = false;

export async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const items = await db.sync_queue.orderBy("created_at").toArray();
    const now = Date.now();
    const ready = items.filter((item) => isReady(item, now));

    for (const item of ready) {
      try {
        // Só INSERT de foto sobe o blob ao Storage. Delete (e qualquer outra op) vai pelo
        // uploadRecord, que remove a linha em field_photos. Antes, todo item 'photos' caía
        // no uploadPhoto — então deletar foto estourava "Blob not found" eternamente.
        if (item.table === "photos" && item.operation === "insert") {
          await uploadPhoto(item.local_id);
        } else {
          await uploadRecord(item);
        }
        await db.sync_queue.delete(item.id);
      } catch (err) {
        const attempts = item.attempts + 1;
        await db.sync_queue.update(item.id, {
          attempts,
          next_attempt_at: new Date(now + backoffDelayMs(attempts)).toISOString(),
          last_error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    isProcessing = false;
  }
}

/** Rearma itens que esgotaram as tentativas (dead-letter) para nova tentativa manual. */
export async function retryFailed(): Promise<void> {
  const dead = await db.sync_queue.where("attempts").aboveOrEqual(MAX_SYNC_ATTEMPTS).toArray();
  await Promise.all(
    dead.map((item) =>
      db.sync_queue.update(item.id, {
        attempts: 0,
        next_attempt_at: null,
        last_error: null,
      }),
    ),
  );
  await processQueue();
}

/** Descarta os itens em dead-letter (esgotaram MAX_SYNC_ATTEMPTS). Usar quando
 * o item é irrecuperável (ex.: referencia um registro local já apagado). Remove
 * apenas da FILA de envio — os dados já coletados no aparelho permanecem. */
export async function discardFailed(): Promise<void> {
  await db.sync_queue.where("attempts").aboveOrEqual(MAX_SYNC_ATTEMPTS).delete();
}

/**
 * Ao reconectar: se há itens em dead-letter (esgotaram tentativas), rearma-os antes de
 * processar. Com inserts idempotentes (upsert), itens travados por registro já gravado no
 * servidor sincronizam e somem; falhas reais re-estouram e continuam visíveis. Sem
 * dead-letters, é só um processQueue comum.
 */
async function flushWithDeadLetterRearm(): Promise<void> {
  const deadCount = await db.sync_queue.where("attempts").aboveOrEqual(MAX_SYNC_ATTEMPTS).count();
  if (deadCount > 0) {
    await retryFailed();
  } else {
    await processQueue();
  }
}

function stripLocalFields(payload: Record<string, unknown>): Record<string, unknown> {
  const { _synced: _s, blob: _b, ...rest } = payload;
  return rest;
}

async function uploadRecord(item: {
  id: string;
  operation: SyncOperation;
  table: string;
  payload: unknown;
}): Promise<void> {
  const supabaseTable = SUPABASE_TABLES[item.table];
  if (!supabaseTable) throw new Error(`Unknown table: ${item.table}`);

  const raw = item.payload as Record<string, unknown>;
  const payload = stripLocalFields(raw);

  if (item.operation === "insert") {
    // upsert (não insert): idempotente. Se uma tentativa anterior já gravou o
    // registro mas a fila não foi limpa (queda de conexão pós-commit), o retry
    // não falha mais com PK duplicada — evita falso "item com falha".
    const { error } = await supabase.from(supabaseTable).upsert(payload);
    if (error) throw error;
  } else if (item.operation === "update") {
    const { id, ...rest } = payload;
    const { error } = await supabase.from(supabaseTable).update(rest).eq("id", id);
    if (error) throw error;
  } else if (item.operation === "delete") {
    const { error } = await supabase.from(supabaseTable).delete().eq("id", payload["id"]);
    if (error) throw error;
  }
}

/** org_id de uma foto, derivado da inspeção do ponto (foto→ponto→inspeção). */
async function resolvePhotoOrgId(pointId: string): Promise<string | undefined> {
  const point = await db.points.get(pointId);
  if (point?.org_id) return point.org_id;
  if (!point?.inspection_id) return undefined;
  const insp = await db.inspections.get(point.inspection_id);
  return insp?.org_id;
}

async function uploadPhoto(localId: string): Promise<void> {
  const photo = await db.photos.get(localId);
  if (!photo?.blob) {
    // Foto sem blob: já enviada (e blob descartado) ou deletada localmente antes de
    // sincronizar. Nada a enviar — retorna em silêncio para o item sair da fila.
    return;
  }

  const ext = photo.blob.type.split("/")[1] ?? "jpg";
  // Path escopado por org ({org_id}/campo/…): prepara isolamento e migração futura
  // p/ storage frio sem retrabalho. Resolve a org pela inspeção do ponto; se não
  // achar (registro antigo/offline incompleto), cai no path legado `campo/…` —
  // sem regressão. Fotos antigas continuam no path original gravado em file_path.
  const orgId = await resolvePhotoOrgId(photo.point_id);
  const remotePath = orgId ? `${orgId}/campo/${localId}.${ext}` : `campo/${localId}.${ext}`;

  const { error: storageError } = await supabase.storage
    .from("rti-evidencias")
    .upload(remotePath, photo.blob, { contentType: photo.blob.type, upsert: true });
  if (storageError) throw storageError;

  // upsert (não insert): idempotente, igual a uploadRecord. Storage já usa upsert.
  const { error: dbError } = await supabase.from("field_photos").upsert({
    id: photo.id,
    point_id: photo.point_id,
    file_path: remotePath,
    file_name: photo.file_name,
    legenda: photo.legenda,
    ordem: photo.ordem,
    created_at: photo.created_at,
  });
  if (dbError) throw dbError;

  // Opção A (decidida em 2026-06-23): após subir, descarta o blob do IndexedDB.
  // O comprimido já está no Supabase e o original full-res permanece na galeria do
  // aparelho. Evita o IndexedDB inchar/sofrer eviction com fotos já sincronizadas.
  await db.photos.update(localId, { file_path: remotePath, _synced: true, blob: null });
}

// ── Connectivity watcher ──────────────────────────────────────────────────────

/** Heartbeat: reprocessa itens cujo backoff venceu sem depender de evento `online`. */
const SYNC_HEARTBEAT_MS = 30_000;

export function startConnectivityWatcher(): () => void {
  const uploadFlush = () => {
    if (navigator.onLine) processQueue().catch(console.error);
  };
  const fullFlush = () => {
    if (navigator.onLine) {
      // Ao reconectar, rearma dead-letters uma vez. Com inserts agora idempotentes,
      // itens travados por PK duplicada (registro já no servidor) sincronizam e a fila
      // esvazia — limpando o falso alarme. Falhas reais voltam a estourar e seguem visíveis.
      flushWithDeadLetterRearm().catch(console.error);
      downloadAll().catch(console.error);
    }
  };
  window.addEventListener("online", fullFlush);
  const heartbeat = window.setInterval(uploadFlush, SYNC_HEARTBEAT_MS);
  // Kick inicial: no celular o app abre já online, então o evento 'online' nunca dispara.
  // Sem isto, dead-letters nunca seriam rearmados e o falso alarme persistiria.
  // Refrescamos a org no boot (barato: 1 query) — independente do downloadAll pesado —
  // para o cache de orgs já estar quente/correto quando o usuário criar uma inspeção,
  // sem depender do evento 'online' nem de o usuário limpar o cache.
  if (navigator.onLine) {
    refreshOrgContext().catch(console.error);
    flushWithDeadLetterRearm().catch(console.error);
  }
  return () => {
    window.removeEventListener("online", fullFlush);
    window.clearInterval(heartbeat);
  };
}
