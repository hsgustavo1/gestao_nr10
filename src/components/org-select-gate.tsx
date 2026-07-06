import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Building2, CornerDownRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { buildOrgTree } from "@/lib/org-tree";
import { cn } from "@/lib/utils";

/** Setado no login (ver login.tsx) para sinalizar que, assim que orgs carregarem,
 * o usuário deve confirmar em qual empresa vai trabalhar antes de continuar. */
export const ORG_SELECT_PENDING_KEY = "gestao-force-org-select";

/**
 * Pop-up obrigatório pós-login: usuários associados a mais de uma empresa
 * (consultor gerenciando clientes, ou membro direto de várias orgs) precisam
 * confirmar em qual empresa vão trabalhar antes de seguir — evita carga de
 * dados na empresa errada.
 */
export function OrgSelectGate() {
  const { user, loading, orgs, orgsReady, currentOrg, setCurrentOrg, isPlatformAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !user || !orgsReady) return;
    const pending = sessionStorage.getItem(ORG_SELECT_PENDING_KEY) === "1";
    if (pending && !isPlatformAdmin && orgs.length > 1) setOpen(true);
    else if (pending) sessionStorage.removeItem(ORG_SELECT_PENDING_KEY);
  }, [loading, user, orgsReady, orgs.length, isPlatformAdmin]);

  if (!open || orgs.length <= 1) return null;

  const sorted = [...orgs].sort((a, b) => (b.is_root ? 1 : 0) - (a.is_root ? 1 : 0));
  const tree = buildOrgTree(sorted);

  function escolher(orgId: string) {
    setCurrentOrg(orgId);
    sessionStorage.removeItem(ORG_SELECT_PENDING_KEY);
    setOpen(false);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={() => {}}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-5 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="flex items-center gap-2 text-base font-semibold">
            <Building2 className="h-4 w-4 text-primary" /> Selecione a empresa
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
            Sua conta está associada a mais de uma empresa. Escolha em qual você vai trabalhar
            nesta sessão para evitar registrar dados na empresa errada.
          </DialogPrimitive.Description>
          <div className="mt-4 max-h-[50vh] space-y-1 overflow-y-auto">
            {tree.map(({ org, depth }) => (
              <button
                key={org.id}
                type="button"
                onClick={() => escolher(org.id)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                  org.id === currentOrg?.id && "border-primary bg-primary/5",
                )}
                style={{ paddingLeft: 12 + depth * 16 }}
              >
                {depth > 0 && (
                  <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                )}
                <span className="flex-1 truncate font-medium">{org.nome}</span>
                {org.id === currentOrg?.id && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    atual
                  </span>
                )}
              </button>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
