import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logEvent, PADLOCK_COLORS, colorLabel, colorSwatch, type PadlockColor } from "@/lib/padlocks";

const baseSchema = z.object({
  color: z.enum(["azul", "amarelo", "latao", "vermelho"]),
  number: z.coerce.number().int().min(0, "Número inválido").max(99999, "Número muito grande"),
  owner_sector: z.string().trim().min(1, "Setor é obrigatório").max(100),
  owner_name: z.string().trim().max(120).optional().or(z.literal("")),
  owner_registration: z.string().trim().max(40).optional().or(z.literal("")),
  owner_role: z.string().trim().max(80).optional().or(z.literal("")),
  owner_phone: z.string().trim().max(30).optional().or(z.literal("")),
});

export function NewPadlockDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [color, setColor] = useState<PadlockColor>("azul");
  const [number, setNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerReg, setOwnerReg] = useState("");
  const [ownerRole, setOwnerRole] = useState("");
  const [ownerSector, setOwnerSector] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const isRed = color === "vermelho";

  function reset() {
    setColor("azul"); setNumber(""); setOwnerName(""); setOwnerReg("");
    setOwnerRole(""); setOwnerSector(""); setOwnerPhone("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = baseSchema.safeParse({
      color, number, owner_sector: ownerSector,
      owner_name: ownerName, owner_registration: ownerReg,
      owner_role: ownerRole, owner_phone: ownerPhone,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    if (!isRed) {
      const missing: string[] = [];
      if (!parsed.data.owner_name) missing.push("Nome");
      if (!parsed.data.owner_registration) missing.push("Matrícula");
      if (!parsed.data.owner_role) missing.push("Função");
      if (!parsed.data.owner_phone) missing.push("Telefone");
      if (missing.length) return toast.error(`Campos obrigatórios: ${missing.join(", ")}`);
    }

    setLoading(true);
    // code é gerado pelo trigger no banco; aqui passamos um placeholder consistente
    const code = `${parsed.data.color}-${parsed.data.number}`;
    const { data, error } = await supabase
      .from("padlocks")
      .insert({
        code,
        color: parsed.data.color,
        number: parsed.data.number,
        owner_name: isRed ? null : parsed.data.owner_name || null,
        owner_registration: isRed ? null : parsed.data.owner_registration || null,
        owner_role: isRed ? null : parsed.data.owner_role || null,
        owner_sector: parsed.data.owner_sector,
        owner_phone: isRed ? null : parsed.data.owner_phone || null,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error || !data) {
      setLoading(false);
      return toast.error(translateError(error?.message ?? "Erro ao cadastrar"));
    }
    await logEvent({
      padlock_id: data.id, padlock_code: data.code, action: "created",
      actor_id: user?.id ?? null, actor_name: user?.email ?? null,
      new_data: data,
    });
    toast.success("Cadeado cadastrado");
    reset();
    setLoading(false);
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo cadeado</DialogTitle>
          <DialogDescription>Cadastre cor, número e dados do dono. Cadeados vermelhos exigem apenas número e setor.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <Select value={color} onValueChange={(v) => setColor(v as PadlockColor)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PADLOCK_COLORS.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full border ${colorSwatch[c]}`} />
                        {colorLabel[c]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="num">Número</Label>
              <Input id="num" type="number" min={0} value={number} onChange={(e) => setNumber(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sector">Setor {isRed && <span className="text-xs text-muted-foreground">(obrigatório)</span>}</Label>
            <Input id="sector" value={ownerSector} onChange={(e) => setOwnerSector(e.target.value)} maxLength={100} required />
          </div>

          {!isRed && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="oname">Nome do dono</Label>
                  <Input id="oname" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} maxLength={120} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="oreg">Matrícula</Label>
                  <Input id="oreg" value={ownerReg} onChange={(e) => setOwnerReg(e.target.value)} maxLength={40} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="orole">Função</Label>
                  <Input id="orole" value={ownerRole} onChange={(e) => setOwnerRole(e.target.value)} maxLength={80} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ophone">Telefone</Label>
                  <Input id="ophone" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} maxLength={30} required />
                </div>
              </div>
            </>
          )}

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

function translateError(msg: string): string {
  if (msg.includes("padlocks_color_number_key") || msg.includes("duplicate key")) {
    if (msg.includes("padlocks_owner_unique_blue_brass")) {
      return "Esta matrícula já possui um cadeado dessa cor (azul/latão é 1 por pessoa).";
    }
    return "Já existe um cadeado com essa cor e número.";
  }
  return msg;
}