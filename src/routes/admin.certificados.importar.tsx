import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useMemo, useEffect } from "react";
import { FileText, Upload, CheckCircle2, AlertCircle, Sparkles, Eye, AlertTriangle, GraduationCap } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  useTurmas,
  upsertTurma,
  importCertificateAsTraining,
  qualKeys,
} from "@/lib/qualificacoes-queries";
import { suggestTurmaForBatch, detectTurmaDiscrepancies, type TurmaCandidate } from "@/lib/turmas";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { TRAINING_TYPES, TRAINING_LABELS, formatDatePtBR, type TrainingType } from "@/lib/qualificacoes";
import {
  groupPagesByFrenteVerso,
  type CertificatePageGroup,
  type PageAnalysis,
} from "@/lib/certificados-ai";
import { analyzeCertificatePage } from "@/lib/certificados-ai-server";

export const Route = createFileRoute("/admin/certificados/importar")({
  component: CertificadosImportarPage,
  head: () => ({ meta: [{ title: "Importar Certificados — Gestão NR-10" }] }),
  validateSearch: (search: Record<string, unknown>): { turmaId?: string } => ({
    turmaId: typeof search.turmaId === "string" ? search.turmaId : undefined,
  }),
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

/** Valor sentinela do seletor de turma para "criar uma nova turma". */
const NOVA_TURMA = "__nova__";

/** Campos do formulário de criação de turma no wizard de importação. */
type NovaTurmaForm = {
  trainingType: TrainingType;
  category: "formacao" | "reciclagem";
  data: string;
  cargaHoraria: string;
  art: string;
  instrutor: string;
  entidade: string;
  responsavelTecnico: string;
  conteudo: string;
};

const emptyNovaTurma: NovaTurmaForm = {
  trainingType: "nr10_basico",
  category: "formacao",
  data: "",
  cargaHoraria: "",
  art: "",
  instrutor: "",
  entidade: "",
  responsavelTecnico: "",
  conteudo: "",
};

function CertificadosImportarPage() {
  const { turmaId: turmaIdFromUrl } = Route.useSearch();
  const { data: employees = [] } = useEmployees();
  const { data: turmas = [] } = useTurmas();
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
  // Turma escolhida para o lote. NOVA_TURMA = criar uma nova; senão, id da turma existente.
  const [turmaSel, setTurmaSel] = useState<string>(NOVA_TURMA);
  const turmaTouched = useRef(false);
  // Formulário da turma nova (pré-preenchido com o que a IA capturou do lote).
  const [novaTurma, setNovaTurma] = useState<NovaTurmaForm>(emptyNovaTurma);
  const novaTurmaTouched = useRef(false);
  // Id da turma (ou NOVA_TURMA) para o qual o formulário acima foi carregado por
  // último — evita recarregar/perder edições do usuário a cada re-render.
  const turmaFormLoadedFor = useRef<string | null>(null);
  const isNovaTurma = turmaSel === NOVA_TURMA;

  // Turma pré-selecionada via querystring (vinda de "Registrar e importar certificados").
  useEffect(() => {
    if (turmaIdFromUrl && !turmaTouched.current) {
      turmaTouched.current = true;
      setTurmaSel(turmaIdFromUrl);
    }
  }, [turmaIdFromUrl]);

  // Certificados atribuídos a um colaborador (tipo/categoria/data vêm da turma).
  const validGroups = useMemo(() => groups.filter((g) => g.employee), [groups]);

  // Carga horária capturada pela IA em algum certificado do lote (para pré-preencher).
  const capturedCarga = useMemo(
    () => validGroups.find((g) => g.workloadHours != null)?.workloadHours ?? null,
    [validGroups],
  );

  // Chave do lote: tipo/categoria do 1º certificado (palpite da IA) + data de
  // realização mais confiável. Alimenta o casamento sugerido e o pré-preenchimento.
  const batchKey = useMemo(() => {
    if (validGroups.length === 0) return null;
    const first = validGroups[0];
    const dataRealizacao = validGroups.find((g) => g.dataRealizacao)?.dataRealizacao || null;
    return {
      trainingType: (first.trainingType || "nr10_basico") as TrainingType,
      category: (first.category || "formacao") as "formacao" | "reciclagem",
      dataRealizacao,
    };
  }, [validGroups]);

  const turmaCandidates: TurmaCandidate[] = useMemo(
    () =>
      turmas.map((t) => ({
        id: t.id,
        training_type: t.training_type,
        category: t.category,
        data: t.data,
        art: t.art,
      })),
    [turmas],
  );

  const suggestion = useMemo(
    () => (batchKey ? suggestTurmaForBatch(batchKey, turmaCandidates) : null),
    [batchKey, turmaCandidates],
  );

  // Opções de vínculo manual: turmas da mesma CATEGORIA (o tipo lido pela IA é
  // pouco confiável), ordenadas por proximidade da data de realização do lote.
  const turmasCompativeis = useMemo(() => {
    if (!batchKey) return [];
    const alvo = batchKey.dataRealizacao ? Date.parse(batchKey.dataRealizacao) : null;
    return turmas
      .filter((t) => t.category === batchKey.category)
      .sort((a, b) => {
        if (alvo == null) return 0;
        const da = a.data ? Math.abs(Date.parse(a.data) - alvo) : Infinity;
        const db = b.data ? Math.abs(Date.parse(b.data) - alvo) : Infinity;
        return da - db;
      });
  }, [turmas, batchKey]);

  // Enquanto o usuário não escolhe manualmente, adota a sugestão (ou nova turma).
  useEffect(() => {
    if (!turmaTouched.current) setTurmaSel(suggestion?.id ?? NOVA_TURMA);
  }, [suggestion?.id]);

  const linkedTurma = useMemo(
    () => (isNovaTurma ? null : turmas.find((t) => t.id === turmaSel) ?? null),
    [turmas, turmaSel, isNovaTurma],
  );

  // Pré-preenche o formulário: turma nova ganha os dados capturados pela IA no
  // lote; turma existente carrega os PRÓPRIOS dados (a turma é autoritativa — a
  // IA nunca sobrescreve automaticamente um campo já preenchido na turma).
  useEffect(() => {
    if (isNovaTurma) {
      if (turmaFormLoadedFor.current !== NOVA_TURMA) {
        turmaFormLoadedFor.current = NOVA_TURMA;
        novaTurmaTouched.current = false;
      }
      if (!batchKey || novaTurmaTouched.current) return;
      setNovaTurma((prev) => ({
        ...prev,
        trainingType: batchKey.trainingType,
        category: batchKey.category,
        data: batchKey.dataRealizacao ?? "",
        cargaHoraria: capturedCarga != null ? String(capturedCarga) : "",
      }));
      return;
    }
    if (!linkedTurma || turmaFormLoadedFor.current === linkedTurma.id) return;
    turmaFormLoadedFor.current = linkedTurma.id;
    novaTurmaTouched.current = true; // bloqueia o pré-preenchimento automático via IA
    setNovaTurma({
      trainingType: linkedTurma.training_type,
      category: linkedTurma.category,
      data: linkedTurma.data ?? "",
      cargaHoraria: linkedTurma.carga_horaria != null ? String(linkedTurma.carga_horaria) : "",
      art: linkedTurma.art ?? "",
      instrutor: linkedTurma.instrutor ?? "",
      entidade: linkedTurma.entidade ?? "",
      responsavelTecnico: linkedTurma.responsavel_tecnico ?? "",
      conteudo: linkedTurma.conteudo_programatico ?? "",
    });
  }, [isNovaTurma, linkedTurma, batchKey, capturedCarga]);

  // Data de realização/carga horária atuais do formulário — valem para o lote
  // inteiro (turma nova ou existente sendo editada).
  const turmaDataAtual = novaTurma.data || null;
  const turmaCargaAtual = useMemo(() => {
    const c = novaTurma.cargaHoraria.trim();
    return c ? parseInt(c, 10) : null;
  }, [novaTurma.cargaHoraria]);

  // Certificados cujo dado diverge do dado da turma → nunca sobrescreve, só alerta.
  const discrepanciasLote = useMemo(
    () =>
      validGroups.flatMap((g) =>
        detectTurmaDiscrepancies(
          { data: turmaDataAtual, carga_horaria: turmaCargaAtual },
          { dataRealizacao: g.dataRealizacao || null, workloadHours: g.workloadHours },
        ),
      ),
    [validGroups, turmaDataAtual, turmaCargaAtual],
  );
  const gruposComDivergenciaData = useMemo(
    () => discrepanciasLote.filter((d) => d.field === "data_realizacao"),
    [discrepanciasLote],
  );
  const gruposComDivergenciaCarga = useMemo(
    () => discrepanciasLote.filter((d) => d.field === "carga_horaria"),
    [discrepanciasLote],
  );

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
    turmaTouched.current = false;
    setTurmaSel(NOVA_TURMA);
    novaTurmaTouched.current = false;
    setNovaTurma(emptyNovaTurma);
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
    const toImport = groups.filter((g) => g.employee);
    if (toImport.length === 0) {
      toast.error("Nenhum certificado com colaborador definido.");
      return;
    }

    // Uma turma governa todo o lote: tipo, categoria e data vêm dela (não de cada
    // certificado) — corrige num só lugar erros de leitura da IA e mantém consistência.
    // O formulário acima é sempre a fonte da verdade (turma nova OU edição/complemento
    // de turma existente): os campos editados pelo usuário são gravados na turma.
    const trainingType = novaTurma.trainingType;
    const category = novaTurma.category;

    setImporting(true);
    let ok = 0;
    let fail = 0;
    let turmaId: string;

    try {
      const carga = novaTurma.cargaHoraria.trim();
      turmaId = await upsertTurma({
        orgId: currentOrgId,
        turma: {
          id: isNovaTurma ? undefined : turmaSel,
          training_type: novaTurma.trainingType,
          category: novaTurma.category,
          data: novaTurma.data || null,
          art: novaTurma.art.trim() || null,
          art_arquivo_url: linkedTurma?.art_arquivo_url ?? null,
          instrutor: novaTurma.instrutor.trim() || null,
          entidade: novaTurma.entidade.trim() || null,
          responsavel_tecnico: novaTurma.responsavelTecnico.trim() || null,
          carga_horaria: carga ? parseInt(carga, 10) : null,
          conteudo_programatico: novaTurma.conteudo.trim() || null,
        },
        employeeIds: [],
      });
    } catch (err) {
      console.error("Falha ao criar/atualizar a turma", err);
      toast.error("Não foi possível salvar a turma. Nada foi importado.");
      setImporting(false);
      return;
    }

    for (const group of toImport) {
      if (!group.employee) continue;
      try {
        // Recorta só as páginas deste certificado e salva na pasta {matricula}_{nome}/,
        // vinculando ao treinamento e à turma do lote (cria a participação se não existir).
        const baseName = `${trainingType}_${category}_p${group.pages.join("-")}_${Date.now()}`;
        const slice = await buildCertificatePdf(group.pages, `${baseName}.pdf`);
        await importCertificateAsTraining({
          employee: group.employee,
          orgId: currentOrgId,
          trainingType,
          category,
          issueDate: group.issueDate || null,
          dataRealizacao: group.dataRealizacao || null,
          workloadHours: group.workloadHours,
          turmaId,
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
    queryClient.invalidateQueries({ queryKey: ["nr10_turmas"] });
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
              erros. Abra cada arquivo em <strong>“Ver arquivo”</strong> e confira o colaborador e a
              data, além dos dados da turma, <strong>antes de importar</strong>. Campos em branco não
              foram lidos com segurança — preencha manualmente.
            </p>
          </div>
        )}

        {/* Casamento de turma para o lote */}
        {batchKey && !processing && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <GraduationCap className="h-4 w-4 text-primary" />
                Turma deste lote
              </div>
              <p className="text-xs text-muted-foreground">
                {suggestion
                  ? "Encontramos uma turma que parece corresponder a estes certificados. Vincule a ela ou crie uma nova — tipo, categoria e data valem para todo o lote."
                  : "Nenhuma turma correspondente. Preencha os dados da nova turma abaixo — eles valem para todos os certificados deste lote."}
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Turma</Label>
                <Select
                  value={turmaSel}
                  onValueChange={(v) => {
                    turmaTouched.current = true;
                    setTurmaSel(v);
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NOVA_TURMA}>➕ Criar nova turma</SelectItem>
                    {turmasCompativeis.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {TRAINING_LABELS[t.training_type]}
                        {" · "}
                        {t.category === "formacao" ? "Formação" : "Reciclagem"}
                        {" · "}
                        {t.data ? formatDatePtBR(t.data) : "sem data"}
                        {t.art ? ` · ART ${t.art}` : ""}
                        {t.instrutor ? ` · ${t.instrutor}` : ""}
                        {suggestion?.id === t.id ? "  (sugerida)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Formulário da turma — nova (pré-preenchida com o que a IA capturou) ou
                  existente (pré-preenchida com os dados já salvos, editável para
                  completar/corrigir; a IA nunca sobrescreve automaticamente aqui). */}
              <div className="rounded-md border bg-background p-3 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {isNovaTurma
                      ? `Dados da nova turma (aplicados a todos os ${validGroups.length} certificado${validGroups.length !== 1 ? "s" : ""})`
                      : `Dados da turma selecionada (edite para completar ou corrigir — aplicados a todos os ${validGroups.length} certificado${validGroups.length !== 1 ? "s" : ""})`}
                    {isNovaTurma && (capturedCarga != null || batchKey?.dataRealizacao) ? (
                      <span className="ml-1 font-normal">
                        — IA capturou:{" "}
                        {batchKey?.dataRealizacao ? formatDatePtBR(batchKey.dataRealizacao) : "—"}
                        {capturedCarga != null ? `, ${capturedCarga}h` : ""}
                      </span>
                    ) : null}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={novaTurma.trainingType}
                        onValueChange={(v) => {
                          novaTurmaTouched.current = true;
                          setNovaTurma((p) => ({ ...p, trainingType: v as TrainingType }));
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRAINING_TYPES.map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">
                              {TRAINING_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Categoria</Label>
                      <Select
                        value={novaTurma.category}
                        onValueChange={(v) => {
                          novaTurmaTouched.current = true;
                          setNovaTurma((p) => ({ ...p, category: v as "formacao" | "reciclagem" }));
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
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
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Data de realização</Label>
                      <Input
                        type="date"
                        value={novaTurma.data}
                        onChange={(e) => {
                          novaTurmaTouched.current = true;
                          setNovaTurma((p) => ({ ...p, data: e.target.value }));
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Carga horária (h)</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Ex.: 40"
                        value={novaTurma.cargaHoraria}
                        onChange={(e) => {
                          novaTurmaTouched.current = true;
                          setNovaTurma((p) => ({ ...p, cargaHoraria: e.target.value }));
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nº ART (opcional)</Label>
                      <Input
                        value={novaTurma.art}
                        onChange={(e) => {
                          novaTurmaTouched.current = true;
                          setNovaTurma((p) => ({ ...p, art: e.target.value }));
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Instrutor</Label>
                      <Input
                        value={novaTurma.instrutor}
                        onChange={(e) => {
                          novaTurmaTouched.current = true;
                          setNovaTurma((p) => ({ ...p, instrutor: e.target.value }));
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Entidade</Label>
                      <Input
                        value={novaTurma.entidade}
                        onChange={(e) => {
                          novaTurmaTouched.current = true;
                          setNovaTurma((p) => ({ ...p, entidade: e.target.value }));
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Responsável técnico</Label>
                      <Input
                        value={novaTurma.responsavelTecnico}
                        onChange={(e) => {
                          novaTurmaTouched.current = true;
                          setNovaTurma((p) => ({ ...p, responsavelTecnico: e.target.value }));
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-3">
                      <Label className="text-xs">Conteúdo programático (resumo, opcional)</Label>
                      <Input
                        value={novaTurma.conteudo}
                        onChange={(e) => {
                          novaTurmaTouched.current = true;
                          setNovaTurma((p) => ({ ...p, conteudo: e.target.value }));
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
              </div>

              {gruposComDivergenciaData.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <p>
                    {gruposComDivergenciaData.length} certificado(s) têm{" "}
                    <strong>data de realização diferente</strong> da turma (
                    {turmaDataAtual ? formatDatePtBR(turmaDataAtual) : "—"}). Um certificado de
                    conclusão não deveria ter data diferente da turma — confira antes de importar.
                  </p>
                </div>
              )}

              {gruposComDivergenciaCarga.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <p>
                    {gruposComDivergenciaCarga.length} certificado(s) têm{" "}
                    <strong>carga horária diferente</strong> da turma (
                    {turmaCargaAtual != null ? `${turmaCargaAtual}h` : "—"}). Confira antes de
                    importar.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Employee selector */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Colaborador</Label>
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
                    </div>

                    {/* Data de realização deste certificado (confrontada com a turma) */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Data de realização</Label>
                      <Input
                        type="date"
                        value={group.dataRealizacao}
                        onChange={(e) => updateGroup(idx, { dataRealizacao: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Tipo e categoria vêm da turma do lote (definidos acima).
                  </p>
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
                : `Importar ${groups.filter((g) => g.employee).length} certificado(s)`}
          </Button>
        )}
      </div>
    </PageShell>
  );
}
