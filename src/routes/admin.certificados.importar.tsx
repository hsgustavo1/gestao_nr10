import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { FileText, Upload, CheckCircle2, AlertCircle, Sparkles, Eye, AlertTriangle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  useEmployees,
  importCertificateAsTraining,
  qualKeys,
} from "@/lib/qualificacoes-queries";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { TRAINING_TYPES, TRAINING_LABELS, type TrainingType } from "@/lib/qualificacoes";
import {
  groupPagesByFrenteVerso,
  type CertificatePageGroup,
  type PageAnalysis,
} from "@/lib/certificados-ai";
import { analyzeCertificatePage } from "@/lib/certificados-ai-server";

export const Route = createFileRoute("/admin/certificados/importar")({
  component: CertificadosImportarPage,
  head: () => ({ meta: [{ title: "Importar Certificados — Gestão NR-10" }] }),
});

// ── PDF.js lazy loader ───────────────────────────────────────────────────────

async function getPdfJs() {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  return pdfjsLib;
}

// Certificados escaneados usam JBIG2 na camada de texto; o pdf.js v6 só decodifica
// via WASM. Servido de public/pdfjs/wasm (ver scripts/copy-pdfjs-assets.mjs). Sem
// isso, o nome do participante some da página e a IA lê o texto errado.
const PDFJS_WASM_URL = "/pdfjs/wasm/";

// pdf.js: 1 unidade de viewport = 1/72". Escala 2.08 ≈ 150 DPI — mesma resolução
// usada no teste que validou a leitura via IA. PNG (sem perda) em vez de JPEG:
// a compressão do JPEG bastou pra degradar texto pequeno de certificado escaneado
// o suficiente pra IA ler nomes errados/com baixa confiança.
const RENDER_SCALE = 150 / 72;

/** Extensões/MIME de imagem aceitas além de PDF. */
function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/**
 * Lê um arquivo de imagem e devolve um PNG data URL já com a orientação EXIF
 * "assada" (o navegador aplica a orientação ao desenhar o <img> no canvas), pra
 * foto de celular chegar em pé antes mesmo da correção por IA.
 */
async function imageFileToPngDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Monta um PDF só com as páginas indicadas (1-based) do PDF de origem. */
async function extractPagesToPdf(sourceFile: File, pages: number[], fileName: string): Promise<File> {
  const { PDFDocument } = await import("pdf-lib");
  const srcDoc = await PDFDocument.load(await sourceFile.arrayBuffer(), { ignoreEncryption: true });
  const outDoc = await PDFDocument.create();
  const indices = pages
    .map((p) => p - 1)
    .filter((i) => i >= 0 && i < srcDoc.getPageCount());
  const copied = await outDoc.copyPages(srcDoc, indices);
  copied.forEach((pg) => outDoc.addPage(pg));
  const bytes = await outDoc.save();
  return new File([bytes as BlobPart], fileName, { type: "application/pdf" });
}

/** Monta um PDF a partir das imagens (PNG data URLs) de um certificado — usado quando a origem é imagem. */
async function pageImagesToPdf(pageDataUrls: string[], fileName: string): Promise<File> {
  const { PDFDocument } = await import("pdf-lib");
  const outDoc = await PDFDocument.create();
  for (const dataUrl of pageDataUrls) {
    const png = await outDoc.embedPng(dataUrl);
    const page = outDoc.addPage([png.width, png.height]);
    page.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height });
  }
  const bytes = await outDoc.save();
  return new File([bytes as BlobPart], fileName, { type: "application/pdf" });
}

/** Renderiza cada página do PDF como imagem (data URL) — é isso que vai pra IA, não o texto. */
async function renderPagesToImages(file: File): Promise<string[]> {
  const pdfjsLib = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, wasmUrl: PDFJS_WASM_URL }).promise;
  const images: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    images.push(canvas.toDataURL("image/png"));
  }
  return images;
}

/** Gira uma imagem (data URL) N graus no sentido horário, retornando novo data URL PNG. */
async function rotateImageDataUrl(dataUrl: string, degrees: 90 | 180 | 270): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = dataUrl;
  });
  const swap = degrees === 90 || degrees === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? img.height : img.width;
  canvas.height = swap ? img.width : img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvas.toDataURL("image/png");
}

// Limite gratuito da Groq: ~2700 tokens/imagem, 30000 TPM -> ~11 chamadas/min.
// Espaçar em 6s mantém margem sem depender só do retry.
const DELAY_BETWEEN_CALLS_MS = 6000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Analisa uma página; se a IA disser que a imagem está girada, corrige a
 * orientação no canvas e reanalisa uma única vez (a leitura de texto deitado é
 * ruim, mas detectar que ESTÁ deitado é confiável). Retorna a melhor análise.
 */
