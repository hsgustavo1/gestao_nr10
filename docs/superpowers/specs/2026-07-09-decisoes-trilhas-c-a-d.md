# Decisões tomadas pela IA — Trilhas C, A e D (auditoria do founder)

**Data:** 2026-07-09
**Como usar:** cada decisão abaixo é uma pergunta que eu (IA) teria feito no brainstorm,
com as opções que apresentaria e a escolha que fiz em seu nome, com o porquê. **Troque
qualquer escolha** — indico o impacto da troca em cada uma. As specs afetadas:
[C](2026-07-09-trilha-c-wizard-relatorio-design.md) ·
[A](2026-07-09-trilha-a-curadoria-padroes-design.md) ·
[D](2026-07-09-trilha-d-experiencia-cliente-design.md).

---

## Trilha C — Wizard de relatório

### D-C1 · Qual relatório atacar primeiro?
- (a) **RTI (laudo de inspeção elétrica)** ← **escolhida**
- (b) Dossiê de fiscalização multi-seção
- (c) Motor genérico configurável por tipo de relatório
**Porquê:** o RTI é o fluxo validado em campo, o entregável que o consultor vende, e o
gargalo real de horas (dor 2.2). O dossiê já existe (window.print); o genérico é o Motor 3
completo — construí-lo antes do 2º tipo real violaria a "regra de ouro" da análise
multi-NR (não generalizar no escuro).
**Se trocar:** (b) desloca a trilha para evolução do `/relatorio/dossie`; (c) adia valor
em meses.

### D-C2 · Tecnologia de geração do PDF?
- (a) Puppeteer/Chromium headless (HTML→PDF) em função serverless
- (b) **`@react-pdf/renderer` server-side na rota do app (Vercel Node)** ← **escolhida**
- (c) `pdf-lib` programático puro
- (d) Continuar com print CSS caprichado (window.print)
**Porquê:** (b) é declarativo (layout em componentes React, linguagem que o projeto já
fala), determinístico e leve no Vercel. (a) dá fidelidade HTML mas cold start/peso de
Chromium em serverless é dor conhecida. (c) é ótimo para *manipular* PDF (já usamos no
recorte de certificados), péssimo para *compor* documento longo. (d) nunca entrega capa/
paginação/controle fino — é o status quo que queremos matar.
**Se trocar para (a):** ganha fidelidade CSS, paga infra (função dedicada, ~50MB+, cold
start); faria sentido se o template evoluir para HTML muito rico.

### D-C2b · (emenda na fase de implementação, 2026-07-09) Renderização client-side
- (a) Server function devolvendo o PDF (como a spec dizia)
- (b) **Mesma lib (@react-pdf/renderer), renderizada no NAVEGADOR: preview via
  PDFViewer e emissão via pdf().toBlob(), upload com a sessão do usuário** ← **escolhida**
**Porquê:** preview e PDF final ficam idênticos por construção; evita transportar PDF
grande (30 NCs × fotos) por server function, timeout serverless e service key — o upload
usa o RLS do próprio usuário. A biblioteca decidida em D-C2 não muda.
**Se trocar para (a):** mover `gerarPdfBlob` para uma rota server e devolver base64;
custo: payload grande + credencial de service no server.

### D-C3 · Papel da IA no relatório?
- (a) Sem IA — só templates e dados
- (b) **IA sugere parecer/resumo executivo; humano sempre revisa e edita** ← **escolhida**
- (c) IA redige o relatório inteiro automaticamente
**Porquê:** (b) usa o Groq já integrado (padrão certificados), custa centavos e ataca a
parte mais lenta da escrita (texto corrido), mantendo a responsabilidade técnica (ART) no
humano — inegociável num laudo. (c) é risco jurídico e de qualidade.
**Se trocar para (a):** wizard continua de pé; só remove a etapa de sugestão.

### D-C4 · White-label: quanto agora?
- (a) Nada — PDF com marca Conforme
- (b) **Identidade mínima do consultor no PDF (logo, cores, razão social, registro)** ← **escolhida**
- (c) White-label completo (app + PDF + domínio)
**Porquê:** o PDF é a peça que o consultor entrega com o nome DELE — sem (b) o wow não
acontece. (c) é trilha própria futura (já no ROADMAP como "white-label do consultor").
**Se trocar para (a):** economiza os campos de branding, enfraquece o pitch de canal.

