import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, CheckCircle2, Download } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { batchImportQualificacoes } from "@/lib/qualificacoes-queries";
import { excelSerialToISO } from "@/lib/qualificacoes";

export const Route = createFileRoute("/admin/qualificacoes/carga")({
  component: QualificacoesCargaPage,
  head: () => ({ meta: [{ title: "Importar Planilha — Qualificações" }] }),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseExcelDate(val: unknown): string | null {
  if (val == null || val === "") return null;
  if (typeof val === "number") {
    if (val < 1 || !isFinite(val)) return null;
    try {
      return excelSerialToISO(val);
    } catch {
      return null;
    }
  }
  if (typeof val === "string" && val.trim()) {
    const iso = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    const parts = iso.split("/");
    if (parts.length === 3)
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return null;
}

function strOrNull(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  return s ? s : null;
}

/** true se a data ISO é posterior a hoje (conclusão no futuro = inválida). */
function isFutureISO(iso: string | null, hoje: string): boolean {
  return iso != null && iso > hoje;
}

// ── Parsed result type ────────────────────────────────────────────────────────

type ParsedData = {
  employees: Parameters<typeof batchImportQualificacoes>[0]["employees"];
  nr10Trainings: Parameters<typeof batchImportQualificacoes>[0]["nr10Trainings"];
  authorizations: Parameters<typeof batchImportQualificacoes>[0]["authorizations"];
  instructions: Parameters<typeof batchImportQualificacoes>[0]["instructions"];
  itTrainings: Parameters<typeof batchImportQualificacoes>[0]["itTrainings"];
  /** nº de datas de conclusão futuras descartadas na leitura (não permitidas). */
  futureConclusoes: number;
};

// ── Parser ────────────────────────────────────────────────────────────────────

function parseWorkbook(wb: XLSX.WorkBook): ParsedData {
  const employees: ParsedData["employees"] = [];
  const nr10Trainings: ParsedData["nr10Trainings"] = [];
  const authorizations: ParsedData["authorizations"] = [];
  const itTrainings: ParsedData["itTrainings"] = [];
  const instructionMap = new Map<string, true>();
  const hoje = new Date().toISOString().slice(0, 10);
  let futureConclusoes = 0;

  // ── Sheet "Escolaridade" ──────────────────────────────────────────────────
  const escSheet = wb.Sheets["Escolaridade"];
  if (escSheet) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(escSheet, {
      header: 1,
      defval: null,
    });

    // header row index 5, data starts at index 6
    for (let i = 6; i < rows.length; i++) {
      const row = rows[i] as unknown[];

      const name = strOrNull(row[1]);
      const matricula = strOrNull(row[2]);
      if (!name || !matricula) continue;

      const setor = strOrNull(row[3]);
      const classificacao = strOrNull(row[4]);
      const funcao = strOrNull(row[5]);
      const escolaridade = strOrNull(row[6]);
      const diploma = strOrNull(row[7]);
      let diploma_conclusao = parseExcelDate(row[8]);
      if (isFutureISO(diploma_conclusao, hoje)) {
        diploma_conclusao = null;
        futureConclusoes++;
      }
      const crea_cft = strOrNull(row[35]);

      employees.push({
        name,
        matricula,
        setor,
        classificacao,
        funcao,
        escolaridade,
        diploma,
        diploma_conclusao,
        crea_cft,
        active: true,
      });

      // NR-10 Básico — formação (col 9) and reciclagem (col 12)
      const nr10BasicoFormDate = parseExcelDate(row[9]);
      if (nr10BasicoFormDate) {
        nr10Trainings.push({
          matricula,
          training_type: "nr10_basico",
          category: "formacao",
          training_date: nr10BasicoFormDate,
          art: strOrNull(row[10]),
          responsavel_tecnico: strOrNull(row[11]),
          valid:
            String(row[15] ?? "")
              .trim()
              .toLowerCase() === "sim",
        });
      }

      const nr10BasicoRecDate = parseExcelDate(row[12]);
      if (nr10BasicoRecDate) {
        nr10Trainings.push({
          matricula,
          training_type: "nr10_basico",
          category: "reciclagem",
          training_date: nr10BasicoRecDate,
          art: strOrNull(row[13]),
          responsavel_tecnico: strOrNull(row[14]),
          valid:
            String(row[15] ?? "")
              .trim()
              .toLowerCase() === "sim",
        });
      }

      // NR-10 Áreas Classificadas — formação (col 16) and reciclagem (col 19)
      const acFormDate = parseExcelDate(row[16]);
      if (acFormDate) {
        nr10Trainings.push({
          matricula,
          training_type: "nr10_areas_classificadas",
          category: "formacao",
          training_date: acFormDate,
          art: strOrNull(row[17]),
          responsavel_tecnico: strOrNull(row[18]),
          valid:
            String(row[22] ?? "")
              .trim()
              .toLowerCase() === "sim",
        });
      }

      const acRecDate = parseExcelDate(row[19]);
      if (acRecDate) {
        nr10Trainings.push({
          matricula,
          training_type: "nr10_areas_classificadas",
          category: "reciclagem",
          training_date: acRecDate,
          art: strOrNull(row[20]),
          responsavel_tecnico: strOrNull(row[21]),
          valid:
            String(row[22] ?? "")
              .trim()
              .toLowerCase() === "sim",
        });
      }

      // SEP — formação (col 23) and reciclagem (col 26)
      const sepFormDate = parseExcelDate(row[23]);
      if (sepFormDate) {
        nr10Trainings.push({
          matricula,
          training_type: "sep",
          category: "formacao",
          training_date: sepFormDate,
          art: strOrNull(row[24]),
          responsavel_tecnico: strOrNull(row[25]),
          valid:
            String(row[29] ?? "")
              .trim()
              .toLowerCase() === "sim",
        });
      }

      const sepRecDate = parseExcelDate(row[26]);
      if (sepRecDate) {
        nr10Trainings.push({
          matricula,
          training_type: "sep",
          category: "reciclagem",
          training_date: sepRecDate,
          art: strOrNull(row[27]),
          responsavel_tecnico: strOrNull(row[28]),
          valid:
            String(row[29] ?? "")
              .trim()
              .toLowerCase() === "sim",
        });
      }

      // Work Authorization — only if level is A0–A4
      const authLevel = strOrNull(row[31]);
      const validLevels = ["A0", "A1", "A2", "A3", "A4"];
      if (authLevel && validLevels.includes(authLevel)) {
        authorizations.push({
          matricula,
          level: authLevel as "A0" | "A1" | "A2" | "A3" | "A4",
          funcao: strOrNull(row[32]),
          abrangencia: strOrNull(row[33]),
          authorization_date: parseExcelDate(row[30]),
          valid:
            String(row[34] ?? "")
              .trim()
              .toLowerCase() === "sim",
        });
      }
    }
  }

  // ── Sheet "IT" ─────────────────────────────────────────────────────────────
  const itSheet = wb.Sheets["IT"];
  if (itSheet) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(itSheet, {
      header: 1,
      defval: null,
    });

    // Read IT codes from header row (index 5) starting at col 4, every 2 cols
    const headerRow = (rows[5] ?? []) as unknown[];
    const itCodes: string[] = [];
    let colIdx = 4;
    while (colIdx < headerRow.length) {
      const code = strOrNull(headerRow[colIdx]);
      if (!code) break;
      itCodes.push(code);
      if (!instructionMap.has(code)) {
        instructionMap.set(code, true);
      }
      colIdx += 2;
    }

    // Data rows start at index 6
    for (let i = 6; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      const matricula = strOrNull(row[2]);
      if (!matricula) continue;

      for (let j = 0; j < itCodes.length; j++) {
        const statusRaw = strOrNull(row[4 + j * 2]);
        if (!statusRaw) continue;

        const upper = statusRaw.toUpperCase();
        const status = upper === "OK" ? "ok" : upper === "VENCIDO" ? "vencido" : "pendente";

        let conclusao_date = parseExcelDate(row[4 + j * 2 + 1]);
        if (isFutureISO(conclusao_date, hoje)) {
          conclusao_date = null;
          futureConclusoes++;
        }

        itTrainings.push({
          matricula,
          instructionCode: itCodes[j],
          status,
          conclusao_date,
        });
      }
    }
  }

  // Build instructions array from discovered IT codes
  const instructions: ParsedData["instructions"] = Array.from(instructionMap.keys()).map(
    (code) => ({
      code,
      title: null,
      validity_months: 24,
    }),
  );

  return { employees, nr10Trainings, authorizations, instructions, itTrainings, futureConclusoes };
}

// ── Template download ─────────────────────────────────────────────────────────

function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  // Sheet "Escolaridade" — header at row index 5 (row 6 in Excel)
  const escHeaders = [
    "",
    "Nome",
    "Matrícula",
    "Setor",
    "Classificação",
    "Função",
    "Escolaridade",
    "Diploma",
    "Conclusão Diploma",
    "NR-10B Form.Data",
    "NR-10B Form.ART",
    "NR-10B Form.Resp",
    "NR-10B Recic.Data",
    "NR-10B Recic.ART",
    "NR-10B Recic.Resp",
    "NR-10B Válido",
    "NR-10AC Form.Data",
    "NR-10AC Form.ART",
    "NR-10AC Form.Resp",
    "NR-10AC Recic.Data",
    "NR-10AC Recic.ART",
    "NR-10AC Recic.Resp",
    "NR-10AC Válido",
    "SEP Form.Data",
    "SEP Form.ART",
    "SEP Form.Resp",
    "SEP Recic.Data",
    "SEP Recic.ART",
    "SEP Recic.Resp",
    "SEP Válido",
    "Aut.Data",
    "Aut.Nível",
    "Aut.Função",
    "Aut.Abrangência",
    "Aut.Válido",
    "CREA/CFT",
  ];
  // Pad 5 empty rows before the header row
  const escData: unknown[][] = [[], [], [], [], [], escHeaders];
  const escSheet = XLSX.utils.aoa_to_sheet(escData);
  XLSX.utils.book_append_sheet(wb, escSheet, "Escolaridade");

  // Sheet "IT" — header at row index 5, data starts at col D (index 3)
  const itHeaders = [
    "",
    "",
    "",
    "Matrícula",
    "Setor",
    "IT001.Status",
    "IT001.Conclusão",
    "IT002.Status",
    "IT002.Conclusão",
  ];
  const itData: unknown[][] = [[], [], [], [], [], itHeaders];
  const itSheet = XLSX.utils.aoa_to_sheet(itData);
  XLSX.utils.book_append_sheet(wb, itSheet, "IT");

  XLSX.writeFile(wb, "modelo_qualificacoes.xlsx");
}

