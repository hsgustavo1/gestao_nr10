import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Camera, ChevronRight, FileCheck2, MapPin, Plus, Sparkles, Trash2,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { formatDatePtBR } from "@/lib/qualificacoes";
import {
  FIELD_INSPECTION_STATUS_BADGE, FIELD_INSPECTION_STATUS_LABELS,
  type FieldPoint,
} from "@/lib/campo";
import {
  comporRti, useDeleteFieldPoint, useFieldInspection, useFieldPoints,
  useInspectionFindings, useUpsertFieldInspection, useUpsertFieldPoint,
} from "@/lib/campo-queries";
import { useRtiReports } from "@/lib/rti-queries";

export const Route = createFileRoute("/campo/inspecao/$id")({
  component: CampoInspecaoPage,
  head: () => ({ meta: [{ title: "Inspeção de Campo — RTI — Gestão NR-10" }] }),
});

function CampoInspecaoPage() {
  const { id } = Route.useParams();
  const { isStaff } = useAuth();
  const { data: inspection, isLoading } = useFieldInspection(id);
  const { data: points = [] } = useFieldPoints(id);
  const { data: findings = [] } = useInspectionFindings(id);

  const [novoPontoOpen, setNovoPontoOpen] = useState(false);
  const [comporOpen, setComporOpen] = useState(false);

  const findingsByPoint = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of findings) map.set(f.point_id, (map.get(f.point_id) ?? 0) + 1);
    return map;
  }, [findings]);

  const areasDistintas = useMemo(
    () => [...new Set(points.map((p) => p.area_nome.trim()))],
    [points],
  );

  if (isLoading || !inspection) {
    return (
      <PageShell>
        <Skeleton className="h-8 w-64" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </PageShell>
    );
  }

  const jaImportada = inspection.status === "importada";
  const totalAchados = findings.length;

  return (
    <PageShell>
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
        <Link to="/campo"><ArrowLeft className="h-4 w-4" /> Coletas de campo</Link>
      </Button>

      <div className="mt-3 flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold leading-tight">{inspection.titulo}</h1>
          <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
            {inspection.cliente && <span>{inspection.cliente}</span>}
            {inspection.local && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{inspection.local}</span>}
            {inspection.engenheiro && <span>{inspection.engenheiro}</span>}
            <span>{formatDatePtBR(inspection.data_inspecao)}</span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${FIELD_INSPECTION_STATUS_BADGE[inspection.status]}`}>
              {FIELD_INSPECTION_STATUS_LABELS[inspection.status]}
            </span>
          </div>
        </div>
      </div>

      {/* Resumo + ações */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatMini label="Pontos" value={points.length} />
        <StatMini label="Áreas" value={areasDistintas.length} />
        <StatMini label="Achados (NCs)" value={totalAchados} tone={totalAchados > 0 ? "primary" : "default"} />
        <StatMini label="Status" valueText={FIELD_INSPECTION_STATUS_LABELS[inspection.status]} />
      </div>

      {jaImportada && inspection.report_id ? (
        <Card className="mt-4 border-emerald-300 bg-emerald-50/50">
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-emerald-800 inline-flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 shrink-0" />
              Esta coleta já foi composta no Plano de Ação RTI.
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/rti/plano" search={{ report: inspection.report_id }}>
                Abrir no Plano de Ação <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : isStaff && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => setNovoPontoOpen(true)} className="bg-brand-gradient text-white shadow-brand">
            <Plus className="h-4 w-4" /> Novo ponto de coleta
          </Button>
          <Button
            variant="outline"
            disabled={totalAchados === 0}
            onClick={() => setComporOpen(true)}
            title={totalAchados === 0 ? "Registre ao menos um achado para compor o RTI" : undefined}
          >
            <Sparkles className="h-4 w-4" /> Compor RTI ({totalAchados} NC{totalAchados !== 1 ? "s" : ""})
          </Button>
        </div>
      )}

      {/* Lista de pontos */}
      <div className="mt-4 space-y-3">
        {points.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhum ponto de coleta ainda. {isStaff && "Adicione o primeiro ponto (ex.: QGBT da Sala Elétrica 2)."}
            </CardContent>
          </Card>
        ) : (
          points.map((point) => (
            <PontoCard
              key={point.id}
              point={point}
              nAchados={findingsByPoint.get(point.id) ?? 0}
              canEdit={isStaff && !jaImportada}
            />
          ))
        )}
      </div>

      {isStaff && novoPontoOpen && (
        <NovoPontoDialog
          inspectionId={id}
          areasExistentes={areasDistintas}
          proximaOrdem={points.reduce((m, p) => Math.max(m, p.ordem), 0) + 1}
          onOpenChange={(o) => { if (!o) setNovoPontoOpen(false); }}
        />
      )}

      {isStaff && comporOpen && (
        <ComporRtiDialog
          inspection={inspection}
          totalAchados={totalAchados}
          onOpenChange={(o) => { if (!o) setComporOpen(false); }}
        />
      )}
    </PageShell>
  );
}

function StatMini({ label, value, valueText, tone = "default" }: {
  label: string; value?: number; valueText?: string; tone?: "default" | "primary";
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className={`font-bold tabular-nums ${tone === "primary" ? "text-primary" : ""} ${valueText ? "text-sm" : "text-2xl"}`}>
          {valueText ?? value}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function PontoCard({ point, nAchados, canEdit }: { point: FieldPoint; nAchados: number; canEdit: boolean }) {
  const deletePoint = useDeleteFieldPoint();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Excluir o ponto "${point.nome}"? Achados e fotos serão removidos.`)) return;
    try {
      await deletePoint.mutateAsync({ id: point.id, inspection_id: point.inspection_id });
      toast.success("Ponto excluído.");
    } catch (err) {
      toast.error("Falha ao excluir: " + (err as Error).message);
    }
  }

  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardContent className="p-0">
        <Link to="/campo/ponto/$id" params={{ id: point.id }} className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="font-medium leading-tight truncate">{point.nome}</div>
            <div className="mt-0.5 text-xs text-muted-foreground truncate">
              {point.area_nome}
              {nAchados > 0
                ? ` · ${nAchados} achado${nAchados !== 1 ? "s" : ""}`
                : " · sem achados ainda"}
            </div>
          </div>
          {nAchados > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/[0.06] px-2 py-0.5 text-[11px] font-semibold text-primary shrink-0">
              <Camera className="h-3 w-3" /> {nAchados}
            </span>
          )}
          {canEdit && (
            <Button
              size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground shrink-0"
              onClick={handleDelete} title="Excluir ponto"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </Link>
      </CardContent>
    </Card>
  );
}

