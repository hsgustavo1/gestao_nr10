import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, FileDown, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { usePadlocks, useQueryClient } from "@/lib/queries";
import { useDebounce } from "@/hooks/use-debounce";
import {
  PADLOCK_COLORS, colorBadge, colorLabel, colorSwatch, formatPhoneBR,
  type PadlockColor,
} from "@/lib/padlocks";
import { NewPadlockDialog } from "@/components/new-padlock-dialog";
import { ReportInconsistencyDialog } from "@/components/report-inconsistency-dialog";

type StatusFilter = "all" | "ativos" | "cancelados";

type PadlocksSearch = {
  color?: PadlockColor | "all";
  status?: StatusFilter;
};

export const Route = createFileRoute("/cadeados/")({
  component: PadlocksList,
  validateSearch: (search: Record<string, unknown>): PadlocksSearch => ({
    color: (search.color as PadlockColor | "all" | undefined) ?? undefined,
    status: (search.status as StatusFilter | undefined) ?? undefined,
  }),
  head: () => ({
    meta: [
      { title: "Base de dados — Bloqueio de energias perigosas" },
      { name: "description", content: "Relação completa de dispositivos com filtros por cor, unidade e status. Exporte para Excel." },
      { property: "og:title", content: "Base de dados — Bloqueio de energias perigosas" },
      { property: "og:description", content: "Dispositivos em uso e baixados com filtros e exportação para Excel." },
    ],
  }),
});

