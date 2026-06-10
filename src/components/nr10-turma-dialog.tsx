import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { GraduationCap, Search } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
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
  const [instrutor, setInstrutor] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [art, setArt] = useState("");
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

    setBusy(true);
    try {
      const carga = cargaHoraria.trim();
      await registrar.mutateAsync({
        employeeIds: Array.from(selected),
        training: {
          training_type: trainingType as TrainingType,
          category: category as "formacao" | "reciclagem",
          training_date: trainingDate,
          art: art.trim() || null,
          responsavel_tecnico: responsavelTecnico.trim() || null,
          carga_horaria: carga ? parseInt(carga, 10) : null,
          entidade: entidade.trim() || null,
          instrutor: instrutor.trim() || null,
          conteudo_programatico: conteudo.trim() || null,
          valid: true,
        },
      });
      toast.success(`Turma registrada para ${selected.size} colaborador(es).`);
      setSelected(new Set());
      onOpenChange(false);
    } catch (err) {
      toast.error("Falha ao registrar turma: " + (err as Error).message);
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
            Aplica o mesmo registro de treinamento a todos os colaboradores selecionados.
            Registros existentes do mesmo tipo/categoria são atualizados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={trainingType} onValueChange={setTrainingType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRAINING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{TRAINING_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="formacao">Formação</SelectItem>
                  <SelectItem value="reciclagem">Reciclagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="turma-date">Data</Label>
              <Input id="turma-date" type="date" value={trainingDate} onChange={(e) => setTrainingDate(e.target.value)} required />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="turma-carga">Carga horária (h)</Label>
              <Input id="turma-carga" type="number" min={1} placeholder="Ex.: 40" value={cargaHoraria} onChange={(e) => setCargaHoraria(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="turma-entidade">Entidade</Label>
              <Input id="turma-entidade" value={entidade} onChange={(e) => setEntidade(e.target.value)} maxLength={150} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="turma-instrutor">Instrutor</Label>
              <Input id="turma-instrutor" value={instrutor} onChange={(e) => setInstrutor(e.target.value)} maxLength={150} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="turma-art">ART (opcional)</Label>
              <Input id="turma-art" value={art} onChange={(e) => setArt(e.target.value)} maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="turma-resp">Responsável técnico (opcional)</Label>
              <Input id="turma-resp" value={responsavelTecnico} onChange={(e) => setResponsavelTecnico(e.target.value)} maxLength={150} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="turma-conteudo">Conteúdo programático (resumo, opcional)</Label>
            <Input id="turma-conteudo" value={conteudo} onChange={(e) => setConteudo(e.target.value)} maxLength={500} />
          </div>

          {/* Seleção de colaboradores */}
          <div className="rounded-md border">
            <div className="flex flex-wrap items-center gap-2 border-b p-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou matrícula..." className="pl-8 h-8 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={setorFilter} onValueChange={setSetorFilter}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos setores</SelectItem>
                  {setores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <button type="button" onClick={toggleAllVisible} className="text-xs text-primary hover:underline whitespace-nowrap">
                {allVisibleSelected ? "Desmarcar visíveis" : "Marcar visíveis"}
              </button>
              <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="max-h-56 overflow-y-auto p-1">
              {visible.length === 0 && (
                <p className="p-3 text-center text-xs text-muted-foreground">Nenhum colaborador encontrado.</p>
              )}
              {visible.map((e) => (
                <label key={e.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/40 cursor-pointer">
                  <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} />
                  <span className="flex-1 truncate">{e.name}</span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    Mat. {e.matricula}{e.setor ? ` · ${e.setor}` : ""}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy} className="bg-brand-gradient text-white shadow-brand">
              {busy ? "Registrando..." : `Registrar turma (${selected.size})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
