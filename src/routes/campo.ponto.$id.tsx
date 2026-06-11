import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Camera, ChevronRight, ImagePlus, ListChecks, Pencil, Plus, Search, Trash2, X,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import {
  RTI_PRIORIDADE_BADGE, RTI_PRIORIDADE_LABELS, RTI_PRIORIDADES, RTI_TIPO_EXECUCAO_LABELS,
  clampPrioridade, type RtiTipoExecucao,
} from "@/lib/rti";
import {
  formatNormas, modosPorCategoria,
  type FieldFinding, type FieldPhoto, type RtiModoFalha,
} from "@/lib/campo";
import {
  uploadFieldPhoto, useAddFieldPhoto, useDeleteFieldFinding, useDeleteFieldPhoto,
  useFieldFindings, useFieldPoint, useModosFalha, usePointPhotos, useUpdateFieldPhoto,
  useUpsertFieldFinding,
} from "@/lib/campo-queries";
import { rtiFileUrl } from "@/lib/rti-queries";

export const Route = createFileRoute("/campo/ponto/$id")({
  component: CampoPontoPage,
  head: () => ({ meta: [{ title: "Coleta do Ponto — RTI — Gestão NR-10" }] }),
});

function CampoPontoPage() {
  const { id } = Route.useParams();
  const { isStaff, user } = useAuth();
  const { data: point, isLoading } = useFieldPoint(id);
  const { data: findings = [] } = useFieldFindings(id);
  const { data: photos = [] } = usePointPhotos(id);

  const [modoSheetOpen, setModoSheetOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editFinding, setEditFinding] = useState<FieldFinding | null>(null);

  const actorName =
    (user?.user_metadata?.display_name as string | undefined) ||
    user?.email?.split("@")[0] || null;

  const photosByFinding = useMemo(() => {
    const map = new Map<string, FieldPhoto[]>();
    for (const ph of photos) {
      const arr = map.get(ph.finding_id);
      if (arr) arr.push(ph);
      else map.set(ph.finding_id, [ph]);
    }
    return map;
  }, [photos]);

  if (isLoading || !point) {
    return (
      <PageShell>
        <Skeleton className="h-8 w-64" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
        <Link to="/campo/inspecao/$id" params={{ id: point.inspection_id }}>
          <ArrowLeft className="h-4 w-4" /> Pontos da inspeção
        </Link>
      </Button>

      <div className="mt-3">
        <h1 className="text-xl sm:text-2xl font-bold leading-tight">{point.nome}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">{point.area_nome}</p>
      </div>

      {isStaff && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => setModoSheetOpen(true)} className="bg-brand-gradient text-white shadow-brand">
            <ListChecks className="h-4 w-4" /> Adicionar modo de falha
          </Button>
          <Button variant="outline" onClick={() => { setEditFinding(null); setManualOpen(true); }}>
            <Plus className="h-4 w-4" /> Achado manual
          </Button>
        </div>
      )}

      {/* Achados do ponto */}
      <div className="mt-4 space-y-3">
        {findings.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhum achado neste ponto. Selecione um modo de falha pré-mapeado ou registre um achado manual.
            </CardContent>
          </Card>
        ) : (
          findings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              photos={photosByFinding.get(finding.id) ?? []}
              pointId={id}
              canEdit={isStaff}
              actorName={actorName}
              onEdit={() => { setEditFinding(finding); setManualOpen(true); }}
            />
          ))
        )}
      </div>

      {isStaff && modoSheetOpen && (
        <ModosFalhaSheet
          pointId={id}
          onOpenChange={(o) => { if (!o) setModoSheetOpen(false); }}
        />
      )}

      {isStaff && manualOpen && (
        <FindingDialog
          pointId={id}
          existing={editFinding}
          onOpenChange={(o) => { if (!o) { setManualOpen(false); setEditFinding(null); } }}
        />
      )}
    </PageShell>
  );
}

