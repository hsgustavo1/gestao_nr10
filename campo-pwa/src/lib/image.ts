import imageCompression from "browser-image-compression";

// Compressão de fotos no cliente, ANTES de gravar no IndexedDB e subir ao Supabase.
// Estratégia: o original full-res permanece na galeria do aparelho (o OS salva ao
// usar a câmera via <input capture>); só a versão comprimida entra no app/Supabase.
//
// Calibragem (2026-07-02): alvo 0,6 MB e 1024px de lado maior, alinhado ao limite
// de 1024px usado em todos os uploads do app principal — decisão de MVP para conter
// o crescimento do storage do Supabase. Ajustar aqui se a legibilidade de placas,
// terminais e etiquetas no campo pedir mais resolução.
const COMPRESSION_OPTS = {
  maxSizeMB: 0.6,
  maxWidthOrHeight: 1024,
  useWebWorker: true,
  fileType: "image/jpeg",
  initialQuality: 0.8,
} as const;

/**
 * Comprime uma foto. Nunca lança: em qualquer falha (lib, EXIF, memória no
 * celular) retorna o arquivo original — perder espaço é melhor que perder a
 * evidência. O chamador grava o resultado direto no Dexie.
 */
export async function compressPhoto(file: File): Promise<Blob> {
  try {
    // Já pequeno o bastante? Não reprocessa (evita recompressão desnecessária).
    if (file.size <= COMPRESSION_OPTS.maxSizeMB * 1024 * 1024) return file;
    return await imageCompression(file, COMPRESSION_OPTS);
  } catch (err) {
    console.warn("Falha ao comprimir foto — usando original.", err);
    return file;
  }
}