function NovoPontoDialog({
  inspectionId, areasExistentes, proximaOrdem, onOpenChange,
}: {
  inspectionId: string;
  areasExistentes: string[];
  proximaOrdem: number;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const upsert = useUpsertFieldPoint();

  const NOVA = "__nova__";
  const [areaSel, setAreaSel] = useState<string>(areasExistentes[0] ?? NOVA);
  const [novaArea, setNovaArea] = useState("");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const area = areaSel === NOVA ? novaArea.trim() : areaSel;
    if (!area) return toast.error("Informe a área do ponto.");
    if (!nome.trim()) return toast.error("Informe o nome do ponto.");
    setBusy(true);
    try {
      const p = await upsert.mutateAsync({
        inspection_id: inspectionId,
        area_nome: area,
        nome: nome.trim(),
        ordem: proximaOrdem,
      });
      toast.success("Ponto criado. Registre os achados.");
      navigate({ to: "/campo/ponto/$id", params: { id: p.id } });
    } catch (err) {
      toast.error("Falha ao criar: " + (err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <MapPin className="h-5 w-5 shrink-0 text-primary" /> Novo ponto de coleta
          </DialogTitle>
          <DialogDescription>
            A área vira o agrupamento da NC no RTI; o ponto é o equipamento/local inspecionado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Área</Label>
            <Select value={areaSel} onValueChange={setAreaSel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {areasExistentes.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                <SelectItem value={NOVA}>+ Nova área...</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {areaSel === NOVA && (
            <div className="space-y-1.5">
              <Label htmlFor="np-area">Nome da nova área</Label>
              <Input id="np-area" value={novaArea} onChange={(e) => setNovaArea(e.target.value)} maxLength={150} placeholder="Ex.: Sala Elétrica 2 / Subestação" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="np-nome">Ponto / equipamento</Label>
            <Input id="np-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={150} placeholder="Ex.: QGBT, CCM-02, Transformador T1" required />
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
            <Button type="submit" disabled={busy} className="bg-brand-gradient text-white shadow-brand">
              {busy ? "Criando..." : "Criar e coletar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ComporRtiDialog({
  inspection, totalAchados, onOpenChange,
}: {
  inspection: import("@/lib/campo").FieldInspection;
  totalAchados: number;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: reports = [] } = useRtiReports();
  const upsertInspection = useUpsertFieldInspection();

  const actorName =
    (user?.user_metadata?.display_name as string | undefined) ||
    user?.email?.split("@")[0] || null;

  const [destino, setDestino] = useState<string>("novo");
  const [busy, setBusy] = useState(false);
  const [progresso, setProgresso] = useState<{ etapa: string; done: number; total: number } | null>(null);

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
      // garante o vínculo mesmo que a função RPC já tenha atualizado
      await upsertInspection.mutateAsync({
        id: inspection.id, titulo: inspection.titulo,
        status: "importada", report_id: result.reportId,
      });
      toast.success(`RTI composto: ${result.ncsCriadas} NCs e ${result.fotosCopiadas} fotos.`);
      navigate({ to: "/rti/plano", search: { report: result.reportId } });
    } catch (err) {
      toast.error("Falha ao compor o RTI: " + (err as Error).message);
      setBusy(false);
      setProgresso(null);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" /> Compor RTI
          </DialogTitle>
          <DialogDescription>
            Cada achado vira uma NC do Plano de Ação, com as fotos anexadas como evidência de constatação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <strong className="tabular-nums">{totalAchados}</strong> achado{totalAchados !== 1 ? "s" : ""} serão convertidos em NCs.
          </div>
          <div className="space-y-1.5">
            <Label>Destino</Label>
            <Select value={destino} onValueChange={setDestino} disabled={busy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="novo">Criar novo relatório RTI</SelectItem>
                {reports.length > 0 && reports.map((r) => (
                  <SelectItem key={r.id} value={r.id}>Anexar a: {r.titulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {destino === "novo"
                ? "Um novo relatório será criado com os dados desta inspeção."
                : "As NCs serão numeradas na sequência do relatório escolhido."}
            </p>
          </div>

          {progresso && (
            <div className="space-y-1">
              <Progress value={progresso.total > 0 ? Math.round((progresso.done / progresso.total) * 100) : 0} className="h-2" />
              <p className="text-[11px] text-muted-foreground text-center">
                {progresso.etapa}… {progresso.done}/{progresso.total} — não feche esta tela.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button type="button" onClick={compor} disabled={busy} className="bg-brand-gradient text-white shadow-brand">
            {busy ? "Compondo..." : "Compor RTI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
