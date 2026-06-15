# Graph Report - .  (2026-06-14)

## ⚠️ Status atual (overlay manual — 2026-06-15)

> Esta seção foi adicionada à mão para refletir o estado do projeto sem re-rodar a
> extração do grafo. Os nós/arestas abaixo (Summary, Communities, God Nodes) ainda
> refletem o snapshot de 2026-06-14 e **não** incluem as mudanças desta data — rode
> um `/graphify` completo quando quiser regenerar os dados do grafo.
> **Fonte canônica do estado atual: [`docs/superpowers/plans/ROADMAP.md`](../../docs/superpowers/plans/ROADMAP.md).**

**O projeto virou multi-tenant (SaaS).** Principais adições desde o snapshot:

- **Fundação multi-tenancy** (`supabase/migrations/20260614000000…`): tabelas novas
  `organizations`, `org_memberships`, `org_entitlements`, `platform_admins`,
  `org_public_tokens`; funções de acesso `SECURITY DEFINER` `can_access_org`,
  `org_role_at_least`, `is_platform_admin`, `has_entitlement`; coluna `org_id` em
  TODAS as tabelas de domínio + RLS reescrita de `USING(true)` para escopo por org.
  → novo seam de autorização (antes era só `has_role`/`is_staff`).
- **Cascata de org_id** (`…20260614010000`, Fase 1.6): trigger `fn_inherit_org_id`
  faz o filho herdar `org_id` do pai (invariante: filho nunca em org diferente).
  `org_id` propagado em `@gestao/campo-core` e no sync do PWA; path de Storage
  `{org_id}/…`; `comporRti()` carimba a org na raiz `rti_reports`.
- **MVP consultor** (`…20260614020000`, Fase 2): orgs Consultoria/Cliente A/Cliente B;
  edge function `admin-users` escopada por org; **isolamento RLS VALIDADO** por teste.
- **Contexto de org no frontend**: `src/lib/auth-context.tsx` estendido (`orgs`,
  `currentOrg`, `entitlements`, `isPlatformAdmin`); seletor de org em `site-header.tsx`.
- **Higiene de lint/CI**: repo reformatado com prettier + `no-explicit-any`→warn +
  `**/dist/**` ignorado no eslint → CI verde (0 erros, 85 testes, build app+PWA).

Comunidades novas que um re-graph deve criar: *Multi-Tenancy Foundation* (orgs/RLS/
funções de acesso), *Org Context & Entitlements* (auth-context + guards). God node
provável novo: `can_access_org()` (base de toda a RLS por org).

