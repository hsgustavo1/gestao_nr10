import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Plus, Trash2, Upload } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getRtiCampoAccess } from "@/lib/tenancy-gates";
import { excelSerialToISO, formatDatePtBR } from "@/lib/qualificacoes";
import { clampPrioridade, formatBRL, type RtiNcStatus } from "@/lib/rti";
import {
  batchImportRti,
  useDeleteRtiReport,
  useRtiReports,
  useUpsertRtiReport,
  type RtiImportNc,
} from "@/lib/rti-queries";

export const Route = createFileRoute("/rti/importar")({
  component: RtiImportarPage,
  head: () => ({ meta: [{ title: "Novo RTI — Gestão NR-10" }] }),
});

// ── Helpers de parsing ────────────────────────────────────────────────────────

/** Normaliza célula: sem acentos, minúsculas, espaços simples. */
function norm(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).replace(/\s+$/g, "").trim();
  return s ? s : null;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && isFinite(Number(v.trim())))
    return Number(v.trim());
  return null;
}

/**
 * Valor monetário da planilha. Em importação, célula vazia OU igual a zero é
 * tratada como "não informado" (null) — um 0 na planilha quase sempre significa
 * "não preenchido", não "custo zero intencional". O zero explícito (sem barreira
 * para executar) só é definido manualmente dentro do app, na edição da NC.
 */
function parseMoney(v: unknown): number | null {
  let n: number | null = null;
  if (typeof v === "number" && isFinite(v)) {
    n = Math.round(v * 100) / 100;
  } else if (typeof v === "string") {
    if (v.trim() === "") return null;
    const s = v
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", ".");
    if (s === "") return null;
    const parsed = Number(s);
    n = isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
  }
  return n === 0 ? null : n;
}

function parseDateCell(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    if (v < 1 || !isFinite(v)) return null;
    try {
      return excelSerialToISO(v);
    } catch {
      return null;
    }
  }
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const parts = s.split("/");
    if (parts.length === 3 && parts[2].length === 4)
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return null;
}

function parsePct(v: unknown): number {
  const n = toNumber(v);
  if (n == null) return 0;
  const pct = n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function parseStatus(v: unknown): RtiNcStatus {
  const s = norm(v);
  if (s.includes("conclu")) return "concluida";
  if (s.includes("andamento")) return "em_andamento";
  return "pendente";
}

type ParseResult = {
  areas: { nome: string; ordem: number; ncs: number }[];
  ncs: RtiImportNc[];
  avisos: string[];
};

/** Varre o workbook e extrai as NCs das abas de área do plano de ação. */
function parseWorkbook(wb: XLSX.WorkBook): ParseResult {
  const areas: ParseResult["areas"] = [];
  const ncs: RtiImportNc[] = [];
  const avisos: string[] = [];
  const numerosVistos = new Set<number>();
  let ordem = 0;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

    // Aba de dados = tem linha de cabeçalho com "NC" + "Não Conformidade" + "Recomendação"
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const cells = (rows[i] ?? []).map(norm);
      if (
        cells.some((c) => c === "nc") &&
        cells.some((c) => c.startsWith("nao conformidade")) &&
        cells.some((c) => c.includes("recomenda"))
      ) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) continue; // abas de capa, resumos e gráficos

    const header = (rows[headerIdx] ?? []).map(norm);
    const idxNc = header.findIndex((c) => c === "nc");
    const idxDesc = header.findIndex((c) => c.startsWith("nao conformidade"));
    const idxRec = header.findIndex((c) => c.includes("recomenda"));
    const idxP = header.findIndex((c) => c === "p");
    const idxResp = header.findIndex((c) => c.startsWith("respons"));
    const idxStatus = header.findIndex((c) => c === "status");
    const idxPct = header.findIndex((c) => c.includes("conclus"));
    const idxPrazo = header.findIndex((c) => c === "prazo");
    const idxInvest = header.findIndex((c) => c.includes("investimento"));
    const idxCustoPlan = header.findIndex((c) => c.includes("planejado"));
    const idxCustoReal = header.findIndex((c) => c.includes("realizado"));
    const idxSituacao = header.findIndex((c) => c.includes("situacao"));

    // Nome da área: célula "PLANO DE AÇÃO NR 10 - ÁREA: X" acima do cabeçalho
    let areaNome = sheetName.trim();
    for (let i = 0; i < headerIdx; i++) {
      for (const cell of rows[i] ?? []) {
        const s = String(cell ?? "");
        if (norm(s).includes("area:")) {
          const apos = s.split(/[Áá]rea\s*:/i)[1];
          if (apos && apos.trim()) areaNome = apos.trim();
          break;
        }
      }
    }

    let countArea = 0;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const numero = toNumber(row[idxNc]);
      if (numero == null || numero < 1) continue; // linhas em branco / rodapé "Média Geral"
      const descricao = str(row[idxDesc]);
      if (!descricao) continue;

      if (numerosVistos.has(numero)) {
        avisos.push(`NC ${numero} duplicada (aba "${sheetName}") — mantida a primeira ocorrência.`);
        continue;
      }
      numerosVistos.add(numero);

      const status = parseStatus(idxStatus >= 0 ? row[idxStatus] : null);
      let progresso = parsePct(idxPct >= 0 ? row[idxPct] : null);
      if (status === "concluida" && progresso === 0) progresso = 100;

      ncs.push({
        numero: Math.round(numero),
        area: areaNome,
        descricao,
        recomendacao: idxRec >= 0 ? str(row[idxRec]) : null,
        prioridade: clampPrioridade(toNumber(idxP >= 0 ? row[idxP] : null) ?? 3),
        responsavel: idxResp >= 0 ? str(row[idxResp]) : null,
        status,
        progresso,
        prazo: idxPrazo >= 0 ? parseDateCell(row[idxPrazo]) : null,
        tipo_execucao: norm(idxInvest >= 0 ? row[idxInvest] : null).startsWith("sim")
          ? "investimento"
          : "os",
        custo_planejado: parseMoney(idxCustoPlan >= 0 ? row[idxCustoPlan] : null),
        custo_realizado: parseMoney(idxCustoReal >= 0 ? row[idxCustoReal] : null),
        situacao_atual: idxSituacao >= 0 ? str(row[idxSituacao]) : null,
      });
      countArea++;
    }

    if (countArea > 0) {
      areas.push({ nome: areaNome, ordem: ordem++, ncs: countArea });
    } else {
      avisos.push(`Aba "${sheetName}" tem cabeçalho de plano de ação mas nenhuma NC válida.`);
    }
  }

  return { areas, ncs, avisos };
}

