# RTI/Campo Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Liberar o fluxo RTI/Campo para usuários com papel na organização ativa, sem depender de papel global legado.

**Architecture:** Um helper puro centraliza os gates de tenancy do recorte RTI/Campo. As telas passam a derivar `canView`, `canEdit` e `canAdmin` desse helper, mantendo fallback legado para `isStaff`/`isAdmin`.

**Tech Stack:** React, TanStack Router, Supabase/RLS, Vitest, TypeScript.

---

### Task 1: Helper de Gates

**Files:**
- Create: `src/lib/tenancy-gates.ts`
- Test: `src/lib/__tests__/tenancy-gates.test.ts`

- [ ] Escrever teste RED para legado staff, cliente `rti_pwa` member/admin e org sem entitlement.
- [ ] Implementar `getRtiCampoAccess`.
- [ ] Verificar teste GREEN.

### Task 2: RTI

**Files:**
- Modify: `src/routes/rti.index.tsx`
- Modify: `src/routes/rti.importar.tsx`
- Modify: `src/routes/rti.gestao.tsx`
- Modify: `src/routes/rti.evidencias.tsx`
- Modify: `src/routes/rti.plano.tsx`
- Modify: `src/routes/rti.nc.$ncId.tsx`

- [ ] Substituir gates locais por `getRtiCampoAccess`.
- [ ] Manter ações destrutivas em `canAdmin`.
- [ ] Manter edição operacional em `canEdit`.

### Task 3: Campo e Menu

**Files:**
- Modify: `src/routes/campo.index.tsx`
- Modify: `src/routes/campo.inspecao.$id.tsx`
- Modify: `src/routes/campo.ponto.$id.tsx`
- Modify: `src/routes/campo.modos.tsx`
- Modify: `src/components/site-header.tsx`

- [ ] Liberar criação/coleta/composição por `canEdit`.
- [ ] Liberar exclusões/modos destrutivos por `canAdmin`.
- [ ] Mostrar itens RTI operacionais no menu por `canEdit`.

### Task 4: Verificação

- [ ] `vitest src/lib/__tests__/tenancy-gates.test.ts`
- [ ] `eslint .`
- [ ] `vitest run`
- [ ] `vite build`
- [ ] `campo-pwa` build
