// Trilha C — modelo de dados do PDF do RTI. Puro (sem Supabase/React) — testável isolado.
import { evidenciaFolder } from "./storage-paths";
import type { NormaRef } from "./normas/types";

// ── Identificação (etapa 1) ──────────────────────────────────────────────────
export interface WizardIdentificacao {
  titulo: string;
  clienteNome: string;
  local: string;
  periodoInicio: string | null; // yyyy-mm-dd
  periodoFim: string | null;
  responsavelTecnico: string;
  artNumero: string;
  normas: string; // referencial normativo, texto livre
  introducao: string; // template editável
  metodologia: string; // template editável
}

export const INTRODUCAO_PADRAO =
  "Este Relatório Técnico de Inspeção (RTI) apresenta o resultado da inspeção das " +
  "instalações elétricas realizada no período indicado, em atendimento ao item 10.2.4 " +
  "da NR-10, com o registro das não conformidades constatadas, sua priorização e as " +
  "recomendações técnicas correspondentes.";

export const METODOLOGIA_PADRAO =
  "A inspeção foi conduzida por inspeção visual e verificação documental em campo, " +
  "com registro fotográfico das constatações. As não conformidades foram classificadas " +
  "por prioridade (P1 a P4, sendo P4 a mais grave) considerando o risco elétrico e o " +
  "impacto na conformidade legal.";

export const LIMITACOES_PADRAO =
  "Este laudo reflete as condições observadas nas instalações elétricas durante o " +
  "período da inspeção, com base em inspeção visual e verificação documental, e não " +
  "constitui projeto elétrico nem substitui a Anotação de Responsabilidade Técnica (ART) " +
  "de projeto ou de execução. As recomendações devem ser implementadas por profissional " +
  "legalmente habilitado, com reavaliação periódica das instalações.";

export function defaultIdentificacao(
  report: {
    titulo?: string | null;
    empresa_auditora?: string | null;
    responsavel_tecnico_rti?: string | null;
    art_numero?: string | null;
    periodo_inicio?: string | null;
    periodo_fim?: string | null;
  },
  _orgNome?: string | null,
): WizardIdentificacao {
  return {
    titulo: report.titulo ?? "",
    clienteNome: report.empresa_auditora ?? "",
    local: "",
    periodoInicio: report.periodo_inicio ?? null,
    periodoFim: report.periodo_fim ?? null,
    responsavelTecnico: report.responsavel_tecnico_rti ?? "",
    artNumero: report.art_numero ?? "",
    normas:
      "NR-10 — Segurança em Instalações e Serviços em Eletricidade; " +
      "NBR 5410 (baixa tensão); NBR 14039 (média tensão)",
    introducao: INTRODUCAO_PADRAO,
    metodologia: METODOLOGIA_PADRAO,
  };
}

// ── NCs e overrides (etapa 2) ────────────────────────────────────────────────
export interface PdfFoto {
  id: string;
  url: string;
  legenda: string | null;
}

export interface NcParaPdf {
  id: string;
  numero: number;
  areaNome: string;
  descricao: string;
  recomendacao: string | null;
  prioridade: number; // 1..4, P4 mais grave
  tipoExecucao: "os" | "investimento";
  osNumero: string | null;
  custoPlanejado: number;
  fotos: PdfFoto[];
  titulo: string | null; // título curto do achado (DIAGNERG Campo 3); null = legado
  normas: NormaRef[]; // referências normativas da NC
  situacaoAtual: string | null; // andamento textual (hoje no banco, agora exposto)
}

export interface NcOverride {
  descricao?: string;
  recomendacao?: string;
  incluir?: boolean; // false = fora do relatório
  fotosExcluidas?: string[]; // ids de PdfFoto
}
export type NcsOverrides = Record<string, NcOverride>;

/** Aplica edições do wizard sobre as NCs SEM tocar o registro técnico no banco. */
export function mergeNcOverrides(ncs: NcParaPdf[], overrides: NcsOverrides): NcParaPdf[] {
  return [...ncs]
    .sort((a, b) => a.numero - b.numero)
    .filter((nc) => overrides[nc.id]?.incluir !== false)
    .map((nc) => {
      const o = overrides[nc.id];
      if (!o) return nc;
      const excluidas = new Set(o.fotosExcluidas ?? []);
      return {
        ...nc,
        descricao: o.descricao ?? nc.descricao,
        recomendacao: o.recomendacao ?? nc.recomendacao,
        fotos: nc.fotos.filter((f) => !excluidas.has(f.id)),
      };
    });
}

/** Referências normativas para exibição: "NR-10 10.2.4.g; NBR 5410 6.1.8.1". */
export function formatNormasRef(normas: NormaRef[]): string {
  return normas
    .map((n) => {
      const ref = n.ref.trim();
      if (!ref) return "";
      return n.tipo === "nr10" ? `NR-10 ${ref}` : ref;
    })
    .filter((s) => s.length > 0)
    .join("; ");
}

