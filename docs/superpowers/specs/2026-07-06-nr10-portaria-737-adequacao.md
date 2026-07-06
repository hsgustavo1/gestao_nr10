# Nova NR-10 (Portaria MTE nº 737/2026) — gap analysis e spec de adequação

**Data:** 2026-07-06
**Status:** spec pronta — **NÃO executar agora** (decisão do founder: há prioridades antes; ver ROADMAP). Retomar com brainstorm das "Decisões em aberto" (§7).
**Fonte normativa:** Portaria MTE nº 737, de 29/05/2026 (DOU 01/06/2026, Seção 1, p. 167) — nova redação integral da NR-10 + Anexos I (Glossário), II (Zonas), III (Treinamentos), IV (EPI arco elétrico). Revoga as Portarias MTE 598/2004 e MTPS 508/2016 (a NR-10 que o app modela hoje). Documento lido integralmente (29 páginas).
**Insumo estratégico:** [2026-07-03-analise-estrategica-multi-nr.md](../plans/2026-07-03-analise-estrategica-multi-nr.md) (três motores; regra de ouro: não adicionar acoplamento hardcoded novo).

---

## 1. Veredito executivo

**A norma que o produto inteiro modela foi substituída, com vacatio legis de 1 ano.** A nova NR-10 entra em vigor em **01/06/2027**. Nada quebra antes disso, mas três coisas são verdade simultaneamente:

1. **O app hoje referencia a numeração antiga em labels, comentários e no checklist do PIE** — após a vigência, isso vira erro visível para qualquer consultor que conheça o texto novo.
2. **O catálogo de treinamentos mudou de forma** (3 tipos no app → 6 treinamentos iniciais com cargas horárias mínimas, + periódico bienal com CH mínima de 16h, + treinamento eventual com gatilhos objetivos). É exatamente o tipo de regra que o §5 da análise estratégica manda parar de hardcodear — **a adequação é a oportunidade natural de nascer como conteúdo do Motor 1**, não como mais código.
3. **A norma criou dois espaços de produto novos que ninguém no mercado terá cedo:** a Permissão de Trabalho em meio digital (10.7.2.3 autoriza explicitamente) e a convalidação de módulos de capacitação entre organizações (10.8.4.2) — que é *estruturalmente multi-tenant*, o formato exato do nosso schema.

Posicionamento: chegar em 01/06/2027 como "o app já adequado à nova NR-10" é argumento de venda direto para o canal de consultores durante todo o período de transição (2026H2–2027).

## 2. Linha do tempo de vigência (dirige o cronograma)

| Data | Evento |
|---|---|
| 01/06/2026 | Publicação no DOU |
| **01/06/2027** | **Vigência da nova NR-10** (Art. 5º) — deadline da Fase 1 |
| 01/06/2028 | Vigência do DDR em edificações não-residenciais para instalações *existentes* (Art. 3º c/ 10.6.4-e) |

Renumeração completa (afeta toda referência no app): qualificação/habilitação/capacitação = **10.8**; treinamento SST = **10.9**; autorização = **10.10**; medidas de proteção individual = **10.11**; desenergização = **10.13**; energizadas/proximidade = **10.14**; documentação/PIE = **10.15**; GIR = **10.16**.

## 3. Mapa de gaps — norma nova × app atual

### 3.1 O que o app já cobre (adequar, não construir)

| Exigência (item novo) | Estado no app |
|---|---|
| Autorização com abrangência identificável (10.10.4) | ✅ `WorkAuthorization.abrangencia` + suspensão por PLH (`qualificacoes.ts:174`) |
| ASO compatível registrado (10.7.5) | ✅ módulo ASOs; bloqueantes `aso_*` em `aptidao.ts` |
| Requisitos de autorização = ASO apto + treinamento aprovado (10.10.2.1) | ✅ `computeAptidao()` — revisar mapeamento fino |
| Relatório de inspeção c/ medidas, plano de ação e cronograma (10.7.11) | ✅ pipeline RTI completo |
| Impedimento de reenergização / bloqueio (10.13) | ✅ módulo LOTO (sob pendência Lovable) |
| PIE com checklist de completude (10.15.6) | ⚠️ existe (`prontuario.ts`), mas com categorias e referências da norma velha |
| Ensaios dielétricos (10.14.4) | ⚠️ cobre luvas + detectores; norma expandiu o universo ensaiável |
| Treinamento por setor (regra recente, commit `9115a44`/`9115e...`) | ✅ fundação certa para as regras de exigência 10.9.4–10.9.9 |
| Documentação digital em português (10.15.1–10.15.2) | ✅ por construção |

