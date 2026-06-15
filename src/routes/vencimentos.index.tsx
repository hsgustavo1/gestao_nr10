import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BellRing, ExternalLink, Search } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useVencimentos, VENC_KINDS, VENC_KIND_LABELS, type VencKind } from "@/lib/vencimentos";
import { formatDatePtBR } from "@/lib/qualificacoes";

export const Route = createFileRoute("/vencimentos/")({
  component: VencimentosPage,
  head: () => ({
    meta: [
      { title: "Central de Vencimentos — Gestão NR-10" },
      {
        name: "description",
        content:
          "Todos os vencimentos do sistema em um só lugar: capacitações, ITs, prontuário, inspeções e ensaios de EPI.",
      },
    ],
  }),
});

function VencimentosPage() {
  const [horizon, setHorizon] = useState<string>("90");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const { items, isLoading } = useVencimentos(parseInt(horizon, 10));

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items.filter((i) => {
      if (kindFilter !== "all" && i.kind !== kindFilter) return false;
      if (!t) return true;
      return (
        i.title.toLowerCase().includes(t) ||
        i.subject.toLowerCase().includes(t) ||
        (i.detail ?? "").toLowerCase().includes(t)
      );
    });
  }, [items, kindFilter, search]);

  const expired = items.filter((i) => i.status === "expired").length;
  const expiring = items.length - expired;

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <BellRing className="h-5 w-5 shrink-0 text-primary" />
            Central de Vencimentos
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Capacitações, ITs, prontuário, inspeções e ensaios de EPI em um só lugar.
          </p>
        </div>
      </div>

      {/* Resumo */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold tabular-nums text-red-600">
              {isLoading ? "—" : expired}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Vencidos
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold tabular-nums text-amber-600">
              {isLoading ? "—" : expiring}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Vencendo em {horizon} dias
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="text-2xl font-bold tabular-nums">{isLoading ? "—" : items.length}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Total de pendências
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] sm:flex-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por colaborador, equipamento, documento..."
            className="pl-8 w-full sm:w-72"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={horizon} onValueChange={setHorizon}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Próximos 30 dias</SelectItem>
            <SelectItem value="60">Próximos 60 dias</SelectItem>
            <SelectItem value="90">Próximos 90 dias</SelectItem>
            <SelectItem value="365">Próximos 12 meses</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {VENC_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {VENC_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card className="mt-4">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {items.length === 0
                ? `Nenhum vencimento nos próximos ${horizon} dias. Tudo em dia! 🎉`
                : "Nenhum item corresponde aos filtros."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Referente a</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((i) => (
                    <TableRow key={i.id} className={i.status === "expired" ? "bg-red-50/50" : ""}>
                      <TableCell>
                        <Badge variant="outline" className="font-normal whitespace-nowrap">
                          {VENC_KIND_LABELS[i.kind as VencKind]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="font-medium leading-tight truncate" title={i.title}>
                          {i.title}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="text-sm truncate" title={i.subject}>
                          {i.subject}
                        </div>
                        {i.detail && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            {i.detail}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDatePtBR(i.dueDate)}
                      </TableCell>
                      <TableCell>
                        {i.status === "expired" ? (
                          <span className="inline-flex items-center rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 whitespace-nowrap">
                            Vencido há {Math.abs(i.daysLeft)}{" "}
                            {Math.abs(i.daysLeft) === 1 ? "dia" : "dias"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 whitespace-nowrap">
                            {i.daysLeft === 0
                              ? "Vence hoje"
                              : `Vence em ${i.daysLeft} ${i.daysLeft === 1 ? "dia" : "dias"}`}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          to={i.link}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
                        >
                          Abrir <ExternalLink className="h-3 w-3" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
