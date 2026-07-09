import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, LayoutTemplate, Pencil, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import {
  EstruturaModeloEditor,
  type ModeloEditorInicial,
} from "@/components/estrutura-modelo-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { arvoreFromNodes, contarNos } from "@/lib/estrutura-modelos";
import {
  useDeleteModelo,
  useEstruturasParaCurar,
  useModelosAdmin,
  useSetPublicado,
  type EstruturaModelo,
} from "@/lib/estrutura-modelos-queries";
import { supabase } from "@/integrations/supabase/client";
import { formatDatePtBR } from "@/lib/qualificacoes";

export const Route = createFileRoute("/admin/padroes")({
  component: AdminPadroesPage,
});

function AdminPadroesPage() {
  const { isPlatformAdmin } = useAuth();
  const modelos = useModelosAdmin();
  const estruturas = useEstruturasParaCurar();
  const setPublicado = useSetPublicado();
  const deleteModelo = useDeleteModelo();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInicial, setEditorInicial] = useState<ModeloEditorInicial | null>(null);
  const [excluir, setExcluir] = useState<EstruturaModelo | null>(null);

  if (!isPlatformAdmin) {
    return (
      <PageShell>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Acesso restrito ao dono da plataforma.
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  function editarModelo(m: EstruturaModelo) {
    setEditorInicial({
      id: m.id,
      nome: m.nome,
      segmento: m.segmento,
      descricao: m.descricao,
      arvore: m.arvore,
      origem_inspecao_id: m.origem_inspecao_id,
    });
    setEditorOpen(true);
  }

  async function promover(insp: {
    id: string;
    titulo: string;
    segmento: string | null;
  }) {
    // Carrega os nós na hora (fora de hook — ação pontual do admin).
    const { data, error } = await supabase
      .from("field_nodes")
      .select("id, parent_id, nome, ordem")
      .eq("inspection_id", insp.id)
      .order("ordem");
    if (error) {
      toast.error(`Falha ao carregar a estrutura: ${error.message}`);
      return;
    }
    const arvore = arvoreFromNodes(
      (data ?? []) as { id: string; parent_id: string | null; nome: string; ordem: number }[],
    );
    if (contarNos(arvore) === 0) {
      toast.error("Esta inspeção não tem estrutura para promover.");
      return;
    }
    setEditorInicial({
      nome: `Modelo — ${insp.segmento?.trim() || insp.titulo}`,
      segmento: insp.segmento ?? "",
      descricao: null,
      arvore,
      origem_inspecao_id: insp.id,
    });
    setEditorOpen(true);
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <LayoutTemplate className="h-5 w-5 shrink-0 text-primary" />
            Padrões de estrutura
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Cure estruturas reais em modelos por segmento. Nenhum conteúdo de uma organização é
            sugerido a outra sem passar por aqui.
          </p>
        </div>

        {/* Modelos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Modelos ({modelos.data?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(modelos.data ?? []).map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {m.nome}{" "}
                    <span
                      className={
                        m.publicado
                          ? "ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700"
                          : "ml-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                      }
                    >
                      {m.publicado ? "Publicado" : "Rascunho"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.segmento} · {contarNos(m.arvore)} itens
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => editarModelo(m)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={setPublicado.isPending}
                    onClick={() =>
                      setPublicado.mutate({ id: m.id, publicado: !m.publicado })
                    }
                  >
                    {m.publicado ? (
                      <>
                        <EyeOff className="mr-1 h-3.5 w-3.5" /> Despublicar
                      </>
                    ) : (
                      <>
                        <Eye className="mr-1 h-3.5 w-3.5" /> Publicar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setExcluir(m)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {(modelos.data?.length ?? 0) === 0 && (
              <p className="p-2 text-sm text-muted-foreground">
                Nenhum modelo ainda — promova uma estrutura abaixo.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Estruturas candidatas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Estruturas de inspeções ({estruturas.data?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(estruturas.data ?? []).map((i) => (
              <div
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{i.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {[i.cliente, i.segmento, `${i.nos} nós`, formatDatePtBR(i.created_at)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void promover(i)}>
                  <Sparkles className="mr-1 h-3.5 w-3.5" /> Promover a modelo
                </Button>
              </div>
            ))}
            {(estruturas.data?.length ?? 0) === 0 && (
              <p className="p-2 text-sm text-muted-foreground">
                Nenhuma inspeção com estrutura cadastrada.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <EstruturaModeloEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        inicial={editorInicial}
      />

      <AlertDialog open={excluir !== null} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              "{excluir?.nome}" será removido do catálogo. Estruturas já aplicadas em inspeções
              não são afetadas (aplicar é cópia).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (excluir) deleteModelo.mutate(excluir.id);
                setExcluir(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
