import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate } from "react-router-dom";
import { db } from "@/db/dexie";
import { supabase } from "@/lib/supabase";
import { Plus, LogOut, RefreshCw, Cloud, CloudOff, RotateCcw, FolderUp } from "lucide-react";
import { useRef, useState } from "react";
import { CreateInspectionModal } from "@/components/CreateInspectionModal";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { clearOrgContext } from "@/lib/org";
import { clearActor } from "@/lib/actor";
import { getResume } from "@/lib/resume";
import { importBackup } from "@/lib/backup";

const STATUS_LABEL: Record<string, string> = {
  em_andamento: "Em andamento",
  finalizada: "Finalizada",
  importada: "Importada",
};

const STATUS_COLOR: Record<string, string> = {
  em_andamento: "bg-blue-900/50 text-blue-300",
  finalizada: "bg-green-900/50 text-green-300",
  importada: "bg-slate-700 text-slate-400",
};

export default function InspectionList() {
  const navigate = useNavigate();
  // try/catch para que um erro na query (ex.: índice ausente após upgrade de schema)
  // apareça na tela em vez de travar em "Carregando..." indefinidamente.
  const inspections = useLiveQuery(async () => {
    try {
      // .toArray() (scan por PK) + ordenação em JS: mais robusto que orderBy('created_at'),
      // cujo cursor de índice pode não resolver em alguns IndexedDB de celular.
      const arr = (await db.inspections.toArray()).filter((i) => !i.arquivada_campo);
      arr.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      return arr;
    } catch (e) {
      return { __error: e instanceof Error ? e.message : String(e) };
    }
  }, []);
  const queryError = inspections && !Array.isArray(inspections) ? inspections.__error : null;
  const list = Array.isArray(inspections) ? inspections : undefined;
  const [showModal, setShowModal] = useState(false);
  const { syncState, lastSyncAt, pendingCount, sync, formatTimeAgo, isOnline } = useSyncStatus();
  // Retomada de contexto (spec §6.2): lido uma vez por render da lista, suficiente.
  const resume = getResume();

  // Restauração de backup (spec §3.3): aparelho quebrou → abrir aqui → importar ZIP.
  const importRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    try {
      const r = await importBackup(file);
      alert(
        r.ok
          ? `Backup "${r.titulo}" restaurado (${r.fotos} foto(s) reanexada(s)).`
          : `Não restaurado: ${r.motivo}`,
      );
    } finally {
      setImportando(false);
      if (importRef.current) importRef.current.value = "";
    }
  }

  async function handleLogout() {
    // "Sair" apaga a sessão salva → o próximo login exige internet. Avisar antes,
    // de forma extra-clara quando o usuário já está offline (logout vira cilada).
    const msg = isOnline
      ? "Sair encerra a sessão neste aparelho. Para entrar de novo você vai precisar de internet. Para usar offline, NÃO saia — apenas feche o app. Deseja sair?"
      : "Você está OFFLINE. Se sair agora, NÃO conseguirá entrar de novo sem internet. Para continuar usando offline, NÃO saia — apenas feche o app. Sair mesmo assim?";
    if (!window.confirm(msg)) return;
    clearOrgContext();
    clearActor();
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-col gap-1 px-4 py-3 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold text-lg">Inspeções</h1>
          <div className="flex gap-2">
            <input
              ref={importRef}
              type="file"
              accept=".zip,application/zip"
              className="sr-only"
              onChange={handleImport}
            />
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              disabled={importando}
              className="p-2.5 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-800 flex items-center justify-center disabled:opacity-40"
              aria-label="Restaurar backup"
              title="Restaurar backup"
            >
              <FolderUp className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={sync}
              disabled={syncState === "syncing" || !isOnline}
              className="p-2.5 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center"
              aria-label="Atualizar"
            >
              <RefreshCw className={`h-5 w-5 ${syncState === "syncing" ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2.5 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-800 flex items-center justify-center"
              aria-label="Sair"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          {isOnline ? (
            <Cloud className="h-3 w-3 text-green-500" />
          ) : (
            <CloudOff className="h-3 w-3 text-slate-500" />
          )}
          <span>{formatTimeAgo(lastSyncAt)}</span>
          {(pendingCount ?? 0) > 0 && (
            <span className="ml-1 text-yellow-500">
              · {pendingCount} pendente{(pendingCount ?? 0) > 1 ? "s" : ""}
            </span>
          )}
          {syncState === "error" && (
            <span className="ml-1 text-red-400">· Erro ao sincronizar</span>
          )}
        </div>
      </header>

      {resume && (
        <Link
          to={resume.path}
          className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-blue-900/40 border border-blue-700/50 px-4 py-3"
        >
          <RotateCcw className="h-5 w-5 text-blue-300 shrink-0" />
          <span className="text-sm text-blue-100 flex-1 min-w-0 truncate">
            Continuar: {resume.label}
            <span className="text-blue-300/80"> · {formatTimeAgo(new Date(resume.at))}</span>
          </span>
        </Link>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {queryError && (
          <div className="rounded-xl border border-red-700/50 bg-red-900/30 p-4 text-sm text-red-300 space-y-2">
            <p className="font-semibold">Erro ao ler o banco local</p>
            <p className="text-xs break-words text-red-300/90">{queryError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-xs underline"
            >
              Recarregar
            </button>
          </div>
        )}
        {!queryError && list === undefined && (
          <p className="text-slate-400 text-sm text-center pt-8">Carregando...</p>
        )}
        {list?.length === 0 && (
          <p className="text-slate-400 text-sm text-center pt-8">
            Nenhuma inspeção. Crie uma nova.
          </p>
        )}
        {list?.map((insp) => (
          <Link
            key={insp.id}
            to={`/inspecoes/${insp.id}`}
            className="block rounded-xl bg-slate-800 p-4 active:bg-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{insp.titulo}</p>
                {insp.cliente && <p className="text-sm text-slate-400 mt-0.5">{insp.cliente}</p>}
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[insp.status] ?? "bg-slate-700 text-slate-400"}`}
              >
                {STATUS_LABEL[insp.status] ?? insp.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {new Date(insp.data_inspecao).toLocaleDateString("pt-BR")}
              {!insp._synced && <span className="ml-2 text-yellow-500">● não sincronizado</span>}
            </p>
          </Link>
        ))}
      </div>

      <div className="p-4 border-t border-slate-800">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 px-4 py-3.5 font-semibold transition-colors"
        >
          <Plus className="h-5 w-5" />
          Nova inspeção
        </button>
      </div>

      {showModal && <CreateInspectionModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
