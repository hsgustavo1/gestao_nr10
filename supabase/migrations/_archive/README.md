# Arquivo de scripts SQL não-migration

Esta pasta guarda scripts SQL de trabalho/consolidação que **não fazem parte do
histórico canônico de migrations**. O histórico canônico são os arquivos
`NNNNNNNNNNNNNN_nome.sql` (timestamp de 14 dígitos) em `supabase/migrations/`.

Estes arquivos foram movidos para cá em 2026-06-12 para limpar o diretório de
migrations. Nenhum deles é aplicado automaticamente: o prefixo `_` já os excluía
do runner do Supabase, e este projeto aplica migrations manualmente pelo SQL
Editor. Mantidos por valor de referência/operacional.

| Arquivo | O que é | Situação |
|---------|---------|----------|
| `_all_migrations.sql` | Dump concatenado das migrations iniciais (a partir de `20260423164152`). Snapshot de referência até ~08/06. | Superado pelos arquivos timestampados individuais. |
| `_pendentes_20260611.sql` | Concatenação do lote de 11/06 (`20260611000000_asos` … `20260611600000_audit_log`) que estava pendente de aplicação. Contém BOM/mojibake de encoding. | Superado — cada migration existe como arquivo individual. |
| `_recuperacao_20260611.sql` | Script **idempotente** de recuperação: reaplica tudo que possa faltar no banco (migrations `20260609000000` … `20260611600000`), na ordem certa, com `IF NOT EXISTS`/`DROP … IF EXISTS`. | Ferramenta operacional. Use para re-sincronizar um banco com drift. |
| `_pendente_campo_v2.sql` | Versão "pendente" do módulo de coleta em campo v2. | **Duplicata exata** de `20260613000000_campo_arvore.sql` (promovido sem alterações). |

## Histórico canônico

O estado real do schema é a sequência de migrations timestampadas em
`supabase/migrations/`. Para reconstruir um banco do zero, aplique-as em ordem
de timestamp. Para re-sincronizar um banco existente com drift, o
`_recuperacao_20260611.sql` é o ponto de partida — mas revise a cobertura: ele
vai até 11/06, então migrations posteriores (`20260612000000_campo_rti`,
`20260613000000_campo_arvore`) precisam ser aplicadas à parte.