// ── Contagem de NCs por relatório ─────────────────────────────────────────────

function useRtiNcCount(reportId: string) {
  return useQuery({
    queryKey: ["rti_ncs_count", reportId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("rti_ncs")
        .select("*", { count: "exact", head: true })
        .eq("report_id", reportId);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

// ── Página ────────────────────────────────────────────────────────────────────

function RtiImportarPage() {
  const auth = useAuth();
  const { user, currentOrgId } = auth;
  const { canEdit, canAdmin: canDelete } = getRtiCampoAccess(auth);
  const navigate = useNavigate();
  const { data: reports = [], isLoading: loadingReports } = useRtiReports();
  const deleteReport = useDeleteRtiReport();
  const upsertReport = useUpsertRtiReport();

  // Metadados do relatório
  const [titulo, setTitulo] = useState(`RTI ${new Date().getFullYear()}`);
  const [empresaAuditora, setEmpresaAuditora] = useState("");
  const [responsavelAuditoria, setResponsavelAuditoria] = useState("");
  const [responsavelPlano, setResponsavelPlano] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");

  // Planilha
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const actorId = user?.id ?? null;
  const actorName =
    (user?.user_metadata?.display_name as string | undefined) || user?.email?.split("@")[0] || null;

  if (auth.currentOrg?.is_root) {
    return (
      <PageShell>
        <Card className="mt-8">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            A organização <strong className="text-foreground">{auth.currentOrg.nome}</strong> é a
            plataforma e não recebe RTIs. Selecione uma organização cliente ou consultoria no menu
            superior.
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (!canEdit) {
    return (
      <PageShell>
        <Card className="mt-8">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Você não tem permissão para importar planilhas do RTI nesta empresa.
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  async function onFile(file: File | null) {
    setParsed(null);
    setFileName(file?.name ?? null);
    if (!file) return;
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const result = parseWorkbook(wb);
      if (result.ncs.length === 0) {
        toast.error(
          "Nenhuma NC encontrada. Verifique se a planilha segue o modelo do plano de ação (abas por área).",
        );
        setParsed(null);
        return;
      }
      setParsed(result);
      toast.success(`${result.ncs.length} NCs encontradas em ${result.areas.length} áreas.`);
    } catch (e) {
      toast.error("Falha ao ler a planilha: " + (e as Error).message);
    } finally {
      setParsing(false);
    }
  }

  async function importar() {
    if (!parsed) return;
    if (!titulo.trim()) return toast.error("Informe o título do relatório.");
    setImporting(true);
    setProgress({ done: 0, total: parsed.ncs.length });
    try {
      await batchImportRti({
        report: {
          titulo: titulo.trim(),
          empresa_auditora: empresaAuditora.trim() || null,
          responsavel_auditoria: responsavelAuditoria.trim() || null,
          responsavel_plano: responsavelPlano.trim() || null,
          periodo_inicio: periodoInicio || null,
          periodo_fim: periodoFim || null,
          created_by: actorId,
          created_by_name: actorName,
        },
        areas: parsed.areas.map(({ nome, ordem }) => ({ nome, ordem })),
        ncs: parsed.ncs,
        orgId: currentOrgId,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      toast.success(`Plano de ação importado: ${parsed.ncs.length} NCs.`);
      navigate({ to: "/rti" });
    } catch (e) {
      toast.error("Falha na importação: " + (e as Error).message);
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }

  async function criarVazio() {
    if (!titulo.trim()) return toast.error("Informe o título do relatório.");
    try {
      await upsertReport.mutateAsync({
        titulo: titulo.trim(),
        empresa_auditora: empresaAuditora.trim() || null,
        responsavel_auditoria: responsavelAuditoria.trim() || null,
        responsavel_plano: responsavelPlano.trim() || null,
        periodo_inicio: periodoInicio || null,
        periodo_fim: periodoFim || null,
        report_path: null,
        notes: null,
        created_by: actorId,
        created_by_name: actorName,
      });
      toast.success("Relatório criado. Adicione NCs pelo Plano de Ação.");
      navigate({ to: "/rti" });
    } catch (e) {
      toast.error("Falha ao criar: " + (e as Error).message);
    }
  }

  async function excluirRelatorio(id: string, tituloRel: string) {
    if (
      !window.confirm(
        `Excluir o relatório "${tituloRel}"?\n\nTODAS as NCs, evidências e histórico vinculados serão excluídos permanentemente.`,
      )
    )
      return;
    try {
      await deleteReport.mutateAsync(id);
      toast.success("Relatório excluído.");
    } catch (e) {
      toast.error("Falha ao excluir: " + (e as Error).message);
    }
  }

  const resumoPrioridades = parsed
    ? parsed.ncs.reduce<Record<number, number>>((acc, nc) => {
        acc[nc.prioridade] = (acc[nc.prioridade] ?? 0) + 1;
        return acc;
      }, {})
    : null;
  const custoTotal = parsed ? parsed.ncs.reduce((s, nc) => s + (nc.custo_planejado ?? 0), 0) : 0;

  return (
    <PageShell>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
          <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
          Novo RTI
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Importe a planilha do plano de ação (uma aba por área auditada) ou crie um relatório em
          branco.
        </p>
      </div>

      {/* Relatórios existentes */}
      <Card className="mt-5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Relatórios cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingReports ? (
            <div className="p-4">
              <Skeleton className="h-10" />
            </div>
          ) : reports.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhum relatório ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Período da auditoria</TableHead>
                  <TableHead>Auditora</TableHead>
                  <TableHead className="text-right">NCs</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <ReportRow
                    key={r.id}
                    report={r}
                    canDelete={canDelete}
                    onDelete={() => excluirRelatorio(r.id, r.titulo)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Novo relatório */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Novo relatório de inspeção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="imp-titulo">Título do relatório *</Label>
              <Input
                id="imp-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={200}
                placeholder="Ex.: Plano de Ação RTI 2025 — Inspeção das Instalações Elétricas"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-auditora">Empresa auditora</Label>
              <Input
                id="imp-auditora"
                value={empresaAuditora}
                onChange={(e) => setEmpresaAuditora(e.target.value)}
                maxLength={150}
                placeholder="Ex.: Empresa"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-resp-aud">Responsável pela auditoria</Label>
              <Input
                id="imp-resp-aud"
                value={responsavelAuditoria}
                onChange={(e) => setResponsavelAuditoria(e.target.value)}
                maxLength={150}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-resp-plano">Responsável pelo plano de ação</Label>
              <Input
                id="imp-resp-plano"
                value={responsavelPlano}
                onChange={(e) => setResponsavelPlano(e.target.value)}
                maxLength={150}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="imp-ini">Início da auditoria</Label>
                <Input
                  id="imp-ini"
                  type="date"
                  value={periodoInicio}
                  onChange={(e) => setPeriodoInicio(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="imp-fim">Fim da auditoria</Label>
                <Input
                  id="imp-fim"
                  type="date"
                  value={periodoFim}
                  onChange={(e) => setPeriodoFim(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-dashed bg-muted/20 p-4">
            <Label htmlFor="imp-file" className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4" /> Planilha do plano de ação (.xlsx)
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              O sistema lê automaticamente todas as abas de área (cabeçalho com NC, Não
              Conformidade, Recomendação, P, Status...). Abas de capa, resumos e gráficos são
              ignoradas.
            </p>
            <Input
              id="imp-file"
              type="file"
              className="mt-2"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              disabled={parsing || importing}
            />
            {parsing && (
              <p className="mt-2 text-xs text-muted-foreground">Analisando planilha...</p>
            )}
          </div>

          {/* Preview da importação */}
          {parsed && (
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {fileName} — pronto para importar
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="text-xl font-bold tabular-nums">{parsed.ncs.length}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    NCs
                  </div>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="text-xl font-bold tabular-nums">{parsed.areas.length}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Áreas
                  </div>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="text-xl font-bold tabular-nums">
                    {resumoPrioridades
                      ? [4, 3, 2, 1]
                          .map((p) =>
                            resumoPrioridades[p] ? `${resumoPrioridades[p]} P${p}` : null,
                          )
                          .filter(Boolean)
                          .slice(0, 2)
                          .join(" · ")
                      : "—"}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Mais graves
                  </div>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="text-xl font-bold tabular-nums">{formatBRL(custoTotal)}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Custo planejado
                  </div>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Área</th>
                      <th className="px-3 py-1.5 text-right font-medium">NCs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.areas.map((a) => (
                      <tr key={a.nome} className="border-t">
                        <td className="px-3 py-1.5">{a.nome}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{a.ncs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parsed.avisos.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Avisos ({parsed.avisos.length})
                  </div>
                  <ul className="list-disc pl-4 max-h-24 overflow-y-auto">
                    {parsed.avisos.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {progress && (
                <div className="space-y-1">
                  <Progress value={(progress.done / progress.total) * 100} className="h-2" />
                  <p className="text-[11px] text-muted-foreground text-center">
                    Importando {progress.done} de {progress.total} NCs...
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={criarVazio} disabled={importing || parsing}>
              <Plus className="h-4 w-4" /> Criar relatório sem planilha
            </Button>
            <Button
              onClick={importar}
              disabled={!parsed || importing || parsing}
              className="bg-brand-gradient text-white shadow-brand"
            >
              <Upload className="h-4 w-4" />
              {importing
                ? "Importando..."
                : parsed
                  ? `Importar ${parsed.ncs.length} NCs`
                  : "Importar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function ReportRow({
  report,
  canDelete,
  onDelete,
}: {
  report: {
    id: string;
    titulo: string;
    periodo_inicio: string | null;
    periodo_fim: string | null;
    empresa_auditora: string | null;
  };
  canDelete: boolean;
  onDelete: () => void;
}) {
  const { data: count } = useRtiNcCount(report.id);
  return (
    <TableRow>
      <TableCell className="font-medium max-w-[280px]">
        <Link
          to="/rti/plano"
          search={{ report: report.id }}
          className="hover:underline block truncate"
          title={report.titulo}
        >
          {report.titulo}
        </Link>
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm">
        {report.periodo_inicio ? (
          <>
            {formatDatePtBR(report.periodo_inicio)}
            {report.periodo_fim ? ` a ${formatDatePtBR(report.periodo_fim)}` : ""}
          </>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-sm">{report.empresa_auditora ?? "—"}</TableCell>
      <TableCell className="text-right tabular-nums">{count ?? "..."}</TableCell>
      <TableCell className="text-right">
        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive"
            onClick={onDelete}
            title="Excluir relatório"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
