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
import { toast } from "sonner";
import { useUpsertInstruction } from "@/lib/qualificacoes-queries";
import type { WorkInstruction } from "@/lib/qualificacoes";

const schema = z.object({
  code: z.string().min(1, "Código obrigatório"),
  title: z.string().optional(),
  // Sem .default() aqui: o valor inicial vem de defaultValues no useForm.
  // Um default no schema deixaria o tipo de entrada opcional e o de saída
  // obrigatório, quebrando a tipagem do zodResolver/useForm.
  validity_months: z.coerce.number().int().min(1),
});
type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  instruction?: WorkInstruction;
};

export function InstructionDialog({ open, onOpenChange, instruction }: Props) {
  const upsert = useUpsertInstruction();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: instruction?.code ?? "",
      title: instruction?.title ?? "",
      validity_months: instruction?.validity_months ?? 24,
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      await upsert.mutateAsync({ ...values, id: instruction?.id });
      toast.success(instruction ? "IT atualizada" : "IT cadastrada");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar IT");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {instruction ? "Editar Instrução de Trabalho" : "Nova Instrução de Trabalho"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código</FormLabel>
                  <FormControl>
                    <Input placeholder="ex: ATV.001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Descrição da IT" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="validity_months"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Validade (meses)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
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
