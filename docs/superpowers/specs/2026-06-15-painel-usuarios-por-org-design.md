# Painel de usuários por org (Fase 2 — UI) — design

**Data:** 2026-06-15
**Contexto:** ROADMAP Fase 2, item "Falta (UI)": wire do painel de usuários para criar
usuário **na org do cliente selecionado** e listar usuários por org. Backend
(`admin-users`, RLS, isolamento) já validado.

## Problema

O painel `src/routes/admin/usuarios.tsx` é 100% legado single-tenant:
- `reload()` lê **todos** os profiles globalmente.
- O diálogo de criação envia apenas o papel **global** (`admin`/`apoio`).
- O gate é `isAdmin` (papel global).

Para o consultor entregar RTI+PWA a clientes, o painel precisa operar **na org ativa**
(o `OrgSwitcher` no header já fornece `currentOrg`).

### Achado técnico decisivo (RLS)

A policy `profiles_select_scoped` libera leitura de profile só para co-membros da
**mesma** org (`shares_org`). O consultor **gerencia** o Cliente A (via `managed_by`)
mas **não é membro** dele → consegue ler as linhas de `org_memberships` do Cliente A,
porém **não** os profiles (nome/e-mail). Logo, listar usuários do cliente puramente
client-side traz uma lista sem nomes.

→ A listagem (e a gestão) de usuários de orgs-cliente vai por uma **ação privilegiada
na edge function** (service role, autorizada por `org_role_at_least(admin)`), mantendo
o RLS de `profiles` apertado.

## Escopo — AGORA

### Edge function `admin-users`
- **Nova ação `list`** `{ type, org_id }`: autoriza por platform admin OU
  `org_role_at_least(admin)` na org; retorna membros da org + profiles + papéis globais.
- **Autorização org-aware** para `delete`/`update`/`reset_password`: aceitam `org_id`
  opcional. Quando presente (não platform admin), autoriza por `org_role_at_least(admin)`
  **e verifica que o usuário-alvo pertence àquela org** (impede mirar usuário de outra
  org passando um org_id que você administra). Sem `org_id` → caminho global legado
  (`has_role admin`) inalterado.

### Painel `admin/usuarios.tsx`
- Opera na `currentOrg`. `PRINCIPAL_ORG_ID = …0001` (org semente legada).
  `isPrincipal = !currentOrgId || currentOrgId === PRINCIPAL_ORG_ID`.
- **Listagem:** principal → leitura client-side (inalterada, sem dependência de deploy);
  org-cliente → edge `list`.
- **Criação:** principal → papel global (`admin`/`apoio`, como hoje); org-cliente →
  `org_id` + `org_role` com dois níveis no MVP:
  - **Administrador da empresa** (`admin`) — cliente final / consultor-distribuidor.
  - **Visualização** (`viewer`) — cliente restrito (não altera nada; aproximação segura).
- **Gestão (delete/reset/edit):** passa `org_id` quando org-cliente.
- **Gate:** `hasOrgRole("admin")` (cobre o consultor gerenciando o cliente).
- Cabeçalho mostra o nome da org ativa; UI de papel adapta (toggles globais no principal,
  badge de `org_role` no cliente).

### Compatibilidade
- Empresa Principal (Atvos): caminho de leitura/criação inalterado → sem regressão e
  **sem** nova dependência de deploy para o legado.
- Sem tenancy aplicada (`currentOrgId` null) → cai no caminho legado.

### Dependência de deploy
A ação `list` + a autz org-aware exigem **redeploy** de `admin-users`
(`supabase functions deploy admin-users`). Sem isso, só o fluxo NOVO de org-cliente
falha (com toast claro); o legado segue funcionando.

## Escopo — ADIADO (registrado no ROADMAP)

- **A) Nível "cliente operador restrito":** edita a operação mas prioridades/NCs
  definidas pelo consultor ficam read-only — trava por campo no domínio RTI. Mapeia a
  um futuro `org_role=member` + column/action-level locks. Levantado em 2026-06-15
  (dois níveis de cliente do consultor: operador-restrito vs. cliente-final).
- **B) Gates de feature por entitlement (Fase 1.5):** hoje as telas liberam por papel
  **global**; para o cliente-admin operar o app 100% sem papel global, falta a migração
  dos gates. Até lá, quem valida o pipeline campo→RTI no MVP é o próprio consultor.

## Fora de escopo
- Não conceder papel global "por baixo" a usuários-cliente (furaria a separação).
- Não migrar os gates de rota agora (é a Fase 1.5).