## Corpus Check
- 238 files · ~175,321 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1834 nodes · 4419 edges · 127 communities (incremental update: +213 nós, +164 arestas)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 122 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_LOTO Padlock Management|LOTO Padlock Management]]
- [[_COMMUNITY_RTI NC Tracking & Costs|RTI NC Tracking & Costs]]
- [[_COMMUNITY_Campo PWA Inspection Tree|Campo PWA Inspection Tree]]
- [[_COMMUNITY_Route Tree Registry|Route Tree Registry]]
- [[_COMMUNITY_UI Sidebar & Shell|UI Sidebar & Shell]]
- [[_COMMUNITY_Auth Guard & Dialogs|Auth Guard & Dialogs]]
- [[_COMMUNITY_Compliance Aggregation|Compliance Aggregation]]
- [[_COMMUNITY_EPIPPE Management|EPI/PPE Management]]
- [[_COMMUNITY_NR-10 Training & Qualifications|NR-10 Training & Qualifications]]
- [[_COMMUNITY_Incident & Compliance Report|Incident & Compliance Report]]
- [[_COMMUNITY_Employee & Authorization Forms|Employee & Authorization Forms]]
- [[_COMMUNITY_Campo→RTI Pipeline|Campo→RTI Pipeline]]
- [[_COMMUNITY_RTI Import & Evidence|RTI Import & Evidence]]
- [[_COMMUNITY_Aptidão NR-10 §10.8 Rules|Aptidão NR-10 §10.8 Rules]]
- [[_COMMUNITY_Auth Context & Route Utils|Auth Context & Route Utils]]
- [[_COMMUNITY_Campo PWA Dependencies|Campo PWA Dependencies]]
- [[_COMMUNITY_Generic Inspections (SPDATermografia)|Generic Inspections (SPDA/Termografia)]]
- [[_COMMUNITY_Route Components|Route Components]]
- [[_COMMUNITY_PWA Icons & Archive|PWA Icons & Archive]]
- [[_COMMUNITY_ASO & Aptidão Concepts|ASO & Aptidão Concepts]]
- [[_COMMUNITY_Module Group 20|Module Group 20]]
- [[_COMMUNITY_Module Group 21|Module Group 21]]
- [[_COMMUNITY_Module Group 22|Module Group 22]]
- [[_COMMUNITY_Module Group 23|Module Group 23]]
- [[_COMMUNITY_Module Group 24|Module Group 24]]
- [[_COMMUNITY_Module Group 25|Module Group 25]]
- [[_COMMUNITY_Module Group 26|Module Group 26]]
- [[_COMMUNITY_Module Group 27|Module Group 27]]
- [[_COMMUNITY_Module Group 28|Module Group 28]]
- [[_COMMUNITY_Module Group 29|Module Group 29]]
- [[_COMMUNITY_Module Group 30|Module Group 30]]
- [[_COMMUNITY_Module Group 31|Module Group 31]]
- [[_COMMUNITY_Module Group 32|Module Group 32]]
- [[_COMMUNITY_Module Group 33|Module Group 33]]
- [[_COMMUNITY_Module Group 34|Module Group 34]]
- [[_COMMUNITY_Module Group 35|Module Group 35]]
- [[_COMMUNITY_Module Group 36|Module Group 36]]
- [[_COMMUNITY_Module Group 37|Module Group 37]]
- [[_COMMUNITY_Module Group 38|Module Group 38]]
- [[_COMMUNITY_Module Group 39|Module Group 39]]
- [[_COMMUNITY_Module Group 40|Module Group 40]]
- [[_COMMUNITY_Module Group 41|Module Group 41]]
- [[_COMMUNITY_Module Group 42|Module Group 42]]
- [[_COMMUNITY_Module Group 43|Module Group 43]]
- [[_COMMUNITY_Module Group 44|Module Group 44]]
- [[_COMMUNITY_Module Group 45|Module Group 45]]
- [[_COMMUNITY_Module Group 46|Module Group 46]]
- [[_COMMUNITY_Module Group 47|Module Group 47]]
- [[_COMMUNITY_Module Group 48|Module Group 48]]
- [[_COMMUNITY_Module Group 49|Module Group 49]]
- [[_COMMUNITY_Module Group 50|Module Group 50]]
- [[_COMMUNITY_Module Group 51|Module Group 51]]
- [[_COMMUNITY_Module Group 52|Module Group 52]]
- [[_COMMUNITY_Module Group 53|Module Group 53]]
- [[_COMMUNITY_Module Group 54|Module Group 54]]
- [[_COMMUNITY_Module Group 55|Module Group 55]]
- [[_COMMUNITY_Module Group 56|Module Group 56]]
- [[_COMMUNITY_Module Group 57|Module Group 57]]
- [[_COMMUNITY_Module Group 58|Module Group 58]]
- [[_COMMUNITY_Module Group 59|Module Group 59]]
- [[_COMMUNITY_Module Group 60|Module Group 60]]
- [[_COMMUNITY_Module Group 61|Module Group 61]]
- [[_COMMUNITY_Module Group 62|Module Group 62]]
- [[_COMMUNITY_Module Group 63|Module Group 63]]
- [[_COMMUNITY_Module Group 64|Module Group 64]]
- [[_COMMUNITY_Module Group 65|Module Group 65]]
- [[_COMMUNITY_Module Group 66|Module Group 66]]
- [[_COMMUNITY_Module Group 67|Module Group 67]]
- [[_COMMUNITY_Module Group 68|Module Group 68]]
- [[_COMMUNITY_Module Group 69|Module Group 69]]
- [[_COMMUNITY_Module Group 70|Module Group 70]]
- [[_COMMUNITY_Module Group 71|Module Group 71]]
- [[_COMMUNITY_Module Group 72|Module Group 72]]
- [[_COMMUNITY_Module Group 73|Module Group 73]]
- [[_COMMUNITY_Module Group 74|Module Group 74]]
- [[_COMMUNITY_Module Group 75|Module Group 75]]
- [[_COMMUNITY_Module Group 76|Module Group 76]]
- [[_COMMUNITY_Module Group 77|Module Group 77]]
- [[_COMMUNITY_Module Group 78|Module Group 78]]
- [[_COMMUNITY_Module Group 79|Module Group 79]]
- [[_COMMUNITY_Module Group 80|Module Group 80]]
- [[_COMMUNITY_Module Group 81|Module Group 81]]
- [[_COMMUNITY_Module Group 82|Module Group 82]]
- [[_COMMUNITY_Module Group 83|Module Group 83]]
- [[_COMMUNITY_Module Group 84|Module Group 84]]
- [[_COMMUNITY_Module Group 85|Module Group 85]]
- [[_COMMUNITY_Module Group 86|Module Group 86]]
- [[_COMMUNITY_Module Group 87|Module Group 87]]
- [[_COMMUNITY_Module Group 88|Module Group 88]]
- [[_COMMUNITY_Module Group 90|Module Group 90]]
- [[_COMMUNITY_Module Group 91|Module Group 91]]
- [[_COMMUNITY_Module Group 92|Module Group 92]]
- [[_COMMUNITY_Module Group 93|Module Group 93]]
- [[_COMMUNITY_Module Group 94|Module Group 94]]
- [[_COMMUNITY_Module Group 95|Module Group 95]]
- [[_COMMUNITY_Module Group 96|Module Group 96]]
- [[_COMMUNITY_Module Group 98|Module Group 98]]
- [[_COMMUNITY_Module Group 99|Module Group 99]]
- [[_COMMUNITY_Module Group 105|Module Group 105]]
- [[_COMMUNITY_Module Group 106|Module Group 106]]
- [[_COMMUNITY_Module Group 107|Module Group 107]]
- [[_COMMUNITY_Module Group 108|Module Group 108]]
- [[_COMMUNITY_Module Group 109|Module Group 109]]
- [[_COMMUNITY_Module Group 110|Module Group 110]]
- [[_COMMUNITY_Module Group 111|Module Group 111]]
- [[_COMMUNITY_Module Group 112|Module Group 112]]
- [[_COMMUNITY_Module Group 113|Module Group 113]]
- [[_COMMUNITY_Module Group 114|Module Group 114]]
- [[_COMMUNITY_Module Group 115|Module Group 115]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 82 edges
2. `cn()` - 72 edges
3. `Button` - 53 edges
4. `FileRoutesByPath` - 43 edges
5. `PageShell()` - 39 edges
6. `formatDatePtBR()` - 37 edges
7. `SelectTrigger` - 35 edges
8. `SelectContent` - 35 edges
9. `SelectItem` - 35 edges
10. `supabase` - 34 edges

## Surprising Connections (you probably didn't know these)
- `FindingForm()` --calls--> `modosPorCategoria()`  [INFERRED]
  campo-pwa/src/pages/PointCapture.tsx → src/lib/campo.ts
- `campo-pwa/index.html (PWA entry point — Campo NR-10)` --conceptually_related_to--> `Concept: Campo v2 — photo-first, hierarchical tree field collection`  [INFERRED]
  campo-pwa/index.html → supabase/migrations/_archive/_pendente_campo_v2.sql
- `setorDoNo()` --calls--> `nodePath()`  [INFERRED]
  campo-pwa/src/lib/campo.ts → src/lib/campo.ts
- `caminhoAbaixoDoSetor()` --calls--> `nodePath()`  [INFERRED]
  campo-pwa/src/lib/campo.ts → src/lib/campo.ts
- `AddNodeModal()` --calls--> `proximoNivel()`  [INFERRED]
  campo-pwa/src/pages/InspectionDetail.tsx → src/lib/campo.ts

## Import Cycles
- None detected.

## Communities (116 total, 30 thin omitted)

### Community 0 - "LOTO Padlock Management"
Cohesion: 0.07
Nodes (38): CancelPadlockDialog(), DeletePadlockDialog(), baseSchema, ConflictPanel(), NewPadlockDialog(), PrintLabelDialog(), Props, ReportInconsistencyDialog() (+30 more)

### Community 1 - "RTI NC Tracking & Costs"
Cohesion: 0.07
Nodes (45): formatBRL(), ncPrazoBucket(), ncPrazoProximo(), ncPrazoVencido(), logBulkHistorico(), useBulkUpdateRtiNcs(), useCreateRtiArea(), useCreateRtiNc() (+37 more)

### Community 2 - "Campo PWA Inspection Tree"
Cohesion: 0.06
Nodes (45): caminhoAbaixoDoSetor(), setorDoNo(), AchadoNovoUI, EstruturaLinha, FIELD_INSPECTION_STATUS_BADGE, FIELD_INSPECTION_STATUS_LABELS, FIELD_INSPECTION_STATUSES, FieldFinding (+37 more)

### Community 3 - "Route Tree Registry"
Cohesion: 0.04
Nodes (46): AdminAuditoriaRoute, AdminCargaRoute, AdminCertificadosImportarRoute, AdminQualificacoesCargaRoute, AdminReportsRoute, AdminUsuariosRoute, CadeadosCodigoRoute, CadeadosIndexRoute (+38 more)

### Community 4 - "UI Sidebar & Shell"
Cohesion: 0.05
Nodes (37): useIsMobile(), Separator, SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay (+29 more)

### Community 5 - "Auth Guard & Dialogs"
Cohesion: 0.06
Nodes (42): ActionPlanDialog (inline) — corrective action plan for a non-compliant inspection, ATVOS_LOGO_BASE64 — Atvos brand logo embedded as JPEG base64, AuthorizationDialog — create/edit NR-10 work authorization for an employee, AuthorizationPrintDialog — printable NR-10 work authorization form, CancelPadlockDialog — soft-delete (baixa) a padlock with reason selection, client.tsx — React client hydration entry point (TanStack Start), Concept: Auth Guard — QueryClientProvider wraps AuthProvider wraps Outlet; auth check delegated to AuthProvider, Admin password revalidation — DeletePadlockDialog re-signs in before permanent delete (+34 more)

### Community 6 - "Compliance Aggregation"
Cohesion: 0.12
Nodes (35): useASOs(), pct(), useComplianceReport(), useEPIs(), useEPITests(), INSPECTION_TYPES, useInspections(), DOC_STATUS_LABELS (+27 more)

### Community 7 - "EPI/PPE Management"
Cohesion: 0.07
Nodes (26): EPI, EPI_STATUS_LABELS, EPI_TYPE_LABELS, EPI_TYPES, EPITest, epiTestStatus, EPIType, lastTestByEpi() (+18 more)

### Community 8 - "NR-10 Training & Qualifications"
Cohesion: 0.11
Nodes (27): NR10TurmaDialog(), Props, PageShell(), useDeleteNR10Document(), useDocumentVersions(), useUpsertNR10Document(), useDeleteEmployee(), useRegistrarTurma() (+19 more)

### Community 9 - "Incident & Compliance Report"
Cohesion: 0.09
Nodes (27): ComplianceReport, SnapshotPayload, snapshotPayloadFrom(), ElectricalIncident, INCIDENT_GRAVIDADE_LABELS, INCIDENT_GRAVIDADES, INCIDENT_STATUS, INCIDENT_STATUS_LABELS (+19 more)

### Community 10 - "Employee & Authorization Forms"
Cohesion: 0.09
Nodes (30): FormValues, Props, schema, EmployeeDialog(), FormValues, Props, schema, FormValues (+22 more)

### Community 11 - "Campo→RTI Pipeline"
Cohesion: 0.10
Nodes (31): AchadoNovo, baixarPlanilhaModeloEstrutura(), campoKeys, comporRti(), ComporRtiDestino, ComporRtiResult, FieldPointWithCounts, InspectionFinding (+23 more)

### Community 12 - "RTI Import & Evidence"
Cohesion: 0.10
Nodes (26): clampPrioridade(), bulkAttachRtiEvidencias(), RtiImportPayload, rtiKeys, uploadRtiFile(), useAddRtiEvidencia(), useAddRtiHistorico(), useDeleteRtiEvidencia() (+18 more)

### Community 13 - "Aptidão NR-10 §10.8 Rules"
Cohesion: 0.11
Nodes (27): AuthorizationPrintDialog(), Aptidao, AptidaoInput, BLOQUEANTE_CODES, BLOQUEANTE_LABELS, BloqueanteCode, computeAptidao(), latestBasicoDate() (+19 more)

### Community 14 - "Auth Context & Route Utils"
Cohesion: 0.17
Nodes (14): AuthContext, AuthState, schema, EmpSummary, instrSearchSchema, extractNcNumero(), extractNumeroFromText(), FileRow (+6 more)

### Community 15 - "Campo PWA Dependencies"
Cohesion: 0.07
Nodes (27): dependencies, dexie, dexie-react-hooks, lucide-react, react, react-dom, react-router-dom, @supabase/supabase-js (+19 more)

### Community 16 - "Generic Inspections (SPDA/Termografia)"
Cohesion: 0.15
Nodes (22): ActionPlanDialog(), InspecoesPage(), InspectionDialog(), ACTION_STATUS_LABELS, ACTION_STATUSES, ActionStatus, Inspection, INSPECTION_RESULT_LABELS (+14 more)

### Community 17 - "Route Components"
Cohesion: 0.07
Nodes (28): Route, Route, Route, Route, Route, Route, Route, Route (+20 more)

### Community 18 - "PWA Icons & Archive"
Cohesion: 0.11
Nodes (28): Archive: _pendente_campo_v2.sql (Campo RTI v2 — hierarchical tree + photo-first flow), Archive README: supabase/migrations/_archive/README.md, Archive: _recuperacao_20260611.sql (idempotent recovery script for migrations up to 20260611), campo-pwa app icon PNG 192x192, campo-pwa app icon PNG 512x512, campo-pwa app icon (SVG): dark navy square with lightning bolt — electrical safety domain, campo-pwa/index.html (PWA entry point — Campo NR-10), Concept: Campo v2 — photo-first, hierarchical tree field collection (+20 more)

### Community 19 - "ASO & Aptidão Concepts"
Cohesion: 0.13
Nodes (26): BloqueanteCode — 9 enumerated NR-10 authorization blockers, computeAptidao — bloqueantes: sem_autorizacao, nr10_basico_ausente, aso_ausente, etc., asoStatus() — derives ok/expiring/expired/inapto/none, aso-docs storage bucket (Supabase Storage for ASO PDFs), ASO type (Atestado de Saúde Ocupacional domain model), asos table (DB) — exam_date, validity_date, resultado, apto_eletricidade, employees table (DB) — status, reciclagem_requerida, reciclagem_motivo, buildVencimentos — 6 fontes: capacitação NR-10, IT, prontuário, inspeção, EPI, ASO (+18 more)

### Community 20 - "Module Group 20"
Cohesion: 0.14
Nodes (26): Aptidão Blocker Analysis (authorized employees failing fitness), Bulk NC Operations (status/responsavel/prazo/custo/evidencias), campo-pwa Integration (field_inspections ↔ RTI reports), Compliance Snapshots — Monthly Trend Capture, computeAptidao() — Fitness Engine (auth+NR10+ASO+reciclagem), NC Evidence Deduplication (filename + tipo guard), PIE Categories (Prontuário das Instalações Elétricas), RTI NC Lifecycle (importar→plano→nc→evidencias+historico) (+18 more)

### Community 21 - "Module Group 21"
Cohesion: 0.16
Nodes (16): Employee, Props, REASONS, memberSlug(), photoPathFor(), formatDateTime(), AdminReportsPage(), Report (+8 more)

### Community 22 - "Module Group 22"
Cohesion: 0.14
Nodes (25): asos — Atestado de Saude Ocupacional (occupational health exam NR-10 10.8.7); fields: employee_id (FK), exam_date, validity_date, tipo (admissional|periodico|retorno_trabalho|mudanca_funcao|demissional), resultado (apto|apto_com_restricoes|inapto), apto_eletricidade, restricoes, medico, file_path, audit_log — immutable centralized audit trail; fields: table_name, record_id, action (INSERT|UPDATE|DELETE), actor_id, old_data (jsonb), new_data (jsonb); written exclusively by fn_audit() SECURITY DEFINER trigger; tracks: employees, nr10_trainings, work_authorizations, it_trainings, nr10_documents, epis, epi_tests, asos, electrical_incidents, rti_modos_falha, field_inspections, compliance_snapshots — monthly compliance snapshots (snapshot_date = 1st of month); fields: snapshot_date (UNIQUE), payload (jsonb with compliance percentages per dimension); generated by app when staff opens report and current month snapshot is missing; cross-cutting: aggregates employees, asos, nr10_trainings, work_authorizations, epis, inspections, rti_ncs, electrical_incidents — electrical incident and near-miss records; fields: occurred_at, tipo (choque|arco_eletrico|principio_incendio|quase_acidente|outro), setor, local, descricao, envolvidos, gravidade (sem_lesao|leve|moderada|grave|fatal), causa_raiz, acoes_tomadas, status (aberto|em_investigacao|concluido), file_path; bucket: inspection-docs/incidents, employees — employee records; columns added: status (ativo|afastado|desligado), afastado_desde, retorno_em, reciclagem_requerida, reciclagem_motivo; audited via fn_audit trigger, epi_tests — dielectric and periodic test history for EPIs; fields: epi_id (FK), test_date, result (aprovado|reprovado), laboratory, certificate_path, epis — PPE/EPI inventory for NR-10 electrical safety; types: luva_isolante, manga_isolante, detector_tensao, bastao_isolante, tapete_isolante, cobertura_isolante; fields: epi_type, epi_class, serial_number, ca (certificado de aprovacao), employee_id, sector, acquisition_date, test_interval_months, campo_arvore: field_findings — failure mode findings per point (1..N per point); fields: point_id (FK), modo_falha_id (FK to rti_modos_falha, NULL=manual entry), descricao, recomendacao, prioridade, tipo_execucao; becomes rti_ncs when RTI is composed (+17 more)

### Community 23 - "Module Group 23"
Cohesion: 0.10
Nodes (17): getInitials(), NR10AdminItems(), QualDropdown(), RACDropdown(), RTIDropdown(), SiteHeader(), VencimentosBell(), useVencimentosBadge() (+9 more)

### Community 24 - "Module Group 24"
Cohesion: 0.08
Nodes (23): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleDetection (+15 more)

### Community 25 - "Module Group 25"
Cohesion: 0.14
Nodes (21): AuthorizationDialog(), FormValues, NR10TrainingDialog(), Props, schema, NR10Training, qualKeys, uploadCertificateFile() (+13 more)

### Community 26 - "Module Group 26"
Cohesion: 0.13
Nodes (17): Bloqueante, batchImportQualificacoes(), ParsedData, parseExcelDate(), parseWorkbook(), Route, strOrNull(), COLORS (+9 more)

### Community 27 - "Module Group 27"
Cohesion: 0.09
Nodes (16): Avatar, AvatarFallback, AvatarImage, HoverCardContent, InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot (+8 more)

### Community 28 - "Module Group 28"
Cohesion: 0.13
Nodes (19): VENC_KIND_LABELS, VENC_KINDS, VencKind, ACTION_LABELS, AdminAuditoriaPage(), AuditEntry, IGNORED_FIELDS, Route (+11 more)

### Community 29 - "Module Group 29"
Cohesion: 0.17
Nodes (21): Aggregate: ComplianceReport merges 6+ domain data sources, Pattern: Domain Module + -queries.ts Counterpart, SnapshotPayload — JSONB compliance state persisted monthly, VencimentoItem — Normalized cross-domain expiry item, DB Table: compliance_snapshots, DB Table: epi_tests, DB Table: epis, DB Table: inspection_actions (+13 more)

### Community 30 - "Module Group 30"
Cohesion: 0.18
Nodes (15): ASO_RESULTADO_LABELS, ASO_RESULTADOS, ASO_STATUS_LABELS, ASO_TIPO_LABELS, ASO_TIPOS, ASOResultado, ASOTipo, latestASOByEmployee() (+7 more)

### Community 31 - "Module Group 31"
Cohesion: 0.16
Nodes (18): excelSerialToISO(), batchImportRti(), RtiImportNc, useDeleteRtiReport(), useUpsertRtiReport(), ExcluirRtiDialog(), norm(), parseDateCell() (+10 more)

### Community 32 - "Module Group 32"
Cohesion: 0.14
Nodes (18): Sidebar state management (cookie-persisted, mobile-aware), useIsMobile hook, useSidebar hook, cn (clsx/tailwind-merge util), @radix-ui/react-dialog, @radix-ui/react-progress, @radix-ui/react-scroll-area, @radix-ui/react-separator (+10 more)

### Community 33 - "Module Group 33"
Cohesion: 0.28
Nodes (18): CreateInspectionModal component, EditMetadataModal component, FieldNode (domain type from campo-core), RtiModoFalha (domain type from campo-core), RtiTipoExecucao (domain type from campo-core), LocalNode = FieldNode & {_synced}, db (singleton CampoDatabase instance), AddNodeModal (inline component in InspectionDetail) (+10 more)

### Community 34 - "Module Group 34"
Cohesion: 0.17
Nodes (17): AppRole — admin | apoio RBAC roles from user_roles table, Viewer mode — sessionStorage-based read-only mode for non-staff, AuthProvider / useAuth (React auth context wrapping Supabase), lib/incidentes — INCIDENT_TIPO_LABELS, INCIDENT_GRAVIDADE_LABELS, ElectricalIncident, lib/padlocks — formatDateTime(), logEvent(), PADLOCK_COLORS, colorLabel(), lib/queries — useDashboardData(), usePadlocks(), usePadlockDetail(), admin/auditoria — Trilha de Auditoria (admin-only, paginada), admin/carga — Importação Excel de histórico de cadeados (+9 more)

### Community 35 - "Module Group 35"
Cohesion: 0.19
Nodes (15): cn(), ButtonProps, buttonVariants, Calendar(), CalendarDayButton(), Pagination(), PaginationContent, PaginationEllipsis() (+7 more)

### Community 36 - "Module Group 36"
Cohesion: 0.16
Nodes (13): AppRole, AdminUsersPage(), Profile, Route, Row, AlertDialogAction, AlertDialogCancel, AlertDialogContent (+5 more)

### Community 37 - "Module Group 37"
Cohesion: 0.18
Nodes (13): generateId(), backoffDelayMs(), downloadAll(), downloadInspections(), downloadInspectionsData(), downloadModosFalha(), enqueue(), processQueue() (+5 more)

### Community 38 - "Module Group 38"
Cohesion: 0.15
Nodes (17): Sync Engine (campo-pwa), Dexie DB (campo-pwa) — local offline store for inspections/nodes/points/findings/photos/modos_falha/sync_queue, Supabase field tables — field_inspections, field_nodes, field_points, field_findings, field_photos, Supabase Storage bucket rti-evidencias — campo PWA photo uploads, startConnectivityWatcher — online event + 30s heartbeat for queue processing, downloadAll — download Supabase→Dexie entry point, downloadInspections — reconciles deletions, fetches active inspections, downloadInspectionsData — parallel batch fetch nodes/points/findings/photos (+9 more)

### Community 39 - "Module Group 39"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 40 - "Module Group 40"
Cohesion: 0.19
Nodes (16): Data Flow: FieldInspection → comporRti() → RtiReport + RtiNc, DB Table: field_findings, DB Table: field_inspections, DB Table: field_nodes, DB Table: field_photos, DB Table: field_points, DB Table: rti_areas, DB Table: rti_modos_falha (failure modes catalog) (+8 more)

### Community 41 - "Module Group 41"
Cohesion: 0.14
Nodes (12): requireSupabaseAuth, supabaseAdmin, CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums (+4 more)

### Community 42 - "Module Group 42"
Cohesion: 0.22
Nodes (12): AuthorizationLevel, EMPLOYEE_STATUS_LABELS, employeeStatusVariant(), IT_STATUS_LABELS, IT_STATUS_VALUES, ITStatus, useITTrainings(), TrainingCertificate (+4 more)

### Community 43 - "Module Group 43"
Cohesion: 0.27
Nodes (14): comporRti() — composes RTI report from field inspection findings, ComporRtiDialog — converte achados em NCs RTI (novo ou existente), FieldInspection tree (inspection → nodes → points → findings + photos), jaImportada flag — inspection.status === 'importada' bloqueia edição em campo, handleReopen — desbloqueia inspeção importada via status=em_andamento, rti-evidencias storage bucket (field inspection photos), campo-queries.ts (TanStack Query hooks for field inspection data), lib/rti — ncPrazoBucket(), RTI_PRIORIDADE_BADGE, clampPrioridade() (+6 more)

### Community 44 - "Module Group 44"
Cohesion: 0.18
Nodes (11): formatNormas(), modosPorCategoria(), NormaRef, useDeleteModoFalha(), useUpsertModoFalha(), RtiModoFalha, RTI_PRIORIDADE_BADGE, RTI_PRIORIDADES (+3 more)

### Community 45 - "Module Group 45"
Cohesion: 0.14
Nodes (12): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+4 more)

