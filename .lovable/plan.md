## Objetivo

Manter exatamente a estrutura atual em telas médias/grandes (≥ md) e adicionar uma camada de melhorias responsivas para celular (< md), sem alterar comportamento de desktop nem regras de negócio.

## Escopo

Ajustes apenas visuais/responsivos. Nenhuma mudança em RLS, edge functions, banco ou lógica de domínio.

## Mudanças por área

### 1. Topbar (`src/components/site-header.tsx`)
- Adicionar menu hambúrguer (Sheet lateral) visível abaixo de `lg`, contendo os mesmos NavLinks (Dashboard, Base de dados, Carga, Controle de acessos conforme papel) e o bloco do usuário.
- Reduzir o título "RAC - Bloqueio de energias perigosas" no mobile (texto mais curto ou wrap controlado) para evitar quebra feia.
- Pill do usuário continua escondida no mobile; mostrar apenas avatar + botão Sair no header; nome/cargo dentro do menu lateral.

### 2. Page shell (`src/components/page-shell.tsx`)
- Reduzir padding vertical em mobile (`py-4 md:py-8`) e padding horizontal (`px-3 md:px-4`).
- Rodapé com `text-xs md:text-sm` e quebra mais elegante.

### 3. Base de dados (`src/routes/cadeados.index.tsx`)
- Cabeçalho: título e botões empilham no mobile; botões "Exportar Excel" e "Novo Dispositivo" passam a ocupar largura total (`w-full sm:w-auto`).
- Filtros: barra de busca em largura total; selects e o grupo de cores em linha rolável horizontal (`overflow-x-auto`) para não quebrar o layout.
- Tabela: no mobile (< md), ocultar a `Table` e renderizar uma lista de cards (um por dispositivo) com:
  - Linha 1: badge de cor + nº + status
  - Linha 2: dono · setor
  - Linha 3 (apenas para usuários autenticados): matrícula · função · telefone
  - Card inteiro clicável (link para `/cadeados/$codigo`)
- Em ≥ md, mantém exatamente a tabela atual.

### 4. Detalhe do dispositivo (`src/routes/cadeados.$codigo.tsx`)
- Cabeçalho com título e ações (Imprimir, Transferir, Editar, Cancelar, Excluir) empilha no mobile; botões `w-full sm:w-auto` e ícones com rótulos curtos.
- Grid de informações `grid-cols-1 md:grid-cols-2`.
- Histórico: cards já são responsivos; apenas reduzir paddings no mobile.

### 5. Dashboard (`src/routes/dashboard.tsx`)
- Cards de KPI em `grid-cols-2 md:grid-cols-4` (já comum; confirmar e ajustar se preciso).
- Distribuição por cor / setor: barras com largura adaptativa; rótulos com `truncate`.
- Linha do tempo: cards em coluna única no mobile.

### 6. Diálogos (Novo, Editar, Transferir, Cancelar, Imprimir)
- Forçar `DialogContent` com `max-h-[90vh] overflow-y-auto` e `w-[calc(100vw-1rem)] sm:max-w-lg` para evitar diálogo cortado em telas pequenas.
- Botões do rodapé do diálogo empilham no mobile (`flex-col-reverse sm:flex-row`).

### 7. Login e reset de senha
- Garantir `px-4` e `max-w-sm` no card; já tendem a estar OK, apenas conferência.

## Critérios de aceitação

- Em viewports ≥ 768 px o layout é idêntico ao atual (mesma tabela, mesma topbar, mesmos espaçamentos).
- Em viewports < 768 px:
  - Navegação acessível por menu hambúrguer.
  - Lista de dispositivos legível como cards, sem scroll horizontal.
  - Filtros utilizáveis sem cortar conteúdo.
  - Botões de ação não estouram a largura.
  - Diálogos roláveis e com botões alcançáveis.

## Não faz parte deste plano

- Mudanças de paleta, tipografia ou identidade visual.
- Alterações em permissões, RLS ou edge functions.
- Reorganização de rotas ou criação de novas páginas.
