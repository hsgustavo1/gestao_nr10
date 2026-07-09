import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, AlertTriangle, Archive } from "lucide-react";
import { db } from "@/db/dexie";
import { computePendencias, type Pendencia } from "@/lib/revisao";
import { exportBackup, type BackupResult } from "@/lib/backup";
import { getActorName } from "@/lib/actor";
import { MAX_SYNC_ATTEMPTS } from "@/sync/engine";

// Portão de saída (spec cofre e portão §4): consultivo, não bloqueante.
// Pensado para o portão da fábrica: conferir antes de ir embora, quando
// corrigir custa 10 minutos e não uma viagem de retorno.
export default function RevisaoVisita() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<BackupResult | null>(null);

  const dados = useLiveQuery(async () => {
    if (!id) return null;
    const [inspection, nodes, points] = await Promise.all([
      db.inspections.get(id),
      db.nodes.where("inspection_id").equals(id).toArray(),
      db.points.where("inspection_id").equals(id).toArray(),
    ]);
    if (!inspection) return null;
    const pointIds = points.map((p) => p.id);
    const [findings, photos, queueAll] = await Promise.all([
      pointIds.length ? db.findings.where("point_id").anyOf(pointIds).toArray() : [],
      pointIds.length ? db.photos.where("point_id").anyOf(pointIds).toArray() : [],
      db.sync_queue.toArray(),
    ]);
    return { inspection, nodes, points, findings, photos, queueAll };
  }, [id]);

  if (!id) return null;
  if (dados === undefined) return null;
  if (dados === null) {
    return (
      <div className="p-8 text-center text-slate-400">
        Inspeção não encontrada.{" "}
        <Link to="/inspecoes" className="text-blue-400 underline">
          Voltar
        </Link>
      </div>
    );
  }

  const { inspection, nodes, points, findings, photos, queueAll } = dados;
  const pendencias = computePendencias({
    nodes,
    points,
    findings,
    photos: photos.map((p) => ({ ...p, blob: !!p.blob })),
    queue: {
      pending: queueAll.filter((q) => q.attempts < MAX_SYNC_ATTEMPTS).length,
      failed: queueAll.filter((q) => q.attempts >= MAX_SYNC_ATTEMPTS).length,
    },
  });
  const fotosLocais = photos.filter((p) => p.blob && !p._synced).length;

  function linkDe(p: Pendencia): string {
    switch (p.tipo) {
      case "setor_sem_ponto":
        return `/inspecoes/${id}`;
      case "ponto_sem_foto":
      case "foto_sem_vinculo":
        return `/inspecoes/${id}/ponto/${p.pointId}`;
      default:
        return `/inspecoes/${id}/revisao`;
    }
  }
  function textoDe(p: Pendencia): string {
    switch (p.tipo) {
      case "setor_sem_ponto":
        return `Setor "${p.nome}" sem nenhum ponto coletado`;
      case "ponto_sem_foto":
        return `Ponto "${p.titulo ?? "sem título"}" sem foto`;
      case "foto_sem_vinculo":
        return `${p.count} foto(s) sem NC vinculada em "${p.titulo ?? "ponto"}"`;
      case "sync_pendente":
        return `${p.count} item(ns) aguardando envio (normal offline)`;
      case "sync_falha":
        return `${p.count} item(ns) com FALHA de envio — resolver antes de sair`;
      case "so_no_aparelho":
        return `${p.fotos} foto(s) existem SÓ neste aparelho — gere o backup abaixo`;
    }
  }

  async function encerrar() {
    setGerando(true);
    try {
      if (fotosLocais > 0 || queueAll.length > 0) {
        setResultado(await exportBackup(id!, getActorName()));
      } else {
        setResultado({ nomeArquivo: "", fotosNoZip: 0 });
      }
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <button
          onClick={() => navigate(`/inspecoes/${id}`)}
          className="p-2.5 -m-1 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-800 flex items-center justify-center"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate">Revisão da visita</h1>
          <p className="text-xs text-slate-400 truncate">{inspection.titulo}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-xl bg-slate-800 p-4 grid grid-cols-4 gap-2 text-center">
          {(
            [
              [points.length, "pontos"],
              [findings.length, "NCs"],
              [photos.length, "fotos"],
              [fotosLocais, "só aqui"],
            ] as const
          ).map(([n, label]) => (
            <div key={label}>
              <p className="text-xl font-bold">{n}</p>
              <p className="text-[11px] text-slate-400">{label}</p>
            </div>
          ))}
        </div>

        {pendencias.length === 0 ? (
          <div className="rounded-xl bg-green-900/30 border border-green-800 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-400 shrink-0" />
            <p className="text-sm text-green-200">Tudo conferido — nenhuma pendência encontrada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Conferir antes de sair ({pendencias.length})
            </p>
            {pendencias.map((p, i) => (
              <Link
                key={i}
                to={linkDe(p)}
                className="flex items-center gap-3 rounded-xl bg-slate-800 border border-slate-700 px-4 py-3"
              >
                <AlertTriangle
                  className={`h-5 w-5 shrink-0 ${
                    p.tipo === "sync_falha" ? "text-red-400" : "text-yellow-400"
                  }`}
                />
                <span className="text-sm flex-1">{textoDe(p)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-slate-800 p-4 space-y-2">
        <button
          onClick={encerrar}
          disabled={gerando}
          className="w-full flex items-center justify-center gap-2 min-h-[52px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-base font-bold"
        >
          <Archive className="h-5 w-5" />
          {gerando ? "Gerando backup…" : "Encerrar visita"}
        </button>
        <p className="text-[11px] text-slate-500 text-center">
          Gera um backup do que existe só neste aparelho. Não bloqueia nada — você decide quando
          sair.
        </p>
      </footer>

      {resultado && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8">
          <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-5 space-y-3">
            <h2 className="font-semibold">Visita encerrada</h2>
            <p className="text-sm text-slate-300">
              {points.length} pontos · {findings.length} NCs · {photos.length} fotos.
              {resultado.fotosNoZip > 0
                ? ` Backup "${resultado.nomeArquivo}" gerado com ${resultado.fotosNoZip} foto(s) — guarde-o fora deste aparelho (Drive/WhatsApp).`
                : " Tudo já sincronizado — backup não foi necessário."}
            </p>
            <button
              onClick={() => navigate("/inspecoes")}
              className="w-full min-h-[48px] rounded-xl bg-blue-600 text-sm font-semibold"
            >
              Concluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