### Community 46 - "Module Group 46"
Cohesion: 0.19
Nodes (13): shadcn/ui component library pattern, lucide-react (icons), @radix-ui/react-dropdown-menu, @radix-ui/react-menubar, @radix-ui/react-navigation-menu, @radix-ui/react-select, react-resizable-panels, DropdownMenu (+5 more)

### Community 47 - "Module Group 47"
Cohesion: 0.17
Nodes (10): CampoDatabase, db, LocalFinding, LocalInspection, LocalModoFalha, LocalNode, LocalPhoto, LocalPoint (+2 more)

### Community 48 - "Module Group 48"
Cohesion: 0.33
Nodes (12): Concept: Resend API — External email service used by vencimentos-email edge function, DB Table: employees, DB Table: it_trainings, DB Table: nr10_trainings, DB Table: training_certificates, DB Table: work_authorizations, DB Table: work_instructions, Edge Function: vencimentos-email — Weekly expiry summary email via Resend API (+4 more)

### Community 49 - "Module Group 49"
Cohesion: 0.24
Nodes (12): Layout component (auth guard + outlet + SyncStatus), SyncStatus component (sync state banner), Offline-first architecture (Dexie + sync queue), CampoDatabase (Dexie IndexedDB), SyncQueueItem (local sync queue entry), useSyncStatus() hook, SyncState = 'idle' | 'syncing' | 'error', formatTimeAgo() — human-readable last-sync time (+4 more)

