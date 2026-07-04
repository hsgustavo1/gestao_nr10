# Motor 1 — NR-13 como conteúdo (validação do modelo com a 2ª norma)

**Data:** 2026-07-03
**Status:** análise concluída — decisão go/no-go do Motor 1 com a norma escolhida pelo founder (NR-13, não NR-35)
**Insumo:** [2026-07-03-motor1-pedra-roseta-nr10.md](2026-07-03-motor1-pedra-roseta-nr10.md) (modelo `compliance_requirements` + 3 mecanismos genéricos)
**Fonte normativa:** texto vigente da NR-13 — Portaria MTP n.º 1.846/2022 (vigor 03/10/2022, retificada 20/10/2022) + Portaria MTP n.º 4.219/2022. Lido integralmente o texto consolidado 2019 (gov.br/CTPP) e as seções alteradas da consolidação vigente (2023-b, gov.br). Itens citados pela numeração vigente (13.x.y).

> ⚠️ Nota de extração: a Tabela 2 (prazos de vasos) veio de PDF com colunas embaralhadas; os valores abaixo foram reconstruídos pela leitura semanticamente consistente (externo sempre mais frequente que interno) e conferem com a redação 2019 e referências de mercado. **Conferir contra o PDF oficial antes de virar seed de produção.**

---

## 1. Veredito executivo

**A NR-13 cabe no Motor 1 — mas exige 2 evoluções do modelo E1 e 1 tabela nova (ativos).** Nenhuma regra da NR-13 quebra o design; as que não viram config degradam de forma limpa para `validity_mode='data_explicita'` (a própria norma delega esses prazos ao PLH, e o que o sistema precisa guardar é o compromisso documentado — a "data improrrogável da próxima inspeção" que a norma exige no relatório, 13.5.4.5.3-e).

A diferença estrutural: a NR-10 é **pessoa-cêntrica** (aptidão do trabalhador); a NR-13 é **equipamento-cêntrica** (integridade do ativo). O motor de requisitos serve aos dois; o que falta no app é a entidade "equipamento com atributos técnicos" — hoje `inspections` guarda `equipment` como texto livre (`inspecoes.ts:40`).

Bônus de timing: a obrigação da NR-13 para **tanques metálicos entra em vigor em 04/07/2026** (art. 3º da Portaria 1.846/22) — amanhã, na data desta análise. Todo estabelecimento com tanque >3 m / >20.000 L com fluido classe A/B passa a precisar de programa de inspeção. É gancho comercial imediato para o consultor.

## 2. Mapa de requisitos da NR-13 vigente

### 2.1 Alvo pessoa (2 requisitos — cabem direto no modelo E1)

| Requisito | Item | Conteúdo | Representação no motor |
|---|---|---|---|
| Operador de caldeira | 13.4.3.x + Anexo I item 1 | Ensino médio + treinamento 40 h (currículo mínimo 1.9, supervisão PLH, **teoria pode ser EaD**, 1.3.1) + prática supervisionada **na própria caldeira que irá operar**: 80 h (cat. A) ou 60 h (cat. B) | `kind='treinamento'`, `validity_mode='perene'` + gatilhos de atualização (1.7: modificação da caldeira, acidente/incidente de alto potencial, recorrência) = **mesmo mecanismo M3 (flag manual)** da reciclagem extraordinária NR-10. Horas de prática por categoria = `evidence_qualifier` com parâmetro por atributo do alvo |
| Operador de unidades de processo (vasos cat. I/II) | Anexo I item 2 | Ensino médio + 40 h + prática supervisionada 300 h | Idem; aplicabilidade condicionada à **presença de vaso cat. I/II na unidade** (avaliador M1, predicado sobre ativos da org) |

**Sem reciclagem periódica** — diferente da bienal NR-10, a NR-13 só exige atualização por gatilho. O modelo E1 já cobre (perene + flag manual). O campo `carga_horaria` já existe em `nr10_trainings` (`qualificacoes.ts:101`).

