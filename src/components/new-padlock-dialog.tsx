import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logEvent } from "@/lib/padlocks";

const schema = z.object({
  code: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9._-]+$/, "Use apenas letras, números, . _ -"),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export function NewPadlockDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ code, location, notes });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("padlocks")
      .insert({
        code: parsed.data.code,
        location: parsed.data.location || null,
        notes: parsed.data.notes || null,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    await logEvent({
      padlock_id: data.id,
      padlock_code: data.code,
      action: "created",
      actor_id: user?.id ?? null,
      actor_name: user?.email ?? null,
      new_data: data,
    });
    toast.success("Cadeado cadastrado");
    setCode(""); setLocation(""); setNotes("");
    setLoading(false);
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cadeado</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Código / etiqueta</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex: CDA-0123" maxLength={60} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loc">Localização inicial (opcional)</Label>
            <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-brand-gradient text-white shadow-brand hover:opacity-95">
              {loading ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}