import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Download,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
import { getGestaoCompletaAccess } from "@/lib/tenancy-gates";
import {
  PIE_CATEGORIES,
  PIE_CATEGORY_LABELS,
  PIE_CATEGORY_NORM_REF,
  PIE_INTEGRATED_CATEGORY,
  PIE_REQUIRED_CATEGORIES,
  DOC_STATUS_LABELS,
  docExpiryStatus,
  prontuarioCompleteness,
  type NR10Document,
  type PIECategory,
  type DocExpiryStatus,
} from "@/lib/prontuario";
import {
  useNR10Documents,
  useUpsertNR10Document,
  useDeleteNR10Document,
  uploadProntuarioFile,
  prontuarioFileUrl,
  archiveDocumentVersion,
  useDocumentVersions,
} from "@/lib/prontuario-queries";
import { formatDatePtBR } from "@/lib/qualificacoes";

export const Route = createFileRoute("/nr10/")({
  component: ProntuarioPage,
  head: () => ({
    meta: [
      { title: "Prontuário das Instalações Elétricas — Gestão NR-10" },
      {
        name: "description",
        content:
          "Prontuário das Instalações Elétricas (NR-10 itens 10.2.3 e 10.2.4): documentos, validades e conformidade.",
      },
    ],
  }),
});

function statusBadge(status: DocExpiryStatus) {
  const cls: Record<DocExpiryStatus, string> = {
    ok: "border-emerald-300 bg-emerald-50 text-emerald-700",
    expiring: "border-amber-300 bg-amber-50 text-amber-700",
    expired: "border-red-300 bg-red-50 text-red-700",
    perennial: "border-slate-300 bg-slate-50 text-slate-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cls[status]}`}
    >
      {DOC_STATUS_LABELS[status]}
    </span>
  );
}