### D-C5 · Compressão de foto 1024px basta para o laudo? (gap 8 do brainstorm)
- (a) Aumentar padrão global de compressão
- (b) **Manter 1024px e decidir com evidência: validar zoom no 1º PDF real; se faltar,
  criar "foto de detalhe" opcional a 2048px no PWA** ← **escolhida**
- (c) Guardar original full-res sempre
**Porquê:** storage é custo real (decisão consciente de 2026-07-02); mudar sem evidência
é regressão de custo. A opção (b) cria o teste mais barato possível.
**Se trocar para (c):** rever custos de Storage antes.

### D-C7 · (emenda na fase de validação real, 2026-07-09) Escala real quebra o render client-side
**Contexto:** o 1º relatório real (RTI 2025) tem **730 NCs e 1021 fotos (289 MB)** —
não é exceção, é o porte típico. O render client-side de D-C2b (PDFViewer ao vivo +
`pdf().toBlob()`) trava o navegador nesse volume, e embutir as fotos em resolução cheia
geraria um PDF de ~300 MB (inviável de gerar e de enviar). **D-C2b fica superada para o
RTI** (valia para dezenas de NCs; não escala para centenas).

Decisões (escolha do founder ao vivo):
- **Onde renderiza:** server function (`createServerFn`, runtime Node/Vercel) com
  `@react-pdf/renderer` `renderToBuffer` — volta à intenção original da spec (D-C2) que
  D-C2b havia invertido. Sobe o PDF no Storage com o **token do próprio usuário**
  (RLS preservada, sem service key — a garantia de D-C2b se mantém, só muda o runtime).
- **Prévia:** sob demanda — botão "Gerar prévia" chama o servidor, que renderiza o PDF
  real (reduzido) e devolve a URL; o navegador exibe num `<iframe>`. Não é mais reativa a
  cada tecla (impossível nesse porte).
- **Fotos:** reduzidas para ~600px antes de embutir (aparecem a ~2 cm no laudo — a
  resolução cheia é desperdício). PDF-alvo ~35-45 MB com as 1021 fotos. Redução via
  endpoint de transformação de imagem do Supabase Storage (`render/image`), sem dep nativa.
- **Fonte no servidor:** Hanken Grotesk registrada a partir dos bytes embarcados
  (o `?url` do Vite não resolve no runtime do servidor) — preserva o design de marca.

**Gate obrigatório (EXECUTADO):** teste em escala real (730 NCs + 1021 fotos reais
reduzidas + fonte real) medindo tempo/tamanho/memória. Achado crítico: o documento tinha
**todas as NCs numa única `<Page>`**, cujo layout no @react-pdf é **superlinear** — render
de ~102 s (RSS 813 MB). **Fatiando as NCs em páginas explícitas (`NC_POR_PAGINA=14`)** o
render caiu para **7,6 s** (RSS 355 MB). Com prefetch **paralelo** das fotos reduzidas
(→ data URIs, o render fica CPU-only) o total ficou em **~27 s no pior caso (frio)** —
cabe no serverless síncrono. Portanto: **síncrono é viável, não precisa de job assíncrono
nem de Chromium.** Transform endpoint confirmado habilitado (179 KB → 29 KB a 600px q55).
- **Detalhe de implementação obrigatório:** a server function faz **prefetch paralelo**
  das fotos reduzidas e passa **data URIs** ao Document (deixar o @react-pdf buscar as URLs
  em série custava ~4× mais). E o Document renderiza as NCs **fatiadas em páginas**.
- **Vercel `maxDuration`:** o default (10 s Hobby / 15 s Pro) é menor que os ~27 s — é
  **obrigatório** configurar `maxDuration` (60 s) para a função no deploy. Local (dev +
  teste de escala) não tem timeout, então valida em localhost; confirmar no preview staging.
**Se um relatório crescer muito (ex.: 1500+ NCs):** subir `maxDuration` (300 s no Pro) ou,
aí sim, migrar para job assíncrono. Tamanho do PDF em produção (1021 fotos distintas):
~20-30 MB (o 0,7 MB do teste é artefato de imagem idêntica deduplicada).

