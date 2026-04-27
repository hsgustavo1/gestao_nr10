import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logEvent, PADLOCK_COLORS, colorLabel, colorSwatch, formatPhoneBR, type Padlock, type PadlockColor } from "@/lib/padlocks";

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
  const [conflict, setConflict] = useState<{ kind: "number" | "registration"; existing: Padlock } | null>(null);

  const isRed = color === "vermelho";

  function reset() {
    setColor("azul"); setNumber(""); setOwnerName(""); setOwnerReg("");
    setOwnerRole(""); setOwnerSector(""); setOwnerPhone("");
    setConflict(null);
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

    // 1) Pré-check de conflitos para oferecer transferência ao invés de erro cru
    //    (a) cor+numero ativo
    const { data: byNumber } = await supabase
      .from("padlocks").select("*")
      .eq("color", parsed.data.color)
      .eq("number", parsed.data.number)
      .eq("cancelled", false)
      .maybeSingle();
    if (byNumber) {
      setLoading(false);
      setConflict({ kind: "number", existing: byNumber });
      return;
    }
    //    (b) matrícula azul/latão ativo
    if (!isRed && (parsed.data.color === "azul" || parsed.data.color === "latao") && parsed.data.owner_registration) {
      const { data: byReg } = await supabase
        .from("padlocks").select("*")
        .eq("color", parsed.data.color)
        .eq("owner_registration", parsed.data.owner_registration)
        .eq("cancelled", false)
        .maybeSingle();
      if (byReg) {
        setLoading(false);
        setConflict({ kind: "registration", existing: byReg });
        return;
      }
    }

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
    toast.success("Dispositivo cadastrado");
    reset();
    setLoading(false);
    onOpenChange(false);
    onCreated();
  }

  async function transferToCurrentForm() {
    if (!conflict) return;
    if (isRed) return; // sem dados de dono em vermelho
    setLoading(true);
    const previous = conflict.existing;
    const newOwner = {
      owner_name: ownerName.trim() || null,
      owner_registration: ownerReg.trim() || null,
      owner_role: ownerRole.trim() || null,
      owner_sector: ownerSector.trim(),
      owner_phone: ownerPhone.trim() || null,
    };
    const { data, error } = await supabase
      .from("padlocks")
      .update(newOwner)
      .eq("id", previous.id)
      .select()
      .single();
    if (error || !data) {
      setLoading(false);
      return toast.error(translateError(error?.message ?? "Erro ao transferir"));
    }
    await logEvent({
      padlock_id: previous.id, padlock_code: previous.code, action: "transferred",
      actor_id: user?.id ?? null, actor_name: user?.email ?? null,
      previous_data: {
        owner_name: previous.owner_name, owner_registration: previous.owner_registration,
        owner_role: previous.owner_role, owner_sector: previous.owner_sector,
        owner_phone: previous.owner_phone,
      },
      new_data: newOwner,
      notes: `Transferência originada do fluxo "Novo dispositivo" (conflito de ${conflict.kind === "number" ? "número" : "matrícula"}).`,
    });
    toast.success("Dispositivo repassado");
    reset();
    setLoading(false);
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Dispositivo</DialogTitle>
          <DialogDescription>Cadastre cor, número e dados do dono. Dispositivos de empréstimo exigem apenas número e setor / empresa.</DialogDescription>
        </DialogHeader>

        {conflict ? (
          <ConflictPanel
            conflict={conflict}
            isRed={isRed}
            loading={loading}
            onBack={() => setConflict(null)}
            onTransfer={transferToCurrentForm}
          />
        ) : (
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
              <Label htmlFor="num">Nº</Label>
              <Input id="num" type="number" min={0} value={number} onChange={(e) => setNumber(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sector">Setor / Empresa {isRed && <span className="text-xs text-muted-foreground">(obrigatório)</span>}</Label>
            <Input id="sector" value={ownerSector} onChange={(e) => setOwnerSector(e.target.value)} maxLength={100} required />
          </div>

          {!isRed && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="oname">Dono</Label>
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
                  <Input id="ophone" value={ownerPhone} onChange={(e) => setOwnerPhone(formatPhoneBR(e.target.value))} inputMode="tel" placeholder="(XX) XXXXX-XXXX" maxLength={16} required />
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-brand-gradient text-white shadow-brand hover:opacity-95">
              {loading ? "Salvando..." : "Cadastrar Novo Dispositivo"}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConflictPanel({
  conflict, isRed, loading, onBack, onTransfer,
}: {
  conflict: { kind: "number" | "registration"; existing: Padlock };
  isRed: boolean;
  loading: boolean;
  onBack: () => void;
  onTransfer: () => void;
}) {
  const p = conflict.existing;
  const reason = conflict.kind === "number"
    ? `Já existe um dispositivo em uso ${colorLabel[p.color]} #${p.number}.`
    : `A matrícula ${p.owner_registration} já possui um dispositivo ${colorLabel[p.color]} em uso (#${p.number}).`;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <div className="font-semibold text-amber-700 dark:text-amber-300 mb-1">Conflito detectado</div>
        <p className="text-foreground">{reason}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Info label="Dono atual" value={p.owner_name ?? "—"} />
          <Info label="Matrícula" value={p.owner_registration ?? "—"} mono />
          <Info label="Setor / Empresa" value={p.owner_sector ?? "—"} />
          <Info label="Telefone" value={p.owner_phone ? formatPhoneBR(p.owner_phone) : "—"} />
        </div>
      </div>
      {isRed ? (
        <p className="text-sm text-muted-foreground">
          Dispositivos de empréstimo não suportam repasse (sem dono associado). Escolha outro número
          ou realize a baixa do dispositivo existente antes de cadastrar um novo.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Você pode <strong>repassar o dispositivo existente</strong> para o novo dono que digitou
          acima — isso preserva o número e mantém a auditoria na linha do tempo. Ou volte e ajuste os dados.
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onBack}>Voltar e ajustar</Button>
        {!isRed && (
          <Button type="button" disabled={loading} onClick={onTransfer} className="bg-brand-gradient text-white shadow-brand hover:opacity-95">
            <ArrowLeftRight className="h-4 w-4" /> {loading ? "Transferindo..." : "Repassar dispositivo"}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function translateError(msg: string): string {
  if (msg.includes("padlocks_color_number_key") || msg.includes("duplicate key")) {
    if (msg.includes("padlocks_owner_unique_blue_brass")) {
      return "Esta matrícula já possui um dispositivo dessa cor (Pessoal/Equipamento é 1 por pessoa).";
    }
    return "Já existe um dispositivo com essa cor e número.";
  }
  return msg;
}