function PadlocksList() {
  const { isStaff, user } = useAuth();
  const queryClient = useQueryClient();
  const sp = Route.useSearch();
  const canSeeSensitive = !!user;

  const { data: items = [], isLoading } = usePadlocks();

  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [colorFilter, setColorFilter] = useState<PadlockColor | "all">(sp.color ?? "all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(sp.status ?? "ativos");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);
  const [openReport, setOpenReport] = useState(false);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    for (const p of items) {
      const v = (p.owner_sector ?? "").trim();
      if (v) s.add(v);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items]);

  const filtered = useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    return items.filter((p) => {
      if (colorFilter !== "all" && p.color !== colorFilter) return false;
      if (statusFilter === "ativos" && p.cancelled) return false;
      if (statusFilter === "cancelados" && !p.cancelled) return false;
      if (sectorFilter !== "all" && (p.owner_sector ?? "") !== sectorFilter) return false;
      if (!term) return true;
      return (
        String(p.number).includes(term) ||
        p.code.toLowerCase().includes(term) ||
        (p.owner_name ?? "").toLowerCase().includes(term) ||
        (p.owner_registration ?? "").toLowerCase().includes(term) ||
        (p.owner_sector ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, debouncedQ, colorFilter, statusFilter, sectorFilter]);

  const exportExcel = () => {
    const rows = filtered.map((p) => {
      const base: Record<string, string | number> = {
        "Nº": p.number,
        "Cor": colorLabel[p.color],
        "Status": p.cancelled ? "Cancelado" : "Ativo",
        "Dono": p.owner_name ?? "",
        "Setor / Empresa": p.owner_sector ?? "",
      };
      if (canSeeSensitive) {
        base["Matrícula"] = p.owner_registration ?? "";
        base["Função"] = p.owner_role ?? "";
        base["Telefone"] = p.owner_phone ? formatPhoneBR(p.owner_phone) : "";
      }
      base["Motivo cancelamento"] = p.cancellation_reason ?? "";
      base["Data registro"] = p.created_at ? new Date(p.created_at).toLocaleDateString("pt-BR") : "";
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cadeados");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `cadeados_${today}.xlsx`);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["padlocks"] });

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Base de dados</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {isLoading ? "Carregando..." : `${items.length} itens registrados · ${filtered.length} exibidos`}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={filtered.length === 0 || isLoading} className="sm:size-default w-full sm:w-auto">
            <FileDown className="h-4 w-4" />
            <span className="sm:inline">Exportar</span>
            <span className="hidden sm:inline">&nbsp;Excel</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOpenReport(true)} className="sm:size-default w-full sm:w-auto">
            <AlertCircle className="h-4 w-4" />
            <span className="sm:hidden">Reportar</span>
            <span className="hidden sm:inline">Reportar inconsistência</span>
          </Button>
          {isStaff && (
            <Button size="sm" onClick={() => setOpenNew(true)} className="bg-brand-gradient text-white shadow-brand hover:opacity-95 col-span-2 sm:size-default w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              <span className="sm:hidden">Novo dispositivo</span>
              <span className="hidden sm:inline">Novo Dispositivo</span>
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 flex gap-3 flex-wrap items-center">
        <div className="relative w-full sm:flex-1 sm:min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, dono, matrícula ou setor" className="pl-9" />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="flex-1 sm:w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="cancelados">Cancelados</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="flex-1 sm:w-[180px]"><SelectValue placeholder="Setor / Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {sectors.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1 rounded-lg bg-secondary p-1 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setColorFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition shrink-0 ${colorFilter === "all" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
          >
            Todas
          </button>
          {PADLOCK_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColorFilter(c)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition shrink-0 ${colorFilter === c ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full border ${colorSwatch[c]}`} />
              {colorLabel[c]}
            </button>
          ))}
        </div>
      </div>

      {/* Skeleton loading */}
      {isLoading && (
        <>
          <Card className="mt-4 hidden md:block">
            <CardContent className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </CardContent>
          </Card>
          <div className="mt-4 grid gap-2 md:hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        </>
      )}

      {/* Tabela (desktop) */}
      {!isLoading && (
        <Card className="mt-4 hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cor</TableHead>
                  <TableHead>Nº</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dono</TableHead>
                  <TableHead>Setor / Empresa</TableHead>
                  {canSeeSensitive && <TableHead>Matrícula</TableHead>}
                  {canSeeSensitive && <TableHead>Função</TableHead>}
                  {canSeeSensitive && <TableHead>Telefone</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canSeeSensitive ? 8 : 5} className="text-center text-muted-foreground py-10">
                      Nenhum dispositivo encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((p) => (
                  <TableRow key={p.id} className={`cursor-pointer ${p.cancelled ? "bg-[#FDECEA]/40 opacity-70" : ""}`}>
                    <TableCell>
                      <Link to="/cadeados/$codigo" params={{ codigo: p.code }} className="inline-flex items-center gap-2 hover:underline">
                        <span className={`h-3.5 w-3.5 rounded-full border ${colorSwatch[p.color]}`} />
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorBadge[p.color]}`}>
                          {colorLabel[p.color]}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link to="/cadeados/$codigo" params={{ codigo: p.code }} className="font-mono font-semibold tabular-nums hover:underline">
                        {p.number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {p.cancelled ? (
                        <span className="inline-flex items-center rounded-full border border-[#D42E1B]/40 bg-[#FFE3DF] px-2 py-0.5 text-xs font-medium text-[#8B1A0E]">
                          Baixado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0F7A47]">
                          <span className="h-2 w-2 rounded-full bg-[#0F7A47]" /> Em uso
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{p.owner_name || "—"}</TableCell>
                    <TableCell className="text-sm">{p.owner_sector || "—"}</TableCell>
                    {canSeeSensitive && <TableCell className="text-sm font-mono">{p.owner_registration || "—"}</TableCell>}
                    {canSeeSensitive && <TableCell className="text-sm">{p.owner_role || "—"}</TableCell>}
                    {canSeeSensitive && <TableCell className="text-sm">{p.owner_phone ? formatPhoneBR(p.owner_phone) : "—"}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Lista de cards (mobile) */}
      {!isLoading && (
        <div className="mt-4 grid gap-2 md:hidden">
          {filtered.length === 0 && (
            <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              Nenhum dispositivo encontrado.
            </div>
          )}
          {filtered.map((p) => (
            <Link
              key={p.id}
              to="/cadeados/$codigo"
              params={{ codigo: p.code }}
              className={`block rounded-lg border bg-card p-3 active:bg-accent/50 transition ${p.cancelled ? "bg-[#FDECEA]/40 opacity-80" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-3.5 w-3.5 rounded-full border shrink-0 ${colorSwatch[p.color]}`} />
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${colorBadge[p.color]}`}>
                    {colorLabel[p.color]}
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-sm">#{p.number}</span>
                </div>
                {p.cancelled ? (
                  <span className="inline-flex items-center rounded-full border border-[#D42E1B]/40 bg-[#FFE3DF] px-2 py-0.5 text-[10px] font-medium text-[#8B1A0E] shrink-0">
                    Baixado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#0F7A47] shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0F7A47]" /> Em uso
                  </span>
                )}
              </div>
              <div className="mt-2 text-sm">
                <div className="font-medium truncate">{p.owner_name || "—"}</div>
                <div className="text-xs text-muted-foreground truncate">{p.owner_sector || "—"}</div>
              </div>
              {canSeeSensitive && (p.owner_registration || p.owner_role || p.owner_phone) && (
                <div className="mt-1.5 text-[11px] text-muted-foreground space-x-2">
                  {p.owner_registration && <span className="font-mono">{p.owner_registration}</span>}
                  {p.owner_role && <span>· {p.owner_role}</span>}
                  {p.owner_phone && <span>· {formatPhoneBR(p.owner_phone)}</span>}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <NewPadlockDialog open={openNew} onOpenChange={setOpenNew} onCreated={invalidate} />
      <ReportInconsistencyDialog open={openReport} onOpenChange={setOpenReport} padlocks={items} />
    </PageShell>
  );
}