async function analyzeWithOrientation(imageDataUrl: string): Promise<PageAnalysis> {
  const first = await analyzeCertificatePage({ data: { imageDataUrl } });
  if (first.orientation_correction === 0) return first;
  await sleep(DELAY_BETWEEN_CALLS_MS);
  const rotated = await rotateImageDataUrl(imageDataUrl, first.orientation_correction);
  const second = await analyzeCertificatePage({ data: { imageDataUrl: rotated } });
  return second;
}

// ── Main component ───────────────────────────────────────────────────────────

function CertificadosImportarPage() {
  const { data: employees = [] } = useEmployees();
  const { currentOrgId } = useAuth();
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceKind, setSourceKind] = useState<"pdf" | "image">("pdf");
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  // PNG data URL de cada página (índice 0 = página 1). Usado tanto pela IA quanto,
  // na origem imagem, para montar o PDF recortado de cada certificado e o "Ver arquivo".
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [groups, setGroups] = useState<CertificatePageGroup[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const asImages = files.every(isImageFile);
    const pdf = files.find((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!asImages && !pdf) {
      toast.error("Envie um PDF ou uma ou mais imagens (JPG/PNG) — não misture os dois.");
      return;
    }

    setProcessing(true);
    setGroups([]);
    setDone(false);
    setPageImages([]);
    try {
      let images: string[];
      if (asImages) {
        // Cada imagem é uma página, na ordem selecionada (frente e verso em fotos separadas
        // funcionam: a frente tem nome → novo certificado; o verso sem nome se junta a ela).
        setSourceKind("image");
        setSourceFile(null);
        setSourceLabel(files.length === 1 ? files[0].name : `${files.length} imagens`);
        images = [];
        for (const f of files) images.push(await imageFileToPngDataUrl(f));
      } else {
        setSourceKind("pdf");
        setSourceFile(pdf!);
        setSourceLabel(pdf!.name);
        images = await renderPagesToImages(pdf!);
      }
      setPageImages(images);
      setProgress({ done: 0, total: images.length });
      const analyses: (PageAnalysis | null)[] = [];
      for (let i = 0; i < images.length; i++) {
        if (i > 0) await sleep(DELAY_BETWEEN_CALLS_MS);
        try {
          const analysis = await analyzeWithOrientation(images[i]);
          analyses.push(analysis);
        } catch (err) {
          console.error(`Falha ao analisar página ${i + 1}`, err);
          analyses.push(null);
        }
        setProgress({ done: i + 1, total: images.length });
      }
      setGroups(groupPagesByFrenteVerso(analyses, employees));
    } catch (err) {
      toast.error("Erro ao processar PDF. Verifique se o arquivo não está protegido.");
      console.error(err);
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  }

  function updateGroup(idx: number, patch: Partial<CertificatePageGroup>) {
    setGroups((prev) => prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  }

  /** Recorta apenas as páginas do certificado num PDF próprio (PDF ou imagem de origem). */
  async function buildCertificatePdf(pages: number[], fileName: string): Promise<File> {
    if (sourceKind === "pdf" && sourceFile) {
      return extractPagesToPdf(sourceFile, pages, fileName);
    }
    const imgs = pages.map((p) => pageImages[p - 1]).filter(Boolean);
    return pageImagesToPdf(imgs, fileName);
  }

  /**
   * Abre para conferência EXATAMENTE o que será salvo: só as páginas do
   * certificado, no mesmo recorte usado no submit (PDF ou imagem de origem).
   */
  async function openSourceAt(pages: number[]) {
    if (sourceKind === "pdf" ? !sourceFile : pageImages.length === 0) return;
    const pdf = await buildCertificatePdf(pages, "conferencia.pdf");
    const url = URL.createObjectURL(pdf);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function handleImport() {
    if (sourceKind === "pdf" ? !sourceFile : pageImages.length === 0) return;
    if (!currentOrgId) {
      toast.error("Selecione uma organização antes de importar.");
      return;
    }
    const validGroups = groups.filter((g) => g.employee && g.trainingType && g.category);
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
        // Recorta só as páginas deste certificado e salva na pasta {matricula}_{nome}/,
        // vinculando ao treinamento correspondente (cria se não existir).
        const baseName = `${group.trainingType}_${group.category}_p${group.pages.join("-")}_${Date.now()}`;
        const slice = await buildCertificatePdf(group.pages, `${baseName}.pdf`);
        await importCertificateAsTraining({
          employee: group.employee,
          orgId: currentOrgId,
          trainingType: group.trainingType as TrainingType,
          category: group.category as "formacao" | "reciclagem",
          issueDate: group.issueDate || null,
          workloadHours: group.workloadHours,
          file: slice,
          baseName,
          sourceLabel: sourceLabel ?? "",
          pagesInSource: group.pages.join("-"),
        });
        ok++;
      } catch (err) {
        console.error("Falha ao importar certificado", err);
        fail++;
      }
    }
    // Reflete os novos treinos/certificados na aba Capacitações e nos pop-ups.
    queryClient.invalidateQueries({ queryKey: qualKeys.nr10() });
    queryClient.invalidateQueries({ queryKey: ["training_certificates"] });
    setImporting(false);
    if (ok > 0) {
      toast.success(
        `${ok} certificado(s) importado(s) com sucesso${fail > 0 ? `. ${fail} falhou.` : "."}`,
      );
      setDone(true);
    } else {
      toast.error("Nenhum certificado importado.");
    }
  }

  const matchedCount = groups.filter((g) => g.employee).length;
  const unmatchedCount = groups.filter((g) => !g.employee).length;

  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          Importar Certificados em Lote <Sparkles className="h-5 w-5 text-amber-500" />
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Faça upload de um PDF com múltiplos certificados. Cada página é lida por IA (Groq/Llama 4
          Vision) para identificar o colaborador, tipo de treinamento e datas — confirme ou corrija
          antes de importar.
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
                {sourceLabel ?? "Selecione o PDF ou as imagens dos certificados"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Aceita um PDF (múltiplos certificados, frente e verso) ou uma/várias imagens
                (JPG/PNG) — na origem imagem, cada foto é uma página, na ordem selecionada.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {processing && (
              <div className="mt-4 text-center text-sm text-muted-foreground animate-pulse">
                {progress
                  ? `Analisando página ${progress.done} de ${progress.total} (IA)...`
                  : "Processando PDF..."}
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

        {/* AI verification warning */}
        {groups.length > 0 && !processing && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <p>
              Os dados abaixo foram <strong>extraídos automaticamente por IA</strong> e podem conter
              erros. Abra cada arquivo em <strong>“Ver arquivo”</strong> e confira colaborador, tipo,
              categoria e data <strong>antes de importar</strong>. Campos em branco não foram lidos
              com segurança — preencha manualmente.
            </p>
          </div>
        )}

        {/* Per-group assignment */}
        {groups.length > 0 && !processing && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Confirme ou corrija as atribuições:</p>
            {groups.map((group, idx) => (
              <Card
                key={idx}
                className={group.employee ? "border-emerald-200" : "border-amber-200"}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {group.employee ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      <span>Páginas {group.pages.join("–")} do PDF</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {group.employeeNameRead && (
                        <span className="text-xs text-muted-foreground">
                          IA leu: <span className="italic">"{group.employeeNameRead}"</span>
                          {group.confidence && (
                            <Badge variant="outline" className="ml-1 text-[10px]">
                              confiança {group.confidence}
                            </Badge>
                          )}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => openSourceAt(group.pages)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver arquivo
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    {/* Employee selector */}
                    <Select
                      value={group.employee?.id ?? ""}
                      onValueChange={(val) => {
                        const emp = employees.find((e) => e.id === val) ?? null;
                        updateGroup(idx, { employee: emp });
                      }}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Colaborador..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id} className="text-xs">
                            {emp.name} ({emp.matricula})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Training type */}
                    <Select
                      value={group.trainingType}
                      onValueChange={(val) =>
                        updateGroup(idx, { trainingType: val as TrainingType })
                      }
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TRAINING_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">
                            {TRAINING_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Category */}
                    <Select
                      value={group.category}
                      onValueChange={(val) =>
                        updateGroup(idx, { category: val as "formacao" | "reciclagem" })
                      }
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Categoria..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formacao" className="text-xs">
                          Formação
                        </SelectItem>
                        <SelectItem value="reciclagem" className="text-xs">
                          Reciclagem
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Issue date */}
                    <Input
                      type="date"
                      value={group.issueDate}
                      onChange={(e) => updateGroup(idx, { issueDate: e.target.value })}
                      className="h-8 text-xs"
                      title="Data de realização"
                    />
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
            {importing
              ? "Importando..."
              : done
                ? "Importação concluída"
                : `Importar ${groups.filter((g) => g.employee && g.trainingType && g.category).length} certificado(s)`}
          </Button>
        )}
      </div>
    </PageShell>
  );
}
