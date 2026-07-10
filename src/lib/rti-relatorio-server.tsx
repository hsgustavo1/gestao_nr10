// Trilha C / D-C7 — geração do PDF do RTI no SERVIDOR (runtime Node do Vercel).
// Por quê server-side: no porte real (730 NCs / 1021 fotos) o render no navegador
// trava. Medições (docs .../decisoes-...md, D-C7): com as NCs fatiadas em páginas e
// as fotos reduzidas + prefetch paralelo (→ data URIs), o render fica em ~27 s no pior
// caso frio, cabendo no serverless síncrono.
//
// RLS preservada: o cliente envia seu access_token e todas as leituras/escritas rodam
// sob a sessão do próprio usuário (sem service key) — mesma garantia da D-C2b.
import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import { RtiPdfDocument } from "@/components/rti/pdf/RtiPdfDocument";
import {
  buildPdfModel,
  defaultIdentificacao,
  proximaVersao,
  relatorioPdfPath,
  relatorioPreviewPath,
  urlFotoReduzida,
  type NcParaPdf,
  type NcsOverrides,
  type OrgBranding,
  type PdfFoto,
  type WizardIdentificacao,
} from "./rti-relatorio";

const BUCKET = "rti-evidencias";

interface GerarArgs {
  reportId: string;
  accessToken: string;
  /** Org entregadora (consultor atual) — dona da marca/assinatura no PDF. */
  orgIdBranding: string | null;
  emitidoPorId: string | null;
  emitidoPorNome: string | null;
  modo: "preview" | "emissao";
}

function clienteComToken(accessToken: string): SupabaseClient {
  // Em dev (Vite) só os VITE_* entram em import.meta.env; process.env não recebe o .env.
  // Na Vercel as não-prefixadas ficam em process.env. Cobrimos os dois — igual client.ts.
  const url = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Variáveis do Supabase ausentes no servidor.");
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Baixa URLs em paralelo (pool) e devolve data URIs — o render fica CPU-only. */
async function prefetchDataUris(urls: string[], concorrencia = 32): Promise<(string | null)[]> {
  const out = new Array<string | null>(urls.length).fill(null);
  let idx = 0;
  async function worker() {
    while (idx < urls.length) {
      const i = idx++;
      try {
        const res = await fetch(urls[i]);
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        const mime = res.headers.get("content-type") || "image/jpeg";
        out[i] = `data:${mime};base64,${buf.toString("base64")}`;
      } catch {
        // foto inacessível não derruba o relatório inteiro
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concorrencia, urls.length || 1) }, worker));
  return out;
}

async function carregarBranding(
  sb: SupabaseClient,
  orgId: string | null,
): Promise<OrgBranding | null> {
  if (!orgId) return null;
  const { data } = await sb
    .from("organizations")
    .select("nome, logo_path, cor_primaria, razao_social_relatorio, registro_profissional")
    .eq("id", orgId)
    .single();
  if (!data) return null;
  const logoUrl = data.logo_path
    ? sb.storage.from("org-assets").getPublicUrl(data.logo_path).data.publicUrl
    : null;
  return {
    logoUrl,
    corPrimaria: data.cor_primaria ?? null,
    razaoSocial: data.razao_social_relatorio ?? data.nome ?? null,
    registroProfissional: data.registro_profissional ?? null,
  };
}

/**
 * Gera o PDF do RTI no servidor e sobe no Storage. `preview` sobrescreve um arquivo
 * temporário; `emissao` grava versão nova imutável + registra em rti_report_pdfs.
 */