### 3.2 Gaps de adequação (o que existe mas mudou)

**G1 — Catálogo de treinamentos (10.9.2 Quadro I + Anexo III).** `TRAINING_TYPES` tem 3 tipos (`qualificacoes.ts:6`); a norma define **6 treinamentos iniciais**:

| Treinamento inicial | CH mín. | No app |
|---|---|---|
| 1. Básico | 40h | ✅ `nr10_basico` |
| 2. Complementar do SEP | 40h | ✅ `sep` |
| 3. Complementar de Média e Alta Tensão – SEC | 16h | ❌ novo |
| 4. Complementar de Área Classificada | 16h | ⚠️ existe (`nr10_areas_classificadas`) sem CH validada |
| 5. Específico e pontual (estrangeiros, ≤30 dias corridos, acompanhamento permanente) | 8h | ❌ novo |
| 6. Específico de compartilhamento de infraestrutura do SEP (telecom em postes) | 40h | ❌ novo |

Regras de exigência por perfil (10.9.4–10.9.9): Básico para todo autorizado *exceto* quem faz o de compartilhamento; Complementar SEP para quem atua no SEP *exceto* compartilhamento; MT/AT-SEC para MT/AT no consumo; Área Classificada para quem atua nelas. Encaixa no mecanismo "treinamento por setor" já existente.

**G2 — Periódico bienal com CH mínima (10.9.10).** "Reciclagem bienal" vira "treinamento periódico bienal de segurança", **mínimo 16h**, conteúdo adequado à realidade da organização. Renomear labels (`BLOQUEANTE_LABELS`, telas) e validar CH.

**G3 — Treinamento eventual (10.9.11).** Hoje é flag manual opcional (`reciclagem_requerida`). A norma dá 4 gatilhos objetivos, e 2 são **automatizáveis com dados que o app já tem**:
- a) retorno de afastamento/inatividade **> 90 dias** → cruzar com `employee.status` (afastado/desligado + data);
- d) **acidente grave ou fatal** → cruzar com módulo de Incidentes (gravidade) e acionar o bloqueante automaticamente;
- b) modificações nas instalações / c) mudança de procedimentos → permanecem flag manual (com motivo).

**G4 — Renumeração de referências normativas.** `PIE_CATEGORY_NORM_REF` cita 10.2.3/10.2.4a-g (agora 10.15.x) — `prontuario.ts:32`; comentários/labels em `aptidao.ts` citam 10.8.4 para autorização (agora 10.10); dossiê e telas que exibem "conforme item X da NR-10". Varredura completa por `10\.\d` em labels/comments.

**G5 — PIE reestruturado (10.15).**
- PIE obrigatório **só** para orgs do SEP ou com instalações MT/AT (10.15.6) → obrigatoriedade do checklist vira condicional a atributo da org.
- Para **todas** as orgs, mesmo sem PIE: projeto elétrico + documentação de inspeções e medições de aterramento (10.15.3).
- Categoria nova obrigatória: **procedimentos de resposta a emergências** (10.15.6.1 — técnicas, equipamentos específicos e sistema de resgate).
- Áreas classificadas ganham lista própria (10.15.5): estudo de classificação de áreas, certificação Ex de equipamentos, inspeções de conformidade — hoje só existe a categoria genérica `certificacao_areas_classificadas`.
- "Esquema unifilar" → o conceito da norma nova é "projeto elétrico atualizado + memorial descritivo" (10.4.7, 10.4.9, 10.4.13).

**G6 — Ensaios dielétricos expandidos (10.14.4).** Universo ensaiável: (a) equipamentos/ferramentas/dispositivos isolantes de MT/AT; (b) **luvas E mangas isolantes** e EPC isolantes de BT; (c) outros por regulamentação. Intervalo = **o menor** entre regulamentação, fabricante e critério do PLH; **default anual** na ausência (10.14.4.1). Hoje o módulo EPI cobre luvas/detectores com regra fixa — generalizar "item ensaiável" com origem do intervalo.

### 3.3 Gaps de construção (não existe no app)

