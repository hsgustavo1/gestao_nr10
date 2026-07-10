import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfModel } from "@/lib/rti-relatorio";
import {
  PRIORIDADE_LABEL,
  LIMITACOES_PADRAO,
  formatNormasRef,
  sumarioPorSetor,
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
  p: { marginBottom: 6, lineHeight: 1.5, textAlign: "justify" },
  ncCard: { marginBottom: 14, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  ncTitulo: { fontSize: 11, fontWeight: 800, marginBottom: 3 },
  ncMeta: { fontSize: 8, color: "#666", marginBottom: 4 },
  fotoRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  fotoBox: {
    width: 160,
    height: 120,
    borderRadius: 3,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  foto: { maxWidth: 160, maxHeight: 120, objectFit: "contain" },
  tabela: { marginTop: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ccc", paddingVertical: 4 },
  th: { fontWeight: 800, fontSize: 9 },
  tdPrio: { width: "40%" },
  tdQtd: { width: "20%" },
  tdCusto: { width: "40%" },
  sumarioSetor: { fontSize: 11, fontWeight: 800, marginTop: 8, marginBottom: 3 },
  sumarioItem: { fontSize: 9, marginBottom: 2, marginLeft: 8 },
  assinatura: { marginTop: 64, alignItems: "center" },
  linhaAssin: {
    width: 260,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    paddingTop: 6,
    alignItems: "center",
  },
});

// Fatiar as NCs em páginas explícitas mantém cada passo de layout do @react-pdf pequeno.
const NC_POR_PAGINA = 14;
function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const fmtBRL = (v: number) =>
  `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

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

export function RtiPdfDocument({ model }: { model: PdfModel }) {
  const cor = model.branding.corPrimaria || PINE;
  const ident = model.identificacao;
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
        <Text style={[s.h2, { color: cor }]}>1. Objeto e escopo</Text>
        <Text style={s.p}>{ident.introducao}</Text>
        <Text style={[s.h2, { color: cor }]}>2. Referencial normativo</Text>
        <Text style={s.p}>{ident.normas || "—"}</Text>
        <Text style={[s.h2, { color: cor }]}>3. Metodologia</Text>
        <Text style={s.p}>{ident.metodologia}</Text>
        <Text style={[s.h2, { color: cor }]}>4. Limitações e ressalvas</Text>
        <Text style={s.p}>{LIMITACOES_PADRAO}</Text>
        {model.resumoExecutivo ? (
          <>
            <Text style={[s.h2, { color: cor }]}>5. Resumo executivo</Text>
            <Text style={s.p}>{model.resumoExecutivo}</Text>
          </>
        ) : null}
        <Text style={[s.h2, { color: cor }]}>Quadro-resumo por prioridade</Text>
        <View style={s.tabela}>
          <View style={s.tr}>
            <Text style={[s.th, s.tdPrio]}>Prioridade</Text>
            <Text style={[s.th, s.tdQtd]}>NCs</Text>
            <Text style={[s.th, s.tdCusto]}>Custo planejado</Text>
          </View>
          {model.resumo.map((l) => (
            <View key={l.prioridade} style={s.tr}>
              <Text style={s.tdPrio}>{l.label}</Text>
              <Text style={s.tdQtd}>{String(l.quantidade)}</Text>
              <Text style={s.tdCusto}>{fmtBRL(l.custoPlanejado)}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* Sumário — NCs agrupadas por setor (navegação também por bookmarks) */}
      {model.ncs.length > 0 ? (
        <Page size="A4" style={s.page}>
          <HeaderFooter model={model} />
          <Text style={[s.h2, { color: cor }]}>Sumário — não conformidades por setor</Text>
          {sumarioPorSetor(model.ncs).map((grupo) => (
            <View key={grupo.setor} wrap={false} style={{ marginBottom: 10 }}>
              <Text style={s.sumarioSetor}>{grupo.setor}</Text>
              {grupo.ncs.map((n) => (
                <Text key={n.numero} style={s.sumarioItem}>
                  NC {String(n.numero).padStart(3, "0")} — {n.rotulo}
                </Text>
              ))}
            </View>
          ))}
        </Page>
      ) : null}

      {/* NCs — fatiadas em páginas explícitas (evita o flow único gigante, que é
          superlinear no @react-pdf). Cada página ainda auto-pagina o overflow. */}
      {chunk(model.ncs, NC_POR_PAGINA).map((grupo, gi) => (
        <Page key={gi} size="A4" style={s.page}>
          <HeaderFooter model={model} />
          {gi === 0 ? (
            <Text style={[s.h2, { color: cor }]}>Não conformidades constatadas</Text>
          ) : null}
          {grupo.map((nc) => (
            <View
              key={nc.id}
              style={s.ncCard}
              wrap={false}
              minPresenceAhead={80}
              // `bookmark` é processado em runtime em qualquer primitivo (o render lê
              // node.props.bookmark genericamente), mas o type binding 4.5.1 só o
              // declara em PageProps — daí o cast pontual.
              {...({
                bookmark: `NC ${String(nc.numero).padStart(3, "0")}${nc.titulo ? ` — ${nc.titulo}` : ""}`,
              } as { bookmark?: string })}
            >
              <Text style={s.ncTitulo}>
                NC {String(nc.numero).padStart(3, "0")}
                {nc.titulo ? ` — ${nc.titulo}` : ` — ${PRIORIDADE_LABEL[nc.prioridade]}`}
              </Text>
              <Text style={s.ncMeta}>
                {PRIORIDADE_LABEL[nc.prioridade]}  ·  Área: {nc.areaNome}
                {nc.tipoExecucao === "investimento"
                  ? "  ·  Investimento"
                  : nc.osNumero
                    ? `  ·  O.S. ${nc.osNumero}`
                    : ""}
                {nc.custoPlanejado ? `  ·  ${fmtBRL(nc.custoPlanejado)}` : ""}
              </Text>
              <Text style={s.p}>{nc.descricao}</Text>
              {nc.recomendacao ? <Text style={s.p}>Recomendação: {nc.recomendacao}</Text> : null}
              {nc.normas.length > 0 ? (
                <Text style={s.p}>Referência normativa: {formatNormasRef(nc.normas)}</Text>
              ) : null}
              {nc.situacaoAtual ? (
                <Text style={s.p}>Situação atual: {nc.situacaoAtual}</Text>
              ) : null}
              {nc.fotos.length > 0 ? (
                <View style={s.fotoRow}>
                  {nc.fotos.map((f) => (
                    <View key={f.id} style={s.fotoBox}>
                      <Image src={f.url} style={s.foto} />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
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
