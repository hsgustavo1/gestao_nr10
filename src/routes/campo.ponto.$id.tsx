import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Camera, ImagePlus, ListChecks, MapPin, Pencil, Plus, Search, Trash2,
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
  NIVEL_LABEL, formatNormas, modosPorCategoria, nodePath,
  type FieldFinding, type FieldPhoto, type RtiModoFalha,
} from "@/lib/campo";
import {
  uploadFieldPhoto, useAddFieldPhoto, useDeleteFieldFinding, useDeleteFieldPhoto,
  useFieldFindings, useFieldNodes, useFieldPoint, useModosFalha, usePointPhotos,
  useUpdateFieldPhoto, useUpsertFieldFinding,
} from "@/lib/campo-queries";
import { rtiFileUrl } from "@/lib/rti-queries";

export const Route = createFileRoute("/campo/ponto/$id")({
  component: CampoPontoPage,
  head: () => ({ meta: [{ title: "Coleta do Ponto — RTI — Gestão NR-10" }] }),
});

function CampoPontoPage() {
  const { id } = Route.useParams();
  const { isStaff } = useAuth();
  const { data: point, isLoading } = useFieldPoint(id);
  const { data: nodes = [] } = useFieldNodes(point?.inspection_id);
  const { data: findings = [] } = useFieldFindings(id);
  const { data: photos = [] } = usePointPhotos(id);

  const [modoSheetOpen, setModoSheetOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editFinding, setEditFinding] = useState<FieldFinding | null>(null);
  const [preview, setPreview] = useState<FieldPhoto | null>(null);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const path = useMemo(() => (point ? nodePath(point.node_id, nodeById) : []), [point, nodeById]);

  const addPhoto = useAddFieldPhoto();
  const deletePhoto = useDeleteFieldPhoto();
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0 || !point) return;
    const list = [...files].filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    setUploading(true);
    try {
      let ordem = photos.length;
      for (const f of list) {
        const { path: fp, name } = await uploadFieldPhoto(f);
        await addPhoto.mutateAsync({ point_id: point.id, file_path: fp, file_name: name, legenda: null, ordem: ordem++ });
      }
      toast.success(`${list.length} foto(s) anexada(s).`);
    } catch (e) {
      toast.error("Falha no upload: " + (e as Error).message);
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  async function removePhoto(ph: FieldPhoto) {
    if (!point || !window.confirm("Excluir esta foto?")) return;
    try {
      await deletePhoto.mutateAsync({ id: ph.id, file_path: ph.file_path, point_id: point.id });
      toast.success("Foto excluída.");
    } catch (e) {
      toast.error("Falha: " + (e as Error).message);
    }
  }

  const isImage = (ph: FieldPhoto) => /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(ph.file_name);

  if (isLoading || !point) {
    return (
      <PageShell>
        <Skeleton className="h-8 w-64" />
        <div className="mt-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
        <Link to="/campo/inspecao/$id" params={{ id: point.inspection_id }}><ArrowLeft className="h-4 w-4" /> Inspeção</Link>
      </Button>

      <div className="mt-2">
        <h1 className="text-xl sm:text-2xl font-bold leading-tight">{point.titulo || "Ponto de coleta"}</h1>
        <div className="mt-0.5 text-xs text-muted-foreground inline-flex items-center gap-1 flex-wrap">
          <MapPin className="h-3 w-3" />
          {path.map((n, i) => (
            <span key={n.id}>{i > 0 && " › "}<span title={NIVEL_LABEL[n.nivel]}>{n.nome}</span></span>
          ))}
        </div>
        {point.observacoes && <p className="mt-1 text-xs text-muted-foreground">{point.observacoes}</p>}
      </div>

      {/* Fotos do ponto */}
      <Card className="mt-4">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold inline-flex items-center gap-1.5"><Camera className="h-4 w-4 text-primary" /> Fotos ({photos.length})</h2>
            {isStaff && (
              <>
                <input ref={cameraRef} type="file" accept="image/*,application/pdf" multiple capture="environment" className="hidden" onChange={(e) => onFiles(e.target.files)} />
                <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => cameraRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" /> {uploading ? "Enviando..." : "Foto"}
                </Button>
              </>
            )}
          </div>
          {photos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma foto. Toque em "Foto" para anexar.</p>
          ) : (
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
                  {isStaff && (
                    <button type="button" onClick={() => removePhoto(ph)} className="absolute top-1 right-1 hidden group-hover:grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white hover:bg-red-600" title="Excluir foto">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modos de falha (achados) */}
      <div className="mt-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold inline-flex items-center gap-1.5"><ListChecks className="h-4 w-4 text-primary" /> Modos de falha ({findings.length})</h2>
        {isStaff && (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setModoSheetOpen(true)}><Plus className="h-4 w-4" /> Da base</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditFinding(null); setManualOpen(true); }}>Manual</Button>
          </div>
        )}
      </div>
      <div className="mt-2 space-y-2">
        {findings.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhum modo de falha. Adicione da base ou manual.</CardContent></Card>
        ) : (
          findings.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[11px] font-bold ${RTI_PRIORIDADE_BADGE[clampPrioridade(f.prioridade)]}`}>P{f.prioridade}</span>
                    <span className="text-[11px] text-muted-foreground">{RTI_TIPO_EXECUCAO_LABELS[f.tipo_execucao]}</span>
                    {!f.modo_falha_id && <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">manual</span>}
                  </div>
                  <p className="mt-1 text-sm leading-snug whitespace-pre-wrap">{f.descricao}</p>
                  {f.recomendacao && <p className="mt-1 text-[11px] text-muted-foreground leading-snug"><span className="font-semibold">Recomendação:</span> {f.recomendacao}</p>}
                </div>
                {isStaff && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditFinding(f); setManualOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <DeleteFindingButton finding={f} pointId={id} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {isStaff && modoSheetOpen && (
        <ModosFalhaSheet pointId={id} jaSelecionados={new Set(findings.map((f) => f.modo_falha_id).filter(Boolean) as string[])} onOpenChange={(o) => { if (!o) setModoSheetOpen(false); }} />
      )}
      {isStaff && manualOpen && (
        <FindingDialog pointId={id} existing={editFinding} onOpenChange={(o) => { if (!o) { setManualOpen(false); setEditFinding(null); } }} />
      )}
      {preview && (
        <PhotoLightbox photo={preview} pointId={id} canEdit={isStaff} onClose={() => setPreview(null)} />
      )}
    </PageShell>
  );
}

function DeleteFindingButton({ finding, pointId }: { finding: FieldFinding; pointId: string }) {
  const del = useDeleteFieldFinding();
  async function handle() {
    if (!window.confirm("Excluir este modo de falha?")) return;
    try {
      await del.mutateAsync({ id: finding.id, point_id: pointId });
      toast.success("Excluído.");
    } catch (e) {
      toast.error("Falha: " + (e as Error).message);
    }
  }
  return <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={handle}><Trash2 className="h-3.5 w-3.5" /></Button>;
}

function PhotoLightbox({ photo, pointId, canEdit, onClose }: { photo: FieldPhoto; pointId: string; canEdit: boolean; onClose: () => void }) {
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
      toast.error("Falha: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] p-3">
        <DialogHeader className="pr-8"><DialogTitle className="text-sm leading-tight truncate">{photo.file_name}</DialogTitle></DialogHeader>
        <img src={rtiFileUrl(photo.file_path)} alt={photo.legenda ?? photo.file_name} className="max-h-[60vh] w-full object-contain rounded" />
        {canEdit && (
          <div className="flex items-center gap-2">
            <Input value={legenda} onChange={(e) => setLegenda(e.target.value)} placeholder="Legenda (opcional)" maxLength={300} className="h-8 text-sm" />
            <Button type="button" size="sm" className="h-8 bg-brand-gradient text-white shadow-brand" disabled={busy || !dirty} onClick={salvar}>{busy ? "..." : "Salvar"}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ModosFalhaSheet({ pointId, jaSelecionados, onOpenChange }: { pointId: string; jaSelecionados: Set<string>; onOpenChange: (o: boolean) => void }) {
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
        point_id: pointId, modo_falha_id: modo.id, descricao: modo.descricao_padrao,
        recomendacao: modo.recomendacao_padrao, prioridade: modo.prioridade_sugerida, tipo_execucao: modo.tipo_execucao_sugerido,
      });
      toast.success(`Adicionado: ${modo.label}`);
    } catch (e) {
      toast.error("Falha: " + (e as Error).message);
    } finally {
      setTimeout(() => setAplicado(null), 500);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] sm:max-w-lg flex flex-col p-0">
        <DialogHeader className="p-4 pb-2"><DialogTitle className="flex items-center gap-2 leading-tight"><ListChecks className="h-5 w-5 shrink-0 text-primary" /> Modos de falha</DialogTitle><DialogDescription>Toque para adicionar como achado deste ponto.</DialogDescription></DialogHeader>
        <div className="px-4 pb-2">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Buscar..." className="pl-8 h-9" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {isLoading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />) : filtrados.size === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum modo encontrado.</p>
          ) : (
            [...filtrados.entries()].map(([categoria, items]) => (
              <div key={categoria}>
                <div className="sticky top-0 bg-background py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{categoria}</div>
                <div className="space-y-1.5 mt-1">
                  {items.map((m) => {
                    const ja = jaSelecionados.has(m.id);
                    return (
                      <button key={m.id} type="button" onClick={() => adicionar(m)} disabled={aplicado === m.id || ja} className="w-full text-left rounded-md border p-2.5 transition-colors hover:border-primary/40 hover:bg-muted/30 disabled:opacity-50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium leading-snug">{m.label}{ja && <span className="ml-1 text-[10px] text-emerald-600">(já adicionado)</span>}</div>
                            {m.normas.length > 0 && <div className="mt-0.5 text-[10px] text-muted-foreground">{formatNormas(m.normas)}</div>}
                          </div>
                          <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold shrink-0 ${RTI_PRIORIDADE_BADGE[clampPrioridade(m.prioridade_sugerida)]}`}>P{m.prioridade_sugerida}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
        <DialogFooter className="p-4 pt-2 border-t"><Button type="button" variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Concluir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FindingDialog({ pointId, existing, onOpenChange }: { pointId: string; existing: FieldFinding | null; onOpenChange: (o: boolean) => void }) {
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
        point_id: pointId, modo_falha_id: existing?.modo_falha_id ?? null,
        descricao: descricao.trim(), recomendacao: recomendacao.trim() || null,
        prioridade: Number(prioridade), tipo_execucao: tipo, observacao: observacao.trim() || null,
      });
      toast.success(isEdit ? "Atualizado." : "Adicionado.");
      onOpenChange(false);
    } catch (err) {
      toast.error("Falha: " + (err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Editar achado" : "Achado manual"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="fd-desc">Não conformidade</Label><Textarea id="fd-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={2000} required /></div>
          <div className="space-y-1.5"><Label htmlFor="fd-rec">Recomendação (opcional)</Label><Textarea id="fd-rec" value={recomendacao} onChange={(e) => setRecomendacao(e.target.value)} rows={2} maxLength={3000} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Prioridade</Label><Select value={prioridade} onValueChange={setPrioridade}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RTI_PRIORIDADES.map((p) => <SelectItem key={p} value={String(p)}>{RTI_PRIORIDADE_LABELS[p]}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Tipo</Label><Select value={tipo} onValueChange={(v) => setTipo(v as RtiTipoExecucao)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="os">OS (manutenção)</SelectItem><SelectItem value="investimento">Investimento</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="fd-obs">Observação de campo (opcional)</Label><Input id="fd-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={500} /></div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
            <Button type="submit" disabled={busy} className="bg-brand-gradient text-white shadow-brand">{busy ? "Salvando..." : (isEdit ? "Salvar" : "Adicionar")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
