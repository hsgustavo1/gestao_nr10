import type { ReactNode } from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfModel, NcParaPdf, PdfPageIndex } from "@/lib/rti-relatorio";
import {
  PRIORIDADE_LABEL,
  LIMITACOES_PADRAO,
  formatNormasRef,
  sumarioPorSetor,
  primeirasNcsPorSetor,
  dimensoesFoto,
} from "@/lib/rti-relatorio";
import { registerPdfFonts } from "./fonts";

registerPdfFonts();

// Hex direto é inevitável aqui: o @react-pdf não lê CSS variables do app.
const PINE = "#0C3326";

const s = StyleSheet.create({
  page: {
    fontFamily: "Hanken Grotesk",
    fontSize: 10,
    paddingTop: 64,
    paddingBottom: 56,
    paddingHorizontal: 48,
    color: "#1a1a1a",
  },
  header: {
    position: "absolute",
    top: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#666",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#666",
  },
  h1: { fontSize: 22, fontWeight: 800, marginBottom: 8 },
  h2: { fontSize: 14, fontWeight: 800, marginTop: 16, marginBottom: 8 },
  capa: { flex: 1, justifyContent: "center" },
  capaBox: { borderLeftWidth: 4, paddingLeft: 16, marginTop: 24 },
  label: { fontSize: 8, color: "#666", marginTop: 6 },
  valor: { fontSize: 11, fontWeight: 600 },
  p: { marginBottom: 6, lineHeight: 1.4 },
  corpoNc: { fontSize: 10, lineHeight: 1.4, marginBottom: 2 },
  blocoLabel: {
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: 0.4,
    color: "#6b7280",
    marginTop: 10,
    marginBottom: 2,
  },
  recomendacaoBox: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#059669",
    backgroundColor: "#ecfdf5",
  },
  recomendacaoLabel: {
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: 0.4,
    color: "#047857",
    marginBottom: 2,
  },
  evidenciaCard: { width: 235 },
  fotoLegenda: { fontSize: 8, color: "#6b7280", marginTop: 3 },
  ncCard: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
  },
  ncTitulo: { fontSize: 11, fontWeight: 800, marginBottom: 3 },
  ncMeta: { fontSize: 8, color: "#666", marginBottom: 4 },
  fotoRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  // Moldura SEM altura fixa e SEM overflow:hidden — a imagem já vem no tamanho
  // exato (dimensoesFoto), então nada é recortado. Centraliza o que sobra na coluna.
  fotoBox: {
    width: 235,
    borderRadius: 4,
    backgroundColor: "#f3f4f6",
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  tabela: { marginTop: 8 },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
    paddingVertical: 4,
  },
  th: { fontWeight: 800, fontSize: 9 },
  tdPrio: { width: "70%" },
  tdQtd: { width: "30%" },
  sumarioLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  sumarioSetor: { fontSize: 11, fontWeight: 600 },
  sumarioPag: { fontSize: 10, color: "#6b7280" },
  marcadorSetor: { height: 0, fontSize: 1, color: "#ffffff" },
  assinatura: { marginTop: 64, alignItems: "center" },
  linhaAssin: {
    width: 260,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    paddingTop: 6,
    alignItems: "center",
  },
});

const fmtData = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

function HeaderFooter({ model }: { model: PdfModel }) {
  return (
    <>
      <View style={s.header} fixed>
        <Text>{model.branding.razaoSocial ?? model.identificacao.titulo}</Text>
        <Text>{model.identificacao.titulo}</Text>
      </View>
      <View style={s.footer} fixed>
        <Text>Emitido em {model.emitidoEm}</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </>
  );
}

function Bloco({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View wrap={false}>
      <Text style={s.blocoLabel}>{label}</Text>
      {children}
    </View>
  );
}

