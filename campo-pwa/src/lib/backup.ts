// Backup completo da inspeção (spec cofre e portão §3.2–3.3): ZIP com manifest +
// dados + blobs ainda não sincronizados. Import = upsert por id (idempotente).
// Separação deliberada: serialize/restore são puros sobre o Dexie (testáveis);
// exportBackup/importBackup cuidam de ZIP + share/download (browser).

import { db } from "@/db/dexie";
import type {
  LocalFinding,
  LocalInspection,
  LocalNode,
  LocalPhoto,
  LocalPoint,
  SyncQueueItem,
} from "@/db/dexie";

export const BACKUP_FORMATO = "campo-backup";
export const BACKUP_SCHEMA = 1;

export type BackupManifest = {
  formato: typeof BACKUP_FORMATO;
  versao_schema: number;
  inspection_id: string;
  titulo: string;
  usuario: string | null;
  exported_at: string;
  contagens: {
    nodes: number;
    points: number;
    findings: number;
    photos: number;
    blobs: number;
    queue: number;
  };
};

export type BackupData = {
  inspection: LocalInspection;
  nodes: LocalNode[];
  points: LocalPoint[];
  findings: LocalFinding[];
  /** Fotos SEM o blob (vai em arquivo separado no ZIP); has_blob marca quais têm. */
  photos: Array<Omit<LocalPhoto, "blob"> & { has_blob: boolean }>;
  queue: SyncQueueItem[];
};

export function buildManifest(args: {
  inspectionId: string;
  titulo: string;
  usuario: string | null;
  contagens: BackupManifest["contagens"];
}): BackupManifest {
  return {
    formato: BACKUP_FORMATO,
    versao_schema: BACKUP_SCHEMA,
    inspection_id: args.inspectionId,
    titulo: args.titulo,
    usuario: args.usuario,
    exported_at: new Date().toISOString(),
    contagens: args.contagens,
  };
}

export function validateManifest(m: unknown): { ok: true } | { ok: false; motivo: string } {
  const man = m as Partial<BackupManifest> | null;
  if (!man || man.formato !== BACKUP_FORMATO) {
    return {
      ok: false,
      motivo: "Arquivo não é um backup do Campo (manifest ausente ou formato desconhecido).",
    };
  }
  if (typeof man.versao_schema !== "number" || man.versao_schema > BACKUP_SCHEMA) {
    return {
      ok: false,
      motivo: `Backup de versão mais nova (${man.versao_schema}) — atualize o app antes de restaurar.`,
    };
  }
  if (!man.inspection_id) return { ok: false, motivo: "Manifest sem inspection_id." };
  return { ok: true };
}

export async function serializeInspecao(inspectionId: string): Promise<BackupData> {
  const inspection = await db.inspections.get(inspectionId);
  if (!inspection) throw new Error("Inspeção não encontrada no aparelho.");
  const nodes = await db.nodes.where("inspection_id").equals(inspectionId).toArray();
  const points = await db.points.where("inspection_id").equals(inspectionId).toArray();
  const pointIds = points.map((p) => p.id);
  const findings = pointIds.length
    ? await db.findings.where("point_id").anyOf(pointIds).toArray()
    : [];
  const photosFull = pointIds.length
    ? await db.photos.where("point_id").anyOf(pointIds).toArray()
    : [];
  const photos = photosFull.map(({ blob, ...rest }) => ({ ...rest, has_blob: !!blob }));
  // Fila: só itens desta inspeção (local_id pertence ao conjunto exportado).
  const ids = new Set<string>([
    inspectionId,
    ...nodes.map((n) => n.id),
    ...pointIds,
    ...findings.map((f) => f.id),
    ...photosFull.map((p) => p.id),
  ]);
  const queue = (await db.sync_queue.toArray()).filter((q) => ids.has(q.local_id));
  return { inspection, nodes, points, findings, photos, queue };
}

/** Blobs ainda só no aparelho (para o ZIP). */
export async function collectLocalBlobs(inspectionId: string): Promise<Map<string, Blob>> {
  const points = await db.points.where("inspection_id").equals(inspectionId).toArray();
  const pointIds = points.map((p) => p.id);
  const photos = pointIds.length
    ? await db.photos.where("point_id").anyOf(pointIds).toArray()
    : [];
  const map = new Map<string, Blob>();
  for (const p of photos) if (p.blob) map.set(p.id, p.blob);
  return map;
}

