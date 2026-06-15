import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Download, FileText, Pencil, Plus, Search, Trash2, Zap } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { SectorSelect } from "@/components/sector-select";
import {
  INCIDENT_GRAVIDADE_LABELS,
  INCIDENT_GRAVIDADES,
  INCIDENT_STATUS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_TIPO_LABELS,
  INCIDENT_TIPOS,
  type ElectricalIncident,
  type IncidentGravidade,
  type IncidentStatus,
  type IncidentTipo,
} from "@/lib/incidentes";
import {
  incidentFileUrl,
  uploadIncidentFile,
  useDeleteIncident,
  useIncidents,
  useUpsertIncident,
} from "@/lib/incidentes-queries";

export const Route = createFileRoute("/incidentes/")({
  component: IncidentesPage,
  head: () => ({
    meta: [
      { title: "Incidentes Elétricos — Gestão NR-10" },
      {
        name: "description",
        content:
          "Registro e investigação de incidentes e quase-acidentes em instalações e serviços em eletricidade.",
      },
    ],
  }),
});

function gravidadeBadge(g: IncidentGravidade) {
  const cls: Record<IncidentGravidade, string> = {
    sem_lesao: "border-slate-300 bg-slate-50 text-slate-600",
    leve: "border-amber-300 bg-amber-50 text-amber-700",
    moderada: "border-orange-300 bg-orange-50 text-orange-700",
    grave: "border-red-300 bg-red-50 text-red-700",
    fatal: "border-red-500 bg-red-100 text-red-900",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cls[g]}`}
    >
      {INCIDENT_GRAVIDADE_LABELS[g]}
    </span>
  );
}

function statusBadge(s: IncidentStatus) {
  const cls: Record<IncidentStatus, string> = {
    aberto: "border-red-300 bg-red-50 text-red-700",
    em_investigacao: "border-amber-300 bg-amber-50 text-amber-700",
    concluido: "border-emerald-300 bg-emerald-50 text-emerald-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cls[s]}`}
    >
      {INCIDENT_STATUS_LABELS[s]}
    </span>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function IncidentesPage() {
  const { isStaff, isAdmin } = useAuth();
  const { data: incidents = [], isLoading } = useIncidents();
  const deleteIncident = useDeleteIncident();

  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [gravidadeFilter, setGravidadeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ElectricalIncident | null>(null);

  const stats = useMemo(() => {
    let abertos = 0,
      investigacao = 0,
      concluidos = 0,
      graves = 0;
    for (const i of incidents) {
      if (i.status === "aberto") abertos++;
      else if (i.status === "em_investigacao") investigacao++;
      else concluidos++;
      if (i.gravidade === "grave" || i.gravidade === "fatal") graves++;
    }
    return { total: incidents.length, abertos, investigacao, concluidos, graves };
  }, [incidents]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return incidents.filter((i) => {
      if (tipoFilter !== "all" && i.tipo !== tipoFilter) return false;
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (gravidadeFilter !== "all" && i.gravidade !== gravidadeFilter) return false;
      if (!t) return true;
      return (
        i.descricao.toLowerCase().includes(t) ||
        (i.setor ?? "").toLowerCase().includes(t) ||
        (i.local ?? "").toLowerCase().includes(t) ||
        (i.envolvidos ?? "").toLowerCase().includes(t) ||
        INCIDENT_TIPO_LABELS[i.tipo].toLowerCase().includes(t)
      );
    });
  }, [incidents, search, tipoFilter, statusFilter, gravidadeFilter]);

  async function handleDelete(incident: ElectricalIncident) {
    if (!window.confirm("Excluir este registro de incidente?")) return;
    try {
      await deleteIncident.mutateAsync({ id: incident.id, file_path: incident.file_path });
      toast.success("Incidente excluído.");
    } catch (e) {
      toast.error("Falha ao excluir: " + (e as Error).message);
    }
  }

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <Zap className="h-5 w-5 shrink-0 text-primary" />
            Incidentes Elétricos
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Choques, arcos, princípios de incêndio e quase-acidentes ·{" "}
            {isLoading
              ? "Carregando..."
              : `${incidents.length} ${incidents.length === 1 ? "registro" : "registros"}`}
          </p>
        </div>
        {isStaff && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="bg-brand-gradient text-white shadow-brand"
          >
            <Plus className="h-4 w-4" /> Registrar incidente
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-3 sm:grid-cols-5 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard
          label="Abertos"
          value={stats.abertos}
          tone={stats.abertos > 0 ? "red" : "default"}
        />
        <StatCard
          label="Em investigação"
          value={stats.investigacao}
          tone={stats.investigacao > 0 ? "amber" : "default"}
        />
        <StatCard label="Concluídos" value={stats.concluidos} tone="green" />
        <StatCard
          label="Graves/fatais"
          value={stats.graves}
          tone={stats.graves > 0 ? "red" : "default"}
        />
      </div>

      {/* Filtros */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] sm:flex-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, setor, envolvidos..."
            className="pl-8 w-full sm:w-72"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {INCIDENT_TIPOS.map((t) => (
              <SelectItem key={t} value={t}>
                {INCIDENT_TIPO_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={gravidadeFilter} onValueChange={setGravidadeFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Gravidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas gravidades</SelectItem>
            {INCIDENT_GRAVIDADES.map((g) => (
              <SelectItem key={g} value={g}>
                {INCIDENT_GRAVIDADE_LABELS[g]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {INCIDENT_STATUS.map((s) => (
              <SelectItem key={s} value={s}>
                {INCIDENT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card className="mt-4">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {incidents.length === 0
                ? "Nenhum incidente registrado. Registrar quase-acidentes alimenta a prevenção."
                : "Nenhum incidente corresponde aos filtros."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Gravidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateTime(i.occurred_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {INCIDENT_TIPO_LABELS[i.tipo]}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {i.setor ?? "—"}
                        {i.local ? ` · ${i.local}` : ""}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <div className="text-sm truncate" title={i.descricao}>
                          {i.descricao}
                        </div>
                        {i.envolvidos && (
                          <div
                            className="text-[11px] text-muted-foreground truncate"
                            title={i.envolvidos}
                          >
                            Envolvidos: {i.envolvidos}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{gravidadeBadge(i.gravidade)}</TableCell>
                      <TableCell>{statusBadge(i.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          {i.file_path && (
                            <Button asChild size="sm" variant="outline" title="Anexo">
                              <a
                                href={incidentFileUrl(i.file_path)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {isStaff && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditing(i);
                                setDialogOpen(true);
                              }}
                              title="Editar / investigar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive"
                              onClick={() => handleDelete(i)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {isStaff && dialogOpen && (
        <IncidentDialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) setEditing(null);
          }}
          existing={editing}
        />
      )}
    </PageShell>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "green" | "amber" | "red";
}) {
  const valueCls =
    tone === "red"
      ? "text-red-600"
      : tone === "amber"
        ? "text-amber-600"
        : tone === "green"
          ? "text-emerald-600"
          : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-2xl font-bold tabular-nums ${valueCls}`}>{value}</div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function IncidentDialog({
  open,
  onOpenChange,
  existing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing: ElectricalIncident | null;
}) {
  const isEdit = !!existing;
  const upsert = useUpsertIncident();
  const { user } = useAuth();

  const [occurredDate, setOccurredDate] = useState(
    existing?.occurred_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [occurredTime, setOccurredTime] = useState(
    existing?.occurred_at ? new Date(existing.occurred_at).toTimeString().slice(0, 5) : "08:00",
  );
  const [tipo, setTipo] = useState<string>(existing?.tipo ?? "");
  const [setor, setSetor] = useState(existing?.setor ?? "");
  const [local, setLocal] = useState(existing?.local ?? "");
  const [descricao, setDescricao] = useState(existing?.descricao ?? "");
  const [envolvidos, setEnvolvidos] = useState(existing?.envolvidos ?? "");
  const [gravidade, setGravidade] = useState<string>(existing?.gravidade ?? "sem_lesao");
  const [causaRaiz, setCausaRaiz] = useState(existing?.causa_raiz ?? "");
  const [acoes, setAcoes] = useState(existing?.acoes_tomadas ?? "");
  const [status, setStatus] = useState<string>(existing?.status ?? "aberto");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!tipo) return toast.error("Selecione o tipo de incidente.");
    if (!descricao.trim()) return toast.error("Descreva o ocorrido.");
    if (file && file.size > 20 * 1024 * 1024) return toast.error("Arquivo excede 20 MB.");

    setBusy(true);
    try {
      let filePath = existing?.file_path ?? null;
      if (file) filePath = await uploadIncidentFile(file);

      await upsert.mutateAsync({
        ...(isEdit ? { id: existing!.id } : {}),
        occurred_at: new Date(`${occurredDate}T${occurredTime || "00:00"}:00`).toISOString(),
        tipo: tipo as IncidentTipo,
        setor: setor || null,
        local: local.trim() || null,
        descricao: descricao.trim(),
        envolvidos: envolvidos.trim() || null,
        gravidade: gravidade as IncidentGravidade,
        causa_raiz: causaRaiz.trim() || null,
        acoes_tomadas: acoes.trim() || null,
        status: status as IncidentStatus,
        file_path: filePath,
        created_by_name:
          existing?.created_by_name ?? user?.user_metadata?.display_name ?? user?.email ?? null,
      });
      toast.success(isEdit ? "Incidente atualizado." : "Incidente registrado.");
      onOpenChange(false);
    } catch (err) {
      toast.error("Falha ao salvar: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <Zap className="h-5 w-5 shrink-0 text-primary" />
            {isEdit ? "Editar / investigar incidente" : "Registrar incidente"}
          </DialogTitle>
          <DialogDescription>
            Registre também quase-acidentes — são o melhor indicador preventivo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="in-date">Data</Label>
              <Input
                id="in-date"
                type="date"
                value={occurredDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setOccurredDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="in-time">Hora</Label>
              <Input
                id="in-time"
                type="time"
                value={occurredTime}
                onChange={(e) => setOccurredTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="in-tipo">Tipo</Label>
              <Select value={tipo || undefined} onValueChange={setTipo} required>
                <SelectTrigger id="in-tipo">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {INCIDENT_TIPO_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Setor</Label>
              <SectorSelect value={setor} onChange={setSetor} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="in-local">Local (opcional)</Label>
              <Input
                id="in-local"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                maxLength={150}
                placeholder="Ex.: Subestação 2, painel QGBT"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="in-desc">Descrição do ocorrido</Label>
            <Textarea
              id="in-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              maxLength={2000}
              required
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="in-env">Envolvidos (opcional)</Label>
              <Input
                id="in-env"
                value={envolvidos}
                onChange={(e) => setEnvolvidos(e.target.value)}
                maxLength={300}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="in-grav">Gravidade</Label>
              <Select value={gravidade} onValueChange={setGravidade}>
                <SelectTrigger id="in-grav">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_GRAVIDADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {INCIDENT_GRAVIDADE_LABELS[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="in-causa">Causa raiz (investigação, opcional)</Label>
            <Textarea
              id="in-causa"
              value={causaRaiz}
              onChange={(e) => setCausaRaiz(e.target.value)}
              rows={2}
              maxLength={1000}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="in-acoes">Ações tomadas (opcional)</Label>
            <Textarea
              id="in-acoes"
              value={acoes}
              onChange={(e) => setAcoes(e.target.value)}
              rows={2}
              maxLength={1000}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="in-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="in-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {INCIDENT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="in-file">Anexo (foto/PDF, opcional)</Label>
              <Input
                id="in-file"
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          {file && (
            <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <FileText className="h-3 w-3" /> {file.name} ({(file.size / 1024).toFixed(0)} KB)
            </div>
          )}
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
              disabled={busy}
              className="bg-brand-gradient text-white shadow-brand"
            >
              {busy ? "Salvando..." : isEdit ? "Salvar alterações" : "Registrar incidente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
