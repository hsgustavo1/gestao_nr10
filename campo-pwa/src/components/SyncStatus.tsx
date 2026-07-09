import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/dexie";
import { processQueue, retryFailed, discardFailed, MAX_SYNC_ATTEMPTS } from "@/sync/engine";
import { useEffect, useState } from "react";
import {
  ensurePersistentStorage,
  formatBytes,
  getStorageEstimate,
  storageWarning,
} from "@/lib/storage-health";

const ZERO = { pending: 0, failed: 0, sampleError: null as string | null };

/** Avisos de saúde do armazenamento (spec cofre e portão §3.1). */
function StorageHealthNotes({ localBytes }: { localBytes: number }) {
  const [health, setHealth] = useState<{ protegido: boolean; aviso: string | null }>({
    protegido: true, // otimista até a 1ª leitura, para não piscar aviso falso
    aviso: null,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const protegido = await ensurePersistentStorage();
      const aviso = storageWarning(await getStorageEstimate());
      if (alive) setHealth({ protegido, aviso });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      {health.aviso && (
        <p className="px-3 py-1 bg-red-950/60 text-red-200 text-[11px]">{health.aviso}</p>
      )}
      {!health.protegido && localBytes > 0 && (
        <p className="px-3 py-1 bg-yellow-950/60 text-yellow-200 text-[11px]">
          Armazenamento não protegido pelo sistema — instale o app na tela inicial e evite
          limpar dados do navegador com fotos pendentes.
        </p>
      )}
    </>
  );
}

export function SyncStatus() {
  // pending = ainda dentro do limite de tentativas (em backoff ou prontos);
  // failed  = esgotaram MAX_SYNC_ATTEMPTS (dead-letter, exigem ação manual).
  const counts =
    useLiveQuery(async () => {
      const pending = await db.sync_queue.where("attempts").below(MAX_SYNC_ATTEMPTS).count();
      const deadItems = await db.sync_queue
        .where("attempts")
        .aboveOrEqual(MAX_SYNC_ATTEMPTS)
        .toArray();
      const first = deadItems[0];
      const sampleError = first
        ? `${first.table}/${first.operation}: ${first.last_error ?? "sem detalhe"}`
        : null;
      return { pending, failed: deadItems.length, sampleError };
    }, []) ?? ZERO;
  const { pending: pendingCount, failed: failedCount, sampleError } = counts;
  const isOnline = navigator.onLine;
  const [syncing, setSyncing] = useState(false);

  // Bytes de foto que existem SÓ no aparelho (blob ainda não sincronizado).
  // Booleans não são chave indexável no IndexedDB → filtro linear (volume local ok).
  const localBytes =
    useLiveQuery(async () => {
      const unsynced = await db.photos.filter((p) => !p._synced && !!p.blob).toArray();
      return unsynced.reduce((acc, p) => acc + (p.blob?.size ?? 0), 0);
    }, []) ?? 0;

  async function handleSync() {
    setSyncing(true);
    try {
      await processQueue();
    } finally {
      setSyncing(false);
    }
  }

  async function handleRetry() {
    setSyncing(true);
    try {
      await retryFailed();
    } finally {
      setSyncing(false);
    }
  }

  async function handleDiscard() {
    if (
      !window.confirm(
        "Descartar os itens com falha? Eles NÃO serão enviados. Os dados já coletados no aparelho permanecem — isto só limpa a fila de envio.",
      )
    )
      return;
    setSyncing(true);
    try {
      await discardFailed();
    } finally {
      setSyncing(false);
    }
  }

  function plural(n: number) {
    return n === 1 ? "item" : "itens";
  }

  if (!isOnline) {
    const total = pendingCount + failedCount;
    return (
      <>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/40 text-red-300 text-xs">
          <span className="h-2 w-2 rounded-full bg-red-400" />
          {total === 0
            ? "Offline — pronto para coletar (dados salvos no aparelho)"
            : `Offline — ${total} ${plural(total)} aguardando envio (salvos no aparelho)`}
          {localBytes > 0 && (
            <span className="ml-auto text-red-300/80 shrink-0">
              {formatBytes(localBytes)} só neste aparelho
            </span>
          )}
        </div>
        <StorageHealthNotes localBytes={localBytes} />
      </>
    );
  }

  if (failedCount > 0) {
    return (
      <>
      <div className="px-3 py-1.5 bg-orange-900/40 text-orange-300 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-orange-400 shrink-0" />
          {failedCount} {plural(failedCount)} com falha após várias tentativas
          <button
            onClick={handleRetry}
            disabled={syncing}
            className="ml-auto underline disabled:opacity-50 shrink-0"
          >
            {syncing ? "Tentando..." : "Tentar novamente"}
          </button>
          <button
            onClick={handleDiscard}
            disabled={syncing}
            className="underline disabled:opacity-50 shrink-0 text-orange-300/80"
          >
            Descartar
          </button>
        </div>
        {sampleError && (
          <p className="mt-0.5 pl-4 text-[10px] text-orange-300/80 break-words">{sampleError}</p>
        )}
      </div>
      <StorageHealthNotes localBytes={localBytes} />
      </>
    );
  }

  if (pendingCount > 0) {
    return (
      <>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-900/40 text-yellow-300 text-xs">
          <span className="h-2 w-2 rounded-full bg-yellow-400" />
          {pendingCount} {plural(pendingCount)} {pendingCount === 1 ? "pendente" : "pendentes"}
          {localBytes > 0 && (
            <span className="text-yellow-300/80">· {formatBytes(localBytes)}</span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="ml-auto underline disabled:opacity-50"
          >
            {syncing ? "Sincronizando..." : "Sincronizar agora"}
          </button>
        </div>
        <StorageHealthNotes localBytes={localBytes} />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/40 text-green-300 text-xs">
        <span className="h-2 w-2 rounded-full bg-green-400" />
        Online — sincronizado · pronto para uso offline
      </div>
      <StorageHealthNotes localBytes={localBytes} />
    </>
  );
}
