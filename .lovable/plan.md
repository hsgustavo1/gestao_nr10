

# Como criar o primeiro Admin

## Por que está difícil agora
A política de segurança da tabela `user_roles` exige que **só um Admin existente** possa inserir novos perfis. Como ainda não há nenhum Admin, ninguém tem permissão para inserir o primeiro registro pela interface — é o clássico problema do "ovo e galinha". Por isso a inserção manual está sendo bloqueada.

## O que cada campo significa (se você quiser inserir manualmente mesmo assim)

Na tabela `user_roles`, ao clicar em **"Insert row"**:

| Campo | O que preencher |
|---|---|
| **id** | Deixe em branco — é gerado automaticamente (`gen_random_uuid()`) |
| **user_id** | O UUID do usuário a promover. No seu caso: `31b7c29c-ff0e-4a0c-8ed8-677f7a0aab09` (sua conta `gustavo.henrique@atvos.com`) |
| **role** | `admin` (literal, em minúsculas — é um enum com dois valores: `admin` ou `supervisor`) |
| **created_at** | Deixe em branco — preenche automaticamente com `now()` |

O `user_id` você encontra em **Cloud → Tables → profiles** (coluna `id` da linha do seu e-mail) ou em **Cloud → Users**.

## Proposta de solução (recomendada)

Em vez de você lutar com o painel, vou:

1. **Promover sua conta a Admin agora**, via migração SQL one-shot (executada com privilégio de serviço, ignora RLS):
   - Insere `user_id = 31b7c29c-ff0e-4a0c-8ed8-677f7a0aab09`, `role = 'admin'` em `user_roles`.
2. A partir desse momento, você consegue entrar em `/admin/usuarios` no app e promover/rebaixar qualquer outro usuário pela interface, sem mexer mais no banco.

## Próximos passos depois de aprovado

- Faça login no app com `gustavo.henrique@atvos.com`.
- Acesse **Usuários e permissões** (link novo no header, visível só para Admin).
- Para cada novo cadastro, atribua **Supervisor** ou **Admin** com um clique.

