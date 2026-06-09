import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useState } from "react";
import { ExternalLink, Paperclip, Trash2, Loader2 } from "lucide-react";
import { useUpsertNR10Training, useCertificates, useInsertCertificate, useDeleteCertificate, uploadCertificateFile } from "@/lib/qualificacoes-queries";
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
  const { data: certificates = [] } = useCertificates(employeeId, training?.id);
  const insertCert = useInsertCertificate();
  const deleteCert = useDeleteCertificate();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleCertUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !training?.id) return;
    setUploading(true);
    try {
      const url = await uploadCertificateFile(employeeId, file);
      await insertCert.mutateAsync({
        employee_id: employeeId,
        nr10_training_id: training.id,
        training_type: training.training_type,
        category: training.category,
        file_url: url,
        file_name: file.name,
        issue_date: null,
        source_file: null,
        pages_in_source: null,
      });
      toast.success("Certificado anexado");
    } catch {
      toast.error("Erro ao anexar certificado");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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

            {/* Certificados — only show when editing an existing training */}
            {training?.id && (
              <div className="pt-2">
                <Separator className="mb-3" />
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Certificados
                  </p>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={handleCertUpload}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                      {uploading ? "Enviando..." : "Anexar"}
                    </Button>
                  </div>
                </div>

                {certificates.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Nenhum certificado anexado.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {certificates.map((cert) => (
                      <li key={cert.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                        <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate text-muted-foreground">
                          {cert.file_name ?? "certificado"}
                        </span>
                        <a
                          href={cert.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline shrink-0 inline-flex items-center gap-0.5"
                        >
                          Abrir <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                        <button
                          type="button"
                          className="text-destructive hover:text-destructive/80 shrink-0"
                          onClick={async () => {
                            try {
                              await deleteCert.mutateAsync({ id: cert.id, employeeId });
                              toast.success("Certificado removido");
                            } catch {
                              toast.error("Erro ao remover");
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

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