## Trilha A — Curadoria de padrões

### D-A1 · O que curar primeiro?
- (a) **Estruturas (árvores setor→ativo→componente) por segmento industrial** ← **escolhida**
- (b) Modos de falha
- (c) Templates completos de inspeção (árvore + checklist + campos)
**Porquê:** (a) é exatamente o exemplo que você deu (papel e celulose) e não existe hoje;
(b) já tem mecanismo de publicação por org (2026-06-20); (c) é o Motor 2 (Horizonte 2).
**Se trocar:** (c) antecipa o Motor 2 — só com a 2ª disciplina de inspeção contratada.

### D-A2 · Como padrões emergem: fila de revisão, automático ou manual?
- (a) Todo cadastro entra numa fila para o founder aprovar/rejeitar
- (b) Agregação automática (clustering) propõe candidatos
- (c) **Painel de curadoria: founder navega estruturas existentes e "promove a modelo"
  quando quiser, com edição obrigatória** ← **escolhida**
**Porquê:** (a) é o gargalo apontado no brainstorm (fila de um humano só, e cria a falsa
expectativa de que tudo será revisto); (b) é overengineering com 1 consultor ativo —
registrada como fase futura; (c) mantém o founder no controle sem criar fila.
**Se trocar para (b):** precisa de volume (3+ consultores) para o clustering ter sinal.

### D-A3 · Anonimização na publicação?
- (a) Publicar como está, confiando no bom senso
- (b) **Editor de generalização obrigatório na promoção + modelo publicado sem vínculo
  visível com o cliente de origem** ← **escolhida**
- (c) Anonimização automática por IA
**Porquê:** estrutura fabril de um cliente pode ser confidencial (nome de linha/produto);
(b) força o olhar humano que é o próprio papel de curador, e custa um passo de UI. (c)
pode entrar depois como assistência dentro do editor.
**Se trocar para (a):** risco LGPD/contratual — não recomendo.

### D-A4 · Segmento: enum fechado ou texto livre?
- (a) Enum curado (lista fixa de segmentos)
- (b) **Texto livre com autocomplete dos valores já usados** ← **escolhida**
**Porquê:** YAGNI — não sabemos ainda a taxonomia certa de segmentos; o autocomplete
converge naturalmente e o founder pode normalizar na curadoria.
**Se trocar para (a):** definir a lista inicial (sugiro CNAE simplificado) e migration.