**G7 — Trabalhador-capacitado com plano de aprendizagem e módulos (10.8.3–10.8.4).** Estrutura inteiramente nova:
- Capacitação sob responsabilidade de PLH autorizado, com **plano de aprendizagem** (documento definido no glossário);
- **Módulos com CH mínima:** Fundamentos de eletricidade básica 40h (SEP+SEC); Qualidade/saúde/meio ambiente 16h (SEP+SEC); Fundamentos de SEP 40h (só SEP); Sistema elétrico de consumo 24h (só SEC); Compartilhamento de infraestruturas 24h (só quem compartilha);
- Validade **restrita à organização que capacitou** (10.8.3.3);
- **Convalidação dos módulos "Fundamentos" e "Qualidade" entre organizações**, por PLH, mediante avaliação, em até **2 anos** do módulo original (10.8.4.2).
→ A convalidação cruza orgs: é caso de uso nativamente multi-tenant (consultor PLH convalidando módulo de trabalhador que muda de cliente). Nenhum concorrente de checklist tem o schema para isso.

**G8 — Permissão de Trabalho digital (10.7.2) — o maior módulo novo.** Para serviços não rotineiros (e obrigatória em áreas classificadas, 10.6.6.1.2):
- Conteúdo mínimo (10.7.2.1): requisitos de execução; medidas da análise de risco; **relação de todos os envolvidos e suas autorizações**; data; condições impeditivas;
- Validade limitada à duração da atividade, **restrita ao turno**; revalidável pelo responsável se nada mudou (10.7.2.2);
- **Disponível no local em meio físico ou digital** e, ao final, **encerrada e arquivada de forma rastreável** (10.7.2.3);
- Aprovada por trabalhador autorizado; supervisor indicado por equipe (10.7.6).
→ Desenho de produto: PT emitida no app com **gate de aptidão** (não emite se algum envolvido tem bloqueante — reusa `computeAptidao()`); ciclo emitir → revalidar → encerrar → arquivar com trilha de auditoria (o app já tem `audit`); exibição offline no PWA cobre "disponível no local".

**G9 — Procedimento de trabalho estruturado + análise de risco (10.7.1, 10.7.3).**
- Procedimento: 9 itens mínimos (objetivo, campo de aplicação, referência técnica, orientações administrativas, detalhamento da tarefa, medidas de prevenção, competências/responsabilidades, condições impeditivas, orientações finais) + **aprovação por PLH** (10.7.1.1). `work_instructions` hoje = código/título/validade → evoluir com campos estruturados, fluxo de aprovação e versionamento.
- Análise de risco: 10 itens mínimos (10.7.3) como entidade vinculável a PT e a procedimento.

**G10 — EPI contra arco elétrico (Anexo IV, adaptado da NFPA 70E:2024).**
- Categorias 1–4 com ATPV/EBT mínimos: **4 / 8 / 25 / 40 cal/cm²**;
- Seleção por equipamento × corrente de falha máxima × tempo de eliminação × distância mínima (Quadros I-CA e II-CC); fora das condições dos quadros → **estudo de energia incidente obrigatório** (10.11.2.3; também 10.4.12 e 10.6.5-a);
- Dispensa para quem não se expõe a arco, conforme análise de risco (10.11.2.4).
→ Produto: catálogo de vestimentas AR (categoria, ATPV, CA) no módulo EPIs; associação tarefa/equipamento → categoria exigida; estudo de energia incidente como documento do PIE com validade.

**G11 — Menores (rápidos, alto valor percebido):**
- **Zonas Anexo II:** tabela Rr/Rc por faixa de tensão (<1 kV até <700 kV) como referência/calculadora — útil na análise de risco e no PWA;
- **GIR (10.16):** codificar as 4 condições de embargo/interdição direta no módulo Violações; 2 delas cruzam com dados existentes (serviço por trabalhador sem os requisitos do 10.10 = aptidão; ensaios de isolação não realizados = testes vencidos no módulo EPI);
- **Instrução formal para zona livre (10.14.1.2):** tipo leve de registro de instrução (não é treinamento do Quadro I);
- **DDR (10.6.4 + Art. 3º):** itens de verificação nas 5 situações como template de checklist de inspeção, com o prazo 2028 sinalizado;
- **Vedação de adornos/indumentária (10.7.8):** item de checklist de campo, não feature.

### 3.4 Fora de escopo (não é gestão, é engenharia)

Capítulos 10.4 (segurança em projetos), 10.6 (medidas de proteção coletiva) e 10.12 (etapas de construção/operação) descrevem obrigações de engenharia da instalação. Para o app, eles se materializam apenas como **documentos do PIE** (projeto, memorial descritivo, estudo de energia incidente, estudo de classificação de áreas) e itens de checklist de inspeção — já contemplados em G5/G10/G11.

## 4. Fases de implementação

