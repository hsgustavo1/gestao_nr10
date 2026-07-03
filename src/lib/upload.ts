// Mensagens amigáveis de falha de upload, em português e sem termos técnicos.
//
// Todos os envios de arquivo passam pela compressão (resizeImage 1024px) e, agora,
// pelo bucket com teto de tamanho e MIME restritos. Quando o Supabase Storage recusa
// um envio, o erro cru vem em inglês e cheio de jargão ("payload too large",
// "row-level security", "mime type not supported"). Esta função traduz qualquer
// falha para uma frase que o usuário de campo entende e sabe o que fazer.
//
// Uso: nos helpers de upload, trocar `throw error` por
//   `throw new Error(mensagemUploadAmigavel(error))`
// Os call sites já exibem `err.message` no toast, então a mensagem aparece pronta.

import { supabase } from "@/integrations/supabase/client";

const MSG_GENERICA =
  "Não foi possível enviar o arquivo. Tente novamente em instantes.";

export function mensagemUploadAmigavel(err: unknown): string {
  const obj = err as { message?: unknown; error?: unknown };
  const raw = String(
    (err instanceof Error ? err.message : obj?.message ?? obj?.error ?? err) ?? "",
  ).toLowerCase();
  // Supabase Storage devolve o código HTTP em `statusCode` (string) ou `status`.
  const status = String(
    (err as { statusCode?: unknown; status?: unknown })?.statusCode ??
      (err as { status?: unknown })?.status ??
      "",
  );

  // Arquivo grande demais (teto do bucket / limite do servidor).
  if (
    status === "413" ||
    raw.includes("too large") ||
    raw.includes("payload") ||
    raw.includes("exceeded the maximum") ||
    raw.includes("maximum allowed size") ||
    raw.includes("entity too large")
  ) {
    return "A imagem ficou pesada demais para enviar. Tire a foto de novo ou escolha uma imagem menor.";
  }

  // Tipo de arquivo não aceito pelo bucket.
  if (
    status === "415" ||
    raw.includes("mime type") ||
    raw.includes("not supported") ||
    raw.includes("invalid_mime")
  ) {
    return "Esse tipo de arquivo não é aceito. Envie uma foto (JPG ou PNG) ou um PDF.";
  }

  // Sem permissão / sessão / org errada.
  if (
    status === "401" ||
    status === "403" ||
    raw.includes("row-level security") ||
    raw.includes("unauthorized") ||
    raw.includes("permission") ||
    raw.includes("not authorized") ||
    raw.includes("jwt")
  ) {
    return "Você não tem permissão para enviar este arquivo. Verifique se está conectado à empresa certa e tente de novo.";
  }

  // Arquivo com o mesmo nome já existe.
  if (
    status === "409" ||
    raw.includes("already exists") ||
    raw.includes("duplicate") ||
    raw.includes("resource already")
  ) {
    return "Esse arquivo já foi enviado.";
  }

  // Falha de conexão.
  if (
    raw.includes("failed to fetch") ||
    raw.includes("network") ||
    raw.includes("timeout") ||
    raw.includes("timed out") ||
    raw.includes("offline")
  ) {
    return "Falha de conexão ao enviar. Verifique sua internet e tente novamente.";
  }

  return MSG_GENERICA;
}

const BUCKET_EVIDENCIAS = "rti-evidencias";

/**
 * Remove do Storage os paths que NÃO são mais referenciados por nenhuma linha de
 * `field_photos` nem `rti_nc_evidencias`. Chamar DEPOIS de apagar as linhas de negócio.
 * Reference-aware: nunca apaga arquivo ainda em uso (fotos de campo compartilhadas com RTI).
 * Checa o erro do `.remove()` e o propaga (não deixa órfão em silêncio).
 *
 * Não é atômico: uma inserção concorrente que referencie um dos paths entre a checagem
 * e a remoção não é coberta (janela considerada aceitável — paths são únicos por UUID).
 * Se um lote de `.remove()` falhar, os lotes anteriores já foram removidos com sucesso.
 */
export async function removerArquivosOrfaos(paths: string[]): Promise<void> {
  const unicos = [...new Set(paths.filter(Boolean))];
  if (unicos.length === 0) return;

  const referenciados = new Set<string>();
  for (let i = 0; i < unicos.length; i += 200) {
    const lote = unicos.slice(i, i + 200);
    const [ev, fp] = await Promise.all([
      supabase.from("rti_nc_evidencias").select("file_path").in("file_path", lote),
      supabase.from("field_photos").select("file_path").in("file_path", lote),
    ]);
    for (const r of ev.data ?? []) referenciados.add(r.file_path);
    for (const r of fp.data ?? []) referenciados.add(r.file_path);
  }

  const orfaos = unicos.filter((p) => !referenciados.has(p));
  for (let i = 0; i < orfaos.length; i += 100) {
    const { error } = await supabase.storage
      .from(BUCKET_EVIDENCIAS)
      .remove(orfaos.slice(i, i + 100));
    if (error) throw new Error(mensagemUploadAmigavel(error));
  }
}
