# Graph Report - .  (2026-07-06)

## Corpus Check
- 0 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1603 nodes · 4557 edges · 102 communities (90 shown, 12 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 93|Community 93]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 156 edges
2. `cn()` - 78 edges
3. `Button` - 55 edges
4. `FileRoutesByPath` - 46 edges
5. `PageShell()` - 42 edges
6. `SelectTrigger` - 38 edges
7. `SelectContent` - 38 edges
8. `SelectItem` - 38 edges
9. `formatDatePtBR()` - 38 edges
10. `supabase` - 37 edges

## Surprising Connections (you probably didn't know these)
- `AddNodeModal()` --calls--> `labelDoTipo()`  [INFERRED]
  campo-pwa/src/pages/InspectionDetail.tsx → packages/campo-core/src/helpers.ts
- `InspectionDetail()` --calls--> `labelDoTipo()`  [INFERRED]
  campo-pwa/src/pages/InspectionDetail.tsx → packages/campo-core/src/helpers.ts
- `InspectionDetail()` --calls--> `labelDoTipoPlural()`  [INFERRED]
  campo-pwa/src/pages/InspectionDetail.tsx → packages/campo-core/src/helpers.ts
- `GestaoCard()` --calls--> `hoje`  [INFERRED]
  src/routes/rti.nc.$ncId.tsx → src/lib/__tests__/regras-nr10.test.ts
- `UserMenu()` --calls--> `useAuth()`  [EXTRACTED]
  src/components/site-header.tsx → src/lib/auth-context.tsx

## Import Cycles
- None detected.

## Communities (102 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (66): defaultsFor(), EmployeeDialog(), FormacaoDocRow(), FormacaoRow(), FormacoesSection(), FormValues, Props, schema (+58 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (60): dependencies, class-variance-authority, @cloudflare/vite-plugin, clsx, cmdk, date-fns, embla-carousel-react, @hookform/resolvers (+52 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (49): AdminAuditoriaRoute, AdminCargaRoute, AdminCertificadosImportarRoute, AdminEmpresasRoute, AdminQualificacoesCargaRoute, AdminReportsRoute, AdminUsuariosRoute, CadeadosCodigoRoute (+41 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (37): AptidaoInput, Bloqueante, BLOQUEANTE_CODES, BLOQUEANTE_LABELS, BloqueanteCode, computeAptidao(), latestBasicoDate(), latestTrainingDate() (+29 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (43): AppSidebar(), NR10TurmaDialog(), QualDropdown(), SiteHeader(), useASOs(), useAuth(), useComplianceReport(), useIncidents() (+35 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (25): DeletePadlockDialog(), baseSchema, ConflictPanel(), NewPadlockDialog(), PrintLabelDialog(), SectorSelect(), colorAccent, colorBadge (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (36): useIsMobile(), SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle (+28 more)

