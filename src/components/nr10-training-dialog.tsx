import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useUpsertNR10Training } from "@/lib/qualificacoes-queries";
import { TRAINING_TYPES, TRAINING_LABELS, type TrainingType, type NR10Training } from "@/lib/qualificacoes";

const schema = z.object({
  employee_id: z.string().uuid(),
  training_type: z.enum(["nr10_basico", "nr10_areas_classificadas", "sep"]),
  category: z.enum(["formacao", "reciclagem"]),
  training_date: z.string().optional(),
  art: z.string().optional(),
  responsavel_tecnico: z.string().optional(),
  valid: z.boolean().default(false),
});
type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId: string;
  employeeName: string;
  training?: NR10Training;
  defaultType?: TrainingType;
  defaultCategory?: "formacao" | "reciclagem";
};

export function NR10TrainingDialog({ open, onOpenChange, employeeId, employeeName, training, defaultType, defaultCategory }: Props) {
  const upsert = useUpsertNR10Training();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employee_id: employeeId,
      training_type: training?.training_type ?? defaultType ?? "nr10_basico",
      category: training?.category ?? defaultCategory ?? "formacao",
      training_date: training?.training_date ?? "",
      art: training?.art ?? "",
      responsavel_tecnico: training?.responsavel_tecnico ?? "",
      valid: training?.valid ?? false,
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      await upsert.mutateAsync(values);
      toast.success("Treinamento salvo");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar treinamento");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Treinamento NR-10 — {employeeName}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="training_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {TRAINING_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{TRAINING_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="formacao">Formação</SelectItem>
                      <SelectItem value="reciclagem">Reciclagem</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="training_date" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Data do treinamento</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="art" render={({ field }) => (
                <FormItem>
                  <FormLabel>ART</FormLabel>
                  <FormControl><Input placeholder="Nº ART" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="responsavel_tecnico" render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável técnico</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="valid" render={({ field }) => (
                <FormItem className="flex items-center gap-3 col-span-2">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Treinamento válido</FormLabel>
                </FormItem>
              )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
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
