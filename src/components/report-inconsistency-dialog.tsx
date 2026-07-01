import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { colorLabel, type Padlock } from "@/lib/padlocks";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  padlock?: Padlock;
  padlocks?: Padlock[];
}

export function ReportInconsistencyDialog({ open, onOpenChange, padlock, padlocks }: Props) {
  const { user } = useAuth();
  const defaultName =
    (user?.user_metadata?.display_name as string | undefined) || user?.email?.split("@")[0] || "";
  const [name, setName] = useState(defaultName);
  const [contact, setContact] = useState(user?.email ?? "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedCode, setSelectedCode] = useState("");
  const [search, setSearch] = useState("");

  const selectionMode = !padlock && Array.isArray(padlocks);
  const sortedPadlocks = useMemo(() => {
    if (!padlocks) return [];
    return [...padlocks].sort((a, b) =>
      a.color === b.color ? a.number - b.number : a.color.localeCompare(b.color),
    );
  }, [padlocks]);
  const filteredPadlocks = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sortedPadlocks;
    return sortedPadlocks.filter(
      (p) =>
        p.code.toLowerCase().includes(term) ||
        String(p.number).includes(term) ||
        (p.owner_name ?? "").toLowerCase().includes(term) ||
        (p.owner_sector ?? "").toLowerCase().includes(term),
    );
  }, [sortedPadlocks, search]);
  const targetPadlock = padlock ?? sortedPadlocks.find((p) => p.code === selectedCode) ?? null;

  const submit = async () => {
    if (!targetPadlock) {
      toast.error("Selecione um dispositivo.");
      return;
    }
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
        org_id: targetPadlock.org_id,
        padlock_id: targetPadlock.id,
        padlock_code: targetPadlock.code,
        reporter_name: name.trim() || null,
        reporter_contact: contact.trim() || null,
        message: msg,
      } as never)
      .select()
      .single();
    if (error || !report) {
      setLoading(false);
      toast.error("Não foi possível enviar o report.");
      return;
    }
    await supabase.from("padlock_report_events").insert({
      org_id: targetPadlock.org_id,
      report_id: report.id,
      padlock_id: targetPadlock.id,
      padlock_code: targetPadlock.code,
      action: "criado",
      actor_id: user?.id ?? null,
      actor_name: name.trim() || (user?.email ?? "Anônimo"),
      notes: msg,
    } as never);
    setLoading(false);
    toast.success("Report enviado. Obrigado!");
    setMessage("");
    setSelectedCode("");
    setSearch("");
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
            {targetPadlock ? (
              <>
                Dispositivo <strong>{targetPadlock.code}</strong>.{" "}
              </>
            ) : (
              <>Selecione o dispositivo com inconsistência. </>
            )}
            O Dono de RAC receberá seu report e dará tratativa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {selectionMode && (
            <div>
              <Label htmlFor="rep-padlock">Dispositivo *</Label>
              <Input
                id="rep-padlock-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por número, dono ou setor"
                className="mb-2"
              />
              <select
                id="rep-padlock"
                value={selectedCode}
                onChange={(e) => setSelectedCode(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                size={Math.min(6, Math.max(3, filteredPadlocks.length))}
              >
                {filteredPadlocks.length === 0 && (
                  <option value="" disabled>
                    Nenhum dispositivo encontrado
                  </option>
                )}
                {filteredPadlocks.map((p) => (
                  <option key={p.id} value={p.code}>
                    #{p.number} · {colorLabel[p.color]}
                    {p.owner_name ? ` · ${p.owner_name}` : ""}
                    {p.owner_sector ? ` · ${p.owner_sector}` : ""}
                    {p.cancelled ? " (baixado)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label htmlFor="rep-name">Seu nome (opcional)</Label>
            <Input
              id="rep-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="rep-contact">Contato — e-mail ou telefone (opcional)</Label>
            <Input
              id="rep-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={120}
            />
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
          <Button
            onClick={submit}
            disabled={loading}
            className="bg-brand-gradient text-white shadow-brand"
          >
            {loading ? "Enviando..." : "Enviar report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
