# Fixes: Bug Foto + Navegação Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o bug que fecha o dialog ao capturar foto no mobile e reformular o menu mobile do app principal em grupos colapsáveis.

**Architecture:** Duas mudanças cirúrgicas em arquivos existentes. Nenhum novo arquivo. Nenhuma alteração de lógica de negócio.

**Tech Stack:** React 19, TanStack Router, Radix UI (Dialog, Collapsible), Tailwind CSS v4, shadcn/ui

---

## Mapa de arquivos

| Arquivo | Tipo | Mudança |
|---|---|---|
| `src/routes/campo.inspecao.$id.tsx` | Modificar | `onInteractOutside` no Dialog + separar `multiple` da câmera |
| `src/components/site-header.tsx` | Modificar | Substituir lista plana por grupos `Collapsible` no Sheet mobile |

---

## Task 1: Corrigir bug de fechamento do dialog ao capturar foto

**Arquivo:** `src/routes/campo.inspecao.$id.tsx`

**Problema:** Em mobile, quando `<input capture="environment">` abre a câmera nativa, o SO dispara um evento `pointerdown` ao retornar ao browser. O Radix Dialog interpreta isso como "clique fora" e chama `onOpenChange(false)`, fechando o dialog e descartando a foto capturada.

**Files:**
- Modify: `src/routes/campo.inspecao.$id.tsx` (função `CapturaPontoSheet`, linha ~427)

- [ ] **Step 1: Localizar o DialogContent do CapturaPontoSheet**

Abrir `src/routes/campo.inspecao.$id.tsx`. Localizar a função `CapturaPontoSheet` (linha ~339). Dentro dela, o `<DialogContent>` está na linha ~428:

```tsx
<DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] sm:max-w-lg flex flex-col p-0 gap-0">
```

- [ ] **Step 2: Adicionar onInteractOutside ao DialogContent**

Substituir a abertura do `<DialogContent>` para:

```tsx
<DialogContent
  className="max-h-[92vh] w-[calc(100vw-1rem)] sm:max-w-lg flex flex-col p-0 gap-0"
  onInteractOutside={(e) => e.preventDefault()}
>
```

Isso impede que eventos externos (como o `pointerdown` disparado pelo SO ao retornar da câmera) fechem o dialog. O usuário só fecha via botão "Cancelar" ou após salvar com sucesso.

- [ ] **Step 3: Localizar o input de câmera dentro de CapturaPontoSheet**

Na linha ~441, dentro do bloco `{/* 1) Fotos */}`, localizar:

```tsx
<input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => addFotos(e.target.files)} />
```

- [ ] **Step 4: Remover o atributo `multiple` do input de câmera**

Substituir por:

```tsx
<input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => addFotos(e.target.files)} />
```

O input de galeria (linha seguinte) mantém `multiple` — apenas o input de câmera muda. No iOS, `capture="environment"` + `multiple` faz o browser abrir a galeria em vez da câmera, ou fecha imediatamente. Câmera captura uma foto por vez; o usuário pode tocar "Tirar foto" mais de uma vez para acumular.

- [ ] **Step 5: Verificar que os dois inputs estão corretos**

Após a edição, os dois inputs na `CapturaPontoSheet` devem estar assim:

```tsx
{/* câmera nativa — sem multiple (iOS não suporta capture+multiple) */}
<input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => addFotos(e.target.files)} />
{/* galeria — com multiple */}
<input ref={galeriaRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => addFotos(e.target.files)} />
```

- [ ] **Step 6: Testar manualmente no mobile**

1. Abrir o app no celular (Chrome Android ou Safari iOS)
2. Navegar até `/campo` → abrir uma inspeção em andamento → entrar em um setor → tocar "Novo ponto de coleta aqui"
3. Tocar "Tirar foto" → câmera abre → capturar foto → voltar ao app
4. **Resultado esperado:** dialog permanece aberto com a preview da foto; não navega para a página anterior
5. Tocar "Tirar foto" novamente → capturar segunda foto → verificar que ambas aparecem no grid
6. Selecionar modos de falha → tocar "Salvar" → verificar que o ponto é criado com sucesso

- [ ] **Step 7: Commit**

```bash
git add src/routes/campo.inspecao.$id.tsx
git commit -m "fix: dialog de captura não fecha ao retornar da câmera nativa no mobile"
```

---

## Task 2: Navegação mobile hierárquica com grupos colapsáveis

**Arquivo:** `src/components/site-header.tsx`

