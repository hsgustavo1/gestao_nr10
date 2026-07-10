import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, Eye, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useRtiAreas, useRtiNcs } from "@/lib/rti-queries";
import {
  useFotosPorNc,
  useReportPdfs,
  useRtiReport,
  useSaveWizardDraft,
  useWizardDraft,
} from "@/lib/rti-relatorio-queries";
import {
  defaultIdentificacao,
  mergeNcOverrides,
  type NcParaPdf,
  type NcsOverrides,
  type WizardIdentificacao,
} from "@/lib/rti-relatorio";
import { gerarRelatorioPdf } from "@/lib/rti-relatorio-server";
import { StepIdentificacao } from "@/components/rti/wizard/StepIdentificacao";
import { StepNcs } from "@/components/rti/wizard/StepNcs";
import { StepParecer } from "@/components/rti/wizard/StepParecer";

export const Route = createFileRoute("/rti/relatorio/$reportId/wizard")({
  component: WizardRelatorioPage,
});

const ETAPAS = ["Identificação", "Revisão de NCs", "Parecer técnico", "Preview", "Emitir"];

function WizardRelatorioPage() {
  const { reportId } = Route.useParams();
  const auth = useAuth();
  const report = useRtiReport(reportId);
  const areas = useRtiAreas(reportId);
  const ncsQ = useRtiNcs(reportId);
  const draft = useWizardDraft(reportId);
  const saveDraft = useSaveWizardDraft(reportId);
  const pdfs = useReportPdfs(reportId);
  const qc = useQueryClient();

  const [etapa, setEtapa] = useState(1);
  const [ident, setIdent] = useState<WizardIdentificacao | null>(null);
  const [overrides, setOverrides] = useState<NcsOverrides>({});
  const [parecer, setParecer] = useState("");
  const [resumoExecutivo, setResumoExecutivo] = useState("");

  // Hidrata o estado uma única vez quando report + rascunho chegam.
  const hidratado = useRef(false);
  useEffect(() => {
    if (hidratado.current || !report.data || draft.isLoading) return;
    hidratado.current = true;
    const base = defaultIdentificacao(report.data, auth.currentOrg?.nome);
    const d = draft.data;
    setIdent({ ...base, ...((d?.identificacao ?? {}) as Partial<WizardIdentificacao>) });
    setOverrides((d?.ncs_overrides ?? {}) as NcsOverrides);
    setParecer(d?.parecer ?? "");
    setResumoExecutivo(d?.resumo_executivo ?? "");
    setEtapa(d?.etapa_atual ?? 1);
  }, [report.data, draft.data, draft.isLoading, auth.currentOrg?.nome]);

  // Autosave: debounce 1,5s sobre qualquer mudança (o wizard nunca perde edição).
  useEffect(() => {
    if (!hidratado.current || !ident) return;
    const t = setTimeout(() => {
      saveDraft.mutate({
        etapa_atual: etapa,
        identificacao: ident,
        ncs_overrides: overrides,
        parecer: parecer || null,
        resumo_executivo: resumoExecutivo || null,
      });
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, ident, overrides, parecer, resumoExecutivo]);

  // NCs no formato do PDF
  const areaNome = useMemo(
    () => new Map((areas.data ?? []).map((a) => [a.id, a.nome])),
    [areas.data],
  );
  const ncIds = useMemo(() => (ncsQ.data ?? []).map((n) => n.id), [ncsQ.data]);
  const fotos = useFotosPorNc(reportId, ncIds);
  const ncsPdf: NcParaPdf[] = useMemo(
    () =>
      (ncsQ.data ?? []).map((nc) => ({
        id: nc.id,
        numero: nc.numero,
        areaNome: areaNome.get(nc.area_id) ?? "—",
        descricao: nc.descricao,
        recomendacao: nc.recomendacao,
        prioridade: nc.prioridade,
        tipoExecucao: nc.tipo_execucao,
        osNumero: nc.os_numero,
        custoPlanejado: Number(nc.custo_planejado ?? 0),
        fotos: fotos.data?.[nc.id] ?? [],
      })),
    [ncsQ.data, areaNome, fotos.data],
  );

  // Geração do PDF é SERVER-SIDE (D-C7): no porte real (centenas de NCs + fotos) o
  // render no navegador trava. O servidor lê tudo sob a RLS do usuário (token abaixo),
  // reduz as fotos, renderiza e sobe no Storage.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gerandoPreview, setGerandoPreview] = useState(false);
  const [emitidoUrl, setEmitidoUrl] = useState<string | null>(null);
  const [emitindo, setEmitindo] = useState(false);

  async function gerarNoServidor(modo: "preview" | "emissao") {
    if (!ident) return null;
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      toast.error("Sessão expirada — entre novamente para gerar o PDF.");
      return null;
    }
    // Descarrega o rascunho para o servidor ler o estado mais recente do wizard.
    await saveDraft.mutateAsync({
      etapa_atual: etapa,
      identificacao: ident,
      ncs_overrides: overrides,
      parecer: parecer || null,
      resumo_executivo: resumoExecutivo || null,
    });
    return gerarRelatorioPdf({
      data: {
        reportId,
        accessToken: token,
        orgIdBranding: auth.currentOrgId ?? null,
        emitidoPorId: auth.user?.id ?? null,
        emitidoPorNome: auth.displayName || null,
        modo,
      },
    });
  }

  const msgErro = (err: unknown) => (err instanceof Error ? err.message : String(err));

  async function onGerarPreview() {
    setGerandoPreview(true);
    try {
      const r = await gerarNoServidor("preview");
      if (r) setPreviewUrl(r.url);
    } catch (err) {
      console.error("[wizard] gerar prévia:", err);
      toast.error(`Falha ao gerar a prévia: ${msgErro(err)}`);
    } finally {
      setGerandoPreview(false);
    }
  }

  async function onEmitir() {
    setEmitindo(true);
    try {
      const r = await gerarNoServidor("emissao");
      if (r && r.modo === "emissao") {
        setEmitidoUrl(r.url);
        toast.success(`Relatório v${r.versao} emitido.`);
        qc.invalidateQueries({ queryKey: ["rti_report_pdfs", reportId] });
        qc.invalidateQueries({ queryKey: ["rti_report", reportId] });
      }
    } catch (err) {
      console.error("[wizard] emitir:", err);
      toast.error(`Falha na emissão (o rascunho está salvo): ${msgErro(err)}`);
    } finally {
      setEmitindo(false);
    }
  }

  if (report.isLoading || !ident) {
    return (
      <PageShell>
        <div className="flex items-center gap-2 p-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando relatório…
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl space-y-4 pb-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Gerar relatório — {report.data?.titulo}</h1>
            <p className="text-sm text-muted-foreground">
              {saveDraft.isPending ? "Salvando rascunho…" : "Rascunho salvo automaticamente"}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/rti/plano">Voltar ao plano</Link>
          </Button>
        </div>

        {/* Stepper */}
        <div className="flex flex-wrap gap-1.5">
          {ETAPAS.map((nome, i) => {
            const n = i + 1;
            return (
              <button
                key={nome}
                type="button"
                onClick={() => setEtapa(n)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  etapa === n
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {n}. {nome}
              </button>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{ETAPAS[etapa - 1]}</CardTitle>
          </CardHeader>
          <CardContent>
            {etapa === 1 && <StepIdentificacao value={ident} onChange={setIdent} />}
            {etapa === 2 && <StepNcs ncs={ncsPdf} overrides={overrides} onChange={setOverrides} />}
            {etapa === 3 && (
              <StepParecer
                identificacao={ident}
                ncs={mergeNcOverrides(ncsPdf, overrides)}
                parecer={parecer}
                resumoExecutivo={resumoExecutivo}
                onChange={(v) => {
                  setParecer(v.parecer);
                  setResumoExecutivo(v.resumoExecutivo);
                }}
              />
            )}
            {etapa === 4 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={onGerarPreview} disabled={gerandoPreview || !ident}>
                    {gerandoPreview ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Gerando prévia…
                      </>
                    ) : (
                      <>
                        <Eye className="mr-1.5 h-4 w-4" /> {previewUrl ? "Atualizar prévia" : "Gerar prévia"}
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    O PDF é gerado no servidor com os dados atuais. Relatórios grandes podem levar
                    alguns segundos.
                  </p>
                </div>
                {previewUrl ? (
                  <iframe
                    title="Prévia do relatório"
                    src={previewUrl}
                    className="h-[75vh] w-full rounded-md border"
                  />
                ) : (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Clique em <strong>Gerar prévia</strong> para ver o PDF real do relatório.
                  </div>
                )}
              </div>
            )}
            {etapa === 5 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  A emissão gera o PDF final e o arquiva com número de versão — reemitir cria uma
                  versão nova, nunca sobrescreve. Depois de emitir, a entrega ao cliente (selo)
                  continua sendo feita pelo plano de ação.
                </p>
                <Button onClick={onEmitir} disabled={emitindo || !ident}>
                  {emitindo ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Emitindo…
                    </>
                  ) : (
                    <>
                      <FileText className="mr-1.5 h-4 w-4" /> Emitir PDF (v
                      {(pdfs.data?.[0]?.versao ?? 0) + 1})
                    </>
                  )}
                </Button>
                {emitidoUrl && (
                  <p className="flex items-center gap-2 text-sm text-primary">
                    <Check className="h-4 w-4" />
                    <a href={emitidoUrl} target="_blank" rel="noreferrer" className="underline">
                      Abrir PDF emitido
                    </a>
                  </p>
                )}
                {(pdfs.data?.length ?? 0) > 0 && (
                  <div className="space-y-1 border-t pt-3">
                    <p className="text-sm font-medium">Versões emitidas</p>
                    {pdfs.data!.map((p) => (
                      <p
                        key={p.id}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Download className="h-3.5 w-3.5" />
                        v{p.versao} · {new Date(p.emitido_em).toLocaleString("pt-BR")}
                        {p.emitido_por_nome ? ` · ${p.emitido_por_nome}` : ""}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" disabled={etapa === 1} onClick={() => setEtapa(etapa - 1)}>
            ← Anterior
          </Button>
          <Button disabled={etapa === 5} onClick={() => setEtapa(etapa + 1)}>
            Próxima →
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