### Community 50 - "Module Group 50"
Cohesion: 0.24
Nodes (11): class-variance-authority (CVA), embla-carousel-react, @radix-ui/react-slot, react-day-picker, Alert, Badge, Breadcrumb, Button (+3 more)

### Community 51 - "Module Group 51"
Cohesion: 0.18
Nodes (11): cmdk, @radix-ui/react-alert-dialog, @radix-ui/react-context-menu, @radix-ui/react-dialog, vaul, AlertDialog, Command, ContextMenu (+3 more)

### Community 52 - "Module Group 52"
Cohesion: 0.22
Nodes (11): DB Table: configuracoes — Key-value config store (sectors list, backup folder, etc.), DB Table: padlock_events, DB Table: padlock_report_events — Immutable history of report status changes, DB Table: padlock_reports — Inconsistency reports on LOTO devices (status: aguardando/solucionado/recusado), DB Table: padlock_violations, DB Table: padlocks, Padlocks — LOTO Cadeado Types, Status & logEvent(), Queries — Shared Padlock Queries (queries.ts) (+3 more)

### Community 53 - "Module Group 53"
Cohesion: 0.25
Nodes (9): useDeleteFieldInspection(), useFieldInspections(), CampoIndexPage(), ExcluirInspecaoDialog(), ExcluirScope, NovaInspecaoDialog(), RtiGestaoPage(), RadioGroup (+1 more)

