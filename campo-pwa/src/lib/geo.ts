// GPS oportunista e NUNCA bloqueante (spec §6.1): warmup assíncrono alimenta um
// cache de módulo; a captura de foto lê o cache de forma síncrona. Se o fix ainda
// não chegou, a foto sai "sem localização" — jamais atrasa o disparo.
// GPS funciona sem rede (satélite) — cenário 100% offline não atrapalha.

export type GpsFix = { lat: number; lng: number; accuracy: number; at: number };

const MAX_AGE_MS = 5 * 60_000; // técnico não anda 500m entre fotos
let cache: GpsFix | null = null;
let warming = false;

export function getGpsCached(now: number = Date.now()): GpsFix | null {
  if (cache && now - cache.at <= MAX_AGE_MS) return cache;
  return null;
}

/** Dispara (ou renova) o fix em background. Silencioso em erro/negado. */
export function warmupGps(): void {
  if (warming || !("geolocation" in navigator)) return;
  warming = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      cache = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        at: Date.now(),
      };
      warming = false;
    },
    () => {
      warming = false; // negado/timeout — segue sem GPS
    },
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
  );
}
