import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { NR10Document } from "./prontuario";

export const prontuarioKeys = {
  documents: ["nr10_documents"] as const,
};

export function useNR10Documents() {
  const { currentOrgId } = useAuth();
  return useQuery({
    queryKey: [...prontuarioKeys.documents, currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nr10_documents")
        .select("*")
        .eq("org_id", currentOrgId!)
        .order("category")
        .order("validity_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as NR10Document[];
    },
  });
}

export function useUpsertNR10Document() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<NR10Document, "id" | "created_at" | "updated_at"> & { id?: string },
    ) => {
      const { data, error } = await supabase
        .from("nr10_documents")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as NR10Document;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: prontuarioKeys.documents }),
  });
}

export function useDeleteNR10Document() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: { id: string; file_path: string | null }) => {
      const { error } = await supabase.from("nr10_documents").delete().eq("id", doc.id);
      if (error) throw error;
      if (doc.file_path) {
        await supabase.storage.from("nr10-docs").remove([doc.file_path]);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: prontuarioKeys.documents }),
  });
}

// ── Versionamento de documentos ──────────────────────────────────────────────
// Ao substituir o PDF de um documento, a versão anterior é arquivada (o
// arquivo permanece no bucket nr10-docs e fica acessível pelo histórico).

export type NR10DocumentVersion = {
  id: string;
  document_id: string;
  file_path: string;
  file_name: string | null;
  document_date: string | null;
  validity_date: string | null;
  replaced_by_name: string | null;
  created_at: string;
};

export function useDocumentVersions(documentId?: string) {
  return useQuery({
    queryKey: ["nr10_document_versions", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nr10_document_versions")
        .select("*")
        .eq("document_id", documentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as NR10DocumentVersion[];
    },
  });
}

export async function archiveDocumentVersion(
  version: Omit<NR10DocumentVersion, "id" | "created_at">,
) {
  const { error } = await supabase.from("nr10_document_versions").insert(version);
  if (error) throw error;
}

export async function uploadProntuarioFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `${crypto.randomUUID()}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("nr10-docs").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export function prontuarioFileUrl(path: string): string {
  const { data } = supabase.storage.from("nr10-docs").getPublicUrl(path);
  return data.publicUrl;
}
