# RTI/Campo Gates Design

## Escopo

Migrar apenas o fluxo RTI/Campo para gates de tenancy. O objetivo é permitir que um cliente com membership na organização ativa opere o pipeline RTI/PWA sem receber `admin` ou `apoio` global legado.

## Decisão

Criar um helper puro em `src/lib/tenancy-gates.ts` para centralizar as regras:

- `canViewRtiCampo`: usuário legado staff ou org com entitlement `rti_pwa`/`gestao_completa`.
- `canEditRtiCampo`: pode ver o fluxo e tem papel legado staff ou `hasOrgRole("member")`.
- `canAdminRtiCampo`: pode ver o fluxo e tem admin legado ou `hasOrgRole("admin")`.

Esse recorte evita mexer em LOTO, NR-10, EPIs, incidentes, qualificações e relatórios. O RLS continua sendo a barreira real; o front só esconde ou libera controles de UI.

## Arquivos

- `src/lib/tenancy-gates.ts`: helper puro e testável.
- `src/lib/__tests__/tenancy-gates.test.ts`: cobertura das combinações de legado, cliente e org sem entitlement.
- `src/routes/rti.*.tsx`, `src/routes/campo.*.tsx`, `src/components/site-header.tsx`: substituir misturas locais de `isStaff`/`isAdmin` por gates do helper no recorte RTI/Campo.

## Verificação

Rodar testes do helper, lint, suíte Vitest e builds do app principal/PWA.