**Problema:** O Sheet mobile lista ~30 links em sequência plana. O usuário precisa rolar toda a lista para encontrar a rota desejada.

**Solução:** Substituir a lista plana por `Collapsible` do Radix (já disponível via `@/components/ui/collapsible`). Grupos espelham os dropdowns do desktop. O grupo da rota ativa inicia expandido.

**Files:**
- Modify: `src/components/site-header.tsx`

- [ ] **Step 1: Adicionar imports necessários**

No topo de `src/components/site-header.tsx`, os imports atuais incluem:
```tsx
import { Link, useNavigate } from "@tanstack/react-router";
import { LogIn, LogOut, Eye, Menu, ChevronDown, BellRing } from "lucide-react";
import { useState } from "react";
```

Adicionar `useRouterState` ao import do tanstack e `Collapsible*` ao import do ui:

```tsx
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogIn, LogOut, Eye, Menu, ChevronDown, BellRing } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
```

- [ ] **Step 2: Adicionar componente MobileNavGroup após a função MobileNavLink existente**

Localizar a função `MobileNavLink` (linha ~198). Logo após ela, adicionar:

```tsx
function MobileNavGroup({
  label,
  prefixes,
  children,
}: {
  label: string;
  prefixes: string[];
  children: React.ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = prefixes.some((p) => pathname.startsWith(p));
  const [open, setOpen] = useState(isActive);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10 transition-colors">
        <span>{label}</span>
        <ChevronDown
          className={`h-4 w-4 text-white/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-3 pl-3 border-l border-white/10 flex flex-col gap-0.5 py-1">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

- [ ] **Step 3: Substituir o bloco <nav> dentro do Sheet no SiteHeader**

Localizar o bloco `<nav className="flex flex-col p-2">` dentro do `SheetContent` (linha ~72). Substituir **todo** o conteúdo do `<nav>` pelo novo layout com grupos:

