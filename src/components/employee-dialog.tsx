import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { useUpsertEmployee } from "@/lib/qualificacoes-queries";
import type { Employee } from "@/lib/qualificacoes";

const schema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  matricula: z.string().min(1, "Matrícula obrigatória"),
  setor: z.string().optional(),
  classificacao: z.string().optional(),
  funcao: z.string().optional(),
  escolaridade: z.string().optional(),
  diploma: z.string().optional(),
  diploma_conclusao: z.string().optional(),
  crea_cft: z.string().optional(),
  status: z.enum(["ativo", "afastado", "desligado"]),
});
type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee?: Employee;
};

export function EmployeeDialog({ open, onOpenChange, employee }: Props) {
  const upsert = useUpsertEmployee();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: employee?.name ?? "",
      matricula: employee?.matricula ?? "",
      setor: employee?.setor ?? "",
      classificacao: employee?.classificacao ?? "",
      funcao: employee?.funcao ?? "",
      escolaridade: employee?.escolaridade ?? "",
      diploma: employee?.diploma ?? "",
      diploma_conclusao: employee?.diploma_conclusao ?? "",
      crea_cft: employee?.crea_cft ?? "",
      status: employee?.status ?? "ativo",
    },
  });

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
                        {["ELE", "GER", "INS", "MEC", "ADM", "OPE", "OUT"].map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
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
                name="funcao"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Função</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
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
                name="crea_cft"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>CREA / CFT</FormLabel>
                    <FormControl>
                      <Input placeholder="Número do registro" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
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
