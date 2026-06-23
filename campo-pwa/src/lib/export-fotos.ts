import { db } from "@/db/dexie";
import type { LocalNode, LocalPhoto } from "@/db/dexie";
import type { FieldInspection } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { setorDoNo, caminhoAbaixoDoSetor } from "@/lib/campo";

const BUCKET = "rti-evidencias";

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

function sanitize(s: string): string {
  // Nome de arquivo/pasta seguro em qualquer SO.
  return (s || "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * Numeração de NC contínua dentro da inspeção (não reinicia por setor).
 * Espelha a regra do comporRti (app): uma NC por achado, na ordem dos pontos.
 * Retorna, por ponto, o primeiro e o último número de NC e a contagem.
 */
export type NcNumbering = Map<string, { first: number; last: number; count: number }>;

export async function buildNcNumbering(inspectionId: string): Promise<NcNumbering> {
  const points = await db.points.where("inspection_id").equals(inspectionId).toArray();
  points.sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at));
  const pointIds = points.map((p) => p.id);
  const findings = pointIds.length
    ? await db.findings.where("point_id").anyOf(pointIds).toArray()
    : [];
  findings.sort((a, b) => a.created_at.localeCompare(b.created_at));

  const findingsByPoint = new Map<string, number>();
  for (const f of findings) findingsByPoint.set(f.point_id, (findingsByPoint.get(f.point_id) ?? 0) + 1);

  const numbering: NcNumbering = new Map();
  let numero = 0;
  for (const p of points) {
    const count = findingsByPoint.get(p.id) ?? 0;
    if (count === 0) continue;
    const first = numero + 1;
    numero += count;
    numbering.set(p.id, { first, last: numero, count });
  }
  return numbering;
}

function ncLabel(info: { first: number; last: number; count: number } | undefined): string {
  if (!info) return "SEM_NC";
  return info.count > 1 ? `NC_${pad3(info.first)}-${pad3(info.last)}` : `NC_${pad3(info.first)}`;
}

/** Resolve o conteúdo da foto: blob local (offline) ou download do Supabase (já sincronizada). */
async function resolveBlob(photo: LocalPhoto): Promise<Blob | null> {
  if (photo.blob) return photo.blob;
  if (photo.file_path) {
    try {
      const { data } = await supabase.storage.from(BUCKET).download(photo.file_path);
      if (data) return data;
    } catch {
      /* offline ou sem permissão — segue sem esta foto */
    }
  }
  return null;
}

export type ExportResult = { fotos: number; faltando: number; nomeArquivo: string };

/**
 * Gera um .zip com as fotos de UM setor, nomeadas pela NC correspondente
 * (NC_001, e quando o ponto tem mais de uma foto, NC_001_1, NC_001_2…).
 * Backup alternativo para o aparelho — NÃO altera o fluxo de upload ao Supabase.
 */
export async function exportSetorFotos(args: {
  inspection: FieldInspection;
  setorNodeId: string;
  allNodes: LocalNode[];
}): Promise<ExportResult> {
  const { inspection, setorNodeId, allNodes } = args;
  const setor = allNodes.find((n) => n.id === setorNodeId);
  const setorNome = setor?.nome ?? "Setor";

  const { default: JSZip } = await import("jszip");
  const numbering = await buildNcNumbering(inspection.id);
  const allPoints = await db.points.where("inspection_id").equals(inspection.id).toArray();
  // Pontos cujo setor (raiz do caminho) é o setor pedido.
  const points = allPoints
    .filter((p) => setorDoNo(p.node_id, allNodes)?.id === setorNodeId)
    .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at));

  const zip = new JSZip();
  const folder = zip.folder(sanitize(setorNome))!;
  const csv: string[] = ["NC;Local;Ponto;Legenda;Arquivo;Sincronizada"];
  let fotos = 0;
  let faltando = 0;

  for (const p of points) {
    const info = numbering.get(p.id);
    const base = ncLabel(info);
    const local = caminhoAbaixoDoSetor(p.node_id, allNodes);
    const photos = (await db.photos.where("point_id").equals(p.id).sortBy("ordem")) as LocalPhoto[];

    for (let i = 0; i < photos.length; i++) {
      const ph = photos[i];
      const blob = await resolveBlob(ph);
      const sufixo = photos.length > 1 ? `_${i + 1}` : "";
      const legenda = ph.legenda?.trim() || "";
      const nome = `${base}${sufixo}${legenda ? ` - ${sanitize(legenda)}` : ""}.jpg`;
      if (blob) {
        folder.file(nome, blob);
        fotos += 1;
      } else {
        faltando += 1;
      }
      csv.push(
        [
          `${base}${sufixo}`,
          local,
          p.titulo ?? "",
          legenda,
          nome,
          blob ? (ph._synced ? "sim" : "local") : "INDISPONÍVEL",
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(";"),
      );
    }
  }

  folder.file("resumo.csv", "﻿" + csv.join("\r\n"));
  const nomeArquivo = `${sanitize(inspection.titulo)} - ${sanitize(setorNome)}.zip`;
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });

  // Mobile: tenta compartilhar (salvar em Arquivos/Drive). Fallback: download direto.
  const file = new File([blob], nomeArquivo, { type: "application/zip" });
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean;
    share?: (d: { files: File[]; title?: string }) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: nomeArquivo });
      return { fotos, faltando, nomeArquivo };
    } catch {
      /* usuário cancelou ou share indisponível — cai no download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  return { fotos, faltando, nomeArquivo };
}
