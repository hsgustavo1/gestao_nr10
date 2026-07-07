import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { GraduationCap, Paperclip, Plus, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resizeImage } from "@/lib/campo";
import { mensagemUploadAmigavel } from "@/lib/upload";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEmployees, useRegistrarTurma } from "@/lib/qualificacoes-queries";
import { TRAINING_LABELS, TRAINING_TYPES, type TrainingType } from "@/lib/qualificacoes";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

/**
 * Registro de treinamento por turma: uma data/entidade/instrutor aplicada a
 * N colaboradores de uma vez, em vez de célula por célula na matriz.
 */
export function NR10TurmaDialog({ open, onOpenChange }: Props) {
  const { data: employees = [] } = useEmployees("ativo");
  const registrar = useRegistrarTurma();

  const [trainingType, setTrainingType] = useState<string>("nr10_basico");
  const [category, setCategory] = useState<string>("reciclagem");
  const [trainingDate, setTrainingDate] = useState(new Date().toISOString().slice(0, 10));
  const [cargaHoraria, setCargaHoraria] = useState("");
  const [entidade, setEntidade] = useState("");
  const [instrutores, setInstrutores] = useState<string[]>([""]);
  const [conteudo, setConteudo] = useState("");
  const [art, setArt] = useState("");
  const [artArquivo, setArtArquivo] = useState<File | null>(null);
  const artInputRef = useRef<HTMLInputElement>(null);
  const [responsavelTecnico, setResponsavelTecnico] = useState("");
  const [search, setSearch] = useState("");
  const [setorFilter, setSetorFilter] = useState("todos");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const setores = useMemo(() => {
    const s = new Set<string>();
    for (const e of employees) if (e.setor) s.add(e.setor);
    return Array.from(s).sort();
  }, [employees]);

  const visible = useMemo(() => {
    const t = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (setorFilter !== "todos" && e.setor !== setorFilter) return false;
      if (!t) return true;
      return e.name.toLowerCase().includes(t) || e.matricula.toLowerCase().includes(t);
    });
  }, [employees, search, setorFilter]);

  const allVisibleSelected = visible.length > 0 && visible.every((e) => selected.has(e.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) for (const e of visible) next.delete(e.id);
      else for (const e of visible) next.add(e.id);
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (selected.size === 0) return toast.error("Selecione ao menos um colaborador.");
    if (!trainingDate) return toast.error("Informe a data do treinamento.");
    if (!responsavelTecnico.trim()) return toast.error("Informe o responsável técnico.");

    setBusy(true);
    try {
      const carga = cargaHoraria.trim();

      let artArquivoUrl: string | null = null;
      if (artArquivo) {
        const artComprimido = await resizeImage(artArquivo, 1024);
        const ext = artComprimido.name.split(".").pop() ?? "pdf";
        const path = `art/${crypto.randomUUID()}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("nr10-docs")
          .upload(path, artComprimido, { cacheControl: "3600", upsert: false });
        if (uploadError) throw new Error(mensagemUploadAmigavel(uploadError));
        const { data } = supabase.storage.from("nr10-docs").getPublicUrl(path);
        artArquivoUrl = data.publicUrl;
      }

      await registrar.mutateAsync({
        employeeIds: Array.from(selected),
        turma: {
          training_type: trainingType as TrainingType,
          category: category as "formacao" | "reciclagem",
          data: trainingDate,
          art: art.trim() || null,
          art_arquivo_url: artArquivoUrl,
          responsavel_tecnico: responsavelTecnico.trim() || null,
          carga_horaria: carga ? parseInt(carga, 10) : null,
          entidade: entidade.trim() || null,
          instrutor: instrutores.map((s) => s.trim()).filter(Boolean).join(" · ") || null,
          conteudo_programatico: conteudo.trim() || null,
        },
      });
      toast.success(`Turma registrada para ${selected.size} colaborador(es).`);
      setSelected(new Set());
      setInstrutores([""]);
      setArtArquivo(null);
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível registrar a turma. Detalhe: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <GraduationCap className="h-5 w-5 shrink-0 text-primary" />
            Registrar turma de treinamento
          </DialogTitle>
          <DialogDescription>
            Aplica o mesmo registro de treinamento a todos os colaboradores selecionados. Registros
            existentes do mesmo tipo/categoria são atualizados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={trainingType} onValueChange={setTrainingType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRAINING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TRAINING_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formacao">Formação</SelectItem>
                  <SelectItem value="reciclagem">Reciclagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="turma-date">Data</Label>
              <Input
                id="turma-date"
                type="date"
                value={trainingDate}
                onChange={(e) => setTrainingDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="turma-carga">Carga horária (h)</Label>
              <Input
                id="turma-carga"
                type="number"
                min={1}
                placeholder="Ex.: 40"
                value={cargaHoraria}
                onChange={(e) => setCargaHoraria(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="turma-entidade">Entidade</Label>
              <Input
                id="turma-entidade"
                value={entidade}
                onChange={(e) => setEntidade(e.target.value)}
                maxLength={150}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Instrutores</Label>
              <button
                type="button"
                onClick={() => setInstrutores((prev) => [...prev, ""])}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="h-3 w-3" /> Adicionar instrutor
              </button>
            </div>
            <div className="space-y-2">
              {instrutores.map((inst, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={inst}
                    onChange={(e) =>
                      setInstrutores((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                    }
                    placeholder={`Instrutor ${i + 1}`}
                    maxLength={150}
                  />
                  {instrutores.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setInstrutores((prev) => prev.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="turma-resp">
                Responsável técnico <span className="text-destructive">*</span>
              </Label>
              <Input
                id="turma-resp"
                value={responsavelTecnico}
                onChange={(e) => setResponsavelTecnico(e.target.value)}
                maxLength={150}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="turma-art">Nº ART (opcional)</Label>
              <Input
                id="turma-art"
                value={art}
                onChange={(e) => setArt(e.target.value)}
                maxLength={60}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Anexar ART (PDF, opcional)</Label>
            <input
              ref={artInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => setArtArquivo(e.target.files?.[0] ?? null)}
            />
            {artArquivo ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{artArquivo.name}</span>
                <button
                  type="button"
                  onClick={() => { setArtArquivo(null); if (artInputRef.current) artInputRef.current.value = ""; }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => artInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" /> Selecionar arquivo
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="turma-conteudo">Conteúdo programático (resumo, opcional)</Label>
            <Input
              id="turma-conteudo"
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              maxLength={500}
            />
          </div>

          {/* Seleção de colaboradores */}
          <div className="rounded-md border">
            <div className="flex flex-wrap items-center gap-2 border-b p-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou matrícula..."
                  className="pl-8 h-8 text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={setorFilter} onValueChange={setSetorFilter}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos setores</SelectItem>
                  {setores.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={toggleAllVisible}
                className="text-xs text-primary hover:underline whitespace-nowrap"
              >
                {allVisibleSelected ? "Desmarcar visíveis" : "Marcar visíveis"}
              </button>
              <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="max-h-56 overflow-y-auto p-1">
              {visible.length === 0 && (
                <p className="p-3 text-center text-xs text-muted-foreground">
                  Nenhum colaborador encontrado.
                </p>
              )}
              {visible.map((e) => (
                <label
                  key={e.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/40 cursor-pointer"
                >
                  <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} />
                  <span className="flex-1 truncate">{e.name}</span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    Mat. {e.matricula}
                    {e.setor ? ` · ${e.setor}` : ""}
                  </span>
                </label>
              ))}
            </div>
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
              disabled={busy}
              className="bg-brand-gradient text-white shadow-brand"
            >
              {busy ? "Registrando..." : `Registrar turma (${selected.size})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