function FindingCard({
  finding, photos, pointId, canEdit, actorName, onEdit,
}: {
  finding: FieldFinding;
  photos: FieldPhoto[];
  pointId: string;
  canEdit: boolean;
  actorName: string | null;
  onEdit: () => void;
}) {
  const deleteFinding = useDeleteFieldFinding();
  const addPhoto = useAddFieldPhoto();
  const deletePhoto = useDeleteFieldPhoto();
  const [busy, setBusy] = useState(false);
  const [progresso, setProgresso] = useState<{ done: number; total: number } | null>(null);
  const [preview, setPreview] = useState<FieldPhoto | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = [...files];
    setBusy(true);
    setProgresso({ done: 0, total: list.length });
    try {
      let done = 0;
      for (const f of list) {
        if (!f.type.startsWith("image/") && f.type !== "application/pdf") {
          toast.error(`"${f.name}": apenas imagens ou PDF.`);
          continue;
        }
        const { path, name } = await uploadFieldPhoto(f);
        await addPhoto.mutateAsync({
          finding_id: finding.id,
          point_id: pointId,
          file_path: path,
          file_name: name,
          legenda: null,
        });
        done += 1;
        setProgresso({ done, total: list.length });
      }
      toast.success(`${done} foto${done !== 1 ? "s" : ""} anexada${done !== 1 ? "s" : ""}.`);
    } catch (e) {
      toast.error("Falha no upload: " + (e as Error).message);
    } finally {
      setBusy(false);
      setProgresso(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDeleteFinding() {
    if (!window.confirm("Excluir este achado e suas fotos?")) return;
    try {
      await deleteFinding.mutateAsync({ id: finding.id, point_id: pointId });
      toast.success("Achado excluído.");
    } catch (e) {
      toast.error("Falha ao excluir: " + (e as Error).message);
    }
  }

  async function removePhoto(ph: FieldPhoto) {
    if (!window.confirm("Excluir esta foto?")) return;
    try {
      await deletePhoto.mutateAsync({ id: ph.id, file_path: ph.file_path, point_id: pointId });
      toast.success("Foto excluída.");
    } catch (e) {
      toast.error("Falha ao excluir: " + (e as Error).message);
    }
  }

  const isImage = (ph: FieldPhoto) => /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(ph.file_name);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[11px] font-bold ${RTI_PRIORIDADE_BADGE[clampPrioridade(finding.prioridade)]}`}>
                P{finding.prioridade}
              </span>
              <span className="text-[11px] text-muted-foreground">{RTI_TIPO_EXECUCAO_LABELS[finding.tipo_execucao]}</span>
              {!finding.modo_falha_id && (
                <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">manual</span>
              )}
            </div>
            <p className="mt-1 text-sm leading-snug whitespace-pre-wrap">{finding.descricao}</p>
            {finding.recomendacao && (
              <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                <span className="font-semibold">Recomendação:</span> {finding.recomendacao}
              </p>
            )}
            {finding.observacao && (
              <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                <span className="font-semibold">Obs. de campo:</span> {finding.observacao}
              </p>
            )}
          </div>
          {canEdit && (
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit} title="Editar achado">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={handleDeleteFinding} title="Excluir achado">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Fotos */}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((ph) => (
              <div key={ph.id} className="group relative rounded-md border overflow-hidden bg-muted/20">
                {isImage(ph) ? (
                  <button type="button" className="block w-full aspect-square cursor-zoom-in" onClick={() => setPreview(ph)} title={ph.legenda ?? ph.file_name}>
                    <img src={rtiFileUrl(ph.file_path)} alt={ph.legenda ?? ph.file_name} loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ) : (
                  <a href={rtiFileUrl(ph.file_path)} target="_blank" rel="noreferrer" className="flex aspect-square flex-col items-center justify-center gap-1 p-2 text-center">
                    <Camera className="h-6 w-6 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground line-clamp-2 break-all">{ph.file_name}</span>
                  </a>
                )}
                {canEdit && (
                  <button
                    type="button" onClick={() => removePhoto(ph)}
                    className="absolute top-1 right-1 hidden group-hover:grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white hover:bg-red-600"
                    title="Excluir foto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="flex items-center gap-2">
            <input
              ref={fileRef} type="file" accept="image/*,application/pdf" multiple capture="environment"
              className="hidden" onChange={(e) => onFiles(e.target.files)}
            />
            <Button type="button" size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-4 w-4" /> {busy ? `Enviando ${progresso?.done ?? 0}/${progresso?.total ?? 0}...` : "Foto"}
            </Button>
            <span className="text-[11px] text-muted-foreground">{photos.length} foto{photos.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </CardContent>

      {preview && (
        <PhotoLightbox photo={preview} pointId={pointId} canEdit={canEdit} actorName={actorName} onClose={() => setPreview(null)} />
      )}
    </Card>
  );
}

function PhotoLightbox({
  photo, pointId, canEdit, onClose,
}: {
  photo: FieldPhoto;
  pointId: string;
  canEdit: boolean;
  actorName: string | null;
  onClose: () => void;
}) {
  const updatePhoto = useUpdateFieldPhoto();
  const [legenda, setLegenda] = useState(photo.legenda ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = legenda.trim() !== (photo.legenda ?? "").trim();

  async function salvar() {
    setBusy(true);
    try {
      await updatePhoto.mutateAsync({ id: photo.id, point_id: pointId, legenda: legenda.trim() || null });
      toast.success("Legenda salva.");
      onClose();
    } catch (e) {
      toast.error("Falha ao salvar: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] p-3">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-sm leading-tight truncate">{photo.file_name}</DialogTitle>
        </DialogHeader>
        <img src={rtiFileUrl(photo.file_path)} alt={photo.legenda ?? photo.file_name} className="max-h-[60vh] w-full object-contain rounded" />
        {canEdit ? (
          <div className="flex items-center gap-2">
            <Input value={legenda} onChange={(e) => setLegenda(e.target.value)} placeholder="Legenda (opcional)" maxLength={300} className="h-8 text-sm" />
            <Button type="button" size="sm" className="h-8 bg-brand-gradient text-white shadow-brand" disabled={busy || !dirty} onClick={salvar}>
              {busy ? "..." : "Salvar"}
            </Button>
          </div>
        ) : photo.legenda && <p className="text-sm">{photo.legenda}</p>}
      </DialogContent>
    </Dialog>
  );
}

// ── Seletor de modos de falha ────────────────────────────────────────────────

function ModosFalhaSheet({ pointId, onOpenChange }: { pointId: string; onOpenChange: (o: boolean) => void }) {
  const { data: modos = [], isLoading } = useModosFalha();
  const upsertFinding = useUpsertFieldFinding();
  const [busca, setBusca] = useState("");
  const [aplicado, setAplicado] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const list = t
      ? modos.filter((m) => m.ativo && (m.label.toLowerCase().includes(t) || m.categoria.toLowerCase().includes(t) || m.descricao_padrao.toLowerCase().includes(t)))
      : modos.filter((m) => m.ativo);
    return modosPorCategoria(list);
  }, [modos, busca]);

  async function adicionar(modo: RtiModoFalha) {
    setAplicado(modo.id);
    try {
      await upsertFinding.mutateAsync({
        point_id: pointId,
        modo_falha_id: modo.id,
        descricao: modo.descricao_padrao,
        recomendacao: modo.recomendacao_padrao,
        prioridade: modo.prioridade_sugerida,
        tipo_execucao: modo.tipo_execucao_sugerido,
      });
      toast.success(`Adicionado: ${modo.label}`);
    } catch (e) {
      toast.error("Falha ao adicionar: " + (e as Error).message);
    } finally {
      setTimeout(() => setAplicado(null), 600);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] sm:max-w-lg flex flex-col p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <ListChecks className="h-5 w-5 shrink-0 text-primary" /> Modos de falha
          </DialogTitle>
          <DialogDescription>
            Toque para adicionar como achado. Os textos vêm da base padrão e podem ser editados depois.
          </DialogDescription>
        </DialogHeader>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar modo de falha..." className="pl-8 h-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)
          ) : filtrados.size === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum modo de falha encontrado.</p>
          ) : (
            [...filtrados.entries()].map(([categoria, items]) => (
              <div key={categoria}>
                <div className="sticky top-0 bg-background py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{categoria}</div>
                <div className="space-y-1.5 mt-1">
                  {items.map((m) => (
                    <button
                      key={m.id} type="button" onClick={() => adicionar(m)} disabled={aplicado === m.id}
                      className="w-full text-left rounded-md border p-2.5 transition-colors hover:border-primary/40 hover:bg-muted/30 disabled:opacity-60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium leading-snug">{m.label}</div>
                          {m.normas.length > 0 && (
                            <div className="mt-0.5 text-[10px] text-muted-foreground">{formatNormas(m.normas)}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${RTI_PRIORIDADE_BADGE[clampPrioridade(m.prioridade_sugerida)]}`}>
                            P{m.prioridade_sugerida}
                          </span>
                          <Plus className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <DialogFooter className="p-4 pt-2 border-t">
          <Button type="button" variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Concluir <ChevronRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Achado manual / edição ───────────────────────────────────────────────────

function FindingDialog({
  pointId, existing, onOpenChange,
}: {
  pointId: string;
  existing: FieldFinding | null;
  onOpenChange: (o: boolean) => void;
}) {
  const isEdit = !!existing;
  const upsert = useUpsertFieldFinding();

  const [descricao, setDescricao] = useState(existing?.descricao ?? "");
  const [recomendacao, setRecomendacao] = useState(existing?.recomendacao ?? "");
  const [prioridade, setPrioridade] = useState(String(existing?.prioridade ?? 3));
  const [tipo, setTipo] = useState<RtiTipoExecucao>(existing?.tipo_execucao ?? "os");
  const [observacao, setObservacao] = useState(existing?.observacao ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!descricao.trim()) return toast.error("Descreva o achado.");
    setBusy(true);
    try {
      await upsert.mutateAsync({
        ...(isEdit ? { id: existing!.id } : {}),
        point_id: pointId,
        modo_falha_id: existing?.modo_falha_id ?? null,
        descricao: descricao.trim(),
        recomendacao: recomendacao.trim() || null,
        prioridade: Number(prioridade),
        tipo_execucao: tipo,
        observacao: observacao.trim() || null,
      });
      toast.success(isEdit ? "Achado atualizado." : "Achado registrado.");
      onOpenChange(false);
    } catch (err) {
      toast.error("Falha ao salvar: " + (err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <Pencil className="h-5 w-5 shrink-0 text-primary" /> {isEdit ? "Editar achado" : "Achado manual"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Ajuste os textos que irão compor a NC." : "Use quando o modo de falha não estiver na base padrão."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fd-desc">Não conformidade constatada</Label>
            <Textarea id="fd-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={2000} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fd-rec">Recomendação (opcional)</Label>
            <Textarea id="fd-rec" value={recomendacao} onChange={(e) => setRecomendacao(e.target.value)} rows={2} maxLength={3000} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RTI_PRIORIDADES.map((p) => <SelectItem key={p} value={String(p)}>{RTI_PRIORIDADE_LABELS[p]}</SelectItem>)}
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
          <div className="space-y-1.5">
            <Label htmlFor="fd-obs">Observação de campo (opcional)</Label>
            <Input id="fd-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={500} placeholder="Ex.: medição registrada, condição no momento da visita" />
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
            <Button type="submit" disabled={busy} className="bg-brand-gradient text-white shadow-brand">
              {busy ? "Salvando..." : (isEdit ? "Salvar" : "Registrar achado")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
