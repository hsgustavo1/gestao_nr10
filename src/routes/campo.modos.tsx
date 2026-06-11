import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, ListChecks, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
  RTI_PRIORIDADE_BADGE, RTI_PRIORIDADE_LABELS, RTI_PRIORIDADES, clampPrioridade,
  type RtiTipoExecucao,
} from "@/lib/rti";
import {
  formatNormas, modosPorCategoria, type NormaRef, type RtiModoFalha,
} from "@/lib/campo";
import { useDeleteModoFalha, useModosFalha, useUpsertModoFalha } from "@/lib/campo-queries";

export const Route = createFileRoute("/campo/modos")({
  component: CampoModosPage,
  head: () => ({ meta: [{ title: "Modos de Falha — RTI — Gestão NR-10" }] }),
});

function slugify(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function CampoModosPage() {
  const { isStaff, isAdmin } = useAuth();
  const { data: modos = [], isLoading } = useModosFalha();
  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RtiModoFalha | null>(null);

  const porCategoria = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const list = t
      ? modos.filter((m) => m.label.toLowerCase().includes(t) || m.categoria.toLowerCase().includes(t) || m.descricao_padrao.toLowerCase().includes(t))
      : modos;
    // mostra inclusive inativos nesta tela de gestão
    const map = new Map<string, RtiModoFalha[]>();
    for (const m of [...list].sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label))) {
      const arr = map.get(m.categoria);
      if (arr) arr.push(m);
      else map.set(m.categoria, [m]);
    }
    return map;
  }, [modos, busca]);

  return (
    <PageShell>
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
        <Link to="/campo"><ArrowLeft className="h-4 w-4" /> Coleta em campo</Link>
      </Button>

      <div className="mt-3 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <ListChecks className="h-5 w-5 shrink-0 text-primary" />
            Base de modos de falha
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Suporte do engenheiro em campo — textos-modelo de NC e recomendação por modo de falha.
          </p>
        </div>
        {isStaff && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-brand-gradient text-white shadow-brand">
            <Plus className="h-4 w-4" /> Novo modo
          </Button>
        )}
      </div>

      <div className="mt-4 relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Buscar modo de falha..." className="pl-8" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <div className="mt-4 space-y-5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)
        ) : porCategoria.size === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum modo de falha encontrado.</CardContent></Card>
        ) : (
          [...porCategoria.entries()].map(([categoria, items]) => (
            <div key={categoria}>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">{categoria}</h2>
              <div className="space-y-2">
                {items.map((m) => (
                  <Card key={m.id} className={m.ativo ? "" : "opacity-60"}>
                    <CardContent className="p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium leading-snug">{m.label}</span>
                          <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${RTI_PRIORIDADE_BADGE[clampPrioridade(m.prioridade_sugerida)]}`}>
                            P{m.prioridade_sugerida}
                          </span>
                          {!m.ativo && <span className="text-[10px] text-muted-foreground">(inativo)</span>}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{m.descricao_padrao}</p>
                        {m.normas.length > 0 && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">{formatNormas(m.normas)}</p>
                        )}
                      </div>
                      {isStaff && (
                        <div className="flex shrink-0 gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditing(m); setDialogOpen(true); }} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin && <DeleteModoButton modo={m} />}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {isStaff && dialogOpen && (
        <ModoDialog
          existing={editing}
          existingCodigos={new Set(modos.map((m) => m.codigo))}
          maxOrdem={modos.reduce((mx, m) => Math.max(mx, m.ordem), 0)}
          onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
          slugify={slugify}
        />
      )}
    </PageShell>
  );
}

function DeleteModoButton({ modo }: { modo: RtiModoFalha }) {
  const del = useDeleteModoFalha();
  async function handle() {
    if (!window.confirm(`Excluir o modo "${modo.label}"? Achados já registrados não são afetados.`)) return;
    try {
      await del.mutateAsync(modo.id);
      toast.success("Modo excluído.");
    } catch (e) {
      toast.error("Falha ao excluir: " + (e as Error).message);
    }
  }
  return (
    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={handle} title="Excluir">
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

function ModoDialog({
  existing, existingCodigos, maxOrdem, onOpenChange, slugify,
}: {
  existing: RtiModoFalha | null;
  existingCodigos: Set<string>;
  maxOrdem: number;
  onOpenChange: (o: boolean) => void;
  slugify: (s: string) => string;
}) {
  const isEdit = !!existing;
  const upsert = useUpsertModoFalha();

  const [label, setLabel] = useState(existing?.label ?? "");
  const [categoria, setCategoria] = useState(existing?.categoria ?? "");
  const [descricao, setDescricao] = useState(existing?.descricao_padrao ?? "");
  const [recomendacao, setRecomendacao] = useState(existing?.recomendacao_padrao ?? "");
  const [prioridade, setPrioridade] = useState(String(existing?.prioridade_sugerida ?? 3));
  const [tipo, setTipo] = useState<RtiTipoExecucao>(existing?.tipo_execucao_sugerido ?? "os");
  const [ativo, setAtivo] = useState(existing?.ativo ?? true);
  const [normasTexto, setNormasTexto] = useState(
    (existing?.normas ?? []).map((n) => (n.item && n.item !== "—" ? `${n.norma} ${n.item}` : n.norma)).join("\n"),
  );
  const [busy, setBusy] = useState(false);

  /** Cada linha "NBR 5410 6.4" vira {norma, item}; sem item vira item "—". */
  function parseNormas(texto: string): NormaRef[] {
    return texto.split("\n").map((l) => l.trim()).filter(Boolean).map((linha) => {
      const m = linha.match(/^(NBR\s*\d+(?:-\d+)?|NR-?\d+|IEC\s*\d+)\s*(.*)$/i);
      if (m) return { norma: m[1].replace(/\s+/, " ").toUpperCase().replace("NR", "NR-").replace("NR--", "NR-"), item: m[2].trim() || "—" };
      return { norma: linha, item: "—" };
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return toast.error("Informe o nome (label) do modo de falha.");
    if (!categoria.trim()) return toast.error("Informe a categoria.");
    if (!descricao.trim()) return toast.error("Informe a descrição-padrão da NC.");

    let codigo = existing?.codigo ?? slugify(label);
    if (!isEdit) {
      let base = codigo || `modo-${Date.now()}`;
      let n = 1;
      while (existingCodigos.has(codigo)) { codigo = `${base}-${n++}`; }
    }

    setBusy(true);
    try {
      await upsert.mutateAsync({
        ...(isEdit ? { id: existing!.id } : {}),
        codigo,
        label: label.trim(),
        categoria: categoria.trim(),
        descricao_padrao: descricao.trim(),
        recomendacao_padrao: recomendacao.trim() || null,
        prioridade_sugerida: Number(prioridade),
        tipo_execucao_sugerido: tipo,
        normas: parseNormas(normasTexto),
        ativo,
        ordem: existing?.ordem ?? maxOrdem + 1,
      });
      toast.success(isEdit ? "Modo atualizado." : "Modo criado.");
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
            <ListChecks className="h-5 w-5 shrink-0 text-primary" /> {isEdit ? "Editar modo de falha" : "Novo modo de falha"}
          </DialogTitle>
          <DialogDescription>
            Os textos-padrão são copiados ao adicionar o achado em campo e podem ser ajustados na coleta.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="md-label">Nome (label exibido na checklist)</Label>
            <Input id="md-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="md-cat">Categoria</Label>
            <Input id="md-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)} maxLength={120} placeholder="Ex.: Quadros e painéis" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="md-desc">Descrição-padrão da NC</Label>
            <Textarea id="md-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={2000} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="md-rec">Recomendação-padrão (opcional)</Label>
            <Textarea id="md-rec" value={recomendacao} onChange={(e) => setRecomendacao(e.target.value)} rows={2} maxLength={3000} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade sugerida</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RTI_PRIORIDADES.map((p) => <SelectItem key={p} value={String(p)}>{RTI_PRIORIDADE_LABELS[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de execução sugerido</Label>
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
            <Label htmlFor="md-normas">Referências normativas (uma por linha)</Label>
            <Textarea id="md-normas" value={normasTexto} onChange={(e) => setNormasTexto(e.target.value)} rows={3} placeholder={"NBR 5410 6.4\nNR-10 10.2.8"} />
            <p className="text-[10px] text-muted-foreground">Formato: norma + item (ex.: "NBR 5410 6.4"). O engenheiro deve revisar as referências.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4" />
            Ativo (aparece na coleta em campo)
          </label>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
            <Button type="submit" disabled={busy} className="bg-brand-gradient text-white shadow-brand">
              {busy ? "Salvando..." : (isEdit ? "Salvar" : "Criar modo")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
