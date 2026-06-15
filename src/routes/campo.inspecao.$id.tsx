import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  ChevronRight,
  FileCheck2,
  FolderTree,
  Home,
  ImagePlus,
  ListChecks,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { formatDatePtBR } from "@/lib/qualificacoes";
import {
  RTI_PRIORIDADE_BADGE,
  RTI_PRIORIDADE_LABELS,
  RTI_PRIORIDADES,
  RTI_TIPO_EXECUCAO_LABELS,
  clampPrioridade,
  type RtiTipoExecucao,
} from "@/lib/rti";
import {
  FIELD_INSPECTION_STATUS_BADGE,
  FIELD_INSPECTION_STATUS_LABELS,
  NIVEL_LABEL,
  NIVEL_LABEL_PLURAL,
  filhosDoNo,
  formatNormas,
  modosPorCategoria,
  nodePath,
  proximoNivel,
  type AchadoNovoUI,
  type FieldInspection,
  type FieldNode,
  type NivelArvore,
  type RtiModoFalha,
} from "@/lib/campo";
import {
  baixarPlanilhaModeloEstrutura,
  bulkCreateNodes,
  comporRti,
  parsePlanilhaEstrutura,
  uploadFieldPhoto,
  useCriarPontoComColeta,
  useDeleteFieldNode,
  useFieldInspection,
  useFieldNodes,
  useFieldPoints,
  useInspectionFindings,
  useModosFalha,
  useSetArquivadaCampo,
  useSetoresHistoricos,
  useUpsertFieldInspection,
  useUpsertFieldNode,
  type AchadoNovo,
  type FieldPointWithCounts,
} from "@/lib/campo-queries";
import { useQueryClient } from "@tanstack/react-query";
import { useRtiReports } from "@/lib/rti-queries";

export const Route = createFileRoute("/campo/inspecao/$id")({
  component: CampoInspecaoPage,
  head: () => ({ meta: [{ title: "Inspeção de Campo — RTI — Gestão NR-10" }] }),
});

