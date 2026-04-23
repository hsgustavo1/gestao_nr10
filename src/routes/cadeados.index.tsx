import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { deriveStatus, formatDateTime, statusColor, statusLabel, type Padlock, type DerivedStatus } from "@/lib/padlocks";
import { NewPadlockDialog } from "@/components/new-padlock-dialog";

export const Route = createFileRoute("/cadeados/")({
  component: PadlocksList,
  head: () => ({ meta: [{ title: "Cadeados — LOTO Atvos" }] }),
});

function PadlocksList() {
  const { isStaff } = useAuth();
  const [items, setItems] = useState<Padlock[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<DerivedStatus | "all">("all");
  const [openNew, setOpenNew] = useState(false);

  const reload = () => {
    supabase.from("padlocks").select("*").order("code").then(({ data }) => setItems(data ?? []));
  };
  useEffect(reload, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((p) => {
      if (filter !== "all" && deriveStatus(p) !== filter) return false;
      if (!term) return true;
      return (
        p.code.toLowerCase().includes(term) ||
        (p.location ?? "").toLowerCase().includes(term) ||
        (p.applied_by_name ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, q, filter]);

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cadeados</h1>
          <p className="text-sm text-muted-foreground">{items.length} registrados · {filtered.length} exibidos</p>
        </div>
        {isStaff && (
          <Button onClick={() => setOpenNew(true)} className="bg-brand-gradient text-white shadow-brand hover:opacity-95">
            <Plus className="h-4 w-4" /> Novo cadeado
          </Button>
        )}
      </div>

      <div className="mt-5 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, local ou responsável" className="pl-9" />
        </div>
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {(["all", "disponivel", "aplicado", "vencido"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${filter === f ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
            >
              {f === "all" ? "Todos" : statusLabel[f]}
            </button>
          ))}
        </div>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Aplicado</TableHead>
                <TableHead>Prazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    Nenhum cadeado encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((p) => {
                const s = deriveStatus(p);
                return (
                  <TableRow key={p.id} className="cursor-pointer">
                    <TableCell>
                      <Link to="/cadeados/$codigo" params={{ codigo: p.code }} className="font-mono font-semibold text-foreground hover:underline">
                        {p.code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColor[s]}`}>
                        {statusLabel[s]}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{p.location || "—"}</TableCell>
                    <TableCell className="text-sm">{p.applied_by_name || "—"}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(p.applied_at)}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(p.due_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewPadlockDialog open={openNew} onOpenChange={setOpenNew} onCreated={reload} />
    </PageShell>
  );
}