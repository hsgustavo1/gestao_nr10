import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Padlock, PadlockEvent } from "@/lib/padlocks";

export { useQueryClient };

// ── Padlocks (lista completa) ─────────────────────────────────────────────────

export function usePadlocks() {
  return useQuery({
    queryKey: ["padlocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("padlocks")
        .select("*")
        .order("color")
        .order("number");
      if (error) throw error;
      return (data ?? []) as Padlock[];
    },
    staleTime: 30_000,
  });
}

// ── Detalhe de um cadeado + seus eventos ──────────────────────────────────────

export function usePadlockDetail(code: string) {
  return useQuery({
    queryKey: ["padlock", code],
    queryFn: async () => {
      const { data: padlock, error } = await supabase
        .from("padlocks")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (error) throw error;
      if (!padlock) return { padlock: null, events: [] as PadlockEvent[] };

      const { data: events } = await supabase
        .from("padlock_events")
        .select("*")
        .eq("padlock_id", padlock.id)
        .order("created_at", { ascending: false });

      return { padlock: padlock as Padlock, events: (events ?? []) as PadlockEvent[] };
    },
    staleTime: 15_000,
  });
}

// ── Dashboard (3 queries em paralelo) ────────────────────────────────────────

export function useDashboardData() {
  const padlocksQ = useQuery({
    queryKey: ["padlocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("padlocks")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Padlock[];
    },
    staleTime: 30_000,
  });

  const eventsQ = useQuery({
    queryKey: ["padlock_events_recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("padlock_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as PadlockEvent[];
    },
    staleTime: 15_000,
  });

  const violationsQ = useQuery({
    queryKey: ["padlock_violations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("padlock_violations").select("reason");
      if (error) throw error;
      return (data ?? []) as { reason: string }[];
    },
    staleTime: 30_000,
  });

  return {
    padlocks: padlocksQ.data ?? [],
    events: eventsQ.data ?? [],
    violations: violationsQ.data ?? [],
    isLoading: padlocksQ.isLoading || eventsQ.isLoading || violationsQ.isLoading,
  };
}

// ── Violações ─────────────────────────────────────────────────────────────────

export type Violation = {
  id: string;
  violation_date: string;
  reason: string;
  requester: string;
  sector: string;
  document_path: string;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
};

export function useViolations() {
  return useQuery({
    queryKey: ["padlock_violations_full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("padlock_violations")
        .select("*")
        .order("violation_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Violation[];
    },
    staleTime: 30_000,
  });
}
