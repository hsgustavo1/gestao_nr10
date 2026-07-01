import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { snapshotPayloadFrom, type ComplianceReport, type SnapshotPayload } from "./conformidade";

// ── Snapshots mensais de conformidade (tendência histórica) ─────────────────

export type ComplianceSnapshot = {
  id: string;
  snapshot_date: string; // sempre dia 1º do mês
  payload: SnapshotPayload;
  created_at: string;
};

export function useComplianceSnapshots() {
  const { currentOrgId } = useAuth();
  return useQuery({
    queryKey: ["compliance_snapshots", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_snapshots")
        .select("*")
        .eq("org_id", currentOrgId!)
        .order("snapshot_date");
      if (error) throw error;
      return data as unknown as ComplianceSnapshot[];
    },
  });
}

/** Primeiro dia do mês corrente em ISO (chave única do snapshot). */
export function currentSnapshotDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Garante que o mês corrente tenha um snapshot: quando um usuário staff
 * carrega o relatório e o mês ainda não foi capturado, grava automaticamente.
 */
export function useEnsureMonthlySnapshot(report: ComplianceReport | null, enabled: boolean) {
  const qc = useQueryClient();
  const { currentOrgId } = useAuth();
  const { data: snapshots } = useComplianceSnapshots();
  const attempted = useRef(false);

  useEffect(() => {
    if (!enabled || !report || !snapshots || !currentOrgId || attempted.current) return;
    const monthKey = currentSnapshotDate();
    if (snapshots.some((s) => s.snapshot_date === monthKey)) return;
    attempted.current = true;
    supabase
      .from("compliance_snapshots")
      .upsert(
        { org_id: currentOrgId, snapshot_date: monthKey, payload: snapshotPayloadFrom(report) },
        { onConflict: "org_id,snapshot_date" },
      )
      .then(({ error }) => {
        if (!error) qc.invalidateQueries({ queryKey: ["compliance_snapshots"] });
      });
  }, [enabled, report, snapshots, qc, currentOrgId]);
}