export const gerarRelatorioPdf = createServerFn({ method: "POST" })
  .validator((data: GerarArgs) => data)
  .handler(async ({ data }) => {
    const sb = clienteComToken(data.accessToken);

    // 1. Report (sob RLS do usuário) + rascunho do wizard
    const { data: report, error: eRep } = await sb
      .from("rti_reports")
      .select("*")
      .eq("id", data.reportId)
      .single();
    if (eRep || !report) throw new Error("Relatório inacessível.");
    const orgIdReport: string | null = report.org_id ?? null;

    const { data: draft } = await sb
      .from("rti_report_wizard")
      .select("*")
      .eq("report_id", data.reportId)
      .maybeSingle();

    // 2. Áreas + NCs (paginado por segurança) + evidências de constatação
    const { data: areas } = await sb
      .from("rti_areas")
      .select("id, nome")
      .eq("report_id", data.reportId);
    const areaNome = new Map((areas ?? []).map((a) => [a.id as string, a.nome as string]));

    const ncsRaw: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: lote, error } = await sb
        .from("rti_ncs")
        .select("*")
        .eq("report_id", data.reportId)
        .order("numero", { ascending: true })
        .range(from, from + 999);
      if (error) throw error;
      ncsRaw.push(...(lote ?? []));
      if (!lote || lote.length < 1000) break;
    }

    const ncIds = ncsRaw.map((n) => n.id as string);
    const fotosPorNc = new Map<string, PdfFoto[]>();
    for (let i = 0; i < ncIds.length; i += 200) {
      const { data: evs } = await sb
        .from("rti_nc_evidencias")
        .select("id, nc_id, file_path, descricao")
        .in("nc_id", ncIds.slice(i, i + 200))
        .eq("tipo", "constatacao")
        .order("created_at");
      for (const ev of evs ?? []) {
        const publicUrl = sb.storage.from(BUCKET).getPublicUrl(ev.file_path as string).data.publicUrl;
        const lista = fotosPorNc.get(ev.nc_id as string) ?? [];
        lista.push({ id: ev.id as string, url: publicUrl, legenda: (ev.descricao as string) ?? null });
        fotosPorNc.set(ev.nc_id as string, lista);
      }
    }

    // 3. Prefetch paralelo das fotos REDUZIDAS → data URIs (render CPU-only)
    const todas: PdfFoto[] = [];
    for (const nc of ncsRaw) for (const f of fotosPorNc.get(nc.id as string) ?? []) todas.push(f);
    const dataUris = await prefetchDataUris(todas.map((f) => urlFotoReduzida(f.url)));
    const uriPorFoto = new Map<string, string | null>();
    todas.forEach((f, i) => uriPorFoto.set(f.id, dataUris[i]));

    // 4. Monta o modelo
    const branding = await carregarBranding(sb, data.orgIdBranding);
    if (branding && branding.logoUrl) {
      const [logoUri] = await prefetchDataUris([branding.logoUrl]);
      branding.logoUrl = logoUri; // data URI (ou null se falhar)
    }

    const ncsPdf: NcParaPdf[] = ncsRaw.map((nc) => ({
      id: nc.id as string,
      numero: nc.numero as number,
      areaNome: areaNome.get(nc.area_id as string) ?? "—",
      descricao: (nc.descricao as string) ?? "",
      recomendacao: (nc.recomendacao as string) ?? null,
      prioridade: (nc.prioridade as number) ?? 1,
      tipoExecucao: (nc.tipo_execucao as "os" | "investimento") ?? "os",
      osNumero: (nc.os_numero as string) ?? null,
      custoPlanejado: Number(nc.custo_planejado ?? 0),
      titulo: (nc.titulo as string) ?? null,
      normas: Array.isArray(nc.normas) ? (nc.normas as import("./normas/types").NormaRef[]) : [],
      situacaoAtual: (nc.situacao_atual as string) ?? null,
      fotos: (fotosPorNc.get(nc.id as string) ?? [])
        .map((f) => ({ ...f, url: uriPorFoto.get(f.id) ?? "" }))
        .filter((f) => f.url), // descarta fotos que falharam no download
    }));

    const base = defaultIdentificacao(report);
    const ident: WizardIdentificacao = {
      ...base,
      ...((draft?.identificacao ?? {}) as Partial<WizardIdentificacao>),
    };
    const model = buildPdfModel({
      identificacao: ident,
      branding,
      ncs: ncsPdf,
      overrides: (draft?.ncs_overrides ?? {}) as NcsOverrides,
      parecer: draft?.parecer ?? "",
      resumoExecutivo: draft?.resumo_executivo ?? "",
    });

    // 5. Render
    const buffer = await renderToBuffer(<RtiPdfDocument model={model} />);

    // 6. Upload + (emissão) versionamento imutável
    if (!orgIdReport) throw new Error("Relatório sem organização.");
    const publicUrlDe = (p: string) => sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;

    if (data.modo === "preview") {
      const path = relatorioPreviewPath(orgIdReport, report);
      const { error } = await sb.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: "application/pdf", upsert: true });
      if (error) throw error;
      return { modo: "preview" as const, url: `${publicUrlDe(path)}?t=${Date.now()}` };
    }

    const { data: pdfsExistentes } = await sb
      .from("rti_report_pdfs")
      .select("versao")
      .eq("report_id", data.reportId);
    const versao = proximaVersao((pdfsExistentes ?? []) as { versao: number }[]);
    const path = relatorioPdfPath(orgIdReport, report, versao);
    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: "application/pdf", upsert: false });
    if (upErr) throw upErr;
    const { error: insErr } = await sb.from("rti_report_pdfs").insert({
      report_id: data.reportId,
      versao,
      file_path: path,
      emitido_por: data.emitidoPorId,
      emitido_por_nome: data.emitidoPorNome,
    });
    if (insErr) throw insErr;
    if (!report.entregue_em) {
      await sb.from("rti_reports").update({ report_path: path }).eq("id", data.reportId);
    }
    return { modo: "emissao" as const, versao, url: publicUrlDe(path) };
  });
