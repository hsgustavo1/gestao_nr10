import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Padlock } from "@/lib/padlocks";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  padlock: Padlock;
}

export function ReportInconsistencyDialog({ open, onOpenChange, padlock }: Props) {
  const { user } = useAuth();
  const defaultName =
    (user?.user_metadata?.display_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "";
  const [name, setName] = useState(defaultName);
  const [contact, setContact] = useState(user?.email ?? "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const msg = message.trim();
    if (msg.length < 5) {
      toast.error("Descreva a inconsistência com pelo menos 5 caracteres.");
      return;
    }
    if (msg.length > 1000) {
      toast.error("Mensagem muito longa (máx. 1000 caracteres).");
      return;
    }
    setLoading(true);
    const { data: report, error } = await supabase
      .from("padlock_reports")
      .insert({
        padlock_id: padlock.id,
        padlock_code: padlock.code,
        reporter_name: name.trim() || null,
        reporter_contact: contact.trim() || null,
        message: msg,
      })
      .select()
      .single();
    if (error || !report) {
      setLoading(false);
      toast.error("Não foi possível enviar o report.");
      return;
    }
    await supabase.from("padlock_report_events").insert({
      report_id: report.id,
      padlock_id: padlock.id,
      padlock_code: padlock.code,
      action: "criado",
      actor_id: user?.id ?? null,
      actor_name: name.trim() || (user?.email ?? "Anônimo"),
      notes: msg,
    });
    setLoading(false);
    toast.success("Report enviado. Obrigado!");
    setMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Reportar inconsistência
          </DialogTitle>
          <DialogDescription>
            Dispositivo <strong>{padlock.code}</strong>. O Dono de RAC receberá seu report e dará tratativa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="rep-name">Seu nome (opcional)</Label>
            <Input id="rep-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
          <div>
            <Label htmlFor="rep-contact">Contato — e-mail ou telefone (opcional)</Label>
            <Input id="rep-contact" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label htmlFor="rep-msg">Descrição da inconsistência *</Label>
            <Textarea
              id="rep-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Descreva o que está incorreto neste cadastro..."
            />
            <div className="text-[11px] text-muted-foreground mt-1">{message.length}/1000</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white shadow-brand">
            {loading ? "Enviando..." : "Enviar report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}