import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  History,
  ImagePlus,
  MessageSquarePlus,
  Save,
  Trash2,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { getRecordAccess, type SealActor } from "@/lib/tenancy-gates";
import { formatDatePtBR } from "@/lib/qualificacoes";
import {
  clampPrioridade,
  formatBRL,
  ncPrazoVencido,
  RTI_NC_STATUSES,
  RTI_NC_STATUS_BADGE,
  RTI_NC_STATUS_LABELS,
  RTI_PRIORIDADES,
  RTI_PRIORIDADE_BADGE,
  RTI_PRIORIDADE_LABELS,
  RTI_TIPO_EXECUCAO_LABELS,
  type RtiEvidenciaTipo,
  type RtiNc,
  type RtiNcEvidencia,
  type RtiNcStatus,
  type RtiTipoExecucao,
} from "@/lib/rti";
import {
  logBulkHistorico,
  rtiFileUrl,
  rtiKeys,
  uploadRtiEvidencia,
  useAddRtiEvidencia,
  useAddRtiHistorico,
  useDeleteRtiEvidencia,
  useDeleteRtiNc,
  useRtiAreas,
  useRtiEvidencias,
  useRtiHistorico,
  useRtiNc,
  useRtiNcs,
  useRtiReports,
  useUpdateRtiEvidencia,
  useUpdateRtiNc,
} from "@/lib/rti-queries";

export const Route = createFileRoute("/rti/nc/$ncId")({
  component: RtiNcDetailPage,
  head: () => ({ meta: [{ title: "Não Conformidade — RTI — Gestão NR-10" }] }),
});