function ProntuarioPage() {
  const { isStaff, isAdmin, hasEntitlement, hasOrgRole, user } = useAuth();
  const { canEdit, canAdmin } = getGestaoCompletaAccess({ isStaff, isAdmin, hasEntitlement, hasOrgRole });
  const { data: docs = [], isLoading } = useNR10Documents();
  const deleteDoc = useDeleteNR10Document();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NR10Document | null>(null);
  const [presetCategory, setPresetCategory] = useState<PIECategory | null>(null);

  const completeness = useMemo(() => prontuarioCompleteness(docs), [docs]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
      if (statusFilter !== "all" && docExpiryStatus(d.validity_date) !== statusFilter) return false;
      if (!t) return true;
      return (
        d.title.toLowerCase().includes(t) ||
        (d.description ?? "").toLowerCase().includes(t) ||
        (d.responsavel ?? "").toLowerCase().includes(t) ||
        (d.art ?? "").toLowerCase().includes(t) ||
        PIE_CATEGORY_LABELS[d.category].toLowerCase().includes(t)
      );
    });
  }, [docs, search, categoryFilter, statusFilter]);

  function openCreate(category?: PIECategory) {
    setEditing(null);
    setPresetCategory(category ?? null);
    setDialogOpen(true);
  }

  async function handleDelete(doc: NR10Document) {
    if (!window.confirm(`Excluir o documento "${doc.title}"? Esta ação não pode ser desfeita.`))
      return;
    try {
      await deleteDoc.mutateAsync({ id: doc.id, file_path: doc.file_path });
      toast.success("Documento excluído.");
    } catch (e) {
      toast.error("Não foi possível excluir. Detalhe: " + (e as Error).message);
    }
  }

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <BookOpenCheck className="h-5 w-5 shrink-0 text-primary" />
            Prontuário das Instalações Elétricas
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            NR-10 itens 10.2.3 e 10.2.4 ·{" "}
            {isLoading
              ? "Carregando..."
              : `${docs.length} ${docs.length === 1 ? "documento" : "documentos"}`}
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => openCreate()}
            className="bg-brand-gradient text-white shadow-brand"
          >
            <Plus className="h-4 w-4" /> Novo documento
          </Button>
        )}
      </div>

      {/* Conformidade */}
      <Card className="mt-5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
            <span>Completude do prontuário</span>
            <span className="text-2xl font-bold tabular-nums">
              {isLoading ? "—" : `${completeness.percent}%`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={isLoading ? 0 : completeness.percent} className="h-2" />
          <div className="grid sm:grid-cols-2 gap-2">
            {PIE_REQUIRED_CATEGORIES.map((cat) => {
              const integrated = cat === PIE_INTEGRATED_CATEGORY;
              const covered = completeness.covered.includes(cat);
              return (
                <div key={cat} className="flex items-start gap-2 rounded-md border p-2.5">
                  {covered ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
                  ) : (
                    <CircleAlert className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                  )}
                  <div className="min-w-0 text-sm">
                    <div className="font-medium leading-tight">
                      {PIE_CATEGORY_LABELS[cat]}
                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                        ({PIE_CATEGORY_NORM_REF[cat]})
                      </span>
                    </div>
                    {integrated ? (
                      <Link
                        to="/qualificacoes"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                      >
                        <Users className="h-3 w-3" /> Integrado ao módulo Pessoas
                      </Link>
                    ) : !covered ? (
                      canEdit ? (
                        <button
                          type="button"
                          onClick={() => openCreate(cat)}
                          className="text-[11px] text-primary hover:underline"
                        >
                          Adicionar documento
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          Nenhum documento válido
                        </span>
                      )
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] sm:flex-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, responsável, ART..."
            className="pl-8 w-full sm:w-72"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {PIE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {PIE_CATEGORY_LABELS[c]}
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
            <SelectItem value="ok">Válido</SelectItem>
            <SelectItem value="expiring">Vencendo (≤ 90 dias)</SelectItem>
            <SelectItem value="expired">Vencido</SelectItem>
            <SelectItem value="perennial">Sem validade</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela de documentos */}
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
              {docs.length === 0
                ? "Nenhum documento cadastrado ainda. Comece adicionando o esquema unifilar e os procedimentos."
                : "Nenhum documento corresponde aos filtros."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Responsável / ART</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => {
                    const status = docExpiryStatus(d.validity_date);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="max-w-[260px]">
                          <div className="font-medium leading-tight truncate" title={d.title}>
                            {d.title}
                          </div>
                          {d.description && (
                            <div
                              className="text-[11px] text-muted-foreground truncate"
                              title={d.description}
                            >
                              {d.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal whitespace-nowrap">
                            {PIE_CATEGORY_LABELS[d.category]}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDatePtBR(d.document_date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDatePtBR(d.validity_date)}
                        </TableCell>
                        <TableCell>{statusBadge(status)}</TableCell>
                        <TableCell className="max-w-[180px]">
                          <div className="text-sm truncate">{d.responsavel || "—"}</div>
                          {d.art && (
                            <div className="text-[11px] text-muted-foreground truncate">
                              ART {d.art}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-1">
                            {d.file_path && (
                              <Button asChild size="sm" variant="outline">
                                <a
                                  href={prontuarioFileUrl(d.file_path)}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Baixar PDF"
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditing(d);
                                  setDialogOpen(true);
                                }}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canAdmin && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => handleDelete(d)}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {canEdit && dialogOpen && (
        <DocumentDialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) {
              setEditing(null);
              setPresetCategory(null);
            }
          }}
          existing={editing}
          presetCategory={presetCategory}
          actorId={user?.id ?? null}
          actorName={
            (user?.user_metadata?.display_name as string | undefined) ||
            user?.email?.split("@")[0] ||
            "Usuário"
          }
        />
      )}
    </PageShell>
  );
}

function DocumentDialog({
  open,
  onOpenChange,
  existing,
  presetCategory,
  actorId,
  actorName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing: NR10Document | null;
  presetCategory: PIECategory | null;
  actorId: string | null;
  actorName: string;
}) {
  const isEdit = !!existing;
  const { currentOrgId } = useAuth();
  const upsert = useUpsertNR10Document();
  const { data: versions = [] } = useDocumentVersions(existing?.id);
  const [category, setCategory] = useState<string>(existing?.category ?? presetCategory ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [documentDate, setDocumentDate] = useState(existing?.document_date ?? "");
  const [validityDate, setValidityDate] = useState(existing?.validity_date ?? "");
  const [responsavel, setResponsavel] = useState(existing?.responsavel ?? "");
  const [art, setArt] = useState(existing?.art ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!category) return toast.error("Selecione a categoria do documento.");
    if (!title.trim()) return toast.error("Informe o título do documento.");
    if (file && file.type !== "application/pdf")
      return toast.error("O anexo deve ser um arquivo PDF.");
    if (file && file.size > 20 * 1024 * 1024) return toast.error("PDF excede 20 MB.");

    setBusy(true);
    try {
      let filePath = existing?.file_path ?? null;
      let oldPath: string | null = null;
      if (file) {
        if (filePath) oldPath = filePath;
        filePath = await uploadProntuarioFile(file);
      }

      await upsert.mutateAsync({
        ...(isEdit ? { id: existing!.id } : {}),
        category: category as PIECategory,
        title: title.trim(),
        description: description.trim() || null,
        document_date: documentDate || null,
        validity_date: validityDate || null,
        file_path: filePath,
        responsavel: responsavel.trim() || null,
        art: art.trim() || null,
        created_by: existing?.created_by ?? actorId,
        created_by_name: existing?.created_by_name ?? actorName,
      });

      // Versionamento: o PDF substituído é arquivado, não excluído — o
      // histórico de versões do prontuário fica auditável.
      if (oldPath && existing) {
        await archiveDocumentVersion(
          {
            document_id: existing.id,
            file_path: oldPath,
            file_name: existing.title,
            document_date: existing.document_date,
            validity_date: existing.validity_date,
            replaced_by_name: actorName,
          },
          currentOrgId,
        );
      }
      toast.success(isEdit ? "Documento atualizado." : "Documento cadastrado.");
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível salvar. Detalhe: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <FileText className="h-5 w-5 shrink-0 text-primary" />
            {isEdit ? "Editar documento do prontuário" : "Novo documento do prontuário"}
          </DialogTitle>
          <DialogDescription>
            Documentos sem data de validade são tratados como perenes.{" "}
            {isEdit ? "Anexar um novo PDF substitui o anterior." : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pd-category">Categoria (item da norma)</Label>
            <Select value={category || undefined} onValueChange={setCategory} required>
              <SelectTrigger id="pd-category">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {PIE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {PIE_CATEGORY_LABELS[c]}
                    {PIE_CATEGORY_NORM_REF[c] !== "—" ? ` (${PIE_CATEGORY_NORM_REF[c]})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pd-title">Título</Label>
            <Input
              id="pd-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Ex.: Esquema unifilar — Subestação principal"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pd-description">Descrição (opcional)</Label>
            <Textarea
              id="pd-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pd-date">Data de emissão</Label>
              <Input
                id="pd-date"
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pd-validity">Validade (opcional)</Label>
              <Input
                id="pd-validity"
                type="date"
                value={validityDate}
                onChange={(e) => setValidityDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pd-resp">Responsável técnico (opcional)</Label>
              <Input
                id="pd-resp"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                maxLength={150}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pd-art">ART (opcional)</Label>
              <Input
                id="pd-art"
                value={art}
                onChange={(e) => setArt(e.target.value)}
                maxLength={80}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pd-file">
              Arquivo PDF{isEdit ? " — opcional (substitui o atual)" : " (opcional)"}
            </Label>
            <Input
              id="pd-file"
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <FileText className="h-3 w-3" /> {file.name} ({(file.size / 1024).toFixed(0)} KB)
              </div>
            )}
            {isEdit && !file && existing?.file_path && (
              <div className="text-[11px] text-muted-foreground">PDF atual será mantido.</div>
            )}
          </div>
          {isEdit && versions.length > 0 && (
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Versões anteriores ({versions.length})
              </p>
              <div className="space-y-1">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-muted-foreground truncate">
                      Substituída em {formatDatePtBR(v.created_at.slice(0, 10))}
                      {v.replaced_by_name ? ` por ${v.replaced_by_name}` : ""}
                    </span>
                    <a
                      href={prontuarioFileUrl(v.file_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline whitespace-nowrap"
                    >
                      Baixar versão
                    </a>
                  </div>
                ))}
              </div>
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
              {busy ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar documento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