function NcConteudo({
  nc,
  cor,
  ehPrimeiraDoSetor,
  pageIndex,
}: {
  nc: NcParaPdf;
  cor: string;
  ehPrimeiraDoSetor: boolean;
  pageIndex?: PdfPageIndex;
}) {
  return (
    <View style={s.ncCard}>
      {ehPrimeiraDoSetor && pageIndex ? (
        // Marcador invisível: o callback render recebe o pageNumber desta página
        // e o grava no índice. Efeito colateral idempotente (pode rodar >1x).
        <Text
          style={s.marcadorSetor}
          render={({ pageNumber }) => {
            pageIndex.setores.set(nc.areaNome || "—", pageNumber);
            return "";
          }}
        />
      ) : null}
      <Text style={[s.ncTitulo, { color: cor }]}>
        NC {String(nc.numero).padStart(3, "0")}
        {nc.titulo ? ` — ${nc.titulo}` : ` — ${PRIORIDADE_LABEL[nc.prioridade]}`}
      </Text>
      <Text style={s.ncMeta}>
        {PRIORIDADE_LABEL[nc.prioridade]} · Área: {nc.areaNome}
        {nc.tipoExecucao === "investimento"
          ? "  ·  Investimento"
          : nc.osNumero
            ? `  ·  O.S. ${nc.osNumero}`
            : ""}
      </Text>

      <Bloco label="CONSTATAÇÃO">
        <Text style={s.corpoNc}>{nc.descricao}</Text>
      </Bloco>

      {nc.recomendacao ? (
        <View style={s.recomendacaoBox} wrap={false}>
          <Text style={s.recomendacaoLabel}>RECOMENDAÇÃO</Text>
          <Text style={s.corpoNc}>{nc.recomendacao}</Text>
        </View>
      ) : null}

      {nc.normas.length > 0 ? (
        <Bloco label="REFERÊNCIA NORMATIVA">
          <Text style={s.corpoNc}>{formatNormasRef(nc.normas)}</Text>
        </Bloco>
      ) : null}

      {nc.situacaoAtual ? (
        <Bloco label="SITUAÇÃO ATUAL">
          <Text style={s.corpoNc}>{nc.situacaoAtual}</Text>
        </Bloco>
      ) : null}

      {nc.fotos.length > 0 ? (
        <View>
          <Text style={s.blocoLabel}>EVIDÊNCIAS</Text>
          <View style={s.fotoRow}>
            {nc.fotos.map((f) => (
              <View key={f.id} style={s.evidenciaCard} wrap={false}>
                <View style={s.fotoBox}>
                  {/* Com dimensões: encaixa exato na moldura (proporção real). Sem
                      dimensões: só largura — o @react-pdf deriva a altura da imagem
                      embutida (inteira, sem distorcer nem recortar). */}
                  <Image
                    src={f.url}
                    style={f.larguraPx && f.alturaPx ? dimensoesFoto(f, 227, 280) : { width: 227 }}
                  />
                </View>
                {f.legenda ? <Text style={s.fotoLegenda}>{f.legenda}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function RtiPdfDocument({
  model,
  pageIndex,
}: {
  model: PdfModel;
  pageIndex?: PdfPageIndex;
}) {
  const cor = model.branding.corPrimaria || PINE;
  const ident = model.identificacao;
  const primeiras = primeirasNcsPorSetor(model.ncs);
  return (
    <Document title={ident.titulo} author={model.branding.razaoSocial ?? undefined}>
      {/* Capa */}
      <Page size="A4" style={s.page}>
        <View style={s.capa}>
          {model.branding.logoUrl ? (
            <Image src={model.branding.logoUrl} style={{ width: 140, marginBottom: 24 }} />
          ) : null}
          <Text style={[s.h1, { color: cor }]}>Relatório Técnico de Inspeção</Text>
          <Text style={{ fontSize: 13, fontWeight: 600 }}>{ident.titulo}</Text>
          <View style={[s.capaBox, { borderLeftColor: cor }]}>
            <Text style={s.label}>Cliente</Text>
            <Text style={s.valor}>{ident.clienteNome || "—"}</Text>
            {ident.local ? (
              <>
                <Text style={s.label}>Local</Text>
                <Text style={s.valor}>{ident.local}</Text>
              </>
            ) : null}
            <Text style={s.label}>Período da inspeção</Text>
            <Text style={s.valor}>
              {fmtData(ident.periodoInicio)} a {fmtData(ident.periodoFim)}
            </Text>
            <Text style={s.label}>Responsável técnico</Text>
            <Text style={s.valor}>{ident.responsavelTecnico || "—"}</Text>
            {ident.artNumero ? (
              <>
                <Text style={s.label}>ART</Text>
                <Text style={s.valor}>{ident.artNumero}</Text>
              </>
            ) : null}
            <Text style={s.label}>Referencial normativo</Text>
            <Text style={s.valor}>{ident.normas || "—"}</Text>
          </View>
        </View>
      </Page>

      {/* Introdução, metodologia, resumo executivo e quadro-resumo */}
      <Page size="A4" style={s.page}>
        <HeaderFooter model={model} />
        <Text style={[s.h2, { color: cor }]} minPresenceAhead={48}>
          1. Objeto e escopo
        </Text>
        <Text style={s.p}>{ident.introducao}</Text>
        <Text style={[s.h2, { color: cor }]} minPresenceAhead={48}>
          2. Referencial normativo
        </Text>
        <Text style={s.p}>{ident.normas || "—"}</Text>
        <Text style={[s.h2, { color: cor }]} minPresenceAhead={48}>
          3. Metodologia
        </Text>
        <Text style={s.p}>{ident.metodologia}</Text>
        <Text style={[s.h2, { color: cor }]} minPresenceAhead={48}>
          4. Limitações e ressalvas
        </Text>
        <Text style={s.p}>{LIMITACOES_PADRAO}</Text>
        {model.resumoExecutivo ? (
          <>
            <Text style={[s.h2, { color: cor }]} minPresenceAhead={48}>
              5. Resumo executivo
            </Text>
            <Text style={s.p}>{model.resumoExecutivo}</Text>
          </>
        ) : null}
        <View wrap={false}>
          <Text style={[s.h2, { color: cor }]}>Quadro-resumo por prioridade</Text>
          <View style={s.tabela}>
            <View style={s.tr}>
              <Text style={[s.th, s.tdPrio]}>Prioridade</Text>
              <Text style={[s.th, s.tdQtd]}>NCs</Text>
            </View>
            {model.resumo.map((l) => (
              <View key={l.prioridade} style={s.tr}>
                <Text style={s.tdPrio}>{l.label}</Text>
                <Text style={s.tdQtd}>{String(l.quantidade)}</Text>
              </View>
            ))}
          </View>
        </View>
      </Page>

      {/* Sumário — uma linha por setor com a página inicial (navegação também por
          bookmarks). As páginas vêm do PdfPageIndex preenchido na 1ª passagem. */}
      {model.ncs.length > 0 ? (
        <Page size="A4" style={s.page} bookmark="Sumário">
          <HeaderFooter model={model} />
          <Text style={[s.h2, { color: cor }]}>Sumário — não conformidades por setor</Text>
          {sumarioPorSetor(model.ncs).map((grupo) => (
            <View key={grupo.setor} style={s.sumarioLinha}>
              <Text style={s.sumarioSetor}>{grupo.setor}</Text>
              <Text style={s.sumarioPag}>
                {pageIndex?.setores.get(grupo.setor)
                  ? `pág. ${pageIndex.setores.get(grupo.setor)}`
                  : "—"}
              </Text>
            </View>
          ))}
        </Page>
      ) : null}

      {/* Uma NC por página: cada página é pequena e independente (bom p/ o motor de
          layout) e vira uma entrada de bookmark navegável. Conteúdo longo (muitas
          fotos) ainda auto-pagina para uma 2ª página. */}
      {model.ncs.map((nc) => (
        <Page
          key={nc.id}
          size="A4"
          style={s.page}
          bookmark={`NC ${String(nc.numero).padStart(3, "0")}${nc.titulo ? ` — ${nc.titulo}` : ""}`}
        >
          <HeaderFooter model={model} />
          <NcConteudo
            nc={nc}
            cor={cor}
            ehPrimeiraDoSetor={primeiras.has(nc.id)}
            pageIndex={pageIndex}
          />
        </Page>
      ))}

      {/* Parecer e assinatura */}
      <Page size="A4" style={s.page}>
        <HeaderFooter model={model} />
        <Text style={[s.h2, { color: cor }]}>Parecer técnico</Text>
        {model.parecer
          .split("\n")
          .filter(Boolean)
          .map((par, i) => (
            <Text key={i} style={s.p}>
              {par}
            </Text>
          ))}
        <View style={s.assinatura}>
          <View style={s.linhaAssin}>
            <Text style={{ fontWeight: 600 }}>{ident.responsavelTecnico || " "}</Text>
            {model.branding.registroProfissional ? (
              <Text style={{ fontSize: 8 }}>{model.branding.registroProfissional}</Text>
            ) : null}
            {ident.artNumero ? <Text style={{ fontSize: 8 }}>ART {ident.artNumero}</Text> : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}