### Fase 1 — Adequação (obrigatória; deadline 01/06/2027)
Escopo: G1, G2, G3, G4, G5, G6. É evolução do existente, não construção.
Critérios de aceite:
1. Cadastro/import de treinamento aceita os 6 tipos com CH mínima validada (incl. `batchImportQualificacoes`);
2. Bloqueantes de aptidão refletem as regras de exigência 10.9.4–10.9.9 por perfil/setor, com regressão sobre `computeAptidao()` (aptidões atuais não mudam sem motivo normativo);
3. Gatilho automático de treinamento eventual por afastamento >90d e por acidente grave/fatal (incidentes);
4. Zero referências à numeração antiga em labels/telas/dossiê (`PIE_CATEGORY_NORM_REF` na numeração 10.15.x);
5. PIE com categoria "resposta a emergências", lista de áreas classificadas (10.15.5) e obrigatoriedade condicional (SEP/MT-AT);
6. Item ensaiável genérico com intervalo = menor(regulamentação, fabricante, PLH; default anual).
**Transição:** até 01/06/2027 as duas redações coexistem no mercado — decidir na retomada se o app mantém rótulo "norma 2004" vs "norma 2026" por org ou corta direto (ver §7-D3).

### Fase 2 — Módulos novos de maior valor comercial
Escopo: G8 (PT digital com gate de aptidão), G9 (procedimentos + análise de risco), G7 (capacitação/convalidação multi-org).
Ordem sugerida: G8 → G9 → G7 (a PT consome análise de risco e autorizações; a capacitação é a mais nova conceitualmente e merece validação com o consultor antes).

### Fase 3 — Aprofundamento técnico
Escopo: G10 (arco elétrico/Anexo IV + energia incidente), G11 (zonas, GIR, instrução formal, DDR).

## 5. Interação com o Motor 1 (decisão estrutural)

A Fase 1 toca exatamente as regras que a análise estratégica (§5, "regra de ouro") mandou parar de hardcodear: tipos de treinamento, CH, periodicidade, gatilhos, bloqueantes. Dois caminhos na retomada:

- **(a) Se o Horizonte 2 (extração do Motor 1) já estiver em andamento:** a nova NR-10 vira o **primeiro conteúdo versionado** do motor — `compliance_requirements` com vigência por data (norma 2004 até 31/05/2027, norma 2026 depois). A adequação e a extração são o mesmo trabalho; melhor caso.
- **(b) Se a retomada for antes do Motor 1:** implementar F1 hardcoded *mas* com as regras isoladas em funções puras testadas (padrão atual de `aptidao.ts`), sem espalhar — dívida controlada e migrável.

O conceito de **vigência por data** (duas redações da mesma NR coexistindo) é um requisito que a análise NR-13 não capturou — registrar como evolução E3 do modelo do Motor 1.

## 6. Riscos

1. **Perder o deadline regulatório** — 01/06/2027 é fixo; a Fase 1 precisa estar em produção antes, com folga para o consultor operar a transição com os clientes dele. Recomendação: iniciar F1 até ~fev/2027.
2. **Interpretação normativa** — CH e regras de exigência foram extraídas do texto do DOU (conversão de PDF); antes de virar validação dura no produto, conferir contra a versão certificada e com o consultor (que é o especialista de domínio).
3. **Rebatismo de conceitos** — "reciclagem" → "periódico bienal", "capacitado" ganhou definição formal: renomear sem quebrar dados históricos (migração de labels, não de dados).
4. **Anexo IV é adaptação da NFPA 70E** — a seleção por quadros tem condições de contorno rígidas (10.11.2.2); modelar isso como *validação assistida*, nunca como decisão automática do app (responsabilidade é do PLH).

## 7. Decisões em aberto (brainstorm na retomada)

- **D1:** F1 nasce no Motor 1 ou hardcoded migrável? (depende do timing do Horizonte 2 — §5)
- **D2:** PT digital (G8) entra como entitlement próprio, dentro de `gestao_completa`, ou módulo à parte vendável? (tem cara de puxador de venda isolado)
- **D3:** Transição 2026→2027: seletor de redação por org, ou corte único na data? (clientes podem ser auditados pela norma velha até a vigência)
- **D4:** Capacitação/convalidação (G7): o PLH que convalida é o da consultoria (nosso 1º cliente) — o fluxo dele com avaliação específica precisa ser desenhado com ele, não deduzido.
- **D5:** Calculadora de zonas e categoria de EPI (G10/G11): no app principal, no PWA, ou nos dois?
