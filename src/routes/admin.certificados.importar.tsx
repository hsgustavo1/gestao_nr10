import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { FileText, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useEmployees, useInsertCertificate, uploadCertificateFile } from "@/lib/qualificacoes-queries";
import { TRAINING_TYPES, TRAINING_LABELS, type TrainingType } from "@/lib/qualificacoes";
import type { Employee } from "@/lib/qualificacoes";

export const Route = createFileRoute("/admin/certificados/importar")({
  component: CertificadosImportarPage,
  head: () => ({ meta: [{ title: "Importar Certificados — Gestão NR-10" }] }),
});

// ── PDF.js lazy loader ───────────────────────────────────────────────────────

async function getPdfJs() {
  const pdfjsLib = await import("pdfjs-dist");
  // Use the bundled worker (Vite will handle the URL)
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  return pdfjsLib;
}

// ── Text extraction ──────────────────────────────────────────────────────────

async function extractPagesText(file: File): Promise<string[]> {
  const pdfjsLib = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ");
    pages.push(text);
  }
  return pages;
}

// ── Employee matching ────────────────────────────────────────────────────────

function matchEmployee(pageText: string, employees: Employee[]): Employee | null {
  const text = pageText.toUpperCase();

  // 1. Try exact matricula match (most reliable)
  for (const emp of employees) {
    if (emp.matricula && text.includes(emp.matricula.toUpperCase())) {
      return emp;
    }
  }

  // 2. Try full name match
  for (const emp of employees) {
    const nameParts = emp.name.toUpperCase().split(" ").filter(p => p.length > 3);
    const matchCount = nameParts.filter(part => text.includes(part)).length;
    if (matchCount >= 2 && nameParts.length >= 2) {
      return emp;
    }
  }

  return null;
}

// ── Group consecutive pages for same employee (frente/verso) ─────────────────

type PageGroup = {
  pages: number[];       // 1-based page numbers
  employee: Employee | null;
  text: string;
  trainingType: TrainingType | "";
  category: "formacao" | "reciclagem" | "";
};

function groupPages(pagesText: string[], employees: Employee[]): PageGroup[] {
  const groups: PageGroup[] = [];
  let i = 0;
  while (i < pagesText.length) {
    const employee = matchEmployee(pagesText[i], employees);
    const pageNums = [i + 1];
    // Check if next page has same or no employee (frente/verso heuristic: short text = verso)
    if (i + 1 < pagesText.length) {
      const nextEmployee = matchEmployee(pagesText[i + 1], employees);
      const nextIsShort = pagesText[i + 1].trim().length < 200;
      if (nextEmployee === employee || (employee && nextIsShort && !nextEmployee)) {
        pageNums.push(i + 2);
        i += 2;
      } else {
        i++;
      }
    } else {
      i++;
    }
    groups.push({
      pages: pageNums,
      employee,
      text: pageNums.map(p => pagesText[p - 1]).join(" "),
      trainingType: "",
      category: "",
    });
  }
  return groups;
}

// ── Main component ───────────────────────────────────────────────────────────