function CampoInspecaoPage() {
  const { id } = Route.useParams();
  const { isStaff } = useAuth();
  const { data: inspection, isLoading } = useFieldInspection(id);
  const { data: nodes = [] } = useFieldNodes(id);
  const { data: points = [] } = useFieldPoints(id);
  const { data: findings = [] } = useInspectionFindings(id);

  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [capturaOpen, setCapturaOpen] = useState(false);
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [cargaOpen, setCargaOpen] = useState(false);
  const [comporOpen, setComporOpen] = useState(false);
  const [reopening, setReopening] = useState(false);

  const upsertInspection = useUpsertFieldInspection();

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const path = useMemo(
    () => (currentNodeId ? nodePath(currentNodeId, nodeById) : []),
    [currentNodeId, nodeById],
  );
  const currentNode = currentNodeId ? (nodeById.get(currentNodeId) ?? null) : null;
  const childLevel = proximoNivel(currentNode?.nivel ?? null); // setor na raiz, etc.
  const children = useMemo(() => filhosDoNo(currentNodeId, nodes), [currentNodeId, nodes]);

  // Subárvore: para contagens aninhadas por nó-filho
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, FieldNode[]>();
    for (const n of nodes) {
      const k = n.parent_id ?? null;
      const arr = map.get(k);
      if (arr) arr.push(n);
      else map.set(k, [n]);
    }
    return map;
  }, [nodes]);

  function descendentes(nodeId: string): Set<string> {
    const out = new Set<string>([nodeId]);
    const fila = [nodeId];
    while (fila.length) {
      const cur = fila.pop()!;
      for (const c of childrenByParent.get(cur) ?? []) {
        if (!out.has(c.id)) {
          out.add(c.id);
          fila.push(c.id);
        }
      }
    }
    return out;
  }

  const pointsByNode = useMemo(() => {
    const map = new Map<string, FieldPointWithCounts[]>();
    for (const p of points) {
      const arr = map.get(p.node_id);
      if (arr) arr.push(p);
      else map.set(p.node_id, [p]);
    }
    return map;
  }, [points]);

  function contagem(nodeId: string): { pontos: number; achados: number } {
    const ids = descendentes(nodeId);
    let pontos = 0,
      achados = 0;
    for (const p of points) {
      if (ids.has(p.node_id)) {
        pontos += 1;
        achados += p._achados;
      }
    }
    return { pontos, achados };
  }

  const pontosAqui = currentNodeId ? (pointsByNode.get(currentNodeId) ?? []) : [];
  const totalAchados = findings.length;
  const podeColetar = !!currentNodeId; // só coleta dentro de um nó

  if (isLoading || !inspection) {
    return (
      <PageShell>
        <Skeleton className="h-8 w-64" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </PageShell>
    );
  }

  const jaImportada = inspection.status === "importada";
  const foiReaberta = !jaImportada && !!inspection.report_id;

  async function handleReopen() {
    if (!inspection || reopening) return;
    setReopening(true);
    try {
      await upsertInspection.mutateAsync({
        id: inspection.id,
        titulo: inspection.titulo,
        status: "em_andamento",
        report_id: inspection.report_id,
      });
    } catch (err) {
      toast.error("Falha ao reabrir: " + (err as Error).message);
    } finally {
      setReopening(false);
    }
  }

  return (
    <PageShell>
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
        <Link to="/campo">
          <ArrowLeft className="h-4 w-4" /> Coletas de campo
        </Link>
      </Button>

      <div className="mt-2 flex items-start justify-between flex-wrap gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold leading-tight">{inspection.titulo}</h1>
          <div className="mt-0.5 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
            {inspection.cliente && <span>{inspection.cliente}</span>}
            <span>{formatDatePtBR(inspection.data_inspecao)}</span>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${FIELD_INSPECTION_STATUS_BADGE[inspection.status]}`}
            >
              {FIELD_INSPECTION_STATUS_LABELS[inspection.status]}
            </span>
            <span className="font-semibold text-primary">
              {totalAchados} achado{totalAchados !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        {isStaff && !jaImportada && totalAchados > 0 && (
          <Button size="sm" variant="outline" onClick={() => setComporOpen(true)}>
            <Sparkles className="h-4 w-4" /> {foiReaberta ? "Recompor RTI" : "Compor RTI"}
          </Button>
        )}
      </div>

      {jaImportada && inspection.report_id && (
        <Card className="mt-3 border-emerald-300 bg-emerald-50/50">
          <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-emerald-800 inline-flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 shrink-0" /> Coleta já composta no Plano de Ação RTI.
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isStaff && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                  onClick={handleReopen}
                  disabled={reopening}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> {reopening ? "Reabrindo..." : "Reabrir"}
                </Button>
              )}
              <Button asChild size="sm" variant="outline">
                <Link to="/rti/plano" search={{ report: inspection.report_id }}>
                  Abrir no Plano <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {foiReaberta && (
        <Card className="mt-3 border-amber-300 bg-amber-50/50">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Inspeção reaberta. Edite os pontos e <strong>Recompor RTI</strong> para atualizar as
              NCs existentes.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Breadcrumb compacto — só o nível atual em destaque */}
      <div className="mt-3 flex items-center gap-1 text-sm overflow-x-auto whitespace-nowrap pb-1">
        <button
          type="button"
          onClick={() => setCurrentNodeId(null)}
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${currentNodeId === null ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Home className="h-3.5 w-3.5" /> Setores
        </button>
        {path.map((n, i) => {
          const ultimo = i === path.length - 1;
          return (
            <span key={n.id} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <button
                type="button"
                onClick={() => setCurrentNodeId(n.id)}
                className={`rounded px-1.5 py-0.5 ${ultimo ? "font-semibold text-foreground bg-muted" : "text-muted-foreground hover:text-foreground"}`}
                title={`${NIVEL_LABEL[n.nivel]}: ${n.nome}`}
              >
                {n.nome}
              </button>
            </span>
          );
        })}
      </div>

      {/* Botão primário: coletar aqui */}
      {isStaff && !jaImportada && (
        <div className="mt-2">
          {podeColetar ? (
            <Button
              onClick={() => setCapturaOpen(true)}
              className="w-full h-12 text-base bg-brand-gradient text-white shadow-brand"
            >
              <Camera className="h-5 w-5" /> Novo ponto de coleta aqui
            </Button>
          ) : (
            <div className="rounded-md border border-dashed bg-muted/20 p-3 text-center text-xs text-muted-foreground">
              Entre em um <strong>Setor</strong> (ou crie um abaixo) para começar a coletar pontos.
            </div>
          )}
        </div>
      )}

      {/* Navegação da árvore (filhos do nó atual) */}
      {childLevel && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {NIVEL_LABEL_PLURAL[childLevel]}
              {children.length > 0 ? ` (${children.length})` : ""}
            </h2>
            {isStaff && !jaImportada && (
              <div className="flex gap-1">
                {currentNodeId === null && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setCargaOpen(true)}
                  >
                    <Upload className="h-3.5 w-3.5" /> Carregar setores
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setAddNodeOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> {NIVEL_LABEL[childLevel]}
                </Button>
              </div>
            )}
          </div>
          {children.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/10 p-4 text-center text-xs text-muted-foreground">
              Nenhum {NIVEL_LABEL[childLevel].toLowerCase()} aqui.
              {currentNodeId === null &&
                " Crie manualmente, carregue por planilha ou use a base histórica."}
            </div>
          ) : (
            <div className="space-y-2">
              {children.map((n) => {
                const c = contagem(n.id);
                return (
                  <Card key={n.id} className="transition-colors hover:border-primary/40">
                    <CardContent className="p-0">
                      <button
                        type="button"
                        onClick={() => setCurrentNodeId(n.id)}
                        className="flex items-center gap-3 p-3 w-full text-left"
                      >
                        <FolderTree className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium leading-tight truncate">{n.nome}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {c.pontos} ponto{c.pontos !== 1 ? "s" : ""} · {c.achados} achado
                            {c.achados !== 1 ? "s" : ""}
                          </div>
                        </div>
                        {isStaff && !jaImportada && <DeleteNodeButton node={n} />}
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pontos criados neste nó */}
      {currentNodeId && (
        <div className="mt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Pontos coletados aqui{pontosAqui.length > 0 ? ` (${pontosAqui.length})` : ""}
          </h2>
          {pontosAqui.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/10 p-4 text-center text-xs text-muted-foreground">
              Nenhum ponto neste nível ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {pontosAqui.map((p) => (
                <Card key={p.id} className="transition-colors hover:border-primary/40">
                  <CardContent className="p-0">
                    <Link
                      to="/campo/ponto/$id"
                      params={{ id: p.id }}
                      className="flex items-center gap-3 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium leading-tight truncate">
                          {p.titulo || `Ponto ${p.ordem || ""}`.trim() || "Ponto de coleta"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {p._achados} modo{p._achados !== 1 ? "s" : ""} de falha · {p._fotos} foto
                          {p._fotos !== 1 ? "s" : ""}
                        </div>
                      </div>
                      {p._fotos > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-primary shrink-0">
                          <Camera className="h-3.5 w-3.5" />
                          {p._fotos}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {isStaff && capturaOpen && currentNodeId && (
        <CapturaPontoSheet
          inspectionId={id}
          orgId={inspection.org_id}
          nodeId={currentNodeId}
          contextoLabel={
            currentNode ? `${NIVEL_LABEL[currentNode.nivel]}: ${currentNode.nome}` : ""
          }
          proximaOrdem={pontosAqui.reduce((m, p) => Math.max(m, p.ordem), 0) + 1}
          onOpenChange={(o) => {
            if (!o) setCapturaOpen(false);
          }}
        />
      )}
      {isStaff && addNodeOpen && childLevel && (
        <AddNodeDialog
          inspectionId={id}
          parentId={currentNodeId}
          nivel={childLevel}
          proximaOrdem={children.reduce((m, n) => Math.max(m, n.ordem), 0) + 1}
          onOpenChange={(o) => {
            if (!o) setAddNodeOpen(false);
          }}
        />
      )}
      {isStaff && cargaOpen && (
        <CargaEstruturaDialog
          inspectionId={id}
          onOpenChange={(o) => {
            if (!o) setCargaOpen(false);
          }}
        />
      )}
      {isStaff && comporOpen && (
        <ComporRtiDialog
          inspection={inspection}
          totalAchados={totalAchados}
          defaultDestino={inspection.report_id ?? undefined}
          onOpenChange={(o) => {
            if (!o) setComporOpen(false);
          }}
        />
      )}
    </PageShell>
  );
}

function DeleteNodeButton({ node }: { node: FieldNode }) {
  const del = useDeleteFieldNode();
  async function handle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Excluir "${node.nome}" e tudo abaixo (pontos, achados, fotos)?`)) return;
    try {
      await del.mutateAsync({ id: node.id, inspection_id: node.inspection_id });
      toast.success("Removido.");
    } catch (err) {
      toast.error("Falha ao excluir: " + (err as Error).message);
    }
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0 text-muted-foreground shrink-0"
      onClick={handle}
      title="Excluir"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

