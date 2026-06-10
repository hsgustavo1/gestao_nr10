import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  AlertTriangle, Camera, CheckCheck, ChevronLeft, ChevronRight, ClipboardList,
  Download, ExternalLink, MessageSquare, Paperclip, Plus, Search, X,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { formatDatePtBR } from "@/lib/qualificacoes";
import {
  clampPrioridade, formatBRL, ncPrazoBucket, ncPrazoVencido, ncPrazoProximo,
  RTI_EVIDENCIA_TIPO_LABELS, RTI_NC_STATUSES, RTI_NC_STATUS_BADGE, RTI_NC_STATUS_LABELS,
  RTI_PRAZO_BUCKET_LABELS, RTI_PRIORIDADES, RTI_PRIORIDADE_BADGE, RTI_PRIORIDADE_LABELS,
  RTI_TIPO_EXECUCAO_LABELS, RTI_TIPO_EXECUCAO_SHORT,
  type RtiEvidenciaTipo, type RtiNc, type RtiNcStatus, type RtiPrioridade, type RtiTipoExecucao,
} from "@/lib/rti";
import {
  bulkAttachRtiEvidencias, logBulkHistorico, useBulkUpdateRtiNcs, useCreateRtiArea,
  useCreateRtiNc, useRtiAreas, useRtiEvidenciaIndex, useRtiNcs, useRtiReports, useUpdateRtiNc,
} from "@/lib/rti-queries";
import { useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 50;

const planoSearchSchema = z.object({
  report: z.string().optional(),
  q: z.string().optional().default(""),
  area: z.string().optional().default("todas"),
  prioridade: z.string().optional().default("all"),
  status: z.string().optional().default("all"),
  tipo: z.string().optional().default("all"),
  prazo: z.string().optional().default("all"),
  evidencia: z.string().optional().default("all"),
  ordem: z.string().optional().default("numero"),
  page: z.coerce.number().optional().default(1),
});

export const Route = createFileRoute("/rti/plano")({
  validateSearch: planoSearchSchema,
  component: RtiPlanoPage,
  head: () => ({ meta: [{ title: "Plano de Ação — RTI — Gestão NR-10" }] }),
});

function RtiPlanoPage() {
  const { isStaff, user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { data: reports = [], isLoading: loadingReports } = useRtiReports();

  const activeReport = reports.find((r) => r.id === search.report) ?? reports[0] ?? null;
  const { data: ncs = [], isLoading: loadingNcs } = useRtiNcs(activeReport?.id);
  const { data: areas = [] } = useRtiAreas(activeReport?.id);
  const { data: evidenciaIndex } = useRtiEvidenciaIndex(activeReport?.id);

  const updateNc = useUpdateRtiNc();
  const bulkUpdate = useBulkUpdateRtiNcs();
  const qc = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [novaNcOpen, setNovaNcOpen] = useState(false);

  const actorName =
    (user?.user_metadata?.display_name as string | undefined) ||
    user?.email?.split("@")[0] || null;

  const areaNome = useMemo(() => new Map(areas.map((a) => [a.id, a.nome])), [areas]);

  function setSearch(patch: Partial<typeof search>) {
    navigate({
      to: "/rti/plano",
      search: { ...search, report: activeReport?.id, page: 1, ...patch },
      replace: true,
    });
  }

  const filtered = useMemo(() => {
    const t = search.q.trim().toLowerCase();
    const list = ncs.filter((nc) => {
      if (search.area !== "todas" && areaNome.get(nc.area_id) !== search.area) return false;
      if (search.prioridade !== "all" && String(nc.prioridade) !== search.prioridade) return false;
      if (search.status !== "all" && nc.status !== search.status) return false;
      if (search.tipo !== "all" && nc.tipo_execucao !== search.tipo) return false;
      if (search.prazo !== "all") {
        if (search.prazo === "proximo") {
          if (!ncPrazoProximo(nc)) return false;
        } else if (search.prazo === "sem") {
          if (nc.prazo) return false;
        } else {
          // Faixas do dashboard (vencido, semana, 30dias, 90dias, mais90, sem_prazo)
          if (nc.status === "concluida" || ncPrazoBucket(nc) !== search.prazo) return false;
        }
      }
      if (search.evidencia !== "all") {
        const temCorrecao = (evidenciaIndex?.get(nc.id)?.correcao ?? 0) > 0;
        if (search.evidencia === "com_correcao" && !temCorrecao) return false;
        if (search.evidencia === "sem_correcao" && temCorrecao) return false;
      }
      if (!t) return true;
      return (
        String(nc.numero).includes(t) ||
        nc.descricao.toLowerCase().includes(t) ||
        (nc.recomendacao ?? "").toLowerCase().includes(t) ||
        (nc.responsavel ?? "").toLowerCase().includes(t) ||
        (nc.os_numero ?? "").toLowerCase().includes(t) ||
        (nc.situacao_atual ?? "").toLowerCase().includes(t)
      );
    });
    const dir = (a: number | string | null, b: number | string | null) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return a < b ? -1 : a > b ? 1 : 0;
    };
    switch (search.ordem) {
      case "prioridade":
        list.sort((a, b) => b.prioridade - a.prioridade || a.numero - b.numero);
        break;
      case "prazo":
        list.sort((a, b) => dir(a.prazo, b.prazo) || a.numero - b.numero);
        break;
      case "custo":
        list.sort((a, b) => Number(b.custo_planejado) - Number(a.custo_planejado) || a.numero - b.numero);
        break;
      default:
        list.sort((a, b) => a.numero - b.numero);
    }
    return list;
  }, [ncs, search, areaNome, evidenciaIndex]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(search.page, totalPages);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resumo = useMemo(() => {
    let pend = 0, and = 0, conc = 0, custo = 0;
    for (const nc of filtered) {
      if (nc.status === "pendente") pend++;
      else if (nc.status === "em_andamento") and++;
      else conc++;
      custo += Number(nc.custo_planejado) || 0;
    }
    return { pend, and, conc, custo };
  }, [filtered]);

  const hasFilters =
    search.q !== "" || search.area !== "todas" || search.prioridade !== "all" ||
    search.status !== "all" || search.tipo !== "all" || search.prazo !== "all" ||
    search.evidencia !== "all";

  async function quickStatus(nc: RtiNc, status: RtiNcStatus) {
    if (status === nc.status) return;
    try {
      await updateNc.mutateAsync({
        id: nc.id,
        status,
        progresso: status === "concluida" ? 100 : status === "pendente" ? 0 : nc.progresso,
        concluida_em: status === "concluida" ? new Date().toISOString().slice(0, 10) : null,
      });
      await logBulkHistorico(
        [nc.id],
        `Status alterado de "${RTI_NC_STATUS_LABELS[nc.status]}" para "${RTI_NC_STATUS_LABELS[status]}"`,
        actorName,
      );
      toast.success(`NC ${nc.numero}: ${RTI_NC_STATUS_LABELS[status]}.`);
    } catch (e) {
      toast.error("Falha ao atualizar: " + (e as Error).message);
    }
  }

  function exportXlsx() {
    const rows = filtered.map((nc) => ({
      "NC": nc.numero,
      "Área": areaNome.get(nc.area_id) ?? "",
      "Não Conformidade": nc.descricao,
      "Recomendação": nc.recomendacao ?? "",
      "Prioridade": `P${nc.prioridade}`,
      "Responsável": nc.responsavel ?? "",
      "Status": RTI_NC_STATUS_LABELS[nc.status],
      "% Conclusão": nc.progresso,
      "Prazo": nc.prazo ? formatDatePtBR(nc.prazo) : "",
      "Tipo": RTI_TIPO_EXECUCAO_LABELS[nc.tipo_execucao],
      "Nº OS": nc.os_numero ?? "",
      "Custo Planejado": nc.custo_planejado ?? "",
      "Custo Realizado": nc.custo_realizado ?? "",
      "Situação Atual": nc.situacao_atual ?? "",
      "Concluída em": nc.concluida_em ? formatDatePtBR(nc.concluida_em) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plano de Ação");
    XLSX.writeFile(wb, "rti-plano-de-acao.xlsx");
    toast.success(`${rows.length} NCs exportadas.`);
  }

  const allPageSelected = pageRows.length > 0 && pageRows.every((nc) => selected.has(nc.id));

  function togglePageSelection() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageRows.forEach((nc) => next.delete(nc.id));
      else pageRows.forEach((nc) => next.add(nc.id));
      return next;
    });
  }

  const isLoading = loadingReports || (activeReport && loadingNcs);

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <ClipboardList className="h-5 w-5 shrink-0 text-primary" />
            Plano de Ação — RTI
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {activeReport ? activeReport.titulo : "Não conformidades do Relatório Técnico das Inspeções."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {reports.length > 1 && (
            <Select
              value={activeReport?.id ?? ""}
              onValueChange={(v) => navigate({ to: "/rti/plano", search: { report: v }, replace: true })}
            >
              <SelectTrigger className="w-52"><SelectValue placeholder="Relatório" /></SelectTrigger>
              <SelectContent>
                {reports.map((r) => <SelectItem key={r.id} value={r.id}>{r.titulo}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={exportXlsx} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Exportar
          </Button>
          {isStaff && activeReport && (
            <Button onClick={() => setNovaNcOpen(true)} className="bg-brand-gradient text-white shadow-brand">
              <Plus className="h-4 w-4" /> Nova NC
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] sm:flex-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar nº, descrição, responsável, OS..."
            className="pl-8 w-full sm:w-72"
            value={search.q}
            onChange={(e) => setSearch({ q: e.target.value })}
          />
        </div>
        <Select value={search.area} onValueChange={(v) => setSearch({ area: v })}>
          <SelectTrigger className="w-full sm:w-60"><SelectValue placeholder="Área" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="todas">Todas as áreas</SelectItem>
            {areas.map((a) => <SelectItem key={a.id} value={a.nome}>{a.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={search.prioridade} onValueChange={(v) => setSearch({ prioridade: v })}>
          <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-40"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Prioridade: todas</SelectItem>
            {RTI_PRIORIDADES.map((p) => (
              <SelectItem key={p} value={String(p)}>{RTI_PRIORIDADE_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={search.status} onValueChange={(v) => setSearch({ status: v })}>
          <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status: todos</SelectItem>
            {RTI_NC_STATUSES.map((s) => <SelectItem key={s} value={s}>{RTI_NC_STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={search.tipo} onValueChange={(v) => setSearch({ tipo: v })}>
          <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tipo: todos</SelectItem>
            <SelectItem value="os">OS (manutenção)</SelectItem>
            <SelectItem value="investimento">Investimento</SelectItem>
          </SelectContent>
        </Select>
        <Select value={search.prazo} onValueChange={(v) => setSearch({ prazo: v })}>
          <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-52"><SelectValue placeholder="Prazo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Prazo: todos</SelectItem>
            <SelectItem value="vencido">{RTI_PRAZO_BUCKET_LABELS.vencido}</SelectItem>
            <SelectItem value="semana">{RTI_PRAZO_BUCKET_LABELS.semana}</SelectItem>
            <SelectItem value="30dias">{RTI_PRAZO_BUCKET_LABELS["30dias"]}</SelectItem>
            <SelectItem value="90dias">{RTI_PRAZO_BUCKET_LABELS["90dias"]}</SelectItem>
            <SelectItem value="mais90">{RTI_PRAZO_BUCKET_LABELS.mais90}</SelectItem>
            <SelectItem value="sem_prazo">{RTI_PRAZO_BUCKET_LABELS.sem_prazo}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={search.evidencia} onValueChange={(v) => setSearch({ evidencia: v })}>
          <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-48"><SelectValue placeholder="Evidência" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Evidência: todas</SelectItem>
            <SelectItem value="com_correcao">Com evidência de correção</SelectItem>
            <SelectItem value="sem_correcao">Sem evidência de correção</SelectItem>
          </SelectContent>
        </Select>
        <Select value={search.ordem} onValueChange={(v) => setSearch({ ordem: v })}>
          <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-44"><SelectValue placeholder="Ordenar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="numero">Ordenar: nº da NC</SelectItem>
            <SelectItem value="prioridade">Ordenar: prioridade</SelectItem>
            <SelectItem value="prazo">Ordenar: prazo</SelectItem>
            <SelectItem value="custo">Ordenar: custo</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost" size="sm" className="text-muted-foreground"
            onClick={() => setSearch({ q: "", area: "todas", prioridade: "all", status: "all", tipo: "all", prazo: "all", evidencia: "all" })}
          >
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      {/* Resumo da seleção de filtros */}
      <div className="mt-3 text-xs text-muted-foreground">
        {isLoading ? "Carregando..." : (
          <>
            <strong className="text-foreground">{filtered.length}</strong> de {ncs.length} NCs
            {" · "}<span className="text-red-600">{resumo.pend} pendentes</span>
            {" · "}<span className="text-amber-600">{resumo.and} em andamento</span>
            {" · "}<span className="text-emerald-600">{resumo.conc} concluídas</span>
            {resumo.custo > 0 && <>{" · "}custo planejado {formatBRL(resumo.custo)}</>}
          </>
        )}
      </div>

      {/* Barra de ações em massa */}
      {isStaff && selected.size > 0 && (
        <BulkBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onApply={async ({ patch, descricaoLog, observacao, files, tipoEvidencia, onProgress }) => {
            const ids = [...selected];
            try {
              if (Object.keys(patch).length > 0) {
                await bulkUpdate.mutateAsync({ ids, patch });
                await logBulkHistorico(ids, `Atualização em massa: ${descricaoLog}`, actorName, "alteracao");
              }
              if (observacao.trim()) {
                await logBulkHistorico(ids, observacao.trim(), actorName, "comentario");
              }
              if (files.length > 0) {
                await bulkAttachRtiEvidencias({
                  ncIds: ids, files, tipo: tipoEvidencia,
                  descricao: observacao.trim() || null, autorNome: actorName, onProgress,
                });
                qc.invalidateQueries({ queryKey: ["rti_nc_evidencias_index"] });
                qc.invalidateQueries({ queryKey: ["rti_nc_evidencias_files"] });
              }
              const partes: string[] = [];
              if (Object.keys(patch).length > 0) partes.push("campos atualizados");
              if (observacao.trim()) partes.push("observação registrada");
              if (files.length > 0) partes.push(`${files.length} anexo(s)`);
              toast.success(`${ids.length} NCs · ${partes.join(", ")}.`);
              setSelected(new Set());
            } catch (e) {
              toast.error("Falha na ação em massa: " + (e as Error).message);
            }
          }}
        />
      )}

      {/* Tabela */}
      <Card className="mt-3">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : !activeReport ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum relatório cadastrado. {isStaff && <>Importe a planilha em <Link to="/rti/importar" className="underline">Importar</Link>.</>}
            </div>
          ) : pageRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {ncs.length === 0 ? "Nenhuma NC cadastrada neste relatório." : "Nenhuma NC corresponde aos filtros."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isStaff && (
                      <TableHead className="w-10">
                        <Checkbox checked={allPageSelected} onCheckedChange={togglePageSelection} aria-label="Selecionar página" />
                      </TableHead>
                    )}
                    <TableHead className="w-14">Nº</TableHead>
                    <TableHead>Não conformidade</TableHead>
                    <TableHead className="w-12">P</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Custo plan.</TableHead>
                    <TableHead className="w-20 text-center">Evid.</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((nc) => {
                    const vencido = ncPrazoVencido(nc);
                    const ev = evidenciaIndex?.get(nc.id);
                    return (
                      <TableRow key={nc.id} className="group">
                        {isStaff && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(nc.id)}
                              onCheckedChange={(c) => {
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (c) next.add(nc.id); else next.delete(nc.id);
                                  return next;
                                });
                              }}
                              aria-label={`Selecionar NC ${nc.numero}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-mono font-semibold tabular-nums">{nc.numero}</TableCell>
                        <TableCell className="max-w-[380px]">
                          <Link
                            to="/rti/nc/$ncId" params={{ ncId: nc.id }}
                            className="block hover:underline"
                            title={nc.descricao}
                          >
                            <div className="text-sm leading-snug line-clamp-2">{nc.descricao}</div>
                          </Link>
                          <div className="mt-0.5 text-[11px] text-muted-foreground truncate">
                            {areaNome.get(nc.area_id) ?? "—"}
                            {nc.responsavel && <> · {nc.responsavel}</>}
                            {nc.os_numero && <> · OS {nc.os_numero}</>}
                            {" · "}{RTI_TIPO_EXECUCAO_SHORT[nc.tipo_execucao]}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[11px] font-bold ${RTI_PRIORIDADE_BADGE[clampPrioridade(nc.prioridade)]}`}
                            title={RTI_PRIORIDADE_LABELS[clampPrioridade(nc.prioridade)]}
                          >
                            P{nc.prioridade}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {nc.prazo ? (
                            <span className={vencido ? "text-red-600 font-semibold inline-flex items-center gap-1" : ""}>
                              {vencido && <AlertTriangle className="h-3.5 w-3.5" />}
                              {formatDatePtBR(nc.prazo)}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {isStaff ? (
                            <div className="space-y-1">
                              <Select value={nc.status} onValueChange={(v) => quickStatus(nc, v as RtiNcStatus)}>
                                <SelectTrigger className={`h-7 w-36 text-xs border rounded-full px-2.5 ${RTI_NC_STATUS_BADGE[nc.status]}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {RTI_NC_STATUSES.map((s) => (
                                    <SelectItem key={s} value={s}>{RTI_NC_STATUS_LABELS[s]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {nc.status === "em_andamento" && (
                                <Progress value={nc.progresso} className="h-1 w-36" />
                              )}
                            </div>
                          ) : (
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${RTI_NC_STATUS_BADGE[nc.status]}`}>
                              {RTI_NC_STATUS_LABELS[nc.status]}{nc.status === "em_andamento" ? ` ${nc.progresso}%` : ""}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">
                          {nc.custo_planejado != null
                            ? formatBRL(nc.custo_planejado)
                            : <span className="text-muted-foreground" title="Custo não informado">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            {(ev?.constatacao ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-0.5" title={`${ev!.constatacao} evidência(s) da constatação`}>
                                <Camera className="h-3.5 w-3.5" />{ev!.constatacao}
                              </span>
                            )}
                            {(ev?.correcao ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-emerald-600" title={`${ev!.correcao} evidência(s) de correção`}>
                                <CheckCheck className="h-3.5 w-3.5" />{ev!.correcao}
                              </span>
                            )}
                            {!ev && nc.status === "concluida" && (
                              <span className="text-amber-600" title="Concluída sem evidência de correção anexada">
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button asChild size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-60 group-hover:opacity-100" title="Abrir NC">
                            <Link to="/rti/nc/$ncId" params={{ ncId: nc.id }}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {!isLoading && totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setSearch({ page: page - 1 })}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setSearch({ page: page + 1 })}>
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {isStaff && novaNcOpen && activeReport && (
        <NovaNcDialog
          reportId={activeReport.id}
          proximoNumero={ncs.reduce((max, nc) => Math.max(max, nc.numero), 0) + 1}
          onOpenChange={(o) => { if (!o) setNovaNcOpen(false); }}
          actorName={actorName}
        />
      )}
    </PageShell>
  );
}

// ── Barra de ações em massa ──────────────────────────────────────────────────

type BulkApplyArgs = {
  patch: Partial<RtiNc>;
  descricaoLog: string;
  observacao: string;
  files: File[];
  tipoEvidencia: RtiEvidenciaTipo;
  onProgress: (done: number, total: number) => void;
};

function BulkBar({
  count, onClear, onApply,
}: {
  count: number;
  onClear: () => void;
  onApply: (args: BulkApplyArgs) => Promise<void>;
}) {
  const [status, setStatus] = useState<string>("keep");
  const [responsavel, setResponsavel] = useState("");
  const [prazo, setPrazo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [tipoEvidencia, setTipoEvidencia] = useState<RtiEvidenciaTipo>("correcao");
  // Custo: "keep" = não mexer · "valor" = definir valor · "naoinformado" = limpar (null)
  const [custoPlanMode, setCustoPlanMode] = useState<"keep" | "valor" | "naoinformado">("keep");
  const [custoPlanValor, setCustoPlanValor] = useState("");
  const [custoRealMode, setCustoRealMode] = useState<"keep" | "valor" | "naoinformado">("keep");
  const [custoRealValor, setCustoRealValor] = useState("");
  const [busy, setBusy] = useState(false);
  const [progresso, setProgresso] = useState<{ done: number; total: number } | null>(null);

  function resetCampos() {
    setStatus("keep"); setResponsavel(""); setPrazo("");
    setObservacao(""); setFiles([]); setTipoEvidencia("correcao");
    setCustoPlanMode("keep"); setCustoPlanValor("");
    setCustoRealMode("keep"); setCustoRealValor("");
  }

  async function apply() {
    const patch: Partial<RtiNc> = {};
    const parts: string[] = [];
    if (status !== "keep") {
      patch.status = status as RtiNcStatus;
      if (status === "concluida") {
        patch.progresso = 100;
        patch.concluida_em = new Date().toISOString().slice(0, 10);
      } else {
        patch.concluida_em = null;
      }
      parts.push(`status → ${RTI_NC_STATUS_LABELS[status as RtiNcStatus]}`);
    }
    if (responsavel.trim()) {
      patch.responsavel = responsavel.trim();
      parts.push(`responsável → ${responsavel.trim()}`);
    }
    if (prazo) {
      patch.prazo = prazo;
      parts.push(`prazo → ${formatDatePtBR(prazo)}`);
    }
    if (custoPlanMode === "valor") {
      const v = custoPlanValor.trim() === "" ? 0 : Number(custoPlanValor);
      patch.custo_planejado = isFinite(v) ? v : 0;
      parts.push(`custo planejado → ${formatBRL(patch.custo_planejado!)}`);
    } else if (custoPlanMode === "naoinformado") {
      patch.custo_planejado = null;
      parts.push("custo planejado → não informado");
    }
    if (custoRealMode === "valor") {
      const v = custoRealValor.trim() === "" ? 0 : Number(custoRealValor);
      patch.custo_realizado = isFinite(v) ? v : 0;
      parts.push(`custo realizado → ${formatBRL(patch.custo_realizado!)}`);
    } else if (custoRealMode === "naoinformado") {
      patch.custo_realizado = null;
      parts.push("custo realizado → não informado");
    }

    const temAlgo = parts.length > 0 || observacao.trim() !== "" || files.length > 0;
    if (!temAlgo) {
      toast.error("Defina um campo, escreva uma observação ou anexe uma evidência.");
      return;
    }

    setBusy(true);
    setProgresso(files.length > 0 ? { done: 0, total: count * files.length } : null);
    try {
      await onApply({
        patch,
        descricaoLog: parts.join("; "),
        observacao,
        files,
        tipoEvidencia,
        onProgress: (done, total) => setProgresso({ done, total }),
      });
      resetCampos();
    } finally {
      setBusy(false);
      setProgresso(null);
    }
  }

  return (
    <Card className="mt-3 border-primary/40 bg-primary/[0.03]">
      <CardContent className="p-3 space-y-3">
        {/* Linha 1: campos rápidos */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold whitespace-nowrap">
            {count} selecionada{count > 1 ? "s" : ""}:
          </span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="keep">Status: manter</SelectItem>
              {RTI_NC_STATUSES.map((s) => <SelectItem key={s} value={s}>{RTI_NC_STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder="Responsável (opcional)" className="h-8 w-48 text-xs"
            value={responsavel} onChange={(e) => setResponsavel(e.target.value)} maxLength={150}
          />
          <Input
            type="date" className="h-8 w-40 text-xs" title="Prazo (opcional)"
            value={prazo} onChange={(e) => setPrazo(e.target.value)}
          />
        </div>

        {/* Linha de custos */}
        <div className="flex flex-wrap items-center gap-2">
          <BulkCustoControl
            label="Custo planejado"
            mode={custoPlanMode} onModeChange={setCustoPlanMode}
            valor={custoPlanValor} onValorChange={setCustoPlanValor}
          />
          <BulkCustoControl
            label="Custo realizado"
            mode={custoRealMode} onModeChange={setCustoRealMode}
            valor={custoRealValor} onValorChange={setCustoRealValor}
          />
        </div>

        {/* Linha 2: observação + anexo de evidência */}
        <div className="grid gap-2 lg:grid-cols-[1fr_auto] items-start">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> Observação (registrada no histórico de cada NC)
            </label>
            <Textarea
              placeholder="Ex.: correção executada conforme OS; verificar na próxima inspeção."
              className="text-xs min-h-[60px]"
              value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={2000}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground inline-flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" /> Anexar evidência a todas
            </label>
            <Select value={tipoEvidencia} onValueChange={(v) => setTipoEvidencia(v as RtiEvidenciaTipo)}>
              <SelectTrigger className="h-8 w-full lg:w-56 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="correcao">{RTI_EVIDENCIA_TIPO_LABELS.correcao}</SelectItem>
                <SelectItem value="constatacao">{RTI_EVIDENCIA_TIPO_LABELS.constatacao}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="file" multiple accept="image/*,application/pdf"
              className="h-8 w-full lg:w-56 text-xs file:text-xs file:mr-2"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {files.length} arquivo(s) → {count} NC(s) = {files.length * count} anexo(s)
              </p>
            )}
          </div>
        </div>

        {/* Progresso de upload */}
        {progresso && progresso.total > 0 && (
          <div className="space-y-1">
            <Progress value={Math.round((progresso.done / progresso.total) * 100)} className="h-1.5" />
            <p className="text-[11px] text-muted-foreground">
              Enviando anexos… {progresso.done}/{progresso.total}
            </p>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="h-8 bg-brand-gradient text-white shadow-brand" onClick={apply} disabled={busy}>
            {busy ? "Aplicando..." : "Aplicar a todas"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={onClear} disabled={busy}>
            <X className="h-3.5 w-3.5" /> Limpar seleção
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BulkCustoControl({
  label, mode, onModeChange, valor, onValorChange,
}: {
  label: string;
  mode: "keep" | "valor" | "naoinformado";
  onModeChange: (m: "keep" | "valor" | "naoinformado") => void;
  valor: string;
  onValorChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{label}:</span>
      <Select value={mode} onValueChange={(v) => onModeChange(v as typeof mode)}>
        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="keep">Manter</SelectItem>
          <SelectItem value="valor">Definir valor</SelectItem>
          <SelectItem value="naoinformado">Não informado</SelectItem>
        </SelectContent>
      </Select>
      {mode === "valor" && (
        <Input
          type="number" min={0} step="0.01" placeholder="R$ 0,00"
          className="h-8 w-28 text-xs"
          value={valor} onChange={(e) => onValorChange(e.target.value)}
        />
      )}
    </div>
  );
}

// ── Nova NC ──────────────────────────────────────────────────────────────────

function NovaNcDialog({
  reportId, proximoNumero, onOpenChange, actorName,
}: {
  reportId: string;
  proximoNumero: number;
  onOpenChange: (o: boolean) => void;
  actorName: string | null;
}) {
  const { data: areas = [] } = useRtiAreas(reportId);
  const createNc = useCreateRtiNc();
  const createArea = useCreateRtiArea();

  const [areaId, setAreaId] = useState<string>("");
  const [novaArea, setNovaArea] = useState("");
  const [numero, setNumero] = useState(proximoNumero);
  const [descricao, setDescricao] = useState("");
  const [recomendacao, setRecomendacao] = useState("");
  const [prioridade, setPrioridade] = useState("3");
  const [responsavel, setResponsavel] = useState("");
  const [prazo, setPrazo] = useState("");
  const [tipo, setTipo] = useState<RtiTipoExecucao>("os");
  const [custoPlanejado, setCustoPlanejado] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!descricao.trim()) return toast.error("Descreva a não conformidade.");
    if ((areaId === "" || areaId === "__nova__") && !novaArea.trim())
      return toast.error("Selecione ou crie a área.");

    setBusy(true);
    try {
      let finalAreaId = areaId;
      if (areaId === "__nova__" || areaId === "") {
        const created = await createArea.mutateAsync({
          report_id: reportId,
          nome: novaArea.trim(),
          ordem: areas.reduce((m, a) => Math.max(m, a.ordem), 0) + 1,
        });
        finalAreaId = created.id;
      }
      const nc = await createNc.mutateAsync({
        report_id: reportId,
        area_id: finalAreaId,
        numero,
        descricao: descricao.trim(),
        recomendacao: recomendacao.trim() || null,
        prioridade: Number(prioridade),
        responsavel: responsavel.trim() || null,
        status: "pendente",
        progresso: 0,
        prazo: prazo || null,
        tipo_execucao: tipo,
        os_numero: null,
        custo_planejado: custoPlanejado.trim() ? Number(custoPlanejado) : null,
        custo_realizado: null,
        situacao_atual: null,
        concluida_em: null,
      });
      await logBulkHistorico([nc.id], "NC registrada manualmente", actorName);
      toast.success(`NC ${numero} registrada.`);
      onOpenChange(false);
    } catch (err) {
      toast.error("Falha ao registrar: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <Plus className="h-5 w-5 shrink-0 text-primary" /> Nova não conformidade
          </DialogTitle>
          <DialogDescription>
            Registre uma NC identificada fora da planilha importada (ex.: nova constatação em campo).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-[1fr_110px] gap-3">
            <div className="space-y-1.5">
              <Label>Área</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger><SelectValue placeholder="Selecione a área" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                  <SelectItem value="__nova__">+ Nova área...</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-numero">Nº da NC</Label>
              <Input
                id="nc-numero" type="number" min={1} value={numero}
                onChange={(e) => setNumero(Number(e.target.value))} required
              />
            </div>
          </div>
          {(areaId === "__nova__" || (areaId === "" && areas.length === 0)) && (
            <div className="space-y-1.5">
              <Label htmlFor="nc-nova-area">Nome da nova área</Label>
              <Input id="nc-nova-area" value={novaArea} onChange={(e) => setNovaArea(e.target.value)} maxLength={150} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="nc-desc">Não conformidade</Label>
            <Textarea id="nc-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={2000} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-rec">Recomendação (opcional)</Label>
            <Textarea id="nc-rec" value={recomendacao} onChange={(e) => setRecomendacao(e.target.value)} rows={2} maxLength={3000} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RTI_PRIORIDADES.map((p) => (
                    <SelectItem key={p} value={String(p)}>{RTI_PRIORIDADE_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de execução</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as RtiTipoExecucao)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="os">OS (manutenção)</SelectItem>
                  <SelectItem value="investimento">Investimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="nc-resp">Responsável</Label>
              <Input id="nc-resp" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} maxLength={150} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-prazo">Prazo</Label>
              <Input id="nc-prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-custo">Custo planejado (R$)</Label>
              <Input
                id="nc-custo" type="number" min={0} step="0.01" value={custoPlanejado}
                onChange={(e) => setCustoPlanejado(e.target.value)} placeholder="Não informado"
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
            <Button type="submit" disabled={busy} className="bg-brand-gradient text-white shadow-brand">
              {busy ? "Salvando..." : "Registrar NC"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
