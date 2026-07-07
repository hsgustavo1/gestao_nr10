import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, FileText, Trash2, CheckCircle2, Plus, BookMarked } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  useUpsertEmployee,
  useEmployeeFormacoes,
  useAddFormacao,
  useUpdateFormacao,
  useDeleteFormacao,
  useAttachFormacaoDoc,
  useRemoveFormacaoDoc,
  employeeDocUrl,
  useEmployeePlh,
  useUpsertEmployeePlh,
  useAttachPlhDoc,
  useRemovePlhDoc,
  useCreaAnuidades,
  useAddCreaAnuidade,
  useUpdateCreaAnuidade,
  useDeleteCreaAnuidade,
  useAttachAnuidadeDoc,
  type EmployeeDocKind,
  type PlhDocKind,
} from "@/lib/qualificacoes-queries";
import {
  creaAnuidadeEmDia,
  creaAnuidadeValidadeAtual,
  formatDatePtBR,
  type Employee,
  type EmployeeCreaAnuidade,
  type EmployeeFormacao,
} from "@/lib/qualificacoes";

const schema = z
  .object({
    name: z.string().min(2, "Nome obrigatório"),
    matricula: z.string().min(1, "Matrícula obrigatória"),
    setor: z.string().optional(),
    classificacao: z.string().optional(),
    funcao: z.string().optional(),
    crea_cft: z.string().optional(),
    status: z.enum(["ativo", "afastado", "desligado"]),
  })
  .refine((v) => v.classificacao !== "Habilitado" || !!v.crea_cft?.trim(), {
    message: 'Registro CREA/CFT é obrigatório para classificação "Habilitado"',
    path: ["crea_cft"],
  });
type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee?: Employee;
};

function defaultsFor(employee?: Employee): FormValues {
  return {
    name: employee?.name ?? "",
    matricula: employee?.matricula ?? "",
    setor: employee?.setor ?? "",
    classificacao: employee?.classificacao ?? "",
    funcao: employee?.funcao ?? "",
    crea_cft: employee?.crea_cft ?? "",
    status: employee?.status ?? "ativo",
  };
}