### Community 54 - "Module Group 54"
Cohesion: 0.20
Nodes (6): AuthProvider(), queryClient, Route, FileRoutesById, Toaster(), ToasterProps

### Community 55 - "Module Group 55"
Cohesion: 0.18
Nodes (7): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, THEMES

### Community 56 - "Module Group 56"
Cohesion: 0.20
Nodes (8): Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut()

### Community 57 - "Module Group 57"
Cohesion: 0.20
Nodes (9): ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut(), ContextMenuSubContent (+1 more)

### Community 58 - "Module Group 58"
Cohesion: 0.24
Nodes (5): norm(), parseCancelled(), parseColor(), ParsedRow, Route

### Community 59 - "Module Group 59"
Cohesion: 0.31
Nodes (7): COR_LABEL, EtiquetaCor, EtiquetaLOTO(), EtiquetaLOTOProps, formatTelefone(), ouTraco(), px()

### Community 60 - "Module Group 60"
Cohesion: 0.28
Nodes (9): Form validation integration (react-hook-form + zod), useFormField hook, @radix-ui/react-label, @radix-ui/react-radio-group, @radix-ui/react-slot, react-hook-form, Form (react-hook-form wrapper), Label (+1 more)

### Community 61 - "Module Group 61"
Cohesion: 0.22
Nodes (9): _synced flag (optimistic local record state), FieldFinding (domain type from campo-core), FieldInspection (domain type from campo-core), FieldPhoto (domain type from campo-core), FieldPoint (domain type from campo-core), LocalFinding = FieldFinding & {_synced}, LocalInspection = FieldInspection & {_synced}, LocalPhoto (FieldPhoto with blob + _synced, nullable file_path) (+1 more)