function CertificadosImportarPage() {
  const { data: employees = [] } = useEmployees();
  const insertCert = useInsertCertificate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [groups, setGroups] = useState<PageGroup[]>([]);
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceFile(file);
    setProcessing(true);
    setGroups([]);
    setDone(false);
    try {
      const pagesText = await extractPagesText(file);
      const grouped = groupPages(pagesText, employees);
      setGroups(grouped);
    } catch (err) {
      toast.error("Erro ao processar PDF. Verifique se o arquivo não está protegido.");
      console.error(err);
    } finally {
      setProcessing(false);
    }
  }

  function updateGroup(idx: number, patch: Partial<PageGroup>) {
    setGroups(prev => prev.map((g, i) => i === idx ? { ...g, ...patch } : g));
  }

  async function handleImport() {
    if (!sourceFile) return;
    const validGroups = groups.filter(g => g.employee && g.trainingType && g.category);
    if (validGroups.length === 0) {
      toast.error("Nenhum certificado com colaborador e tipo de treinamento definidos.");
      return;
    }
    setImporting(true);
    let ok = 0;
    let fail = 0;
    for (const group of validGroups) {
      if (!group.employee) continue;
      try {
        // Upload the original file (full PDF) — in a real app we'd split pages here
        const url = await uploadCertificateFile(
          group.employee.id,
          sourceFile,
          `p${group.pages.join("-")}`
        );
        await insertCert.mutateAsync({
          employee_id: group.employee.id,
          nr10_training_id: null,
          training_type: group.trainingType as TrainingType,
          category: group.category as "formacao" | "reciclagem",
          file_url: url,
          file_name: sourceFile.name,
          issue_date: null,
          source_file: sourceFile.name,
          pages_in_source: group.pages.join("-"),
        });
        ok++;
      } catch {
        fail++;
      }
    }
    setImporting(false);
    if (ok > 0) {
      toast.success(`${ok} certificado(s) importado(s) com sucesso${fail > 0 ? `. ${fail} falhou.` : "."}`);
      setDone(true);
    } else {
      toast.error("Nenhum certificado importado.");
    }
  }

  const matchedCount = groups.filter(g => g.employee).length;
  const unmatchedCount = groups.filter(g => !g.employee).length;

  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Importar Certificados em Lote</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Faça upload de um PDF com múltiplos certificados. O app extrai o texto de cada página
          e tenta identificar automaticamente o colaborador.
        </p>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Drop zone */}
        <Card>
          <CardContent className="p-6">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">
                {sourceFile ? sourceFile.name : "Selecione o PDF com os certificados"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Aceita PDF com múltiplos certificados (frente e verso incluídos)
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            {processing && (
              <div className="mt-4 text-center text-sm text-muted-foreground animate-pulse">
                Extraindo texto das páginas...
              </div>
            )}

            {groups.length > 0 && !processing && (
              <div className="mt-4 flex gap-2 flex-wrap">
                <Badge variant="outline">{groups.length} certificado(s) detectado(s)</Badge>
                <Badge variant={matchedCount > 0 ? "default" : "secondary"}>
                  {matchedCount} identificado(s) automaticamente
                </Badge>
                {unmatchedCount > 0 && (
                  <Badge variant="destructive">{unmatchedCount} sem correspondência</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-group assignment */}
        {groups.length > 0 && !processing && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Confirme ou corrija as atribuições:</p>
            {groups.map((group, idx) => (
              <Card key={idx} className={group.employee ? "border-emerald-200" : "border-amber-200"}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {group.employee
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      : <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                    }
                    <span>Páginas {group.pages.join("–")} do PDF</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Employee selector */}
                    <Select
                      value={group.employee?.id ?? ""}
                      onValueChange={(val) => {
                        const emp = employees.find(e => e.id === val) ?? null;
                        updateGroup(idx, { employee: emp });
                      }}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Colaborador..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id} className="text-xs">
                            {emp.name} ({emp.matricula})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Training type */}
                    <Select
                      value={group.trainingType}
                      onValueChange={(val) => updateGroup(idx, { trainingType: val as TrainingType })}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TRAINING_TYPES.map(t => (
                          <SelectItem key={t} value={t} className="text-xs">
                            {TRAINING_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Category */}
                    <Select
                      value={group.category}
                      onValueChange={(val) => updateGroup(idx, { category: val as "formacao" | "reciclagem" })}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Categoria..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formacao" className="text-xs">Formação</SelectItem>
                        <SelectItem value="reciclagem" className="text-xs">Reciclagem</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Import button */}
        {groups.length > 0 && !processing && (
          <Button
            onClick={handleImport}
            disabled={importing || done}
            className="w-full bg-brand-gradient text-white shadow-brand hover:opacity-95"
          >
            <Upload className="h-4 w-4" />
            {importing ? "Importando..." : done ? "Importação concluída" : `Importar ${groups.filter(g => g.employee && g.trainingType && g.category).length} certificado(s)`}
          </Button>
        )}
      </div>
    </PageShell>
  );
}