function RtiNcDetailPage() {
  const { ncId } = Route.useParams();
  const auth = useAuth();
  const { user } = auth;
  const navigate = useNavigate();

  const { data: nc, isLoading } = useRtiNc(ncId);

  const sealActor: SealActor = {
    isStaff: auth.isStaff,
    isPlatformAdmin: auth.isPlatformAdmin,
    hasEntitlement: auth.hasEntitlement,
    directOrgRole: auth.orgRole,
    managerOrgRole: auth.managerOrgRole,
    roleInOrg: auth.roleInOrg,
  };
  const acc = getRecordAccess(sealActor, {
    entregue_em: nc?.entregue_em ?? null,
    entregue_por_org: nc?.entregue_por_org ?? null,
  });
  const canEditTecnico = acc.canEditTecnico;
  const canEditOperacional = acc.canEditOperacional;
  const canDeleteNc = acc.canDelete;
  const { data: areas = [] } = useRtiAreas(nc?.report_id);
  const { data: siblings = [] } = useRtiNcs(nc?.report_id);
  const { data: reports = [] } = useRtiReports();
  const report = reports.find((r) => r.id === nc?.report_id);
  const deleteNc = useDeleteRtiNc();

  const actorName =
    (user?.user_metadata?.display_name as string | undefined) || user?.email?.split("@")[0] || null;

  const areaNome = useMemo(() => areas.find((a) => a.id === nc?.area_id)?.nome ?? "—", [areas, nc]);

  const { anterior, proxima } = useMemo(() => {
    if (!nc || siblings.length === 0) return { anterior: null, proxima: null };
    const idx = siblings.findIndex((s) => s.id === nc.id);
    return {
      anterior: idx > 0 ? siblings[idx - 1] : null,
      proxima: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null,
    };
  }, [nc, siblings]);

  async function handleDelete() {
    if (!nc) return;
    if (
      !window.confirm(`Excluir a NC ${nc.numero}? As evidências anexadas também serão excluídas.`)
    )
      return;
    try {
      await deleteNc.mutateAsync(nc.id);
      toast.success(`NC ${nc.numero} excluída.`);
      navigate({ to: "/rti/plano", search: { report: nc.report_id } });
    } catch (e) {
      toast.error("Não foi possível excluir. Detalhe: " + (e as Error).message);
    }
  }

  if (isLoading || !nc) {
    return (
      <PageShell>
        <Skeleton className="h-8 w-72" />
        <div className="mt-4 grid lg:grid-cols-[1fr_380px] gap-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </PageShell>
    );
  }

  const vencido = ncPrazoVencido(nc);

  return (
    <PageShell>
      {/* Navegação */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
          <Link to="/rti/plano" search={{ report: nc.report_id }}>
            <ArrowLeft className="h-4 w-4" /> Plano de Ação
          </Link>
        </Button>
        <div className="flex items-center gap-1">
          <Button
            asChild={!!anterior}
            variant="outline"
            size="sm"
            disabled={!anterior}
            title={anterior ? `NC ${anterior.numero}` : undefined}
          >
            {anterior ? (
              <Link to="/rti/nc/$ncId" params={{ ncId: anterior.id }}>
                <ChevronLeft className="h-4 w-4" /> NC {anterior.numero}
              </Link>
            ) : (
              <span>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </span>
            )}
          </Button>
          <Button
            asChild={!!proxima}
            variant="outline"
            size="sm"
            disabled={!proxima}
            title={proxima ? `NC ${proxima.numero}` : undefined}
          >
            {proxima ? (
              <Link to="/rti/nc/$ncId" params={{ ncId: proxima.id }}>
                NC {proxima.numero} <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span>
                Próxima <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Cabeçalho */}
      <div className="mt-3 flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold leading-tight">
            NC {nc.numero} <span className="font-normal text-muted-foreground">— {areaNome}</span>
          </h1>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${RTI_PRIORIDADE_BADGE[clampPrioridade(nc.prioridade)]}`}
            >
              {RTI_PRIORIDADE_LABELS[clampPrioridade(nc.prioridade)]}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${RTI_NC_STATUS_BADGE[nc.status]}`}
            >
              {RTI_NC_STATUS_LABELS[nc.status]}
              {nc.status === "em_andamento" ? ` · ${nc.progresso}%` : ""}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              {RTI_TIPO_EXECUCAO_LABELS[nc.tipo_execucao]}
            </span>
            {vencido && (
              <span className="inline-flex items-center rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
                Prazo vencido: {formatDatePtBR(nc.prazo)}
              </span>
            )}
          </div>
        </div>
        {canDeleteNc && (
          <Button variant="outline" size="sm" className="text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" /> Excluir NC
          </Button>
        )}
      </div>

      <div className="mt-4 grid lg:grid-cols-[1fr_400px] gap-4 items-start">
        {/* Coluna principal */}
        <div className="space-y-4 min-w-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Não conformidade constatada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{nc.descricao}</p>
              {nc.recomendacao && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Recomendação do auditor
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{nc.recomendacao}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <EvidenceSection
            nc={nc}
            tipo="constatacao"
            canEdit={canEditTecnico}
            sealedReadonly={acc.sealed && !canEditTecnico}
            actorName={actorName}
            titulo="Registro da não conformidade"
            descricao="Fotos e documentos que evidenciam o problema constatado na inspeção."
            icon={<Camera className="h-4 w-4 text-primary" />}
            orgId={auth.currentOrgId}
            orgNome={auth.currentOrg?.nome ?? null}
            reportTitulo={report?.titulo ?? null}
          />
          <EvidenceSection
            nc={nc}
            tipo="correcao"
            canEdit={canEditOperacional}
            actorName={actorName}
            titulo="Evidências da correção"
            descricao="Comprovação da ação corretiva executada (fotos do depois, OS encerrada, laudos...)."
            icon={<CheckCheck className="h-4 w-4 text-emerald-600" />}
            orgId={auth.currentOrgId}
            orgNome={auth.currentOrg?.nome ?? null}
            reportTitulo={report?.titulo ?? null}
          />
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4">
          <GestaoCard
            nc={nc}
            canEdit={canEditOperacional}
            canEditTecnico={canEditTecnico}
            actorName={actorName}
          />
          <HistoricoCard ncId={nc.id} canComment={canEditOperacional} actorName={actorName} />
        </div>
      </div>
    </PageShell>
  );
}

// ── Gestão (tratativa) ───────────────────────────────────────────────────────

/** Campo de custo: vazio = não informado (null); "0" = zero explícito. */
function parseCusto(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return isFinite(n) ? n : null;
}

function GestaoCard({
  nc,
  canEdit,
  canEditTecnico,
  actorName,
}: {
  nc: RtiNc;
  canEdit: boolean;
  /** Edição da criticidade (prioridade) — registro técnico; bloqueada quando entregue. */
  canEditTecnico: boolean;
  actorName: string | null;
}) {
  const qc = useQueryClient();
  const updateNc = useUpdateRtiNc();

  const hoje = () => new Date().toISOString().slice(0, 10);

  const [status, setStatus] = useState<RtiNcStatus>(nc.status);
  const [progresso, setProgresso] = useState(nc.progresso);
  const [responsavel, setResponsavel] = useState(nc.responsavel ?? "");
  const [prazo, setPrazo] = useState(nc.prazo ?? "");
  const [tipo, setTipo] = useState<RtiTipoExecucao>(nc.tipo_execucao);
  const [osNumero, setOsNumero] = useState(nc.os_numero ?? "");
  const [prioridade, setPrioridade] = useState(String(nc.prioridade));
  const [custoPlanejado, setCustoPlanejado] = useState(
    nc.custo_planejado == null ? "" : String(nc.custo_planejado),
  );
  const [custoRealizado, setCustoRealizado] = useState(
    nc.custo_realizado == null ? "" : String(nc.custo_realizado),
  );
  const [situacao, setSituacao] = useState(nc.situacao_atual ?? "");
  const [concluidaEm, setConcluidaEm] = useState(nc.concluida_em ?? "");
  const [busy, setBusy] = useState(false);

  // Ressincroniza ao navegar entre NCs (anterior/próxima)
  useEffect(() => {
    setStatus(nc.status);
    setProgresso(nc.progresso);
    setResponsavel(nc.responsavel ?? "");
    setPrazo(nc.prazo ?? "");
    setTipo(nc.tipo_execucao);
    setOsNumero(nc.os_numero ?? "");
    setPrioridade(String(nc.prioridade));
    setCustoPlanejado(nc.custo_planejado == null ? "" : String(nc.custo_planejado));
    setCustoRealizado(nc.custo_realizado == null ? "" : String(nc.custo_realizado));
    setSituacao(nc.situacao_atual ?? "");
    setConcluidaEm(nc.concluida_em ?? "");
  }, [nc]);

  function onStatusChange(s: RtiNcStatus) {
    setStatus(s);
    // Concluída → 100% e data de conclusão (hoje, se ainda não informada)
    if (s === "concluida") {
      setProgresso(100);
      setConcluidaEm((prev) => prev || hoje());
    }
    if (s === "pendente") {
      setProgresso(0);
      setConcluidaEm("");
    }
    if (s === "em_andamento" && concluidaEm) setConcluidaEm("");
  }

  function onProgressoChange(raw: number) {
    const v = Math.max(0, Math.min(100, Math.round(raw)));
    setProgresso(v);
    // Inserir progresso move automaticamente para "Em andamento" (quando ainda pendente)
    if (v > 0 && v < 100 && status === "pendente") setStatus("em_andamento");
    // Progresso 100% conclui a ação
    if (v === 100) {
      setStatus("concluida");
      setConcluidaEm((prev) => prev || hoje());
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const concluidaEmFinal = status === "concluida" ? concluidaEm || hoje() : null;
      if (concluidaEmFinal && concluidaEmFinal > hoje()) {
        toast.error("A data de conclusão não pode ser futura.");
        return;
      }
      const patch: Partial<RtiNc> & { id: string } = {
        id: nc.id,
        status,
        progresso,
        responsavel: responsavel.trim() || null,
        prazo: prazo || null,
        tipo_execucao: tipo,
        os_numero: osNumero.trim() || null,
        prioridade: Number(prioridade),
        custo_planejado: parseCusto(custoPlanejado),
        custo_realizado: parseCusto(custoRealizado),
        situacao_atual: situacao.trim() || null,
        concluida_em: concluidaEmFinal,
      };

      // Log de TODAS as mudanças relevantes (cada uma fica no histórico)
      const mudancas: string[] = [];
      if (status !== nc.status) mudancas.push(`status → ${RTI_NC_STATUS_LABELS[status]}`);
      if (progresso !== nc.progresso) mudancas.push(`progresso → ${progresso}%`);
      if ((responsavel.trim() || null) !== nc.responsavel)
        mudancas.push(`responsável → ${responsavel.trim() || "—"}`);
      if ((prazo || null) !== nc.prazo)
        mudancas.push(`prazo → ${prazo ? formatDatePtBR(prazo) : "—"}`);
      if (tipo !== nc.tipo_execucao) mudancas.push(`tipo → ${RTI_TIPO_EXECUCAO_LABELS[tipo]}`);
      if ((osNumero.trim() || null) !== nc.os_numero)
        mudancas.push(`OS → ${osNumero.trim() || "—"}`);
      if (Number(prioridade) !== nc.prioridade) mudancas.push(`prioridade → P${prioridade}`);
      const cpNovo = parseCusto(custoPlanejado);
      const crNovo = parseCusto(custoRealizado);
      if (cpNovo !== nc.custo_planejado)
        mudancas.push(`custo planejado → ${cpNovo == null ? "não informado" : formatBRL(cpNovo)}`);
      if (crNovo !== nc.custo_realizado)
        mudancas.push(`custo realizado → ${crNovo == null ? "não informado" : formatBRL(crNovo)}`);
      if (concluidaEmFinal !== nc.concluida_em) {
        mudancas.push(
          `data de conclusão → ${concluidaEmFinal ? formatDatePtBR(concluidaEmFinal) : "—"}`,
        );
      }
      if ((situacao.trim() || null) !== nc.situacao_atual)
        mudancas.push(`situação atual → ${situacao.trim() || "—"}`);

      if (mudancas.length === 0) {
        toast.info("Nenhuma alteração para salvar.");
        return;
      }

      await updateNc.mutateAsync(patch);
      await logBulkHistorico([nc.id], mudancas.join("; "), actorName);
      await qc.invalidateQueries({ queryKey: rtiKeys.historico(nc.id) });
      toast.success("NC atualizada.");
    } catch (err) {
      toast.error("Não foi possível salvar. Detalhe: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tratativa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <InfoRow label="Responsável" value={nc.responsavel ?? "—"} />
          <InfoRow label="Prazo" value={nc.prazo ? formatDatePtBR(nc.prazo) : "—"} />
          <InfoRow label="Nº OS" value={nc.os_numero ?? "—"} />
          <InfoRow
            label="Custo planejado"
            value={nc.custo_planejado == null ? "Não informado" : formatBRL(nc.custo_planejado)}
          />
          <InfoRow
            label="Custo realizado"
            value={nc.custo_realizado == null ? "Não informado" : formatBRL(nc.custo_realizado)}
          />
          {nc.concluida_em && (
            <InfoRow label="Concluída em" value={formatDatePtBR(nc.concluida_em)} />
          )}
          {nc.situacao_atual && (
            <div className="pt-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Situação atual
              </div>
              <p className="mt-1 whitespace-pre-wrap">{nc.situacao_atual}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const saveButton = (
    <Button
      type="submit"
      disabled={busy}
      className="w-full bg-brand-gradient text-white shadow-brand"
    >
      <Save className="h-4 w-4" /> {busy ? "Salvando..." : "Salvar tratativa"}
    </Button>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Tratativa</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="space-y-3">
          {/* Salvar (topo) — evita perder alterações em telas pequenas */}
          {saveButton}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => onStatusChange(v as RtiNcStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RTI_NC_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {RTI_NC_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade} disabled={!canEditTecnico}>
                <SelectTrigger
                  title={
                    canEditTecnico
                      ? undefined
                      : "Criticidade entregue pelo consultor — somente leitura"
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RTI_PRIORIDADES.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      {RTI_PRIORIDADE_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="g-prog">Progresso</Label>
              <div className="flex items-center gap-1">
                <Input
                  id="g-prog"
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={progresso}
                  onChange={(e) => onProgressoChange(Number(e.target.value))}
                  className="h-7 w-16 text-xs text-right tabular-nums"
                />
                <span className="text-xs font-semibold text-muted-foreground">%</span>
              </div>
            </div>
            <Slider
              value={[progresso]}
              min={0}
              max={100}
              step={5}
              onValueChange={(v) => onProgressoChange(v[0] ?? 0)}
            />
            <p className="text-[10px] text-muted-foreground">
              Ao registrar progresso a NC passa a "Em andamento"; 100% conclui automaticamente.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-resp">Responsável</Label>
              <Input
                id="g-resp"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                maxLength={150}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-prazo">Prazo</Label>
              <Input
                id="g-prazo"
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de execução</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as RtiTipoExecucao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="os">OS (manutenção)</SelectItem>
                  <SelectItem value="investimento">Investimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-os">Nº da OS</Label>
              <Input
                id="g-os"
                value={osNumero}
                onChange={(e) => setOsNumero(e.target.value)}
                maxLength={60}
                placeholder="—"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-concl">Data de conclusão</Label>
            <Input
              id="g-concl"
              type="date"
              value={concluidaEm}
              max={hoje()}
              onChange={(e) => setConcluidaEm(e.target.value)}
              disabled={status !== "concluida"}
            />
            <p className="text-[10px] text-muted-foreground">
              {status === "concluida"
                ? "Em branco = preenchida com a data de hoje ao salvar."
                : "Disponível quando a NC estiver concluída."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-cp">Custo planejado</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">
                  R$
                </span>
                <Input
                  id="g-cp"
                  type="number"
                  min={0}
                  step="0.01"
                  className="pl-9"
                  value={custoPlanejado}
                  onChange={(e) => setCustoPlanejado(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Deixe vazio = não informado
                <br />0 = sem custo p/ executar
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-cr">Custo realizado</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">
                  R$
                </span>
                <Input
                  id="g-cr"
                  type="number"
                  min={0}
                  step="0.01"
                  className="pl-9"
                  value={custoRealizado}
                  onChange={(e) => setCustoRealizado(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-sit">Situação atual / observações</Label>
            <Textarea
              id="g-sit"
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Ex.: OS aberta em 10/06, aguardando material. Previsão de execução na parada de safra."
            />
          </div>
          {saveButton}
        </form>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

// ── Evidências ───────────────────────────────────────────────────────────────

function EvidenceSection({
  nc,
  tipo,
  canEdit,
  sealedReadonly = false,
  actorName,
  titulo,
  descricao,
  icon,
  orgId,
  orgNome,
  reportTitulo,
}: {
  nc: RtiNc;
  tipo: RtiEvidenciaTipo;
  canEdit: boolean;
  sealedReadonly?: boolean;
  actorName: string | null;
  titulo: string;
  descricao: string;
  icon: React.ReactNode;
  orgId: string | null;
  orgNome?: string | null;
  reportTitulo: string | null;
}) {
  const { data: todas = [], isLoading } = useRtiEvidencias(nc.id);
  const addEvidencia = useAddRtiEvidencia();
  const deleteEvidencia = useDeleteRtiEvidencia();
  const addHistorico = useAddRtiHistorico();

  const evidencias = todas.filter((e) => e.tipo === tipo);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<RtiNcEvidencia | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = [...files];
    // Nomes já anexados a esta NC neste tipo de evidência (bloqueia duplicado).
    const existentes = new Set(evidencias.map((e) => e.file_name));
    for (const f of list) {
      const okTipo = f.type.startsWith("image/") || f.type === "application/pdf";
      if (!okTipo) return toast.error(`"${f.name}": apenas imagens ou PDF.`);
      if (f.size > 15 * 1024 * 1024) return toast.error(`"${f.name}" excede 15 MB.`);
      if (existentes.has(f.name))
        return toast.error(
          `"${f.name}" já foi anexado a esta NC em "${titulo}". Renomeie o arquivo se for uma versão diferente.`,
        );
    }
    // Bloqueia também duplicados dentro da mesma seleção
    const naSelecao = new Set<string>();
    for (const f of list) {
      if (naSelecao.has(f.name)) return toast.error(`"${f.name}" está repetido na seleção.`);
      naSelecao.add(f.name);
    }
    if (!orgId) {
      toast.error("Selecione uma empresa antes de anexar evidências.");
      return;
    }
    setBusy(true);
    try {
      for (const f of list) {
        const path = await uploadRtiEvidencia(f, {
          orgId,
          orgNome,
          reportId: nc.report_id,
          reportTitulo,
          ncNum: nc.numero,
        });
        await addEvidencia.mutateAsync({
          nc_id: nc.id,
          tipo,
          file_path: path,
          file_name: f.name,
          mime_type: f.type,
          descricao: caption.trim() || null,
          created_by_name: actorName,
        });
      }
      await addHistorico.mutateAsync({
        nc_id: nc.id,
        tipo: "alteracao",
        texto: `${list.length} ${list.length === 1 ? "arquivo anexado" : "arquivos anexados"} em "${titulo}"${caption.trim() ? ` — ${caption.trim()}` : ""}`,
        autor_nome: actorName,
      });
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success(
        `${list.length} ${list.length === 1 ? "evidência anexada" : "evidências anexadas"}.`,
      );
    } catch (e) {
      toast.error("Não foi possível concluir o upload. Detalhe: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(ev: RtiNcEvidencia) {
    if (!window.confirm(`Excluir a evidência "${ev.file_name}"?`)) return;
    try {
      await deleteEvidencia.mutateAsync({ id: ev.id, nc_id: ev.nc_id, file_path: ev.file_path });
      toast.success("Evidência excluída.");
    } catch (e) {
      toast.error("Não foi possível excluir. Detalhe: " + (e as Error).message);
    }
  }

  const isImage = (ev: RtiNcEvidencia) => (ev.mime_type ?? "").startsWith("image/");

  return (
    <Card title={sealedReadonly ? "Registro entregue pelo consultor — somente leitura" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon} {titulo}
          <span className="text-xs font-normal text-muted-foreground">({evidencias.length})</span>
          {sealedReadonly && (
            <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
              Entregue · somente leitura
            </span>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : evidencias.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/20 p-5 text-center text-xs text-muted-foreground">
            Nenhuma evidência anexada
            {tipo === "correcao" && nc.status === "concluida"
              ? " — anexe a comprovação da correção para defesa em auditoria."
              : "."}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {evidencias.map((ev) => (
              <div
                key={ev.id}
                className="group relative rounded-md border overflow-hidden bg-muted/20"
              >
                {isImage(ev) ? (
                  <button
                    type="button"
                    className="block w-full aspect-square cursor-zoom-in"
                    onClick={() => setPreview(ev)}
                    title={ev.descricao ?? ev.file_name}
                  >
                    <img
                      src={rtiFileUrl(ev.file_path)}
                      alt={ev.descricao ?? ev.file_name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPreview(ev)}
                    className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 p-2 text-center cursor-pointer"
                    title={ev.descricao ?? ev.file_name}
                  >
                    <FileText className="h-7 w-7 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground line-clamp-2 break-all">
                      {ev.descricao ?? ev.file_name}
                    </span>
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => remove(ev)}
                    className="absolute top-1 right-1 hidden group-hover:grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white hover:bg-red-600"
                    title="Excluir evidência"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="rounded-md border bg-muted/20 p-2.5 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Legenda (opcional)"
                className="h-8 flex-1 min-w-[140px] text-xs"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={300}
              />
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                id={`ev-file-${tipo}-${nc.id}`}
                onChange={(e) => onFiles(e.target.files)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" /> {busy ? "Enviando..." : "Anexar fotos / PDF"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Digite a legenda antes de anexar. Você também pode editá-la depois, clicando na foto.
            </p>
          </div>
        )}
      </CardContent>

      {/* Lightbox */}
      {preview && (
        <EvidenceLightbox
          ev={preview}
          canEdit={canEdit}
          actorName={actorName}
          onClose={() => setPreview(null)}
        />
      )}
    </Card>
  );
}

function EvidenceLightbox({
  ev,
  canEdit,
  actorName,
  onClose,
}: {
  ev: RtiNcEvidencia;
  canEdit: boolean;
  actorName: string | null;
  onClose: () => void;
}) {
  const updateEvidencia = useUpdateRtiEvidencia();
  const addHistorico = useAddRtiHistorico();
  const [caption, setCaption] = useState(ev.descricao ?? "");
  const [busy, setBusy] = useState(false);
  const isImage = (ev.mime_type ?? "").startsWith("image/");
  const dirty = caption.trim() !== (ev.descricao ?? "").trim();

  async function salvarLegenda() {
    setBusy(true);
    try {
      const nova = caption.trim() || null;
      await updateEvidencia.mutateAsync({ id: ev.id, nc_id: ev.nc_id, descricao: nova });
      await addHistorico.mutateAsync({
        nc_id: ev.nc_id,
        tipo: "alteracao",
        texto: `Legenda da evidência "${ev.file_name}" ${nova ? `atualizada para "${nova}"` : "removida"}`,
        autor_nome: actorName,
      });
      toast.success("Legenda atualizada.");
    } catch (e) {
      toast.error("Não foi possível salvar a legenda. Detalhe: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-3xl w-[calc(100vw-1rem)] p-3">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-sm leading-tight truncate">{ev.file_name}</DialogTitle>
        </DialogHeader>
        {isImage ? (
          <img
            src={rtiFileUrl(ev.file_path)}
            alt={ev.descricao ?? ev.file_name}
            className="max-h-[60vh] w-full object-contain rounded"
          />
        ) : (
          <a
            href={rtiFileUrl(ev.file_path)}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center justify-center gap-2 rounded border border-dashed bg-muted/20 py-10 text-sm text-muted-foreground"
          >
            <FileText className="h-10 w-10" /> Abrir documento
          </a>
        )}

        {/* Legenda editável */}
        {canEdit ? (
          <div className="space-y-1.5">
            <Label htmlFor="ev-caption" className="text-[11px] text-muted-foreground">
              Legenda
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="ev-caption"
                className="h-8 text-sm"
                placeholder="Legenda (opcional)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={300}
              />
              <Button
                type="button"
                size="sm"
                className="h-8 bg-brand-gradient text-white shadow-brand"
                disabled={busy || !dirty}
                onClick={salvarLegenda}
              >
                <Save className="h-3.5 w-3.5" /> {busy ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        ) : (
          ev.descricao && <p className="text-sm">{ev.descricao}</p>
        )}

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {ev.created_by_name && <>Por {ev.created_by_name} · </>}
            {formatDatePtBR(ev.created_at.slice(0, 10))}
          </span>
          <a
            href={rtiFileUrl(ev.file_path)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline"
          >
            <Download className="h-3 w-3" /> Abrir original
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Histórico ────────────────────────────────────────────────────────────────

function HistoricoCard({
  ncId,
  canComment,
  actorName,
}: {
  ncId: string;
  canComment: boolean;
  actorName: string | null;
}) {
  const { data: historico = [], isLoading } = useRtiHistorico(ncId);
  const addHistorico = useAddRtiHistorico();
  const [comentario, setComentario] = useState("");
  const [busy, setBusy] = useState(false);

  async function comentar(e: FormEvent) {
    e.preventDefault();
    if (!comentario.trim()) return;
    setBusy(true);
    try {
      await addHistorico.mutateAsync({
        nc_id: ncId,
        tipo: "comentario",
        texto: comentario.trim(),
        autor_nome: actorName,
      });
      setComentario("");
    } catch (err) {
      toast.error("Não foi possível enviar o comentário. Detalhe: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4 text-primary" /> Histórico
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canComment && (
          <form onSubmit={comentar} className="flex items-start gap-2">
            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Adicionar comentário..."
              className="text-sm"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={busy || !comentario.trim()}
              title="Comentar"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </form>
        )}
        {isLoading ? (
          <Skeleton className="h-20" />
        ) : historico.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhum registro ainda.</p>
        ) : (
          <ol className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {historico.map((h) => (
              <li key={h.id} className="relative pl-4 border-l-2 border-muted">
                <span
                  className={`absolute -left-[5px] top-1.5 h-2 w-2 rounded-full ${h.tipo === "comentario" ? "bg-blue-400" : "bg-amber-400"}`}
                />
                <p className="text-xs whitespace-pre-wrap leading-relaxed">{h.texto}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {h.autor_nome && <>{h.autor_nome} · </>}
                  {new Date(h.created_at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
