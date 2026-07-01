import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, ShieldAlert, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { PADLOCK_COLORS, colorLabel, logEvent, type PadlockColor } from "@/lib/padlocks";

export const Route = createFileRoute("/admin/carga")({
  component: AdminCargaPage,
  head: () => ({ meta: [{ title: "Carga — Histórico de cadeados" }] }),
});

/** Linha pronta para inserção (mesmo schema da tabela padlocks, parcial). */
type ParsedRow = {
  rowIndex: number; // linha da planilha (1-based, já incluindo o cabeçalho)
  number: number | null;
  color: PadlockColor | null;
  cancelled: boolean;
  owner_name: string | null;
  owner_registration: string | null;
  owner_role: string | null;
  owner_sector: string | null;
  owner_phone: string | null;
  cancellation_reason: string | null;
  created_at: string | null; // ISO ou null
  warnings: string[];
};

/** Normaliza string de cabeçalho (lowercase, sem acento, sem espaços extras). */
function norm(s: string): string {
  return s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Mapeia o texto da coluna "Cor" da planilha para o enum padlock_color. */
function parseColor(raw: unknown): PadlockColor | null {
  if (raw == null) return null;
  const v = norm(String(raw));
  if (!v) return null;
  if (v.includes("azul")) return "azul";
  if (v.includes("amarelo")) return "amarelo";
  if (v.includes("latao") || v.includes("laton") || v.includes("parceiro")) return "latao";
  if (v.includes("vermelho") || v.includes("equipamento")) return "vermelho";
  // Match direto por enum
  if ((PADLOCK_COLORS as string[]).includes(v)) return v as PadlockColor;
  return null;
}

/** "Cancelado" / "Baixado" => true; "Ativo" / "Em uso" / vazio => false. */
function parseCancelled(raw: unknown): boolean {
  if (raw == null) return false;
  const v = norm(String(raw));
  return v.includes("cancel") || v.includes("baix");
}

/** Aceita Date, número (serial Excel) ou string em pt-BR (dd/mm/aaaa). */
function parseDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw.toISOString();
  if (typeof raw === "number") {
    // Serial Excel — usa o utilitário do XLSX
    const dt = XLSX.SSF.parse_date_code(raw);
    if (!dt) return null;
    const d = new Date(Date.UTC(dt.y, dt.m - 1, dt.d, dt.H ?? 0, dt.M ?? 0, dt.S ?? 0));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const s = String(raw).trim();
  // dd/mm/aaaa ou dd/mm/aa
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const d = parseInt(br[1], 10);
    const m = parseInt(br[2], 10) - 1;
    let y = parseInt(br[3], 10);
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, m, d, 12, 0, 0));
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