### 2.2 Alvo equipamento — periodicidades (o stress test)

**Caldeiras** — categorias A (P ≥ 1.960 kPa, V > 100 L) e B (60 < P < 1.960 kPa, V > 100 L, P·V > 6) (13.4.1.2). Inspeção periódica (13.4.4.4/13.4.4.5):

| Situação | Prazo máximo |
|---|---|
| Cat. A e B, base | 12 meses |
| Recuperação de álcalis | 18 meses (era 15 na redação 2019) |
| Cat. A com teste de válvulas aos 12 meses | 24 meses |
| Cat. B com SGC (Anexo IV) | 30 meses |
| Com SPIE: álcalis / cat. B | 24 meses |
| Com SPIE: cat. A | 30 meses |
| Com SPIE: cat. A com SIS (Anexo IV) | 48 meses |

Mais: avaliação de integridade aos 25 anos de uso (13.4.4.6); válvulas de segurança desmontadas/testadas em prazo ≤ periódica (13.4.4.7); cat. B: teste mensal de alavanca p/ água não tratada (13.4.4.8-a). **Atraso na periódica de caldeira = Risco Grave e Iminente** (13.3.1-b) — severidade máxima no produto.

**Vasos de pressão** — categoria I–V derivada de **classe de fluido (A/B/C/D) × grupo de potencial de risco (1–5 por P·V em MPa·m³: ≥100 / ≥30 / ≥2,5 / ≥1 / <1)** — Tabela 1 (13.5.1.1). Periódica — Tabela 2 (13.5.4.5), valores reconstruídos:

| Cat. | Sem SPIE ext. | Sem SPIE int. | Com SPIE ext. | Com SPIE int. |
|---|---|---|---|---|
| I | 1 ano | 3 anos | 3 anos | 6 anos |
| II | 2 anos | 4 anos | 4 anos | 8 anos |
| III | 3 anos | 6 anos | 5 anos | 10 anos |
| IV | 4 anos | 8 anos | 6 anos | 12 anos |
| V | 5 anos | 10 anos | 7 anos | a critério |

Mais: SPIE + inspeção baseada em risco (RBI, integrada ao PGR/NR-01) pode ampliar além da tabela, limite 10 anos p/ interno cat. I (13.5.4.5.1/.2); postergação do interno por **metade do prazo** com SPIE + INI (ABNT NBR 16455) + relatório com data improrrogável (13.5.4.5.3); vasos < 0 °C: externo 2 anos, interno a critério do PLH/código (13.5.4.8); válvulas ≤ prazo do exame interno (13.5.4.9).

**Tubulações** (classe A/B ligadas a caldeiras/vasos): prazo = **prazo do exame interno do vaso/caldeira mais crítico a elas ligado** (13.6.2.2); duplicável a critério do PLH, máx. 10 anos (13.6.2.2.1).

**Tanques metálicos** (vigor 04/07/2026): prazos definidos em **programa de inspeção elaborado por responsável técnico conforme códigos/normas** (13.7.3.2) — a redação 2022 removeu a amarra à NBR 17505-2.

**Inspeções extraordinárias** (gatilhos por evento): dano por acidente; reparo/alteração significativa; inatividade > 6 meses (caldeira, 13.4.4.10-c), > 12 meses (vaso, 13.5.4.10-c), > 12/24 meses (tubulação, 13.6.2.4-c), > 24 meses (tanque, 13.7.3.3-c); mudança de local.

**Postergação universal**: força maior + justificativa formal + análise técnica do PLH + comunicação ao sindicato = até 6 meses sobre a periódica de **qualquer equipamento** (13.3.1.1 — na redação 2019 valia só para caldeiras).

### 2.3 Alvo documento (checklist por equipamento — generaliza o PIE da NR-10)