### Community 62 - "Module Group 62"
Cohesion: 0.25
Nodes (6): formatTimeAgo(), SyncState, useSyncStatus(), InspectionList(), STATUS_COLOR, STATUS_LABEL

### Community 63 - "Module Group 63"
Cohesion: 0.25
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 64 - "Module Group 64"
Cohesion: 0.25
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 65 - "Module Group 65"
Cohesion: 0.25
Nodes (7): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator()

### Community 66 - "Module Group 66"
Cohesion: 0.38
Nodes (7): Concept: RLS Pattern — has_role/is_staff SECURITY DEFINER functions used as RLS policy conditions, DB Table: profiles — User display_name and email, FK to auth.users, DB Table: user_roles — Maps auth.users to app_role enum (admin, apoio), Edge Function: admin-users — Create/delete/update/reset Supabase Auth users (requires admin role), DB Trigger Function: handle_new_user — Auto-creates profiles row on auth.users INSERT, DB Function: has_role(_user_id, _role) — Returns boolean, SECURITY DEFINER, DB Function: is_staff(_user_id) — Returns true if user has admin or apoio role

### Community 67 - "Module Group 67"
Cohesion: 0.43
Nodes (7): Bearer token auth flow — attacher injects token; middleware validates it server-side, RLS bypass — supabaseAdmin uses service role key, never exposed to client, attachSupabaseAuth (client-side TanStack Start middleware), requireSupabaseAuth (server-side TanStack Start middleware), supabase (browser/SSR Supabase client singleton), supabaseAdmin (server-only service-role client, bypasses RLS), Database types (auto-generated Supabase schema types)

