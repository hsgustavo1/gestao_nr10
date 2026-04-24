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
import {
  PADLOCK_COLORS, colorBadge, colorLabel, colorSwatch,
  type Padlock, type PadlockColor,
} from "@/lib/padlocks";
import { NewPadlockDialog } from "@/components/new-padlock-dialog";

export const Route = createFileRoute("/cadeados/")({
  component: PadlocksList,
  head: () => ({ meta: [{ title: "Cadeados — LOTO Atvos" }] }),
});

function PadlocksList() {
  const { isStaff } = useAuth();
  const [items, setItems] = useState<Padlock[]>([]);
  const [q, setQ] = useState("");
  const [colorFilter, setColorFilter] = useState<PadlockColor | "all">("all");
  const [openNew, setOpenNew] = useState(false);

  const reload = () => {
    supabase
      .from("padlocks")
      .select("*")
      .order("color")
      .order("number")
      .then(({ data }) => setItems(data ?? []));
  };
  useEffect(reload, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((p) => {
      if (colorFilter !== "all" && p.color !== colorFilter) return false;
      if (!term) return true;
      return (
        String(p.number).includes(term) ||
        p.code.toLowerCase().includes(term) ||
        (p.owner_name ?? "").toLowerCase().includes(term) ||
        (p.owner_registration ?? "").toLowerCase().includes(term) ||
        (p.owner_sector ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, q, colorFilter]);

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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, dono, matrícula ou setor" className="pl-9" />
        </div>
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          <button
            onClick={() => setColorFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${colorFilter === "all" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
          >
            Todas as cores
          </button>
          {PADLOCK_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColorFilter(c)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${colorFilter === c ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full border ${colorSwatch[c]}`} />
              {colorLabel[c]}
            </button>
          ))}
        </div>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cor</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Dono</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Telefone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    Nenhum cadeado encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((p) => (
                <TableRow key={p.id} className="cursor-pointer">
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
                  <TableCell className="text-sm">{p.owner_name || (p.color === "vermelho" ? <span className="text-muted-foreground">—</span> : "—")}</TableCell>
                  <TableCell className="text-sm font-mono">{p.owner_registration || "—"}</TableCell>
                  <TableCell className="text-sm">{p.owner_role || "—"}</TableCell>
                  <TableCell className="text-sm">{p.owner_sector || "—"}</TableCell>
                  <TableCell className="text-sm">{p.owner_phone || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewPadlockDialog open={openNew} onOpenChange={setOpenNew} onCreated={reload} />
    </PageShell>
  );
}