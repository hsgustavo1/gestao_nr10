// Trilha C — React Query + Supabase do wizard de relatório.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { RtiReport } from "@/lib/rti";
import {
  proximaVersao,
  relatorioPdfPath,
  type NcsOverrides,
  type OrgBranding,
  type PdfFoto,
  type WizardIdentificacao,
} from "@/lib/rti-relatorio";

/** O tipo RtiReport do app não expõe org_id, mas a linha do banco tem. */
export type RtiReportComOrg = RtiReport & { org_id?: string | null };

export interface WizardDraft {
  report_id: string;
  etapa_atual: number;
  identificacao: Partial<WizardIdentificacao>;
  ncs_overrides: NcsOverrides;
  parecer: string | null;
  resumo_executivo: string | null;
}

export interface RtiReportPdf {
  id: string;
  report_id: string;
  versao: number;
  file_path: string;
  emitido_por_nome: string | null;
  emitido_em: string;
}

const publicUrl = (path: string) =>
  supabase.storage.from("rti-evidencias").getPublicUrl(path).data.publicUrl;

export function useRtiReport(reportId?: string) {
  return useQuery({
    queryKey: ["rti_report", reportId ?? "none"],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rti_reports")
        .select("*")
        .eq("id", reportId!)
        .single();
      if (error) throw error;
      return data as unknown as RtiReportComOrg;
    },
  });
}

export function useWizardDraft(reportId?: string) {
  return useQuery({
    queryKey: ["rti_report_wizard", reportId ?? "none"],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rti_report_wizard")
        .select("*")
        .eq("report_id", reportId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as WizardDraft | null) ?? null;
    },
  });
}

export function useSaveWizardDraft(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: Omit<WizardDraft, "report_id">) => {
      const { error } = await supabase
        .from("rti_report_wizard")
        .upsert({ report_id: reportId, ...draft } as never, { onConflict: "report_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rti_report_wizard", reportId] }),
  });
}

/** Fotos de constatação por NC (evidências) — já como URL pública p/ o PDF. */
export function useFotosPorNc(reportId?: string, ncIds?: string[]) {
  return useQuery({
    queryKey: ["rti_wizard_fotos", reportId ?? "none", ncIds?.length ?? 0],
    enabled: !!reportId && !!ncIds && ncIds.length > 0,
    queryFn: async () => {
      const porNc: Record<string, PdfFoto[]> = {};
      for (let i = 0; i < ncIds!.length; i += 200) {
        const { data, error } = await supabase
          .from("rti_nc_evidencias")
          .select("id, nc_id, file_path, descricao")
          .in("nc_id", ncIds!.slice(i, i + 200))
          .eq("tipo", "constatacao")
          .order("created_at");
        if (error) throw error;
        for (const ev of data ?? []) {
          (porNc[ev.nc_id] ??= []).push({
            id: ev.id,
            url: publicUrl(ev.file_path),
            legenda: ev.descricao,
          });
        }
      }
      return porNc;
    },
  });
}

export function useReportPdfs(reportId?: string) {
  return useQuery({
    queryKey: ["rti_report_pdfs", reportId ?? "none"],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rti_report_pdfs")
        .select("*")
        .eq("report_id", reportId!)
        .order("versao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RtiReportPdf[];
    },
  });
}

/** Emite: sobe o Blob no Storage (nunca sobrescreve) + registra a versão. */
export function useEmitirPdf() {
  const qc = useQueryClient();
  const auth = useAuth();
  return useMutation({
    mutationFn: async (args: {
      report: RtiReportComOrg;
      blob: Blob;
      pdfs: { versao: number }[];
    }) => {
      const orgId = args.report.org_id;
      if (!orgId) throw new Error("Relatório sem organização.");
      const versao = proximaVersao(args.pdfs);
      const path = relatorioPdfPath(orgId, args.report, versao, auth.currentOrg?.nome);
      const { error: upErr } = await supabase.storage
        .from("rti-evidencias")
        .upload(path, args.blob, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("rti_report_pdfs").insert({
        report_id: args.report.id,
        versao,
        file_path: path,
        emitido_por: auth.user?.id ?? null,
        emitido_por_nome: auth.displayName || null,
      } as never);
      if (insErr) throw insErr;
      // Aponta o report_path pro PDF mais novo (só antes da entrega — depois o selo congela).
      if (!args.report.entregue_em) {
        await supabase.from("rti_reports").update({ report_path: path }).eq("id", args.report.id);
      }
      return { versao, path, url: publicUrl(path) };
    },
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: ["rti_report_pdfs", args.report.id] });
      qc.invalidateQueries({ queryKey: ["rti_report", args.report.id] });
    },
  });
}

export function useSetOrgBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      orgId: string;
      logoPath: string | null;
      corPrimaria: string | null;
      razaoSocial: string | null;
      registroProfissional: string | null;
    }) => {
      const { error } = await supabase.rpc("fn_set_org_branding", {
        _org_id: args.orgId,
        _logo_path: args.logoPath,
        _cor_primaria: args.corPrimaria,
        _razao_social_relatorio: args.razaoSocial,
        _registro_profissional: args.registroProfissional,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org_branding"] }),
  });
}

/** Branding cru da org (paths), para o formulário de edição. */
export function useOrgBrandingRow(orgId?: string | null) {
  return useQuery({
    queryKey: ["org_branding", "row", orgId ?? "none"],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, nome, logo_path, cor_primaria, razao_social_relatorio, registro_profissional")
        .eq("id", orgId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/** Branding da org entregadora (a org atual do consultor), pronto para o PDF. */
export function useOrgBranding(orgId?: string | null) {
  const row = useOrgBrandingRow(orgId);
  const branding: OrgBranding | null = row.data
    ? {
        logoUrl: row.data.logo_path
          ? supabase.storage.from("org-assets").getPublicUrl(row.data.logo_path).data.publicUrl
          : null,
        corPrimaria: row.data.cor_primaria,
        razaoSocial: row.data.razao_social_relatorio ?? row.data.nome,
        registroProfissional: row.data.registro_profissional,
      }
    : null;
  return { ...row, data: branding };
}
