import { useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useUpsertAuthorization } from "@/lib/qualificacoes-queries";
import { AUTHORIZATION_LEVELS } from "@/lib/qualificacoes";
import type { WorkAuthorization } from "@/lib/qualificacoes";

const schema = z.object({
  employee_id: z.string(),
  level: z.enum(AUTHORIZATION_LEVELS),
  funcao: z.string().optional(),
  abrangencia: z.string().optional(),
  authorization_date: z.string().optional(),
  valid: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId: string;
  employeeName: string;
  authorization?: WorkAuthorization;
};

export function AuthorizationDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  authorization,
}: Props) {
  const upsert = useUpsertAuthorization();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employee_id: employeeId,
      level: authorization?.level ?? "A0",
      funcao: authorization?.funcao ?? "",
      abrangencia: authorization?.abrangencia ?? "",
      authorization_date: authorization?.authorization_date ?? "",
      valid: authorization?.valid ?? false,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        employee_id: employeeId,
        level: authorization?.level ?? "A0",
        funcao: authorization?.funcao ?? "",
        abrangencia: authorization?.abrangencia ?? "",
        authorization_date: authorization?.authorization_date ?? "",
        valid: authorization?.valid ?? false,
      });
    }
  }, [open, employeeId, authorization, form]);

  async function onSubmit(values: FormValues) {
    try {
      await upsert.mutateAsync({
        ...values,
        funcao: values.funcao || null,
        abrangencia: values.abrangencia || null,
        authorization_date: values.authorization_date || null,
        id: authorization?.id,
      });
      toast.success("Autorização salva");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar autorização");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Autorização de Trabalho — {employeeName}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Hidden employee_id field */}
            <input type="hidden" {...form.register("employee_id")} />

            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nível de autorização</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o nível" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {AUTHORIZATION_LEVELS.map((lvl) => (
                        <SelectItem key={lvl} value={lvl}>
                          {lvl}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
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
                    <Textarea placeholder="Descreva a função..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="abrangencia"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Abrangência</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descreva a abrangência..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="authorization_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de autorização</FormLabel>
                  <FormControl>
                    <input
                      type="date"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="valid"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormLabel className="mt-0">Autorização válida</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
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
