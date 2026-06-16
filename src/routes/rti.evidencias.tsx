import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  CheckCheck,
  CheckCircle2,
  FolderOpen,
  ImagePlus,
  Images,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { RTI_EVIDENCIA_TIPO_LABELS, type RtiEvidenciaTipo, type RtiNc } from "@/lib/rti";
import {
  uploadRtiFile,
  useRtiEvidenciaFileIndex,
  useRtiNcs,
  useRtiReports,
} from "@/lib/rti-queries";

export const Route = createFileRoute("/rti/evidencias")({
  component: RtiEvidenciasMassaPage,
  head: () => ({ meta: [{ title: "Importar Evidências — RTI — Gestão NR-10" }] }),
});

/** Extrai um nº de NC de um texto. Prioriza "NC 123"; senão, primeiro número isolado de 1–4 dígitos (ignora anos 19xx/20xx). */
function extractNumeroFromText(text: string): number | null {
  const nc = text.match(/nc[\s_\-.]*(\d{1,4})/i);
  if (nc) return Number(nc[1]);
  for (const m of text.matchAll(/(?<!\d)(\d{1,4})(?!\d)/g)) {
    if (m[1].length === 4 && (m[1].startsWith("19") || m[1].startsWith("20"))) continue;
    return Number(m[1]);
  }
  return null;
}

/**
 * Identifica a NC do arquivo: primeiro pelas subpastas (da mais próxima do
 * arquivo para a raiz — ex.: "Evidências/NC 123/foto 2.jpg" → 123), depois
 * pelo nome do próprio arquivo.
 */
function extractNcNumero(file: File): number | null {
  const rel = file.webkitRelativePath || "";
  if (rel) {
    const pastas = rel.split("/").slice(0, -1);
    for (let i = pastas.length - 1; i >= 0; i--) {
      const n = extractNumeroFromText(pastas[i]);
      if (n != null) return n;
    }
  }
  return extractNumeroFromText(file.name.replace(/\.[^.]+$/, ""));
}

/** Nome de exibição/registro: caminho relativo quando veio de pasta, senão o nome simples. */
function fileRelName(file: File): string {
  return file.webkitRelativePath || file.name;
}

type FileRow = {
  key: string;
  file: File;
  numero: number | null;
};