### Community 7 - "Community 7"
Cohesion: 0.16
Nodes (26): Employee, Props, Props, memberSlug(), photoPathFor(), formatNormas(), modosPorCategoria(), useDeleteFieldFinding() (+18 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (29): AuthorizationDialog(), FormValues, Props, schema, FormValues, Props, schema, FormValues (+21 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (27): EPI, EPI_STATUS_LABELS, EPI_TYPE_LABELS, EPI_TYPES, EPITest, epiTestStatus, EPIType, lastTestByEpi() (+19 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (22): getActiveOrgId(), getOperableOrgs(), operableFrom(), OrgLite, refreshOrgContext(), supabase, generateId(), backoffDelayMs() (+14 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (26): AuthorizationPrintDialog(), Aptidao, ASO_RESULTADO_LABELS, ASO_RESULTADOS, ASO_STATUS_LABELS, ASO_TIPO_LABELS, ASO_TIPOS, ASOResultado (+18 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (25): computeAndamentoPorCusto(), computeBudget(), matchCustoFiltro(), ncPrazoBucket(), ncPrazoProximo(), RTI_CUSTO_FILTRO_LABELS, RTI_CUSTO_FILTROS, RTI_EVIDENCIA_TIPO_LABELS (+17 more)

### Community 13 - "Community 13"
Cohesion: 0.10
Nodes (26): NavGroup, SidebarGroup(), SidebarSingleLink(), SidebarSubLink(), SubItem, cn(), ButtonProps, buttonVariants (+18 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (30): dependencies, browser-image-compression, dexie, dexie-react-hooks, jszip, lucide-react, react, react-dom (+22 more)

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (27): AchadoNovoUI, coletoresCampoDe(), EstruturaLinha, FIELD_INSPECTION_STATUSES, FieldFinding, FieldInspectionStatus, FieldNode, FieldPhoto (+19 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (23): ActionPlanDialog(), InspecoesPage(), InspectionDialog(), ACTION_STATUS_LABELS, ACTION_STATUSES, ActionStatus, Inspection, INSPECTION_RESULT_LABELS (+15 more)

### Community 17 - "Community 17"
Cohesion: 0.07
Nodes (29): Route, Route, Route, Route, Route, Route, Route, Route (+21 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (24): useFieldInspections(), bulkAttachRtiEvidencias(), deleteRtiArt(), EntregarRtiPayload, logBulkHistorico(), RtiArtUploadOpts, RtiEvidenciaUploadOpts, RtiImportPayload (+16 more)

### Community 19 - "Community 19"
Cohesion: 0.11
Nodes (25): formatDatePtBR(), clampPrioridade(), ncPrazoVencido(), rtiKeys, useAddRtiEvidencia(), useAddRtiHistorico(), useDeleteRtiEvidencia(), useDeleteRtiNc() (+17 more)

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (23): OrgTipo, MODULE_LABEL, MODULES, TIPO_LABEL, createOrg(), deleteOrg(), EmpresaRow, fetchEmpresas() (+15 more)

### Community 21 - "Community 21"
Cohesion: 0.09
Nodes (18): AddNodeModal(), InspectionDetail(), Params, labelDoTipo(), labelDoTipoPlural(), FIELD_INSPECTION_STATUSES, FieldFinding, FieldInspection (+10 more)

### Community 22 - "Community 22"
Cohesion: 0.09
Nodes (16): EmpSummary, instrSearchSchema, Route, Alert, AlertDescription, AlertTitle, alertVariants, Badge() (+8 more)

### Community 23 - "Community 23"
Cohesion: 0.10
Nodes (18): getInitials(), NR10AdminItems(), OrgSwitcher(), RACDropdown(), RTIDropdown(), UserMenu(), VencimentosBell(), buildOrgTree() (+10 more)

### Community 24 - "Community 24"
Cohesion: 0.08
Nodes (23): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleDetection (+15 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (17): ACTION_LABELS, AdminAuditoriaPage(), AuditEntry, IGNORED_FIELDS, TABLE_LABELS, extractNcNumero(), extractNumeroFromText(), FileRow (+9 more)

### Community 26 - "Community 26"
Cohesion: 0.12
Nodes (16): useDebounce(), formatDateTime(), usePadlocks(), Report, ReportEvent, ReportStatus, PadlocksList(), PadlocksSearch (+8 more)

### Community 27 - "Community 27"
Cohesion: 0.14
Nodes (20): campoKeys, ComporRtiDestino, ComporRtiResult, InspectionFinding, useAddFieldPhoto(), useArchiveModoFalha(), useDeleteFieldPhoto(), useDeleteModoFalha() (+12 more)

### Community 28 - "Community 28"
Cohesion: 0.16
Nodes (18): formatTimestampPtBR(), labelResponsaveisCampo(), rtiFileUrl(), useBulkUpdateRtiNcs(), useCreateRtiArea(), useCreateRtiNc(), useEntregarRtiReport(), useRtiAreas() (+10 more)

### Community 29 - "Community 29"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+12 more)

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (14): ElectricalIncident, INCIDENT_GRAVIDADE_LABELS, INCIDENT_GRAVIDADES, INCIDENT_STATUS, INCIDENT_STATUS_LABELS, INCIDENT_TIPO_LABELS, INCIDENT_TIPOS, IncidentGravidade (+6 more)

### Community 31 - "Community 31"
Cohesion: 0.19
Nodes (16): DOC_STATUS_LABELS, docExpiryStatus, NR10Document, PIE_CATEGORIES, PIE_CATEGORY_LABELS, PIE_CATEGORY_NORM_REF, PIE_REQUIRED_CATEGORIES, PIECategory (+8 more)

### Community 32 - "Community 32"
Cohesion: 0.13
Nodes (14): formatBRL(), useRtiNcs(), RTI_PRIORIDADE_LABELS, RTI_TIPO_EXECUCAO_LABELS, RtiBudget, RtiNc, RtiTipoExecucao, Agg (+6 more)

### Community 33 - "Community 33"
Cohesion: 0.13
Nodes (12): OrgSelectGate(), AppRole, AuthContext, AuthProvider(), AuthState, Membership, Org, ORG_ROLE_RANK (+4 more)

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 35 - "Community 35"
Cohesion: 0.16
Nodes (16): FIELD_INSPECTION_STATUS_BADGE, FIELD_INSPECTION_STATUS_LABELS, FieldInspection, useDeleteFieldInspection(), useSetArquivadaCampo(), useUpsertFieldInspection(), removerArquivosOrfaos(), ExcluirInspecaoDialog() (+8 more)

### Community 36 - "Community 36"
Cohesion: 0.11
Nodes (18): devDependencies, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-prettier, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+10 more)

### Community 37 - "Community 37"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 38 - "Community 38"
Cohesion: 0.20
Nodes (13): batchImportRti(), RtiImportNc, norm(), parseDateCell(), parseMoney(), parsePct(), ParseResult, parseStatus() (+5 more)

### Community 39 - "Community 39"
Cohesion: 0.20
Nodes (9): PageShell(), HomePage(), STATUS_COLORS, Card, CardContent, CardDescription, CardFooter, CardHeader (+1 more)

### Community 40 - "Community 40"
Cohesion: 0.13
Nodes (11): requireSupabaseAuth, supabaseAdmin, CompositeTypes, Constants, DatabaseWithoutInternals, DefaultSchema, Enums, Json (+3 more)

### Community 41 - "Community 41"
Cohesion: 0.20
Nodes (12): AchadoNovo, baixarPlanilhaModeloEstrutura(), FieldPointWithCounts, parsePlanilhaEstrutura(), useCriarPontoComColeta(), useDeleteFieldNode(), useSetoresHistoricos(), useUpsertFieldNode() (+4 more)

### Community 42 - "Community 42"
Cohesion: 0.22
Nodes (10): Acc, addPayload(), aggregateSnapshotsByMonth(), emptyAcc(), MESES_PT, monthLabel(), reportIdsInSnapshots(), RtiSnapshotPayload (+2 more)

### Community 43 - "Community 43"
Cohesion: 0.14
Nodes (12): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.14
Nodes (3): ITTraining, VencimentosData, TODAY

### Community 45 - "Community 45"
Cohesion: 0.15
Nodes (12): name, private, scripts, build, build:dev, dev, format, lint (+4 more)

### Community 46 - "Community 46"
Cohesion: 0.17
Nodes (10): CampoDatabase, db, LocalFinding, LocalInspection, LocalModoFalha, LocalNode, LocalPhoto, LocalPoint (+2 more)

### Community 47 - "Community 47"
Cohesion: 0.29
Nodes (5): useViolations(), Violation, REASON_OPTIONS, attachSupabaseAuth, supabase

### Community 48 - "Community 48"
Cohesion: 0.30
Nodes (8): ComplianceReport, INCIDENT_GRAVIDADE_WEIGHT, incidentCompliancePercent(), pct(), SnapshotPayload, snapshotPayloadFrom(), prontuarioCompleteness(), ComplianceSnapshot

### Community 49 - "Community 49"
Cohesion: 0.17
Nodes (6): AdminUsersPage(), ClientOrgRole, ExistingUser, Profile, Route, Row

### Community 50 - "Community 50"
Cohesion: 0.18
Nodes (7): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, THEMES

### Community 51 - "Community 51"
Cohesion: 0.18
Nodes (7): getEmpresaAdminAccess(), AdminEmpresasPage(), R, RANK, rascunho, sealed, seladoHaMuitoTempo

### Community 52 - "Community 52"
Cohesion: 0.29
Nodes (8): excelSerialToISO(), batchImportQualificacoes(), isFutureISO(), ParsedData, parseExcelDate(), parseWorkbook(), Route, strOrNull()

### Community 53 - "Community 53"
Cohesion: 0.24
Nodes (5): AdminCargaPage(), norm(), parseCancelled(), parseColor(), ParsedRow

### Community 54 - "Community 54"
Cohesion: 0.29
Nodes (7): CancelPadlockDialog(), REASONS, Props, ReportInconsistencyDialog(), logEvent(), Padlock, Textarea

### Community 55 - "Community 55"
Cohesion: 0.20
Nodes (8): Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut()

### Community 56 - "Community 56"
Cohesion: 0.20
Nodes (9): ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut(), ContextMenuSubContent (+1 more)

### Community 57 - "Community 57"
Cohesion: 0.20
Nodes (9): OrgRole, EmpresaAdminAccess, EmpresaGateContext, ORG_RANK, rank(), RecordAccess, ScopedAccess, ScopedGateContext (+1 more)

### Community 58 - "Community 58"
Cohesion: 0.20
Nodes (9): includeFiles, buildCommand, functions, api/server.ts, headers, installCommand, outputDirectory, rewrites (+1 more)

### Community 59 - "Community 59"
Cohesion: 0.36
Nodes (8): buildNcNumbering(), ExportResult, exportSetorFotos(), ncLabel(), NcNumbering, pad3(), resolveBlob(), sanitize()

### Community 60 - "Community 60"
Cohesion: 0.25
Nodes (6): formatTimeAgo(), SyncState, useSyncStatus(), InspectionList(), STATUS_COLOR, STATUS_LABEL

### Community 61 - "Community 61"
Cohesion: 0.25
Nodes (7): compilerOptions, module, moduleResolution, skipLibCheck, strict, target, include

### Community 62 - "Community 62"
Cohesion: 0.36
Nodes (7): COR_LABEL, EtiquetaCor, EtiquetaLOTO(), EtiquetaLOTOProps, formatTelefone(), ouTraco(), px()

### Community 63 - "Community 63"
Cohesion: 0.25
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 64 - "Community 64"
Cohesion: 0.25
Nodes (7): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator()

### Community 65 - "Community 65"
Cohesion: 0.29
Nodes (6): buildCommand, headers, installCommand, outputDirectory, rewrites, $schema

### Community 66 - "Community 66"
Cohesion: 0.33
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 67 - "Community 67"
Cohesion: 0.29
Nodes (3): Item, NcItem, TRAINING_LABELS

### Community 68 - "Community 68"
Cohesion: 0.33
Nodes (3): Action, corsHeaders, OrgRole

### Community 70 - "Community 70"
Cohesion: 0.33
Nodes (5): main, name, private, types, version

### Community 71 - "Community 71"
Cohesion: 0.33
Nodes (3): APPLY, orphans, sb

### Community 73 - "Community 73"
Cohesion: 0.40
Nodes (5): useModosFalha(), useUpsertFieldFinding(), CampoModosPage(), FindingDialog(), ModosFalhaSheet()

### Community 74 - "Community 74"
Cohesion: 0.40
Nodes (4): InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot

### Community 75 - "Community 75"
Cohesion: 0.40
Nodes (3): getRouter(), Register, routeTree

### Community 76 - "Community 76"
Cohesion: 0.50
Nodes (3): __dirname, svg, svgPath

### Community 77 - "Community 77"
Cohesion: 0.50
Nodes (3): AccordionContent, AccordionItem, AccordionTrigger

### Community 78 - "Community 78"
Cohesion: 0.50
Nodes (3): TabsContent, TabsList, TabsTrigger

### Community 79 - "Community 79"
Cohesion: 0.50
Nodes (3): Avatar, AvatarFallback, AvatarImage

## Knowledge Gaps
- **570 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `css` (+565 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.