/** Upsert por id em todas as tabelas; reanexa blobs. Idempotente. */
export async function restoreBackupData(data: BackupData, blobs: Map<string, Blob>): Promise<void> {
  await db.transaction(
    "rw",
    [db.inspections, db.nodes, db.points, db.findings, db.photos, db.sync_queue],
    async () => {
      await db.inspections.put(data.inspection);
      if (data.nodes.length) await db.nodes.bulkPut(data.nodes);
      if (data.points.length) await db.points.bulkPut(data.points);
      if (data.findings.length) await db.findings.bulkPut(data.findings);
      if (data.photos.length) {
        await db.photos.bulkPut(
          data.photos.map(({ has_blob, ...rest }) => ({
            ...rest,
            blob: has_blob ? (blobs.get(rest.id) ?? null) : null,
          })),
        );
      }
      if (data.queue.length) await db.sync_queue.bulkPut(data.queue);
    },
  );
}

function sanitize(s: string): string {
  return (s || "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export type BackupResult = { nomeArquivo: string; fotosNoZip: number };

/** Gera o ZIP e entrega via Web Share (fallback: download). */
export async function exportBackup(
  inspectionId: string,
  usuario: string | null,
): Promise<BackupResult> {
  const { default: JSZip } = await import("jszip");
  const data = await serializeInspecao(inspectionId);
  const blobs = await collectLocalBlobs(inspectionId);
  const manifest = buildManifest({
    inspectionId,
    titulo: data.inspection.titulo,
    usuario,
    contagens: {
      nodes: data.nodes.length,
      points: data.points.length,
      findings: data.findings.length,
      photos: data.photos.length,
      blobs: blobs.size,
      queue: data.queue.length,
    },
  });

  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("inspecao.json", JSON.stringify(data));
  const fotos = zip.folder("fotos")!;
  for (const [photoId, blob] of blobs) {
    const photo = data.photos.find((p) => p.id === photoId);
    fotos.file(`${photo?.point_id ?? "sem-ponto"}/${photoId}.jpg`, blob);
  }

  const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const nomeArquivo = `backup-${sanitize(data.inspection.titulo)}-${stamp}.zip`;
  const zipBlob = await zip.generateAsync({ type: "blob", compression: "STORE" });

  const file = new File([zipBlob], nomeArquivo, { type: "application/zip" });
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean;
    share?: (d: { files: File[]; title?: string }) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: nomeArquivo });
      return { nomeArquivo, fotosNoZip: blobs.size };
    } catch {
      /* usuário cancelou ou share indisponível — cai no download */
    }
  }
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { nomeArquivo, fotosNoZip: blobs.size };
}

export type ImportResult =
  | { ok: true; titulo: string; fotos: number }
  | { ok: false; motivo: string };

/** Lê um ZIP de backup e restaura (upsert). */
export async function importBackup(file: File): Promise<ImportResult> {
  const { default: JSZip } = await import("jszip");
  let zip: InstanceType<typeof JSZip>;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return { ok: false, motivo: "Arquivo inválido (não é um ZIP legível)." };
  }
  const manifestRaw = await zip.file("manifest.json")?.async("string");
  if (!manifestRaw) {
    return { ok: false, motivo: "ZIP sem manifest.json — não é um backup do Campo." };
  }
  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch {
    return { ok: false, motivo: "manifest.json corrompido." };
  }
  const valid = validateManifest(manifest);
  if (!valid.ok) return { ok: false, motivo: valid.motivo };

  const dataRaw = await zip.file("inspecao.json")?.async("string");
  if (!dataRaw) return { ok: false, motivo: "ZIP sem inspecao.json." };
  const data = JSON.parse(dataRaw) as BackupData;

  const blobs = new Map<string, Blob>();
  for (const f of zip.file(/^fotos\//)) {
    if (f.dir) continue;
    const photoId = f.name.split("/").pop()!.replace(/\.jpg$/i, "");
    blobs.set(photoId, await f.async("blob"));
  }

  await restoreBackupData(data, blobs);
  return { ok: true, titulo: data.inspection.titulo, fotos: blobs.size };
}