function FormacaoDocRow({
  employee,
  formacao,
  kind,
  label,
  icon,
}: {
  employee: Employee;
  formacao: EmployeeFormacao;
  kind: EmployeeDocKind;
  label: string;
  icon: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const attach = useAttachFormacaoDoc();
  const remove = useRemoveFormacaoDoc();
  const propPath = kind === "diploma" ? formacao.diploma_arquivo_path : formacao.historico_arquivo_path;
  const [path, setPath] = useState<string | null | undefined>(propPath);
  const [fileName, setFileName] = useState<string | null>(propPath ? propPath.split("/").pop() ?? null : null);
  useEffect(() => {
    setPath(propPath);
    setFileName(propPath ? propPath.split("/").pop() ?? null : null);
  }, [formacao.id, kind, propPath]);
  const busy = attach.isPending || remove.isPending;

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const newPath = await attach.mutateAsync({ employee, formacaoId: formacao.id, formacaoTexto: formacao.formacao, kind, file });
      setPath(newPath);
      setFileName(file.name);
      toast.success(`${label} anexado.`);
    } catch (err) {
      toast.error(`Não foi possível anexar. Detalhe: ${(err as Error).message}`);
    }
  }

  async function onRemove() {
    if (!path) return;
    if (!window.confirm(`Remover o anexo de ${label.toLowerCase()}? Esta ação não pode ser desfeita.`)) return;
    try {
      await remove.mutateAsync({ employeeId: employee.id, formacaoId: formacao.id, kind, path });
      setPath(null);
      setFileName(null);
      toast.success(`${label} removido.`);
    } catch (err) {
      toast.error(`Não foi possível remover. Detalhe: ${(err as Error).message}`);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-input px-2 py-1">
      <input ref={inputRef} type="file" accept="application/pdf,image/*" onChange={onFileChange} disabled={busy} className="hidden" />
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="flex-1 truncate text-xs" title={fileName ?? undefined}>
        {busy ? (
          <span className="text-muted-foreground">Enviando…</span>
        ) : fileName ? (
          <span className="text-foreground">{fileName}</span>
        ) : (
          <span className="text-muted-foreground">{label}</span>
        )}
      </span>
      {path && !busy && (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <a
            href={employeeDocUrl(path)}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline underline-offset-2 hover:text-foreground"
          >
            Ver
          </a>
        </>
      )}
      <Button type="button" variant="outline" size="sm" className="h-6 text-xs px-2" disabled={busy} onClick={() => inputRef.current?.click()}>
        {path ? "Substituir" : "Anexar"}
      </Button>
      {path && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
          disabled={busy}
          onClick={onRemove}
          title={`Remover ${label.toLowerCase()}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function FormacaoRow({ employee, formacao }: { employee: Employee; formacao: EmployeeFormacao }) {
  const update = useUpdateFormacao();
  const del = useDeleteFormacao();
  const [texto, setTexto] = useState(formacao.formacao);
  const [conclusao, setConclusao] = useState(formacao.diploma_conclusao ?? "");

  async function onBlurSave() {
    if (texto === formacao.formacao && conclusao === (formacao.diploma_conclusao ?? "")) return;
    try {
      await update.mutateAsync({ id: formacao.id, employeeId: employee.id, formacao: texto, diploma_conclusao: conclusao });
    } catch (err) {
      toast.error(`Não foi possível salvar a formação. Detalhe: ${(err as Error).message}`);
    }
  }

  async function onDelete() {
    if (!window.confirm("Remover esta formação e seus anexos? Esta ação não pode ser desfeita.")) return;
    try {
      await del.mutateAsync({
        id: formacao.id,
        employeeId: employee.id,
        diploma_arquivo_path: formacao.diploma_arquivo_path,
        historico_arquivo_path: formacao.historico_arquivo_path,
      });
      toast.success("Formação removida.");
    } catch (err) {
      toast.error(`Não foi possível remover. Detalhe: ${(err as Error).message}`);
    }
  }

  return (
    <div className="space-y-1.5 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={onBlurSave}
          placeholder="Ex.: Técnico em Eletrotécnica"
          className="h-8 flex-1"
        />
        <Input
          type="date"
          value={conclusao}
          onChange={(e) => setConclusao(e.target.value)}
          onBlur={onBlurSave}
          className="h-8 w-40"
          title="Conclusão do curso"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={del.isPending}
          title="Remover formação"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <FormacaoDocRow employee={employee} formacao={formacao} kind="diploma" label="Diploma" icon={<GraduationCap className="h-3.5 w-3.5" />} />
        <FormacaoDocRow employee={employee} formacao={formacao} kind="historico" label="Histórico escolar" icon={<FileText className="h-3.5 w-3.5" />} />
      </div>
    </div>
  );
}

function FormacoesSection({ employee }: { employee: Employee }) {
  const { data: formacoes = [] } = useEmployeeFormacoes(employee.id);
  const add = useAddFormacao();

  async function onAdd() {
    try {
      await add.mutateAsync({ employeeId: employee.id, formacao: "" });
    } catch (err) {
      toast.error(`Não foi possível adicionar. Detalhe: ${(err as Error).message}`);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Escolaridade / Formação</p>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onAdd} disabled={add.isPending}>
          <Plus className="h-3.5 w-3.5" /> Adicionar formação
        </Button>
      </div>
      {formacoes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma formação cadastrada.</p>
      ) : (
        <div className="space-y-2">
          {formacoes.map((f) => (
            <FormacaoRow key={f.id} employee={employee} formacao={f} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlhDocRow({
  employee,
  kind,
  label,
  path,
}: {
  employee: Employee;
  kind: PlhDocKind;
  label: string;
  path: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const attach = useAttachPlhDoc();
  const remove = useRemovePlhDoc();
  const busy = attach.isPending || remove.isPending;
  const fileName = path ? path.split("/").pop() ?? null : null;

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await attach.mutateAsync({ employee, kind, file });
      toast.success(`${label} anexado.`);
    } catch (err) {
      toast.error(`Não foi possível anexar. Detalhe: ${(err as Error).message}`);
    }
  }

  async function onRemove() {
    if (!path) return;
    if (!window.confirm(`Remover o anexo de ${label.toLowerCase()}? Esta ação não pode ser desfeita.`)) return;
    try {
      await remove.mutateAsync({ employeeId: employee.id, kind, path });
      toast.success(`${label} removido.`);
    } catch (err) {
      toast.error(`Não foi possível remover. Detalhe: ${(err as Error).message}`);
    }
  }

  return (
    <div className="space-y-1.5 rounded-md border border-input p-2">
      <input ref={inputRef} type="file" accept="application/pdf,image/*" onChange={onFileChange} disabled={busy} className="hidden" />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <FileText className="h-3.5 w-3.5 shrink-0" /> {label}
        </span>
        {!path && (
          <Button type="button" variant="outline" size="sm" className="h-6 text-xs px-2 shrink-0" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Enviando…" : "Anexar"}
          </Button>
        )}
      </div>
      {path && (
        <div className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="min-w-0 flex-1 truncate text-xs" title={fileName ?? undefined}>
            {busy ? <span className="text-muted-foreground">Enviando…</span> : fileName}
          </span>
          <a href={employeeDocUrl(path)} target="_blank" rel="noreferrer" className="shrink-0 text-xs underline underline-offset-2 hover:text-foreground">
            Ver
          </a>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
            disabled={busy}
            onClick={onRemove}
            title={`Remover ${label.toLowerCase()}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function AnuidadeRow({ employee, anuidade }: { employee: Employee; anuidade: EmployeeCreaAnuidade }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const update = useUpdateCreaAnuidade();
  const del = useDeleteCreaAnuidade();
  const attach = useAttachAnuidadeDoc();
  const [validadeAte, setValidadeAte] = useState(anuidade.validade_ate ?? "");
  const busy = update.isPending || del.isPending || attach.isPending;
  const fileName = anuidade.comprovante_arquivo_path ? anuidade.comprovante_arquivo_path.split("/").pop() ?? null : null;

  async function onBlurSave() {
    if (validadeAte === (anuidade.validade_ate ?? "")) return;
    try {
      await update.mutateAsync({ id: anuidade.id, employeeId: employee.id, validade_ate: validadeAte });
    } catch (err) {
      toast.error(`Não foi possível salvar a anuidade. Detalhe: ${(err as Error).message}`);
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await attach.mutateAsync({ employee, anuidadeId: anuidade.id, ano: anuidade.ano, file });
      toast.success("Comprovante anexado.");
    } catch (err) {
      toast.error(`Não foi possível anexar. Detalhe: ${(err as Error).message}`);
    }
  }

  async function onDelete() {
    if (!window.confirm(`Remover a anuidade de ${anuidade.ano}? Esta ação não pode ser desfeita.`)) return;
    try {
      await del.mutateAsync({ id: anuidade.id, employeeId: employee.id, comprovante_arquivo_path: anuidade.comprovante_arquivo_path });
      toast.success("Anuidade removida.");
    } catch (err) {
      toast.error(`Não foi possível remover. Detalhe: ${(err as Error).message}`);
    }
  }

  return (
    <div className="space-y-1.5 rounded-md border p-2">
      <input ref={inputRef} type="file" accept="application/pdf,image/*" onChange={onFileChange} disabled={busy} className="hidden" />
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 text-sm font-medium">{anuidade.ano}</span>
        <Input
          type="date"
          value={validadeAte}
          onChange={(e) => setValidadeAte(e.target.value)}
          onBlur={onBlurSave}
          className="h-8 flex-1"
          title="Validade"
        />
        {!fileName && (
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 text-xs px-2" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Enviando…" : "Anexar"}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={busy}
          title="Remover anuidade"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {fileName && (
        <div className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="min-w-0 flex-1 truncate text-xs" title={fileName}>
            {busy ? <span className="text-muted-foreground">Enviando…</span> : fileName}
          </span>
          <a
            href={employeeDocUrl(anuidade.comprovante_arquivo_path!)}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-xs underline underline-offset-2 hover:text-foreground"
          >
            Ver
          </a>
        </div>
      )}
    </div>
  );
}

function PlhSection({ employee }: { employee: Employee }) {
  const { data: plh } = useEmployeePlh(employee.id);
  const { data: anuidades = [] } = useCreaAnuidades(employee.id);
  const upsertPlh = useUpsertEmployeePlh();
  const addAnuidade = useAddCreaAnuidade();
  const [termoNomeacaoData, setTermoNomeacaoData] = useState(plh?.termo_nomeacao_data ?? "");
  const [artCargoFuncao, setArtCargoFuncao] = useState(plh?.art_cargo_funcao ?? "");

  useEffect(() => {
    setTermoNomeacaoData(plh?.termo_nomeacao_data ?? "");
    setArtCargoFuncao(plh?.art_cargo_funcao ?? "");
  }, [plh?.id, plh?.termo_nomeacao_data, plh?.art_cargo_funcao]);

  async function onBlurSave() {
    if (
      termoNomeacaoData === (plh?.termo_nomeacao_data ?? "") &&
      artCargoFuncao === (plh?.art_cargo_funcao ?? "")
    )
      return;
    try {
      await upsertPlh.mutateAsync({
        employeeId: employee.id,
        termo_nomeacao_data: termoNomeacaoData,
        art_cargo_funcao: artCargoFuncao,
      });
    } catch (err) {
      toast.error(`Não foi possível salvar o PLH. Detalhe: ${(err as Error).message}`);
    }
  }

  const emDia = creaAnuidadeEmDia(anuidades);
  const validade = creaAnuidadeValidadeAtual(anuidades);

  async function onAddAnuidade() {
    const proximoAno = anuidades.length ? Math.max(...anuidades.map((a) => a.ano)) + 1 : new Date().getFullYear();
    try {
      await addAnuidade.mutateAsync({ employeeId: employee.id, ano: proximoAno });
    } catch (err) {
      toast.error(`Não foi possível adicionar. Detalhe: ${(err as Error).message}`);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900 dark:bg-amber-950/10">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <BookMarked className="h-3.5 w-3.5" /> PLH — Profissional Legalmente Habilitado
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Termo de nomeação — data</label>
          <Input
            type="date"
            value={termoNomeacaoData}
            onChange={(e) => setTermoNomeacaoData(e.target.value)}
            onBlur={onBlurSave}
            className="h-8"
          />
          <PlhDocRow employee={employee} kind="termo_nomeacao" label="Anexo do termo" path={plh?.termo_nomeacao_arquivo_path ?? null} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">ART de cargo e função — número</label>
          <Input
            value={artCargoFuncao}
            onChange={(e) => setArtCargoFuncao(e.target.value)}
            onBlur={onBlurSave}
            placeholder="Número da ART"
            className="h-8"
          />
          <PlhDocRow employee={employee} kind="art_cargo_funcao" label="Anexo da ART" path={plh?.art_cargo_funcao_arquivo_path ?? null} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Anuidades CREA/CFT{" "}
            <span className={emDia ? "text-emerald-600" : "text-amber-700"}>
              ({emDia ? `em dia até ${formatDatePtBR(validade)}` : "pendente"})
            </span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onAddAnuidade}
            disabled={addAnuidade.isPending}
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar anuidade
          </Button>
        </div>
        {anuidades.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma anuidade registrada.</p>
        ) : (
          <div className="space-y-2">
            {anuidades.map((a) => (
              <AnuidadeRow key={a.id} employee={employee} anuidade={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmployeeDialog({ open, onOpenChange, employee }: Props) {
  const upsert = useUpsertEmployee();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(employee),
  });

  useEffect(() => {
    if (open) form.reset(defaultsFor(employee));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee]);

  async function onSubmit(values: FormValues) {
    try {
      // Gatilhos de reciclagem extraordinária (NR-10 10.8.8.x):
      // retorno de afastamento > 3 meses e mudança de função exigem reciclagem.
      const extras: Partial<Employee> = {};
      const today = new Date().toISOString().slice(0, 10);
      let gatilho: string | null = null;

      if (employee) {
        if (employee.status !== "afastado" && values.status === "afastado") {
          extras.afastado_desde = today;
        }
        if (employee.status === "afastado" && values.status === "ativo") {
          extras.retorno_em = today;
          const desde = employee.afastado_desde;
          if (desde) {
            const dias = Math.floor((Date.parse(today) - Date.parse(desde)) / 86_400_000);
            if (dias > 90) gatilho = "Retorno de afastamento superior a 3 meses";
          }
        }
        const funcaoAntiga = (employee.funcao ?? "").trim();
        const funcaoNova = (values.funcao ?? "").trim();
        if (funcaoAntiga && funcaoNova && funcaoAntiga !== funcaoNova) {
          gatilho = gatilho ? `${gatilho} · Mudança de função` : "Mudança de função";
        }
        if (gatilho) {
          extras.reciclagem_requerida = true;
          extras.reciclagem_motivo = gatilho;
        }
      }

      await upsert.mutateAsync({ ...values, ...extras, id: employee?.id });
      toast.success(employee ? "Colaborador atualizado" : "Colaborador cadastrado");
      if (gatilho) {
        toast.warning(
          `Reciclagem extraordinária sinalizada: ${gatilho} (NR-10 10.8.8). A flag é limpa ao registrar nova reciclagem.`,
        );
      }
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar colaborador");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{employee ? "Editar colaborador" : "Novo colaborador"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="matricula"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matrícula</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="setor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {([
                          ["ELE", "ELE — Elétrica"],
                          ["INS", "INS — Instrumentação"],
                          ["GER", "GER — Geração de energia"],
                          ["ADM", "ADM — Administrativo"],
                        ] as [string, string][]).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="classificacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Classificação</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["Qualificado", "Capacitado", "Habilitado"].map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Situação</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="afastado">Afastado</SelectItem>
                        <SelectItem value="desligado">Desligado</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="funcao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Função</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="crea_cft"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CREA / CFT</FormLabel>
                    <FormControl>
                      <Input placeholder="Número do registro" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {employee ? (
              <>
                <FormacoesSection employee={employee} />
                {form.watch("classificacao") === "Habilitado" && <PlhSection employee={employee} />}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Salve o colaborador para cadastrar Escolaridade / Formação
                {" "}e, se "Habilitado", os dados de PLH.
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
