import { beforeEach, describe, expect, it } from "vitest";
import {
  buildManifest,
  validateManifest,
  serializeInspecao,
  restoreBackupData,
} from "@/lib/backup";
import { db } from "@/db/dexie";

const now = "2026-07-08T12:00:00.000Z";

async function seed() {
  await db.inspections.add({
    id: "i1",
    titulo: "Insp Teste",
    cliente: null,
    local: null,
    engenheiro: null,
    data_inspecao: "2026-07-08",
    status: "em_andamento",
    report_id: null,
    notes: null,
    created_by_name: null,
    arquivada_campo: false,
    created_at: now,
    updated_at: now,
    _synced: false,
  });
  await db.nodes.add({
    id: "n1",
    inspection_id: "i1",
    parent_id: null,
    nivel: "setor",
    nome: "Setor A",
    ordem: 0,
    created_at: now,
    updated_at: now,
    _synced: false,
  });
  await db.points.add({
    id: "p1",
    inspection_id: "i1",
    node_id: "n1",
    titulo: "Ponto 1",
    observacoes: null,
    ordem: 0,
    collected_by_user_id: null,
    collected_by_name: null,
    created_at: now,
    updated_at: now,
    _synced: false,
  });
  await db.findings.add({
    id: "f1",
    point_id: "p1",
    modo_falha_id: null,
    descricao: "NC teste",
    recomendacao: null,
    prioridade: 3,
    tipo_execucao: "os",
    observacao: null,
    created_at: now,
    updated_at: now,
    _synced: false,
  });
  await db.photos.add({
    id: "ph1",
    point_id: "p1",
    finding_id: "f1",
    gps_lat: -22.3,
    gps_lng: -47.8,
    gps_accuracy: 8,
    file_path: null,
    file_name: "a.jpg",
    legenda: null,
    ordem: 0,
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    created_at: now,
    _synced: false,
  });
}

async function clearAll() {
  await Promise.all([
    db.inspections.clear(),
    db.nodes.clear(),
    db.points.clear(),
    db.findings.clear(),
    db.photos.clear(),
    db.sync_queue.clear(),
  ]);
}

beforeEach(clearAll);

describe("manifest", () => {
  it("valida o próprio manifest gerado", () => {
    const m = buildManifest({
      inspectionId: "i1",
      titulo: "X",
      usuario: null,
      contagens: { nodes: 1, points: 1, findings: 1, photos: 1, blobs: 1, queue: 0 },
    });
    expect(validateManifest(m)).toEqual({ ok: true });
  });
  it("rejeita formato desconhecido e versão de schema futura", () => {
    expect(validateManifest({ formato: "outro" }).ok).toBe(false);
    expect(validateManifest({ formato: "campo-backup", versao_schema: 99 }).ok).toBe(false);
    expect(validateManifest(null).ok).toBe(false);
  });
});

describe("serialize + restore (round-trip)", () => {
  it("restaura num banco vazio sem perder nada e sem duplicar em re-import", async () => {
    await seed();
    const data = await serializeInspecao("i1");
    expect(data.photos[0].finding_id).toBe("f1");
    expect(data.photos[0].has_blob).toBe(true);

    const blobs = new Map<string, Blob>([
      ["ph1", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" })],
    ]);

    // "Aparelho novo": limpa tudo e restaura duas vezes (idempotência).
    await clearAll();
    await restoreBackupData(data, blobs);
    await restoreBackupData(data, blobs);

    expect(await db.inspections.count()).toBe(1);
    expect(await db.points.count()).toBe(1);
    expect(await db.findings.count()).toBe(1);
    const ph = await db.photos.get("ph1");
    expect(ph?.blob).toBeTruthy();
    expect(ph?._synced).toBe(false);
    expect(ph?.gps_lat).toBe(-22.3);
    expect(ph?.finding_id).toBe("f1");
  });
});