### Community 68 - "Module Group 68"
Cohesion: 0.29
Nodes (3): Item, NcItem, TRAINING_LABELS

### Community 71 - "Module Group 71"
Cohesion: 0.40
Nodes (3): getRouter(), Register, routeTree

### Community 72 - "Module Group 72"
Cohesion: 0.40
Nodes (5): @radix-ui/react-accordion, @radix-ui/react-collapsible, Accordion, Collapsible, SiteHeader

### Community 73 - "Module Group 73"
Cohesion: 0.40
Nodes (4): Alert, AlertDescription, AlertTitle, alertVariants

### Community 74 - "Module Group 74"
Cohesion: 0.50
Nodes (4): @radix-ui/react-hover-card, @radix-ui/react-popover, HoverCard, Popover

### Community 75 - "Module Group 75"
Cohesion: 0.50
Nodes (4): @gestao/campo-core (shared domain types & tree helpers), types.ts (re-exports from @gestao/campo-core), campo-pwa (PWA package), Vite + PWA config (Campo NR-10)

### Community 77 - "Module Group 77"
Cohesion: 0.50
Nodes (3): AccordionContent, AccordionItem, AccordionTrigger

### Community 78 - "Module Group 78"
Cohesion: 0.50
Nodes (3): TabsContent, TabsList, TabsTrigger