function parseNumber(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/\D/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function strOrNull(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s ? s : null;
}

/** Lê a planilha em linhas tipadas + valida o mínimo (Nº e Cor). */
function parseSheet(rows: Record<string, unknown>[]): ParsedRow[] {
  return rows.map((r, idx) => {
    // Re-mapeia chaves do Excel para nomes normalizados
    const map = new Map<string, unknown>();
    for (const k of Object.keys(r)) map.set(norm(k), r[k]);

    const get = (...keys: string[]) => {
      for (const k of keys) {
        const v = map.get(k);
        if (v != null && v !== "") return v;
      }
      return null;
    };

    const number = parseNumber(get("no", "n", "numero", "nº"));
    const color = parseColor(get("cor"));
    const cancelled = parseCancelled(get("status"));
    const owner_name = strOrNull(get("dono"));
    const owner_registration = strOrNull(get("matricula"));
    const owner_role = strOrNull(get("funcao"));
    const owner_sector = strOrNull(get("setor / empresa", "setor/empresa", "setor"));
    const owner_phone = strOrNull(get("telefone"));
    const cancellation_reason = strOrNull(get("motivo cancelamento", "motivo"));
    const created_at = parseDate(get("data registro", "data"));

    const warnings: string[] = [];
    if (number == null) warnings.push("Nº ausente ou inválido");
    if (color == null) warnings.push("Cor não reconhecida");
    if (cancelled && !cancellation_reason) warnings.push("Cancelado sem motivo");

    return {
      rowIndex: idx + 2, // +1 por 0-based, +1 pelo cabeçalho
      number,
      color,
      cancelled,
      owner_name,
      owner_registration,
      owner_role,
      owner_sector,
      owner_phone,
      cancellation_reason,
      created_at,
      warnings,
    };
  });
}

function AdminCargaPage() {
  const { isAdmin, loading, user, currentOrgId } = useAuth();
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    inserted: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const summary = useMemo(() => {
    const total = parsed.length;
    const importable = parsed.filter((p) => p.number != null && p.color != null).length;
    const withWarnings = parsed.filter((p) => p.warnings.length > 0).length;
    return { total, importable, withWarnings };
  }, [parsed]);

  if (loading) {
    return (
      <PageShell>
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </PageShell>
    );
  }
  if (!isAdmin) {
    return (
      <PageShell>
        <div className="text-center py-16">
          <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="mt-3 text-xl font-bold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Apenas Admins podem importar histórico de cadeados.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/dashboard">Voltar</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  async function handleFile(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      });
      const out = parseSheet(rows);
      setParsed(out);
      setFileName(file.name);
      setResult(null);
      if (out.length === 0) toast.warning("Planilha vazia.");
      else toast.success(`${out.length} linha(s) lidas.`);
    } catch (err) {
      toast.error(`Falha ao ler planilha: ${(err as Error).message}`);
    }
  }

  function clearAll() {
    setParsed([]);
    setFileName("");
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function importAll() {
    const importable = parsed.filter((p) => p.number != null && p.color != null);
    if (importable.length === 0) {
      toast.error("Nenhuma linha importável (faltam Nº ou Cor).");
      return;
    }
    setImporting(true);
    let inserted = 0;
    const errors: string[] = [];

    // Insere em lotes de 100 para evitar payload muito grande
    const batches: ParsedRow[][] = [];
    for (let i = 0; i < importable.length; i += 100) batches.push(importable.slice(i, i + 100));

    for (const batch of batches) {
      const payload = batch.map((p) => {
        const code = `${p.color}-${String(p.number).padStart(3, "0")}`;
        return {
          ...(currentOrgId ? { org_id: currentOrgId } : {}),
          code,
          number: p.number!,
          color: p.color!,
          status: "disponivel" as const,
          cancelled: p.cancelled,
          cancellation_reason: p.cancellation_reason,
          cancelled_at: p.cancelled ? p.created_at : null,
          owner_name: p.owner_name,
          owner_registration: p.owner_registration,
          owner_role: p.owner_role,
          owner_sector: p.owner_sector,
          owner_phone: p.owner_phone,
          created_at: p.created_at ?? undefined,
        };
      });

      // upsert por code para tornar a operação idempotente
      const { data, error } = await supabase
        .from("padlocks")
        .upsert(payload as never, { onConflict: "code", ignoreDuplicates: false })
        .select("id, code");

      if (error) {
        errors.push(error.message);
      } else {
        inserted += data?.length ?? 0;
        // Registra no histórico que o cadeado foi criado/atualizado via carga
        const actorName = user?.email ?? "Admin";
        const actorId = user?.id ?? null;
        const fileLabel = fileName || "arquivo externo";
        await Promise.all(
          (data ?? []).map((row) =>
            logEvent({
              padlock_id: row.id,
              padlock_code: row.code,
              action: "created",
              actor_id: actorId,
              actor_name: actorName,
              notes: `Criado por carga de base de dados (arquivo: ${fileLabel})`,
            }),
          ),
        );
      }
    }

    setImporting(false);
    const skipped = parsed.length - inserted;
    setResult({ inserted, skipped, errors });
    if (errors.length === 0) toast.success(`${inserted} cadeado(s) importado(s).`);
    else toast.error(`Importação parcial: ${errors.length} erro(s).`);
  }

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Carga — Histórico de cadeados</h1>
          <p className="text-sm text-muted-foreground">
            Importe um arquivo Excel (.xlsx) com as mesmas colunas do exportado: Nº, Cor, Status,
            Dono, Matrícula, Função, Setor / Empresa, Telefone, Motivo cancelamento e Data registro.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Selecionar arquivo
          </Button>
          {parsed.length > 0 && (
            <Button variant="ghost" onClick={clearAll}>
              <X className="h-4 w-4" /> Limpar
            </Button>
          )}
          {parsed.length > 0 && (
            <Button
              onClick={importAll}
              disabled={importing || summary.importable === 0}
              className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
            >
              <CheckCircle2 className="h-4 w-4" />
              {importing ? "Importando..." : `Importar ${summary.importable}`}
            </Button>
          )}
        </div>
      </div>

      <Card className="mt-6">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{fileName || "Nenhum arquivo selecionado."}</span>
          </div>
          {parsed.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-border bg-secondary px-2 py-0.5">
                Total: <strong>{summary.total}</strong>
              </span>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                Importáveis: <strong>{summary.importable}</strong>
              </span>
              {summary.withWarnings > 0 && (
                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                  Com avisos: <strong>{summary.withWarnings}</strong>
                </span>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Linhas com avisos são importadas se tiverem <strong>Nº</strong> e <strong>Cor</strong>{" "}
            válidos. Os demais campos entram como estão — o Admin pode revisar e editar manualmente
            em{" "}
            <Link to="/cadeados" className="underline">
              Base de dados
            </Link>
            . A importação faz <em>upsert</em> por código (ex.: <code>azul-001</code>): se já
            existir, os dados são atualizados.
          </p>
        </CardContent>
      </Card>

      {result && (
        <Card className="mt-4 border-emerald-500/40 bg-emerald-500/5">
          <CardContent className="p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Resultado da importação
            </div>
            <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
              <li>
                Inseridos / atualizados: <strong>{result.inserted}</strong>
              </li>
              <li>
                Ignorados (sem Nº ou Cor): <strong>{result.skipped}</strong>
              </li>
              {result.errors.length > 0 && (
                <li className="text-destructive">
                  Erros:{" "}
                  {result.errors.map((e, i) => (
                    <span key={i} className="block">
                      • {e}
                    </span>
                  ))}
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {parsed.length > 0 && (
        <Card className="mt-4">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Linha</TableHead>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dono</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Setor / Empresa</TableHead>
                  <TableHead>Avisos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.map((p) => {
                  const importable = p.number != null && p.color != null;
                  return (
                    <TableRow
                      key={p.rowIndex}
                      className={
                        !importable
                          ? "bg-destructive/5"
                          : p.warnings.length > 0
                            ? "bg-amber-500/5"
                            : ""
                      }
                    >
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {p.rowIndex}
                      </TableCell>
                      <TableCell className="font-mono">{p.number ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {p.color ? (
                          colorLabel[p.color]
                        ) : (
                          <span className="text-destructive">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.cancelled ? "Cancelado" : "Ativo"}
                      </TableCell>
                      <TableCell className="text-xs">{p.owner_name ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {p.owner_registration ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">{p.owner_sector ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {p.warnings.length === 0 ? (
                          <span className="text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> ok
                          </span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-300 inline-flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {p.warnings.join("; ")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
