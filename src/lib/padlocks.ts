import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Padlock = Database["public"]["Tables"]["padlocks"]["Row"];
export type PadlockEvent = Database["public"]["Tables"]["padlock_events"]["Row"];

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