Por **caldeira** (13.4.1.5): prontuário do fabricante, Registro de Segurança, projeto de instalação, projetos de alteração/reparo, relatórios de inspeção, certificados de calibração dos dispositivos. Por **vaso** (13.5.1.x): idem menos projeto de instalação. Por **tubulação** (13.6.1.4): especificações, fluxograma de engenharia, projetos, relatórios, Registro de Segurança. Por **tanque** (13.7.1.x): folha de dados, desenho geral, projetos, relatórios, Registro de Segurança.

→ Mesma estrutura de `norm_document_categories` do E1, com `target='equipamento'` (checklist **por ativo**, não por instalação — exige a tabela de ativos, §4).

### 2.4 O relatório de inspeção tem conteúdo mínimo definido em norma

13.4.4.14 (caldeiras), 13.5.4.x (vasos), 13.6.2.5 (tubulações), 13.7.3.4 (tanques): identificação, categoria, fluidos, tipo de inspeção, datas, exames executados, **registro fotográfico obrigatório**, resultado, recomendações, **parecer conclusivo de integridade**, **data prevista da próxima inspeção**, assinatura do PLH com registro no conselho. Pode ser eletrônico com **assinatura digital validada por AC** (ICP-Brasil). Emissão em até 60 dias (90 em parada geral).

→ Isso é literalmente o pipeline campo-pwa → `comporRti` → laudo com selo de entrega que o app já tem para RTI. **A NR-13 não é só compatível com o Motor 3 — ela especifica o template do laudo.** E "data prevista da próxima inspeção" no relatório é exatamente o `validity_date` que `inspections` já armazena.

## 3. Validação contra o modelo E1 — exceções novas

Os 3 mecanismos do E1 (M1 aplicabilidade, M2 qualificador de evidência, M3 flag manual) cobrem os requisitos de pessoa. Para equipamento surgem **4 evoluções**:

| # | Exceção nova | Resolução | Custo |
|---|---|---|---|
| N1 | **Validade em função de atributo do alvo** (prazo por categoria da caldeira/vaso, por tipo de exame) | `validity_matrix` jsonb no requisito: `{"dims": ["categoria", "exame", "spie"], "prazos_meses": {...}}` + resolvedor genérico. Generaliza o `validity_months` escalar (NR-10 vira matriz 1×1) | médio — é O design novo central |
| N2 | **Modificador de contexto** (SPIE certificado no estabelecimento; SIS/SGC no equipamento; RBI) muda a coluna da matriz | `context_modifiers`: fatos com evidência e validade própria (certificado SPIE por OCP/INMETRO) no nível org ou ativo, referenciados como dimensão da matriz N1 | pequeno, dado N1 |
| N3 | **Categorização derivada** (categoria = f(classe fluido, P·V)) | Tabela de categorização por norma + função de derivação; recalculada quando atributos do ativo mudam. Novo mecanismo M4 | pequeno |
| N4 | **Prazo herdado de outro ativo** (tubulação ← vaso mais crítico ligado) e **prazo a critério do PLH** (tanques, vaso V interno, RBI) | **Não modelar.** A norma delega ao PLH; o sistema registra a data comprometida → degrada para `validity_mode='data_explicita'`, que o E1 já tem. O relatório de inspeção obrigatoriamente traz "data prevista da próxima inspeção" — essa é a fonte da verdade | zero |
| N5 | **Postergação auditada** (6 meses força maior, 13.3.1.1; metade do prazo com INI, 13.5.4.5.3) | Novo mecanismo M5: prorrogação com autor, justificativa, evidência e comunicação — mesma família do M3 (flag manual com trilha). Também serve a NR-10 (prorrogações negociadas de plano de ação) | pequeno |

Os gatilhos de inspeção extraordinária e de atualização de operador (evento → obrigação) permanecem **fora do motor** como na decisão do E1 (§4.M3 lá): fase 1 registra manualmente, detecção automática é feature separada.

**Conclusão go/no-go: GO.** A NR-13 valida a arquitetura e força as generalizações certas (matriz de validade + contexto), sem invalidar nada do que a NR-10 exigiu. O escape hatch `data_explicita` se confirma como a válvula de segurança do design: tudo que é engenharia demais para virar config degrada para "o PLH assina uma data e o sistema cobra a data".

