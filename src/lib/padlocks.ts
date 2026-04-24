import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Padlock = Database["public"]["Tables"]["padlocks"]["Row"];
export type PadlockEvent = Database["public"]["Tables"]["padlock_events"]["Row"];
export type PadlockColor = Database["public"]["Enums"]["padlock_color"];

export const PADLOCK_COLORS: PadlockColor[] = ["azul", "amarelo", "latao", "vermelho"];

export const colorLabel: Record<PadlockColor, string> = {
  azul: "Azul",
  amarelo: "Amarelo",
  latao: "Latão",
  vermelho: "Vermelho",
};

// Swatch para a bolinha visual da cor — usa cores reais do cadeado (não tokens semânticos)
export const colorSwatch: Record<PadlockColor, string> = {
  azul: "bg-[#1d4ed8] border-[#1e3a8a]",
  amarelo: "bg-[#facc15] border-[#a16207]",
  latao: "bg-[#b08d57] border-[#6b4f2a]",
  vermelho: "bg-[#dc2626] border-[#7f1d1d]",
};

export const colorBadge: Record<PadlockColor, string> = {
  azul: "bg-[#1d4ed8]/15 text-[#1d4ed8] dark:text-[#93c5fd] border-[#1d4ed8]/30",
  amarelo: "bg-[#facc15]/20 text-[#854d0e] dark:text-[#fde68a] border-[#a16207]/40",
  latao: "bg-[#b08d57]/20 text-[#6b4f2a] dark:text-[#d4b483] border-[#b08d57]/40",
  vermelho: "bg-[#dc2626]/15 text-[#b91c1c] dark:text-[#fca5a5] border-[#dc2626]/30",
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
  aplicado: "Aplicado",
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
  action: "created" | "updated" | "deleted" | "applied" | "released";
  actor_id: string | null;
  actor_name: string | null;
  previous_data?: unknown;
  new_data?: unknown;
  notes?: string;
}) {
  await supabase.from("padlock_events").insert({
    padlock_id: input.padlock_id,
    padlock_code: input.padlock_code,
    action: input.action,
    actor_id: input.actor_id,
    actor_name: input.actor_name,
    previous_data: (input.previous_data as never) ?? null,
    new_data: (input.new_data as never) ?? null,
    notes: input.notes ?? null,
  });
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}