### D-A5 · Aplicar modelo: cópia ou referência viva?
- (a) **Cópia (o consultor edita livre, modelo não muda)** ← **escolhida**
- (b) Referência com atualização propagada
**Porquê:** campo sempre diverge do padrão (fluxo 3.2: "informações de campo
surpreendem"); referência viva criaria conflito de versão sem benefício claro.

### D-A6 · (emenda na fase de implementação, 2026-07-09) Formato do editor de generalização
- (a) Tree-editor completo (drag-and-drop, adicionar/mover nós)
- (b) **Lista indentada: um campo de texto + botão remover por nó; sem drag e sem
  adicionar nó** ← **escolhida**
**Porquê:** o trabalho real da anonimização é RENOMEAR e REMOVER — a lista indentada
cobre 100% disso com fração do custo. Quem precisar de nó novo cria na inspeção de
origem antes de promover (ou edita a inspeção aplicada depois — aplicar é cópia).
**Se trocar para (a):** evoluir `estrutura-modelo-editor.tsx` (as funções puras
`removerNo`/`renomearNo` já são imutáveis e prontas para operações extras).

### D-A7 · (emenda na fase de implementação) Entrada no menu
- **Link "Padrões" próprio na sidebar (só platform admin), acima de Configurações** —
  a sidebar não tem grupo de configurações com sub-itens; criar grupo só para isso
  seria mexer mais no god node `AppSidebar` do que o necessário.

## Trilha D — Experiência do cliente

### D-D1 · Primeira fatia do "app com vida"?
- (a) **Home do cliente com KPIs + pendências acionáveis (D1), depois digest de e-mail
  (D2), depois importadores de legado (D3)** ← **escolhida (ordem)**
- (b) Começar pelos importadores (onboarding primeiro)
- (c) Começar por notificações push
**Porquê:** D1 retoma um item já adiado do ROADMAP e é só composição de queries
existentes (barato, visível). D2 é o que faz o app "ir até" o cliente — mas precisa da
D1 pronta (mesma fonte de pendências). D3 é a maior alavanca de venda, porém cada
importador é um projeto pequeno — melhor depois do wizard C provar o padrão de valor.
**Se trocar para (b):** faz sentido se houver cliente novo grande entrando (onboarding
vira urgência).

### D-D2 · Canal de alerta?
- (a) **E-mail (digest semanal, provedor Resend)** ← **escolhida**
- (b) WhatsApp (API Business)
- (c) Push notification (PWA)
**Porquê:** e-mail é o canal que o gestor SESMT/industrial já vive, sem burocracia de
template da Meta nem os limites de push em iOS; Resend é trivial no Vercel. WhatsApp é
candidato forte para a fase 2 (BR ❤ WhatsApp) — decisão consciente de adiar.
**Se trocar para (b):** somar custo/burocracia da API oficial e templates aprovados.

### D-D3 · Frequência e conteúdo do digest?
- (a) Diário
- (b) **Semanal, só se houver pendência, espelhando os cards da home** ← **escolhida**
- (c) Mensal
**Porquê:** diário vira spam e treina o cliente a ignorar; mensal deixa vencimento de
30d passar. Semanal com supressão de e-mail vazio é o equilíbrio.

### D-D4 · Importadores de legado: quais entidades?
- (a) **Funcionários, ASOs, treinamentos históricos, EPIs — nesta ordem, um shell de UI
  comum** ← **escolhida**
- (b) Só certificados (já existe) + funcionários
**Porquê:** a ordem segue o caminho crítico do prontuário (pessoa → aptidão → EPI). O
shell comum (dropzone → conferência → confirmar) é o padrão já provado no importador de
certificados.

### D-D5 · (emenda na fase de implementação, 2026-07-09) Re-escopo do D3
- (a) Construir os 4 importadores agora
- (b) **Reconhecer o que JÁ existe (funcionários/treinamentos por planilha na rota de
  carga; certificados por IA) e registrar o delta — importador de ASOs por IA (~900
  linhas no padrão certificados) e EPIs por planilha — como próxima fatia** ← **escolhida**
**Porquê:** a própria spec D posicionava importadores como "depois do wizard C provar o
padrão"; clonar o fluxo Groq para ASO (dado de saúde, LGPD) no fim de uma sessão-maratona
troca qualidade por checkbox. O delta está no ROADMAP com o caminho pronto.
**Se trocar:** clonar `admin.certificados.importar.tsx` trocando o prompt para ASO.

### D-D6 · (implementação) Digest não compartilha código com buildVencimentos
O digest roda em Deno (edge function) e **espelha as regras** de `buildVencimentos`
(validade 2 anos, ITs por validity_months, EPIs por intervalo, ASO por validity_date) com
consultas escopadas por org — paridade de regra, não de código; a pura do app é a testada.

### D-D7 · (implementação) Opt-out do digest
`profiles.digest_optout` (default false = admins da org cliente recebem). v1 sem UI de
opt-out — rodapé instrui a pedir ao consultor. Anti-spam real é o "só envia se houver
pendência" + idempotência semanal (`digest_log`).

### D-D8 · (implementação) Cópia de supervisão
`ALERT_EMAILS` (founder) entra como BCC de todo digest e como fallback quando a org não
tem admin com e-mail — visibilidade do dono da plataforma sobre o que os clientes recebem.

## Transversal

### D-T1 · Ordem geral das trilhas?
- **Mantida a sua: B (feito) → validação em campo → C → A → D.**
Observação: D1 (home do cliente) é pequena e independente — se surgir janela curta entre
C e A, ela pode adiantar sem conflito.

### D-T2 · Regra de merge planejamento↔campo (gap 7)?
- **"Campo vence e edições são aditivas"** — campo nunca deleta o que o PC criou; marca
  "não encontrado" e acrescenta. Registrada na spec A §4; implementação fica para quando
  a edição de estrutura no PC (fluxo 3.1) existir de fato.
