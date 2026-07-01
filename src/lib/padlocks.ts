import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Padlock = Database["public"]["Tables"]["padlocks"]["Row"];
export type PadlockEvent = Database["public"]["Tables"]["padlock_events"]["Row"];
export type PadlockColor = Database["public"]["Enums"]["padlock_color"];

export const PADLOCK_COLORS: PadlockColor[] = ["azul", "amarelo", "latao", "vermelho"];

export const colorLabel: Record<PadlockColor, string> = {
  azul: "AZUL - EXECUTANTE",
  amarelo: "AMARELO - DONO DE ÁREA",
  latao: "LATÃO - PARCEIROS",
  vermelho: "VERMELHO - EQUIPAMENTOS",
};

// Swatch para a bolinha visual da cor — usa cores reais do cadeado (não tokens semânticos)
export const colorSwatch: Record<PadlockColor, string> = {
  azul: "bg-[#1d4ed8] border-[#1e3a8a]",
  amarelo: "bg-[#facc15] border-[#a16207]",
  latao: "bg-[#b08d57] border-[#6b4f2a]",
  vermelho: "bg-[#dc2626] border-[#7f1d1d]",
};

export const colorBadge: Record<PadlockColor, string> = {
  azul: "bg-[#E2EEFA] text-[#0B4A8A] border-[#2174C9]/40",
  amarelo: "bg-[#FFF4D6] text-[#7A5500] border-[#E8B800]/50",
  latao: "bg-[#F0EDE3] text-[#5A5236] border-[#A89660]/50",
  vermelho: "bg-[#FFE3DF] text-[#8B1A0E] border-[#D42E1B]/40",
};

// Acento usado no topo dos cards do Painel
export const colorAccent: Record<PadlockColor, string> = {
  azul: "bg-[#2174C9]",
  amarelo: "bg-[#E8B800]",
  latao: "bg-[#A89660]",
  vermelho: "bg-[#D42E1B]",
};

export function ownerRequiresAllFields(color: PadlockColor): boolean {
  return color !== "vermelho";
}

export type DerivedStatus = "disponivel" | "aplicado" | "vencido";

export function deriveStatus(p: Pick<Padlock, "status" | "due_at">): DerivedStatus {
  if (p.status === "aplicado" && p.due_at && new Date(p.due_at).getTime() < Date.now()) {
    return "vencido";
  }
  return p.status;
}

export const statusLabel: Record<DerivedStatus, string> = {
  disponivel: "Disponível",
  aplicado: "Em uso",
  vencido: "Vencido",
};

export const statusColor: Record<DerivedStatus, string> = {
  disponivel: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  aplicado: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  vencido: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

export async function logEvent(input: {
  padlock_id: string;
  padlock_code: string;
  action: "created" | "updated" | "deleted" | "applied" | "released" | "transferred";
  actor_id: string | null;
  actor_name: string | null;
  previous_data?: unknown;
  new_data?: unknown;
  notes?: string;
}) {
  // Carimba o mesmo org_id do cadeado (fn_default_org_id só cobre usuário de 1 org).
  const { data: padlockRow } = await supabase
    .from("padlocks")
    .select("org_id")
    .eq("id", input.padlock_id)
    .single();
  await supabase.from("padlock_events").insert({
    ...(padlockRow?.org_id ? { org_id: padlockRow.org_id } : {}),
    padlock_id: input.padlock_id,
    padlock_code: input.padlock_code,
    action: input.action,
    actor_id: input.actor_id,
    actor_name: input.actor_name,
    previous_data: (input.previous_data as never) ?? null,
    new_data: (input.new_data as never) ?? null,
    notes: input.notes ?? null,
  } as never);
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Formata telefone BR como (XX) XXXXX-XXXX (ou (XX) XXXX-XXXX para 10 dígitos). */
export function formatPhoneBR(value: string | null | undefined): string {
  if (!value) return "";
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