/** Rótulo curto da NC para índice/bookmark: título, ou descrição aparada a ~80 chars. */
export function rotuloNc(nc: Pick<NcParaPdf, "titulo" | "descricao">): string {
  if (nc.titulo && nc.titulo.trim()) return nc.titulo.trim();
  const d = (nc.descricao ?? "").trim();
  if (d.length <= 80) return d;
  const corte = d.slice(0, 80);
  const ultimoEspaco = corte.lastIndexOf(" ");
  const base = ultimoEspaco > 40 ? corte.slice(0, ultimoEspaco) : corte;
  return base.trimEnd() + "…";
}

export interface SumarioSetor {
  setor: string;
  ncs: { numero: number; rotulo: string }[];
}

/** Agrupa NCs por setor (ordem de aparição), NCs ordenadas por número. */
export function sumarioPorSetor(ncs: NcParaPdf[]): SumarioSetor[] {
  const ordem: string[] = [];
  const mapa = new Map<string, { numero: number; rotulo: string }[]>();
  for (const nc of ncs) {
    const setor = nc.areaNome || "—";
    if (!mapa.has(setor)) {
      mapa.set(setor, []);
      ordem.push(setor);
    }
    mapa.get(setor)!.push({ numero: nc.numero, rotulo: rotuloNc(nc) });
  }
  return ordem.map((setor) => ({
    setor,
    ncs: mapa
      .get(setor)!
      .slice()
      .sort((a, b) => a.numero - b.numero),
  }));
}

// ── Quadro-resumo (P4 → P1, sempre 4 linhas) ────────────────────────────────
export const PRIORIDADE_LABEL: Record<number, string> = {
  4: "P4 — Crítica",
  3: "P3 — Alta",
  2: "P2 — Média",
  1: "P1 — Baixa",
};

export interface ResumoLinha {
  prioridade: number;
  label: string;
  quantidade: number;
  custoPlanejado: number;
}

export function resumoPorPrioridade(ncs: NcParaPdf[]): ResumoLinha[] {
  return [4, 3, 2, 1].map((p) => {
    const doNivel = ncs.filter((n) => n.prioridade === p);
    return {
      prioridade: p,
      label: PRIORIDADE_LABEL[p],
      quantidade: doNivel.length,
      custoPlanejado: doNivel.reduce((s, n) => s + (n.custoPlanejado || 0), 0),
    };
  });
}

// ── Branding e modelo final ──────────────────────────────────────────────────
export interface OrgBranding {
  logoUrl: string | null;
  corPrimaria: string | null; // hex; fallback do PDF: pinho Conforme
  razaoSocial: string | null;
  registroProfissional: string | null;
}

export interface PdfModel {
  identificacao: WizardIdentificacao;
  branding: OrgBranding;
  ncs: NcParaPdf[]; // já com overrides aplicados
  resumo: ResumoLinha[];
  parecer: string;
  resumoExecutivo: string;
  emitidoEm: string; // dd/mm/aaaa (exibição)
}

export function buildPdfModel(args: {
  identificacao: WizardIdentificacao;
  branding: OrgBranding | null;
  ncs: NcParaPdf[];
  overrides: NcsOverrides;
  parecer: string;
  resumoExecutivo: string;
  agora?: Date;
}): PdfModel {
  const ncs = mergeNcOverrides(args.ncs, args.overrides);
  const d = args.agora ?? new Date();
  return {
    identificacao: args.identificacao,
    branding: args.branding ?? {
      logoUrl: null,
      corPrimaria: null,
      razaoSocial: null,
      registroProfissional: null,
    },
    ncs,
    resumo: resumoPorPrioridade(ncs),
    parecer: args.parecer,
    resumoExecutivo: args.resumoExecutivo,
    emitidoEm: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`,
  };
}

// ── Redução de foto para o PDF (transform CDN do Storage) ────────────────────
// As fotos aparecem no laudo a ~2 cm; a resolução cheia (~290 KB) é desperdício.
// Reescreve a URL pública para o endpoint de transformação de imagem do Supabase,
// que devolve um JPEG reduzido (~29 KB a 600px q55). Confirmado no projeto (D-C7).
export function urlFotoReduzida(publicUrl: string, width = 600, quality = 55): string {
  if (!publicUrl.includes("/object/public/")) return publicUrl;
  const base = publicUrl.replace("/object/public/", "/render/image/public/");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}width=${width}&quality=${quality}`;
}

// ── Versões e path no Storage ────────────────────────────────────────────────
export function proximaVersao(pdfs: { versao: number }[]): number {
  return pdfs.reduce((m, p) => Math.max(m, p.versao), 0) + 1;
}

export function relatorioPdfFileName(versao: number): string {
  return `relatorio-v${String(versao).padStart(2, "0")}.pdf`;
}

/** Subpasta `relatorios/` dentro da pasta de evidências do report (convenção 2026-07-02). */
export function relatorioPdfPath(
  orgId: string,
  report: { id: string; titulo?: string | null },
  versao: number,
  orgNome?: string | null,
): string {
  return `${evidenciaFolder(orgId, report, orgNome)}/relatorios/${relatorioPdfFileName(versao)}`;
}

/** Prévia (sobrescrita a cada geração; não é versão arquivada). */
export function relatorioPreviewPath(
  orgId: string,
  report: { id: string; titulo?: string | null },
  orgNome?: string | null,
): string {
  return `${evidenciaFolder(orgId, report, orgNome)}/relatorios/_preview.pdf`;
}