function RtiEvidenciasMassaPage() {
  const { isStaff, hasOrgRole, user } = useAuth();
  // Gate de UI: papel operacional na org ativa (ou staff legado). RLS é a verdade.
  const canEdit = isStaff || hasOrgRole("member");
  const qc = useQueryClient();
  const { data: reports = [] } = useRtiReports();

  const [reportId, setReportId] = useState<string | null>(null);
  const activeReport = reports.find((r) => r.id === reportId) ?? reports[0] ?? null;

  const { data: ncs = [] } = useRtiNcs(activeReport?.id);
  const { data: fileIndex } = useRtiEvidenciaFileIndex(activeReport?.id);

  const [tipo, setTipo] = useState<RtiEvidenciaTipo>("constatacao");
  const [rows, setRows] = useState<FileRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<{ ok: number; ncsAfetadas: number } | null>(null);

  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const actorName =
    (user?.user_metadata?.display_name as string | undefined) || user?.email?.split("@")[0] || null;

  const ncByNumero = useMemo(() => new Map(ncs.map((nc) => [nc.numero, nc])), [ncs]);

  type RowStatus = "ok" | "sem_numero" | "nc_inexistente" | "ja_importada" | "arquivo_invalido";

  function rowStatus(row: FileRow): { status: RowStatus; nc: RtiNc | null } {
    const okTipo = row.file.type.startsWith("image/") || row.file.type === "application/pdf";
    if (!okTipo || row.file.size > 15 * 1024 * 1024)
      return { status: "arquivo_invalido", nc: null };
    if (row.numero == null) return { status: "sem_numero", nc: null };
    const nc = ncByNumero.get(row.numero) ?? null;
    if (!nc) return { status: "nc_inexistente", nc: null };
    if (fileIndex?.has(`${nc.id}|${tipo}|${fileRelName(row.file)}`))
      return { status: "ja_importada", nc };
    return { status: "ok", nc };
  }

  const analise = useMemo(() => {
    const out = rows.map((r) => ({ row: r, ...rowStatus(r) }));
    const ok = out.filter((r) => r.status === "ok");
    return {
      out,
      ok,
      ncsDistintas: new Set(ok.map((r) => r.nc!.id)).size,
      problemas: out.filter(
        (r) =>
          r.status === "sem_numero" ||
          r.status === "nc_inexistente" ||
          r.status === "arquivo_invalido",
      ).length,
      jaImportadas: out.filter((r) => r.status === "ja_importada").length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ncByNumero, fileIndex, tipo]);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setResultado(null);
    setRows((prev) => {
      const existing = new Set(prev.map((r) => `${fileRelName(r.file)}|${r.file.size}`));
      const novos: FileRow[] = [];
      for (const f of [...list]) {
        if (existing.has(`${fileRelName(f)}|${f.size}`)) continue;
        novos.push({ key: crypto.randomUUID(), file: f, numero: extractNcNumero(f) });
      }
      return [...prev, ...novos];
    });
    if (filesRef.current) filesRef.current.value = "";
    if (folderRef.current) folderRef.current.value = "";
  }

  function setNumero(key: string, numero: number | null) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, numero } : r)));
  }

  async function importar() {
    if (!activeReport || analise.ok.length === 0) return;
    setImporting(true);
    setProgress({ done: 0, total: analise.ok.length });
    const porNc = new Map<string, number>();
    let done = 0;
    try {
      for (const item of analise.ok) {
        const nc = item.nc!;
        const path = await uploadRtiFile(item.row.file, `nc-${nc.numero}`);
        const { error } = await supabase.from("rti_nc_evidencias").insert({
          nc_id: nc.id,
          tipo,
          file_path: path,
          file_name: fileRelName(item.row.file),
          mime_type: item.row.file.type || null,
          descricao: null,
          created_by_name: actorName,
        });
        if (error) throw error;
        porNc.set(nc.id, (porNc.get(nc.id) ?? 0) + 1);
        done++;
        setProgress({ done, total: analise.ok.length });
      }

      // Histórico: uma entrada por NC afetada
      const histRows = [...porNc.entries()].map(([nc_id, n]) => ({
        nc_id,
        tipo: "alteracao" as const,
        texto: `${n} ${n === 1 ? "evidência importada" : "evidências importadas"} em massa (${RTI_EVIDENCIA_TIPO_LABELS[tipo].toLowerCase()})`,
        autor_nome: actorName,
      }));
      for (let i = 0; i < histRows.length; i += 200) {
        await supabase.from("rti_nc_historico").insert(histRows.slice(i, i + 200));
      }

      qc.invalidateQueries({ queryKey: ["rti_nc_evidencias"] });
      qc.invalidateQueries({ queryKey: ["rti_nc_evidencias_index"] });
      qc.invalidateQueries({ queryKey: ["rti_nc_evidencias_files"] });
      qc.invalidateQueries({ queryKey: ["rti_nc_historico"] });

      setResultado({ ok: done, ncsAfetadas: porNc.size });
      setRows([]);
      toast.success(`${done} evidências importadas em ${porNc.size} NCs.`);
    } catch (e) {
      qc.invalidateQueries({ queryKey: ["rti_nc_evidencias"] });
      qc.invalidateQueries({ queryKey: ["rti_nc_evidencias_files"] });
      toast.error(`Falha após ${done} envios: ` + (e as Error).message);
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }

  if (!canEdit) {
    return (
      <PageShell>
        <Card className="mt-8">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Você não tem permissão para importar evidências nesta empresa.
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const statusBadge: Record<RowStatus, { cls: string; label: string }> = {
    ok: { cls: "border-emerald-300 bg-emerald-50 text-emerald-700", label: "Pronta" },
    sem_numero: { cls: "border-amber-300 bg-amber-50 text-amber-700", label: "Sem nº de NC" },
    nc_inexistente: { cls: "border-red-300 bg-red-50 text-red-700", label: "NC não existe" },
    ja_importada: { cls: "border-slate-300 bg-slate-50 text-slate-600", label: "Já importada" },
    arquivo_invalido: {
      cls: "border-red-300 bg-red-50 text-red-700",
      label: "Inválido (>15MB ou tipo)",
    },
  };

  return (
    <PageShell>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
          <Images className="h-5 w-5 shrink-0 text-primary" />
          RTI — Importar Evidências em Massa
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Selecione uma pasta inteira — o sistema identifica a NC pelo nome da{" "}
          <strong>subpasta</strong> (ex.:{" "}
          <code className="text-[11px] bg-muted px-1 rounded">NC 123/foto 1.jpg</code>,{" "}
          <code className="text-[11px] bg-muted px-1 rounded">Evidências/045/IMG_001.jpg</code>) ou,
          se não houver pasta numerada, pelo nome do arquivo (
          <code className="text-[11px] bg-muted px-1 rounded">NC 123.jpg</code>,{" "}
          <code className="text-[11px] bg-muted px-1 rounded">123-2.png</code>).
        </p>
      </div>

      {/* Configuração */}
      <Card className="mt-5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">1. Destino das evidências</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          {reports.length > 1 && (
            <div className="space-y-1.5">
              <Label>Relatório</Label>
              <Select
                value={activeReport?.id ?? ""}
                onValueChange={(v) => {
                  setReportId(v);
                  setRows([]);
                }}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Relatório" />
                </SelectTrigger>
                <SelectContent>
                  {reports.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Tipo de evidência</Label>
            <RadioGroup
              value={tipo}
              onValueChange={(v) => setTipo(v as RtiEvidenciaTipo)}
              className="flex gap-4 pt-1"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="constatacao" id="ev-const" />
                <Camera className="h-4 w-4 text-primary" /> Constatação da NC (foto do problema)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="correcao" id="ev-corr" />
                <CheckCheck className="h-4 w-4 text-emerald-600" /> Correção (foto do depois)
              </label>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Seleção de arquivos */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">2. Arquivos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              ref={filesRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <input
              ref={folderRef}
              type="file"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
              {...({ webkitdirectory: "" } as object)}
            />
            <Button
              variant="outline"
              onClick={() => filesRef.current?.click()}
              disabled={importing || !activeReport}
            >
              <ImagePlus className="h-4 w-4" /> Selecionar arquivos
            </Button>
            <Button
              variant="outline"
              onClick={() => folderRef.current?.click()}
              disabled={importing || !activeReport}
            >
              <FolderOpen className="h-4 w-4" /> Selecionar pasta inteira
            </Button>
            {rows.length > 0 && (
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setRows([])}
                disabled={importing}
              >
                <X className="h-4 w-4" /> Limpar lista
              </Button>
            )}
          </div>

          {!activeReport && (
            <p className="text-xs text-muted-foreground">
              Cadastre um relatório primeiro (RTI → Importar planilha).
            </p>
          )}

          {resultado && (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {resultado.ok} evidências importadas em {resultado.ncsAfetadas} NCs.{" "}
              <Link
                to="/rti/plano"
                search={{ report: activeReport?.id }}
                className="underline font-medium"
              >
                Ver plano de ação
              </Link>
            </div>
          )}

          {rows.length > 0 && (
            <>
              {/* Resumo */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-700 px-2.5 py-1 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {analise.ok.length} prontas →{" "}
                  {analise.ncsDistintas} NCs
                </span>
                {analise.problemas > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 text-amber-700 px-2.5 py-1 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5" /> {analise.problemas} com problema
                    (corrija o nº abaixo)
                  </span>
                )}
                {analise.jaImportadas > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 text-slate-600 px-2.5 py-1 font-semibold">
                    {analise.jaImportadas} já importadas (ignoradas)
                  </span>
                )}
              </div>

              {/* Tabela de mapeamento */}
              <div className="max-h-[420px] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead className="w-24">Nº NC</TableHead>
                      <TableHead>NC identificada</TableHead>
                      <TableHead className="w-36">Situação</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analise.out.map(({ row, status, nc }) => (
                      <TableRow key={row.key}>
                        <TableCell className="max-w-[260px]">
                          <div className="truncate text-sm" title={fileRelName(row.file)}>
                            {row.file.name}
                          </div>
                          <div
                            className="truncate text-[10px] text-muted-foreground"
                            title={fileRelName(row.file)}
                          >
                            {row.file.webkitRelativePath
                              ? row.file.webkitRelativePath.split("/").slice(0, -1).join(" / ")
                              : `${(row.file.size / 1024).toFixed(0)} KB`}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            className="h-7 w-20 text-xs tabular-nums"
                            value={row.numero ?? ""}
                            onChange={(e) =>
                              setNumero(
                                row.key,
                                e.target.value === "" ? null : Number(e.target.value),
                              )
                            }
                            disabled={importing}
                          />
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          {nc ? (
                            <div
                              className="text-xs leading-snug line-clamp-2 text-muted-foreground"
                              title={nc.descricao}
                            >
                              {nc.descricao}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${statusBadge[status].cls}`}
                          >
                            {statusBadge[status].label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground"
                            onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                            disabled={importing}
                            title="Remover da lista"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {progress && (
                <div className="space-y-1">
                  <Progress value={(progress.done / progress.total) * 100} className="h-2" />
                  <p className="text-[11px] text-muted-foreground text-center">
                    Enviando {progress.done} de {progress.total} arquivos... não feche esta aba.
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={importar}
                  disabled={importing || analise.ok.length === 0}
                  className="bg-brand-gradient text-white shadow-brand"
                >
                  <Upload className="h-4 w-4" />
                  {importing
                    ? "Importando..."
                    : `Importar ${analise.ok.length} ${analise.ok.length === 1 ? "evidência" : "evidências"} (${RTI_EVIDENCIA_TIPO_LABELS[tipo]})`}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