// ── Component ─────────────────────────────────────────────────────────────────

function QualificacoesCargaPage() {
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const result = parseWorkbook(wb);
      setParsed(result);
      setDone(false);
      if (result.employees.length === 0) {
        toast.warning("Nenhum colaborador encontrado na planilha.");
      } else {
        toast.success(`${result.employees.length} colaborador(es) lido(s) com sucesso.`);
      }
      if (result.futureConclusoes > 0) {
        toast.warning(
          `${result.futureConclusoes} data(s) de conclusão no futuro foram ignoradas (não permitidas).`,
        );
      }
    } catch (err) {
      toast.error(`Falha ao ler planilha: ${(err as Error).message}`);
    }
  }

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);
    try {
      await batchImportQualificacoes(parsed);
      setDone(true);
      toast.success("Importação concluída com sucesso!");
    } catch (err) {
      toast.error(`Erro na importação: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Importar Planilha — Qualificações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Carregue o arquivo{" "}
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
              Qualificacao Treinamentos 240730.xlsx
            </code>{" "}
            para importar colaboradores, treinamentos NR-10, autorizações de trabalho e conclusões
            de IT.
          </p>
        </div>

        {/* Drop zone + template button row */}
        <div className="flex flex-col gap-3">
          <Card
            className="border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => inputRef.current?.click()}
          >
            <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <FileSpreadsheet className="h-10 w-10" />
              <p className="text-sm font-medium">Clique para selecionar o arquivo Excel</p>
              <p className="text-xs">.xlsx ou .xls</p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setTimeout(downloadTemplate, 0)}>
              <Download className="h-4 w-4" />
              Baixar Modelo
            </Button>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />

        {/* Preview */}
        {parsed && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{parsed.employees.length} colaboradores</Badge>
              <Badge variant="secondary">{parsed.nr10Trainings.length} registros NR-10</Badge>
              <Badge variant="secondary">{parsed.authorizations.length} autorizações</Badge>
              <Badge variant="secondary">{parsed.instructions.length} ITs</Badge>
              <Badge variant="secondary">{parsed.itTrainings.length} conclusões de IT</Badge>
              {parsed.futureConclusoes > 0 && (
                <Badge variant="destructive">
                  {parsed.futureConclusoes} conclusão(ões) futura(s) ignorada(s)
                </Badge>
              )}
            </div>

            {/* Preview table — first 10 employees */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Nome</th>
                        <th className="text-left px-3 py-2 font-medium">Matrícula</th>
                        <th className="text-left px-3 py-2 font-medium">Setor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsed.employees.slice(0, 10).map((emp) => (
                        <tr key={emp.matricula} className="hover:bg-muted/40">
                          <td className="px-3 py-1.5">{emp.name}</td>
                          <td className="px-3 py-1.5 font-mono">{emp.matricula}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{emp.setor ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.employees.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      … e mais {parsed.employees.length - 10} colaboradores
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Success */}
        {done && (
          <Card className="border-emerald-500/40 bg-emerald-500/5">
            <CardContent className="flex items-center gap-3 py-4 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>Importação concluída! Todos os dados foram salvos com sucesso.</span>
            </CardContent>
          </Card>
        )}

        {/* Import button */}
        <div className="flex justify-end">
          <Button
            onClick={handleImport}
            disabled={!parsed || importing || done}
            className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
          >
            <Upload className="h-4 w-4" />
            {importing ? "Importando…" : "Confirmar Importação"}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