```tsx
<nav className="flex flex-col p-2 gap-0.5">
  <MobileNavGroup
    label="RAC — Bloqueio"
    prefixes={["/dashboard", "/cadeados", "/violacoes", "/admin/reports", "/admin/carga", "/admin/certificados", "/admin/usuarios"]}
  >
    <MobileNavLink to="/dashboard" onNav={() => setMenuOpen(false)}>Dashboard</MobileNavLink>
    <MobileNavLink to="/cadeados" onNav={() => setMenuOpen(false)}>Base de dados</MobileNavLink>
    <MobileNavLink to="/violacoes" onNav={() => setMenuOpen(false)}>Violações</MobileNavLink>
    {isAdmin && <MobileNavLink to="/admin/reports" onNav={() => setMenuOpen(false)}>Inconsistências</MobileNavLink>}
    {isAdmin && <MobileNavLink to="/admin/carga" onNav={() => setMenuOpen(false)}>Carga</MobileNavLink>}
    {isAdmin && <MobileNavLink to="/admin/certificados/importar" onNav={() => setMenuOpen(false)}>Importar Certificados</MobileNavLink>}
    {isAdmin && <MobileNavLink to="/admin/usuarios" onNav={() => setMenuOpen(false)}>Controle de acessos</MobileNavLink>}
  </MobileNavGroup>

  <MobileNavGroup
    label="NR-10"
    prefixes={["/nr10", "/relatorio", "/vencimentos", "/incidentes", "/admin/auditoria"]}
  >
    <MobileNavLink to="/nr10" onNav={() => setMenuOpen(false)}>Prontuário (PIE)</MobileNavLink>
    <MobileNavLink to="/relatorio" onNav={() => setMenuOpen(false)}>Relatório de Conformidade</MobileNavLink>
    <MobileNavLink to="/relatorio/dossie" onNav={() => setMenuOpen(false)}>Dossiê de Fiscalização</MobileNavLink>
    <MobileNavLink to="/vencimentos" onNav={() => setMenuOpen(false)}>Central de Vencimentos</MobileNavLink>
    <MobileNavLink to="/incidentes" onNav={() => setMenuOpen(false)}>Incidentes Elétricos</MobileNavLink>
    {isAdmin && <MobileNavLink to="/admin/auditoria" onNav={() => setMenuOpen(false)}>Trilha de Auditoria</MobileNavLink>}
  </MobileNavGroup>

  <MobileNavGroup
    label="RTI"
    prefixes={["/rti", "/campo"]}
  >
    <MobileNavLink to="/rti" onNav={() => setMenuOpen(false)}>Dashboard</MobileNavLink>
    <MobileNavLink to="/rti/plano" onNav={() => setMenuOpen(false)}>Plano de Ação</MobileNavLink>
    <MobileNavLink to="/rti/custos" onNav={() => setMenuOpen(false)}>Análise de Custos</MobileNavLink>
    <MobileNavLink to="/campo" onNav={() => setMenuOpen(false)}>Coleta em Campo</MobileNavLink>
    <MobileNavLink to="/campo/modos" onNav={() => setMenuOpen(false)}>Modos de falha</MobileNavLink>
    {isStaff && <MobileNavLink to="/rti/importar" onNav={() => setMenuOpen(false)}>Importar planilha</MobileNavLink>}
    {isStaff && <MobileNavLink to="/rti/evidencias" onNav={() => setMenuOpen(false)}>Importar evidências</MobileNavLink>}
  </MobileNavGroup>

  <MobileNavGroup
    label="Inspeções"
    prefixes={["/termografias", "/cercon", "/spda"]}
  >
    <MobileNavLink to="/termografias" onNav={() => setMenuOpen(false)}>Termografias</MobileNavLink>
    <MobileNavLink to="/cercon" onNav={() => setMenuOpen(false)}>Cercon</MobileNavLink>
    <MobileNavLink to="/spda" onNav={() => setMenuOpen(false)}>SPDA</MobileNavLink>
  </MobileNavGroup>

  <MobileNavGroup
    label="Pessoas"
    prefixes={["/qualificacoes", "/admin/qualificacoes"]}
  >
    <MobileNavLink to="/qualificacoes" onNav={() => setMenuOpen(false)}>Dashboard</MobileNavLink>
    <MobileNavLink to="/qualificacoes/colaboradores" onNav={() => setMenuOpen(false)}>Qualificação</MobileNavLink>
    <MobileNavLink to="/qualificacoes/nr10" onNav={() => setMenuOpen(false)}>Capacitações NR-10</MobileNavLink>
    <MobileNavLink to="/qualificacoes/instrucoes" onNav={() => setMenuOpen(false)}>ITs</MobileNavLink>
    <MobileNavLink to="/qualificacoes/autorizacoes" onNav={() => setMenuOpen(false)}>Autorizações</MobileNavLink>
    <MobileNavLink to="/qualificacoes/asos" onNav={() => setMenuOpen(false)}>ASOs</MobileNavLink>
    <MobileNavLink to="/qualificacoes/plh" onNav={() => setMenuOpen(false)}>PLH</MobileNavLink>
    {isAdmin && <MobileNavLink to="/admin/qualificacoes/carga" onNav={() => setMenuOpen(false)}>Importar xlsx</MobileNavLink>}
  </MobileNavGroup>

  <MobileNavLink to="/epis" onNav={() => setMenuOpen(false)}>EPIs e EPCs</MobileNavLink>
</nav>
```

- [ ] **Step 4: Verificar que `isAdmin` e `isStaff` estão disponíveis no escopo do Sheet**

O Sheet está dentro da função `SiteHeader`, que já destrói `{ user, isAdmin, isStaff, isViewer, signOut, exitViewerMode }` do `useAuth()` na linha ~28. Confirmar que o novo bloco `<nav>` está dentro do `SheetContent` (que está dentro de `SiteHeader`) — as variáveis já estão no escopo. Nenhuma mudança extra necessária.

- [ ] **Step 5: Verificar build sem erros TypeScript**

```bash
cd "C:/Users/hsgus/OneDrive/Claude Code/gestao_nr10"
npm run build
```

Resultado esperado: build concluído sem erros. Se houver erro de tipo no `useRouterState`, verificar que `@tanstack/react-router` exporta esse hook (versão ≥ 1.x exporta).

- [ ] **Step 6: Testar manualmente no browser**

1. Rodar `npm run dev` e abrir o app em modo mobile (DevTools → responsive 375px)
2. Tocar no ícone de hambúrguer — Sheet abre
3. Verificar: 5 grupos colapsáveis + 1 link direto (EPIs)
4. Todos os grupos começam fechados se a rota atual não pertence a eles
5. Navegar para `/campo` → fechar e reabrir o Sheet → grupo "RTI" deve estar aberto
6. Tocar em um grupo fechado → expande; tocar novamente → colapsa
7. Tocar em um link → navega para a rota → Sheet fecha

- [ ] **Step 7: Commit**

```bash
git add src/components/site-header.tsx
git commit -m "feat: menu mobile com grupos colapsáveis hierárquicos"
```
