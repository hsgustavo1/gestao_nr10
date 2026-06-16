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
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
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
import { useUpsertITTraining } from "@/lib/qualificacoes-queries";
import { IT_STATUS_VALUES, IT_STATUS_LABELS } from "@/lib/qualificacoes";

const schema = z.object({
  employee_id: z.string().uuid(),
  instruction_id: z.string().uuid(),
  status: z.enum(["ok", "pendente", "vencido"]),
  conclusao_date: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId: string;
  employeeName: string;
  instructionId: string;
  instructionCode: string;
  currentStatus?: string;
  currentDate?: string;
};

export function ITTrainingDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  instructionId,
  instructionCode,
  currentStatus,
  currentDate,
}: Props) {
  const upsert = useUpsertITTraining();
  const hoje = new Date().toISOString().slice(0, 10);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employee_id: employeeId,
      instruction_id: instructionId,
      status: (currentStatus as "ok" | "pendente" | "vencido") ?? "pendente",
      conclusao_date: currentDate ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    if (values.conclusao_date && values.conclusao_date > hoje) {
      toast.error("A data de conclusão não pode ser futura.");
      return;
    }
    try {
      // conclusao_date do form é string | undefined ("" quando vazio);
      // a coluna aceita string | null, então normalizamos ausência para null.
      await upsert.mutateAsync({ ...values, conclusao_date: values.conclusao_date || null });
      toast.success("Conclusão de IT registrada");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {instructionCode} — {employeeName}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {IT_STATUS_VALUES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {IT_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="conclusao_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de conclusão</FormLabel>
                  <FormControl>
                    <Input type="date" max={hoje} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
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