### Community 80 - "Module Group 80"
Cohesion: 0.67
Nodes (3): Component: InspecoesPage — Shared component for SPDA and Termografias inspection pages, Route /spda/ — SPDA (Lightning Protection) page, Route /termografias/ — Termografias (Thermography) page

### Community 83 - "Module Group 83"
Cohesion: 0.67
Nodes (3): Supabase Auth + Viewer Mode, Home — RAC Padlocks Dashboard (/), Login / Auth Page (/login)

### Community 84 - "Module Group 84"
Cohesion: 0.67
Nodes (3): DB Table: electrical_incidents, Incidentes — Electrical Incident Types & Constants, IncidentesQueries — Incident React Query Hooks

## Knowledge Gaps
- **509 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+504 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Module Group 35` to `Campo PWA Inspection Tree`, `UI Sidebar & Shell`, `NR-10 Training & Qualifications`, `Incident & Compliance Report`, `Employee & Authorization Forms`, `RTI Import & Evidence`, `Aptidão NR-10 §10.8 Rules`, `Auth Context & Route Utils`, `Module Group 21`, `Module Group 23`, `Module Group 26`, `Module Group 27`, `Module Group 28`, `Module Group 36`, `Module Group 39`, `Module Group 44`, `Module Group 45`, `Module Group 53`, `Module Group 55`, `Module Group 56`, `Module Group 57`, `Module Group 63`, `Module Group 64`, `Module Group 65`, `Module Group 73`, `Module Group 77`, `Module Group 78`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `Button` connect `Auth Context & Route Utils` to `LOTO Padlock Management`, `RTI NC Tracking & Costs`, `Campo PWA Inspection Tree`, `UI Sidebar & Shell`, `Compliance Aggregation`, `NR-10 Training & Qualifications`, `Incident & Compliance Report`, `Employee & Authorization Forms`, `Campo→RTI Pipeline`, `RTI Import & Evidence`, `Aptidão NR-10 §10.8 Rules`, `Generic Inspections (SPDA/Termografia)`, `Module Group 21`, `Module Group 25`, `Module Group 26`, `Module Group 28`, `Module Group 30`, `Module Group 31`, `Module Group 35`, `Module Group 36`, `Module Group 42`, `Module Group 44`, `Module Group 45`, `Module Group 53`, `Module Group 58`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `LOTO Padlock Management` to `RTI NC Tracking & Costs`, `Campo PWA Inspection Tree`, `Compliance Aggregation`, `NR-10 Training & Qualifications`, `Incident & Compliance Report`, `Campo→RTI Pipeline`, `RTI Import & Evidence`, `Aptidão NR-10 §10.8 Rules`, `Auth Context & Route Utils`, `Generic Inspections (SPDA/Termografia)`, `Module Group 21`, `Module Group 23`, `Module Group 28`, `Module Group 30`, `Module Group 31`, `Module Group 36`, `Module Group 44`, `Module Group 53`, `Module Group 58`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _509 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `LOTO Padlock Management` be split into smaller, more focused modules?**
  _Cohesion score 0.06885245901639345 - nodes in this community are weakly interconnected._
- **Should `RTI NC Tracking & Costs` be split into smaller, more focused modules?**
  _Cohesion score 0.07259528130671507 - nodes in this community are weakly interconnected._
- **Should `Campo PWA Inspection Tree` be split into smaller, more focused modules?**
  _Cohesion score 0.06009783368273934 - nodes in this community are weakly interconnected._