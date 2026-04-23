

# Sistema LOTO Atvos — Controle de Cadeados

App web responsivo para gestão de Lockout/Tagout, com dados persistentes na nuvem, três níveis de acesso e auditoria completa.

## Identidade visual
- Fundo principal **azul Atvos** `#0A2D48`
- Acentos em **gradiente laranja→amarelo** (`#E35D12 → #F47920 → #FAC800`)
- Tipografia system-ui, layout limpo no estilo do protótipo (lock + barra de acento)
- Modo claro e escuro coerentes com a marca

## Perfis de acesso

| Perfil | Login | O que pode fazer |
|---|---|---|
| **Visualizador** | Sem login (público) | Ver dashboard e listagem de cadeados em modo somente-leitura |
| **Supervisor** | E-mail + senha | Tudo que o Admin faz, **exceto editar ou excluir registros existentes** (pode criar e aplicar/remover cadeados) |
| **Admin (Dono de RAC)** | E-mail + senha | Acesso total — cadastrar, editar, excluir cadeados, gerenciar usuários e atribuir perfis |

Roles armazenadas em tabela separada `user_roles` (segurança por RLS, sem escalonamento de privilégio). Primeiro Admin precisa ser promovido manualmente após o cadastro inicial.

## Entidade central: Cadeado
Cada cadeado físico tem registro único com:
- **Código/etiqueta** única (identificador no campo)
- **Status**: Disponível, Aplicado, Vencido
- **Localização/equipamento** (campo livre — onde está aplicado)
- **Responsável atual** (quem aplicou)
- **Data/hora de aplicação** e **prazo previsto de liberação**
- **Motivo** do bloqueio
- **Observações**

## Telas

1. **Home pública (`/`)** — visão institucional + dashboard resumido em modo leitura, com botão "Entrar" para Supervisor/Admin.
2. **Dashboard (`/dashboard`)** — cards de KPIs (cadeados ativos, vencidos, disponíveis, total) + lista dos últimos eventos. Visível sem login.
3. **Cadeados (`/cadeados`)** — tabela filtrável por status/código/responsável. Cada linha abre painel de detalhe.
4. **Detalhe do cadeado (`/cadeados/$codigo`)** — ficha + **histórico/auditoria completa** (linha do tempo de cada aplicação, liberação, edição, com autor e timestamp).
5. **Aplicar / Remover cadeado** — ações contextuais no detalhe (Supervisor e Admin), com formulário curto (motivo, prazo).
6. **Cadastro de cadeados** — criar novo (Supervisor/Admin); editar/excluir (apenas Admin).
7. **Usuários e permissões (`/admin/usuarios`)** — apenas Admin: lista de usuários e atribuição de perfil.
8. **Login (`/login`)** e logout no header.

## Regras-chave
- **Auditoria imutável**: toda mudança de status, edição ou exclusão gera evento permanente em tabela de log com `user_id`, ação, dados anteriores/novos e timestamp — visível na tela de detalhe.
- **Cadeado "vencido"**: calculado automaticamente quando o prazo previsto passou e o cadeado ainda está aplicado (destaque vermelho no dashboard).
- **Visualizador** nunca vê botões de ação — apenas dados.
- **Supervisor** vê botões de criar/aplicar/remover, mas não vê "Editar" nem "Excluir" em registros já existentes.

## Backend (Lovable Cloud)
- Tabelas: `padlocks`, `padlock_events` (auditoria), `user_roles`, `profiles`
- RLS em todas as tabelas; leitura pública liberada em `padlocks` e `padlock_events` para o modo Visualizador
- Função `has_role(user_id, role)` para checagens seguras nas policies
- Auth por e-mail/senha (auto-confirm ligado para facilitar testes)

## Fora do MVP (podem vir depois)
Cadastro separado de equipamentos/TAGs, ordens de serviço, leitura de QR Code, exportação PDF/Excel, notificações de vencimento por e-mail.