// ── Captura foto-primeiro ────────────────────────────────────────────────────

function CapturaPontoSheet({
  inspectionId,
  orgId,
  nodeId,
  contextoLabel,
  proximaOrdem,
  onOpenChange,
}: {
  inspectionId: string;
  orgId?: string;
  nodeId: string;
  contextoLabel: string;
  proximaOrdem: number;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: modos = [] } = useModosFalha();
  const criar = useCriarPontoComColeta();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);

  const [fotos, setFotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [titulo, setTitulo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [manuais, setManuais] = useState<AchadoNovoUI[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [busy, setBusy] = useState(false);
  const [progresso, setProgresso] = useState<{ done: number; total: number } | null>(null);

  function addFotos(list: FileList | null) {
    if (!list || list.length === 0) return;
    const novos = [...list].filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf",
    );
    setFotos((prev) => [...prev, ...novos]);
    setPreviews((prev) => [...prev, ...novos.map((f) => URL.createObjectURL(f))]);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galeriaRef.current) galeriaRef.current.value = "";
  }
  function removeFoto(i: number) {
    setFotos((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[i]);
      return prev.filter((_, idx) => idx !== i);
    });
  }
  function toggleModo(id: string) {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const list = t
      ? modos.filter(
          (m) =>
            m.ativo &&
            (m.label.toLowerCase().includes(t) ||
              m.categoria.toLowerCase().includes(t) ||
              m.descricao_padrao.toLowerCase().includes(t)),
        )
      : modos.filter((m) => m.ativo);
    return modosPorCategoria(list);
  }, [modos, busca]);

  const modoById = useMemo(() => new Map(modos.map((m) => [m.id, m])), [modos]);
  const totalAchados = selecionados.size + manuais.length;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (totalAchados === 0)
      return toast.error("Selecione ao menos um modo de falha ou adicione um achado manual.");
    setBusy(true);
    setProgresso(fotos.length > 0 ? { done: 0, total: fotos.length } : null);
    try {
      const enviadas: { path: string; name: string }[] = [];
      for (let i = 0; i < fotos.length; i++) {
        enviadas.push(await uploadFieldPhoto(fotos[i], orgId));
        setProgresso({ done: i + 1, total: fotos.length });
      }
      const achados: AchadoNovo[] = [
        ...[...selecionados].map((id) => {
          const m = modoById.get(id)!;
          return {
            modo_falha_id: m.id,
            descricao: m.descricao_padrao,
            recomendacao: m.recomendacao_padrao,
            prioridade: m.prioridade_sugerida,
            tipo_execucao: m.tipo_execucao_sugerido,
            observacao: null,
          } as AchadoNovo;
        }),
        ...manuais.map((m) => ({ ...m, modo_falha_id: null })),
      ];
      await criar.mutateAsync({
        inspectionId,
        nodeId,
        titulo: titulo.trim() || null,
        observacoes: observacoes.trim() || null,
        ordem: proximaOrdem,
        fotos: enviadas,
        achados,
      });
      previews.forEach((u) => URL.revokeObjectURL(u));
      toast.success(`Ponto registrado: ${totalAchados} modo(s), ${fotos.length} foto(s).`);
      onOpenChange(false);
    } catch (err) {
      toast.error("Falha ao salvar: " + (err as Error).message);
      setBusy(false);
      setProgresso(null);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!busy) onOpenChange(o);
      }}
    >
      <DialogContent
        className="max-h-[92vh] w-[calc(100vw-1rem)] sm:max-w-lg flex flex-col p-0 gap-0"
        onInteractOutside={(e) => {
          // iOS fires focusoutside when the OS returns from the native camera.
          // Block only that event; genuine backdrop taps (pointerdownoutside) still close.
          if (e.type === "focusoutside") e.preventDefault();
        }}
      >
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <Camera className="h-5 w-5 shrink-0 text-primary" /> Novo ponto de coleta
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1 text-xs">
            <MapPin className="h-3 w-3 shrink-0" /> {contextoLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1) Fotos */}
          <div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => addFotos(e.target.files)}
            />
            <input
              ref={galeriaRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => addFotos(e.target.files)}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1 h-11 bg-brand-gradient text-white shadow-brand"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="h-5 w-5" /> Tirar foto
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => galeriaRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" /> Galeria
              </Button>
            </div>
            {previews.length > 0 ? (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-md overflow-hidden border">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFoto(i)}
                      className="absolute top-0.5 right-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                A foto é opcional (ex.: NC de documentação não tem o que fotografar).
              </p>
            )}
          </div>

          {/* 2) Dados do ponto */}
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="cp-titulo" className="text-xs">
                Título do ponto (opcional)
              </Label>
              <Input
                id="cp-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={150}
                placeholder="Ex.: vista frontal do painel"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cp-obs" className="text-xs">
                Observação (opcional)
              </Label>
              <Input
                id="cp-obs"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                maxLength={300}
                className="h-9"
              />
            </div>
          </div>

          {/* 3) Modos de falha (multi-seleção) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs font-semibold inline-flex items-center gap-1">
                <ListChecks className="h-3.5 w-3.5" /> Modos de falha ({totalAchados})
              </Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setManualOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Manual
              </Button>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar modo de falha..."
                className="pl-8 h-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            {manuais.length > 0 && (
              <div className="mb-2 space-y-1">
                {manuais.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md border border-slate-300 bg-slate-50 p-2 text-xs"
                  >
                    <span
                      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${RTI_PRIORIDADE_BADGE[clampPrioridade(m.prioridade)]}`}
                    >
                      P{m.prioridade}
                    </span>
                    <span className="flex-1 leading-snug">{m.descricao}</span>
                    <button
                      type="button"
                      onClick={() => setManuais((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
              {filtrados.size === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Nenhum modo encontrado.
                </p>
              ) : (
                [...filtrados.entries()].map(([categoria, items]) => (
                  <div key={categoria}>
                    <div className="px-2.5 py-1 bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {categoria}
                    </div>
                    {items.map((m) => {
                      const on = selecionados.has(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-start gap-2 p-2.5 cursor-pointer ${on ? "bg-primary/[0.06]" : "hover:bg-muted/30"}`}
                        >
                          <Checkbox
                            checked={on}
                            onCheckedChange={() => toggleModo(m.id)}
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium leading-snug">{m.label}</div>
                            {m.normas.length > 0 && (
                              <div className="text-[10px] text-muted-foreground">
                                {formatNormas(m.normas)}
                              </div>
                            )}
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold shrink-0 ${RTI_PRIORIDADE_BADGE[clampPrioridade(m.prioridade_sugerida)]}`}
                          >
                            P{m.prioridade_sugerida}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>

          {progresso && (
            <div className="space-y-1">
              <Progress
                value={
                  progresso.total > 0 ? Math.round((progresso.done / progresso.total) * 100) : 0
                }
                className="h-1.5"
              />
              <p className="text-[11px] text-muted-foreground text-center">
                Enviando fotos {progresso.done}/{progresso.total}…
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="p-3 border-t flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1 bg-brand-gradient text-white shadow-brand"
            onClick={salvar}
            disabled={busy || totalAchados === 0}
          >
            {busy ? "Salvando..." : `Salvar (${totalAchados})`}
          </Button>
        </DialogFooter>
      </DialogContent>

      {manualOpen && (
        <ManualAchadoDialog
          onAdd={(a) => setManuais((prev) => [...prev, a])}
          onOpenChange={(o) => {
            if (!o) setManualOpen(false);
          }}
        />
      )}
    </Dialog>
  );
}

function ManualAchadoDialog({
  onAdd,
  onOpenChange,
}: {
  onAdd: (a: AchadoNovoUI) => void;
  onOpenChange: (o: boolean) => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [recomendacao, setRecomendacao] = useState("");
  const [prioridade, setPrioridade] = useState("3");
  const [tipo, setTipo] = useState<RtiTipoExecucao>("os");

  function add(e: FormEvent) {
    e.preventDefault();
    if (!descricao.trim()) return toast.error("Descreva o achado.");
    onAdd({
      descricao: descricao.trim(),
      recomendacao: recomendacao.trim() || null,
      prioridade: Number(prioridade),
      tipo_execucao: tipo,
      observacao: null,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Achado manual</DialogTitle>
          <DialogDescription>Use quando o modo de falha não está na base padrão.</DialogDescription>
        </DialogHeader>
        <form onSubmit={add} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ma-desc">Não conformidade</Label>
            <Textarea
              id="ma-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              maxLength={2000}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ma-rec">Recomendação (opcional)</Label>
            <Textarea
              id="ma-rec"
              value={recomendacao}
              onChange={(e) => setRecomendacao(e.target.value)}
              rows={2}
              maxLength={3000}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger>
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
            <div className="space-y-1.5">
              <Label>Tipo</Label>
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
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-brand-gradient text-white shadow-brand">
              Adicionar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Adicionar nó (setor/ativo/componente) ────────────────────────────────────

function AddNodeDialog({
  inspectionId,
  parentId,
  nivel,
  proximaOrdem,
  onOpenChange,
}: {
  inspectionId: string;
  parentId: string | null;
  nivel: NivelArvore;
  proximaOrdem: number;
  onOpenChange: (o: boolean) => void;
}) {
  const upsert = useUpsertFieldNode();
  const { data: setoresHist = [] } = useSetoresHistoricos();
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return toast.error(`Informe o nome do ${NIVEL_LABEL[nivel].toLowerCase()}.`);
    setBusy(true);
    try {
      await upsert.mutateAsync({
        inspection_id: inspectionId,
        parent_id: parentId,
        nivel,
        nome: nome.trim(),
        ordem: proximaOrdem,
      });
      toast.success(`${NIVEL_LABEL[nivel]} criado.`);
      onOpenChange(false);
    } catch (err) {
      toast.error("Falha ao criar: " + (err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo {NIVEL_LABEL[nivel].toLowerCase()}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="an-nome">Nome</Label>
            <Input
              id="an-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={150}
              required
              autoFocus
              list={nivel === "setor" ? "setores-hist" : undefined}
              placeholder={
                nivel === "setor"
                  ? "Ex.: CALDEIRA"
                  : nivel === "ativo"
                    ? "Ex.: CCM-02"
                    : "Ex.: Gaveta G4"
              }
            />
            {nivel === "setor" && (
              <datalist id="setores-hist">
                {setoresHist.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
            {nivel === "setor" && setoresHist.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Comece a digitar para ver sugestões da base histórica.
              </p>
            )}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-brand-gradient text-white shadow-brand"
              disabled={busy}
            >
              {busy ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Carga de estrutura (planilha + base histórica) ──────────────────────────

function CargaEstruturaDialog({
  inspectionId,
  onOpenChange,
}: {
  inspectionId: string;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: setoresHist = [] } = useSetoresHistoricos();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [busy, setBusy] = useState(false);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return t ? setoresHist.filter((s) => s.toLowerCase().includes(t)) : setoresHist;
  }, [setoresHist, busca]);

  async function importarPlanilha(file: File) {
    setBusy(true);
    try {
      const linhas = await parsePlanilhaEstrutura(file);
      if (linhas.length === 0) {
        toast.error("A planilha não tem linhas válidas (coluna Setor).");
        return;
      }
      const n = await bulkCreateNodes(inspectionId, linhas);
      qc.invalidateQueries({ queryKey: ["field_nodes", inspectionId] });
      toast.success(`${n} nó(s) criados a partir da planilha.`);
      onOpenChange(false);
    } catch (e) {
      toast.error("Falha ao importar: " + (e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function carregarSelecionados() {
    if (selecionados.size === 0) return toast.error("Selecione ao menos um setor.");
    setBusy(true);
    try {
      const linhas = [...selecionados].map((setor) => ({ setor, ativo: null, componente: null }));
      const n = await bulkCreateNodes(inspectionId, linhas);
      qc.invalidateQueries({ queryKey: ["field_nodes", inspectionId] });
      toast.success(`${n} setor(es) carregados.`);
      onOpenChange(false);
    } catch (e) {
      toast.error("Falha: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] sm:max-w-lg flex flex-col p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <Upload className="h-5 w-5 shrink-0 text-primary" /> Carregar setores
          </DialogTitle>
          <DialogDescription>
            Por planilha (Setor/Ativo/Componente) ou da base histórica dos setores reais.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-4">
          {/* Planilha */}
          <div className="rounded-md border p-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Por planilha
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importarPlanilha(f);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => baixarPlanilhaModeloEstrutura(setoresHist)}
                disabled={busy}
              >
                Baixar planilha modelo
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-brand-gradient text-white shadow-brand"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                <Upload className="h-4 w-4" /> Enviar planilha preenchida
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Colunas: Setor (obrigatório), Ativo, Componente. Cada linha é um caminho; o modelo já
              vem com os {setoresHist.length} setores reais de referência.
            </p>
          </div>

          {/* Base histórica */}
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Da base histórica ({selecionados.size})
              </div>
              <button
                type="button"
                className="text-[11px] text-primary"
                onClick={() => setSelecionados(new Set(filtrados))}
              >
                Marcar todos
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar setor..."
                className="pl-8 h-8 text-sm"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="max-h-52 overflow-y-auto space-y-0.5">
              {filtrados.map((s) => {
                const on = selecionados.has(s);
                return (
                  <label
                    key={s}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer ${on ? "bg-primary/[0.06]" : "hover:bg-muted/30"}`}
                  >
                    <Checkbox
                      checked={on}
                      onCheckedChange={() =>
                        setSelecionados((prev) => {
                          const n = new Set(prev);
                          if (n.has(s)) n.delete(s);
                          else n.add(s);
                          return n;
                        })
                      }
                    />
                    <span className="flex-1 truncate">{s}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 border-t flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Fechar
          </Button>
          <Button
            type="button"
            className="flex-1 bg-brand-gradient text-white shadow-brand"
            onClick={carregarSelecionados}
            disabled={busy || selecionados.size === 0}
          >
            {busy ? "Carregando..." : `Carregar ${selecionados.size} setor(es)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Compor RTI ───────────────────────────────────────────────────────────────

function ComporRtiDialog({
  inspection,
  totalAchados,
  defaultDestino,
  onOpenChange,
}: {
  inspection: FieldInspection;
  totalAchados: number;
  defaultDestino?: string;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: reports = [] } = useRtiReports();
  const upsertInspection = useUpsertFieldInspection();
  const setArquivada = useSetArquivadaCampo();

  const actorName =
    (user?.user_metadata?.display_name as string | undefined) || user?.email?.split("@")[0] || null;

  const [destino, setDestino] = useState<string>(defaultDestino ?? "novo");
  const [busy, setBusy] = useState(false);
  const [progresso, setProgresso] = useState<{ etapa: string; done: number; total: number } | null>(
    null,
  );
  const [dicaReportId, setDicaReportId] = useState<string | null>(null);

  async function compor() {
    setBusy(true);
    setProgresso({ etapa: "Preparando", done: 0, total: totalAchados });
    try {
      const result = await comporRti({
        inspection,
        destino: destino === "novo" ? { mode: "novo" } : { mode: "existente", reportId: destino },
        actorName,
        onProgress: (etapa, done, total) => setProgresso({ etapa, done, total }),
      });
      await upsertInspection.mutateAsync({
        id: inspection.id,
        titulo: inspection.titulo,
        status: "importada",
        report_id: result.reportId,
      });
      toast.success(`RTI composto: ${result.ncsCriadas} NCs e ${result.fotosCopiadas} fotos.`);
      // Mostra dica para arquivar antes de navegar para o RTI.
      setProgresso(null);
      setDicaReportId(result.reportId);
    } catch (err) {
      toast.error("Falha ao compor o RTI: " + (err as Error).message);
      setBusy(false);
      setProgresso(null);
    }
  }

  async function irParaRti(arquivar: boolean) {
    if (!dicaReportId) return;
    if (arquivar) {
      try {
        await setArquivada.mutateAsync({ id: inspection.id, arquivada_campo: true });
      } catch {
        // não bloqueia a navegação se arquivar falhar
      }
    }
    navigate({ to: "/rti/plano", search: { report: dicaReportId } });
  }

  if (dicaReportId) {
    return (
      <Dialog open onOpenChange={() => irParaRti(false)}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 leading-tight">
              <Sparkles className="h-5 w-5 shrink-0 text-primary" /> RTI atualizado!
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Já terminou a inspeção em campo?</p>
                <p className="text-muted-foreground">
                  Se sim, arquive para tirar do celular do inspetor. Se ainda vai continuar amanhã,
                  mantenha no campo.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => irParaRti(false)}>
              Continuar no campo
            </Button>
            <Button onClick={() => irParaRti(true)} disabled={setArquivada.isPending}>
              {setArquivada.isPending ? "Arquivando..." : "Concluí — arquivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!busy) onOpenChange(o);
      }}
    >
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />{" "}
            {defaultDestino ? "Recompor RTI" : "Compor RTI"}
          </DialogTitle>
          <DialogDescription>
            {defaultDestino
              ? "Achados novos viram NCs; achados já exportados atualizam a NC existente e registram histórico."
              : "Cada achado vira uma NC (área = Setor); as fotos do ponto viram evidência de constatação."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <strong className="tabular-nums">{totalAchados}</strong> achado
            {totalAchados !== 1 ? "s" : ""} serão convertidos em NCs.
          </div>
          <div className="space-y-1.5">
            <Label>Destino</Label>
            <Select value={destino} onValueChange={setDestino} disabled={busy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="novo">Criar novo relatório RTI</SelectItem>
                {reports.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    Anexar a: {r.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {progresso && (
            <div className="space-y-1">
              <Progress
                value={
                  progresso.total > 0 ? Math.round((progresso.done / progresso.total) * 100) : 0
                }
                className="h-2"
              />
              <p className="text-[11px] text-muted-foreground text-center">
                {progresso.etapa}… {progresso.done}/{progresso.total} — não feche.
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={compor}
            disabled={busy}
            className="bg-brand-gradient text-white shadow-brand"
          >
            {busy ? "Compondo..." : "Compor RTI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
