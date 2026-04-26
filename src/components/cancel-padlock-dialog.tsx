import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logEvent, colorLabel, type Padlock } from "@/lib/padlocks";

const REASONS = [
  "Perda do cadeado",
  "Quebra/danificado",
  "Desligamento do colaborador",
  "Troca por novo cadeado",
  "Erro de cadastro",
  "Outro",
] as const;

export function CancelPadlockDialog({
  open, onOpenChange, padlock, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  padlock: Padlock;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setReason(""); setDetail(""); setLoading(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason) return toast.error("Selecione um motivo");
    if (reason === "Outro" && !detail.trim()) {
      return toast.error("Descreva o motivo no campo de detalhes");
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("padlocks")
      .update({
        cancelled: true,
        cancelled_at: new Date().toISOString(),
        cancelled_by: user?.id ?? null,
        cancellation_reason: reason,
        cancellation_detail: detail.trim() || null,
      })
      .eq("id", padlock.id)
      .select()
      .single();
    if (error || !data) {
      setLoading(false);
      return toast.error(error?.message ?? "Erro ao cancelar cadeado");
    }
    await logEvent({
      padlock_id: padlock.id,
      padlock_code: padlock.code,
      action: "deleted", // mantemos compat com tipo do log; representa "cancelado" para soft-delete
      actor_id: user?.id ?? null,
      actor_name: user?.email ?? null,
      previous_data: padlock,
      new_data: data,
      notes: `Cancelado — motivo: ${reason}${detail.trim() ? ` — ${detail.trim()}` : ""}`,
    });
    toast.success("Cadeado cancelado");
    reset();
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar {colorLabel[padlock.color]} #{padlock.number}</DialogTitle>
          <DialogDescription>
            O cadeado fica marcado como <strong>cancelado</strong>, libera o número/matrícula
            para reuso e permanece no histórico para auditoria.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Selecione um motivo" /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>
              Detalhes {reason === "Outro" && <span className="text-xs text-muted-foreground">(obrigatório)</span>}
            </Label>
            <Textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Descreva brevemente o ocorrido..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
            <Button type="submit" disabled={loading} variant="destructive">
              {loading ? "Cancelando..." : "Confirmar cancelamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}