## 4. Diff contra o schema atual do app

| Gap | Hoje | Necessário para NR-13 |
|---|---|---|
| **Ativos como entidade** | `inspections.equipment` é texto livre | Tabela `assets`: org_id, tipo (caldeira/vaso/tubulação/tanque), atributos técnicos (PMTA, pressão/volume de operação, classe de fluido, ano de fabricação, dados de placa 13.4.1.3), categoria derivada (N3), local/setor |
| **Dispositivos de segurança** | inexistente | `asset_devices` (válvulas de segurança e afins) com calibração/teste próprios — prazo acoplado à periódica do ativo protegido |
| **Tipos de exame** | `inspections` tem 1 validade por laudo | Evento de inspeção tipado: inicial / periódica **externa** / periódica **interna** / extraordinária / TH / calibração de dispositivo — validades independentes por tipo |
| **Fatos de contexto** | inexistente | SPIE certificado (org, com validade da certificação), SIS/SGC (ativo, Anexo IV) — dimensões da matriz N1 |
| **Registro de Segurança** | inexistente | Livro de ocorrências por ativo (13.4.1.8) — append-only, casa com a governança de selo/trilha já construída para o RTI |
| **Prontuário por ativo** | `nr10_documents` é por instalação | `norm_document_categories` com `target='equipamento'` + vínculo a `assets` |
| **Operadores** | `employees` + treinamentos NR-10 | Reuso direto: novo tipo de treinamento com prática supervisionada (horas) e vínculo ao ativo específico (Anexo I 1.5: "na própria caldeira que irá operar") |

Reuso confirmado: RTI/campo-pwa (coleta com foto → laudo), selo de entrega, vencimentos (`buildVencimentos` ganha kind novo alimentado pelo motor), multi-tenancy/entitlement (`nr13` como entitlement novo).

## 5. Decisões travadas por este documento

1. A 2ª norma é a **NR-13** (decisão do founder, 2026-07-03) — NR-35 sai do caminho crítico.
2. O modelo E1 evolui com: `validity_matrix` (N1), `context_modifiers` (N2), derivação de categoria (N3/M4), prorrogação auditada (N5/M5). O DDL do E1 §2 será revisado nesses pontos **antes** de qualquer implementação.
3. Prazos delegados ao PLH (tubulações, tanques, RBI) **não são modelados** — entram como `data_explicita` extraída do relatório de inspeção.
4. A entidade `assets` é pré-requisito do módulo NR-13 e independe do motor — pode (e deve) nascer no desenho do módulo, com o motor consumindo depois.
5. Seeds da Tabela 1/Tabela 2 só entram em produção após conferência visual contra o PDF oficial (nota de extração no topo).

## Próximos passos

- E4: transformar o H0 em sessões executáveis (independente deste documento).
- Quando o módulo NR-13 for priorizado: brainstorm de produto (que fatia vender primeiro — aposta: **tanques**, pela janela de 04/07/2026 + inventário de vasos com categorização automática, que é calculadora vistosa de baixo custo).

## Fontes

- [NR-13 vigente (consolidação 2023, gov.br/CTPP)](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-13-atualizada-2023-b.pdf)
- [NR-13 consolidação anterior (2019, gov.br/CTPP)](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/arquivos/normas-regulamentadoras/nr-13.pdf)
- [Portaria MTP n.º 1.846/2022 retificada (gov.br)](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/sst-portarias/2022/portaria-mtp-n-o-1-846-nova-nr-13-_retificada.pdf)
- [Resumo das mudanças 2022 (Conexão Trabalho/CNI)](https://conexaotrabalho.portaldaindustria.com.br/publicacoes/detalhe/seguranca-e-saude-do-trabalho/revisao-das-normas-regulamentadoras/publicada-nova-redacao-da-nr-13-sobre-caldeiras-vasos-de-pressao-tubulacoes-e-tanques-metalicos/)
