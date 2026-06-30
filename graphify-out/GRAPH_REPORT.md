# Graph Report - src  (2026-06-29)

## Corpus Check
- 156 files · ~131,859 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1178 nodes · 3935 edges · 67 communities (62 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_LOTO Padlock Management|LOTO Padlock Management]]
- [[_COMMUNITY_Route Tree Registry|Route Tree Registry]]
- [[_COMMUNITY_Auth Guard & Dialogs|Auth Guard & Dialogs]]
- [[_COMMUNITY_Aptidão NR-10 §10.8 Rules|Aptidão NR-10 §10.8 Rules]]
- [[_COMMUNITY_NR-10 Authorization Print|NR-10 Authorization Print]]
- [[_COMMUNITY_UI Component Library|UI Component Library]]
- [[_COMMUNITY_Authorization Dialog Forms|Authorization Dialog Forms]]
- [[_COMMUNITY_EPIs & ASOs|EPIs & ASOs]]
- [[_COMMUNITY_Compliance Aggregation|Compliance Aggregation]]
- [[_COMMUNITY_Admin Routes|Admin Routes]]
- [[_COMMUNITY_NR-10 Training Dialogs|NR-10 Training Dialogs]]
- [[_COMMUNITY_RTI Budget & Progress|RTI Budget & Progress]]
- [[_COMMUNITY_AppSidebar Navigation|AppSidebar Navigation]]
- [[_COMMUNITY_Inspeções Page|Inspeções Page]]
- [[_COMMUNITY_Campo Inspection UI|Campo Inspection UI]]
- [[_COMMUNITY_RTI NC Tracking & Costs|RTI NC Tracking & Costs]]
- [[_COMMUNITY_Incidents Management|Incidents Management]]
- [[_COMMUNITY_Site Header Navigation|Site Header Navigation]]
- [[_COMMUNITY_UI Overlay Components|UI Overlay Components]]
- [[_COMMUNITY_ASOs Management|ASOs Management]]
- [[_COMMUNITY_Campo & RTI Queries|Campo & RTI Queries]]
- [[_COMMUNITY_Employee Dialog & Badges|Employee Dialog & Badges]]
- [[_COMMUNITY_Vencimentos & Tables|Vencimentos & Tables]]
- [[_COMMUNITY_Campo Finding & Photos|Campo Finding & Photos]]
- [[_COMMUNITY_RTI NC Update Operations|RTI NC Update Operations]]
- [[_COMMUNITY_RTI Format & NC Queries|RTI Format & NC Queries]]
- [[_COMMUNITY_Tenancy Gates|Tenancy Gates]]
- [[_COMMUNITY_PageShell & RTI Evidências|PageShell & RTI Evidências]]
- [[_COMMUNITY_Campo Inspection Tree|Campo Inspection Tree]]
- [[_COMMUNITY_UI Menubar Components|UI Menubar Components]]
- [[_COMMUNITY_Campo Estrutura & Points|Campo Estrutura & Points]]
- [[_COMMUNITY_Supabase Integration|Supabase Integration]]
- [[_COMMUNITY_RTI Snapshots|RTI Snapshots]]
- [[_COMMUNITY_UI Carousel|UI Carousel]]
- [[_COMMUNITY_RTI Import Pipeline|RTI Import Pipeline]]
- [[_COMMUNITY_AppSidebar Sub-components|AppSidebar Sub-components]]
- [[_COMMUNITY_LOTO Cancel Dialog|LOTO Cancel Dialog]]
- [[_COMMUNITY_EPIs Certificates|EPIs Certificates]]
- [[_COMMUNITY_NR-10 Turmas|NR-10 Turmas]]
- [[_COMMUNITY_Supabase Client & Queries|Supabase Client & Queries]]
- [[_COMMUNITY_Snapshots & Compliance|Snapshots & Compliance]]
- [[_COMMUNITY_Qualificações Import|Qualificações Import]]
- [[_COMMUNITY_Auth Provider & Root|Auth Provider & Root]]
- [[_COMMUNITY_Chart Components|Chart Components]]
- [[_COMMUNITY_Admin Carga Parse|Admin Carga Parse]]
- [[_COMMUNITY_Command UI|Command UI]]
- [[_COMMUNITY_Context Menu UI|Context Menu UI]]
- [[_COMMUNITY_Dropdown Menu UI|Dropdown Menu UI]]
- [[_COMMUNITY_LOTO Etiquetas|LOTO Etiquetas]]
- [[_COMMUNITY_Navigation Menu UI|Navigation Menu UI]]
- [[_COMMUNITY_Drawer UI|Drawer UI]]
- [[_COMMUNITY_Authorization Print & Format|Authorization Print & Format]]
- [[_COMMUNITY_Toggle Group UI|Toggle Group UI]]
- [[_COMMUNITY_Campo Archive Flow|Campo Archive Flow]]
- [[_COMMUNITY_Router Config|Router Config]]
- [[_COMMUNITY_Alert UI|Alert UI]]
- [[_COMMUNITY_Campo Ponto Coleta|Campo Ponto Coleta]]
- [[_COMMUNITY_Home Page|Home Page]]
- [[_COMMUNITY_Tabs UI|Tabs UI]]
- [[_COMMUNITY_Avatar UI|Avatar UI]]
- [[_COMMUNITY_Cercon Route|Cercon Route]]
- [[_COMMUNITY_Qualificações PLH Route|Qualificações PLH Route]]
- [[_COMMUNITY_SPDA Route|SPDA Route]]
- [[_COMMUNITY_Termografias Route|Termografias Route]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 122 edges
2. `cn()` - 78 edges
3. `Button` - 55 edges
4. `FileRoutesByPath` - 46 edges
5. `PageShell()` - 42 edges
6. `formatDatePtBR()` - 39 edges
7. `SelectTrigger` - 38 edges
8. `SelectContent` - 38 edges
9. `SelectItem` - 38 edges
10. `supabase` - 36 edges

## Surprising Connections (you probably didn't know these)
- `CommandShortcut()` --calls--> `cn()`  [EXTRACTED]
  components/ui/command.tsx → lib/utils.ts
- `ContextMenuShortcut()` --calls--> `cn()`  [EXTRACTED]
  components/ui/context-menu.tsx → lib/utils.ts
- `DrawerHeader()` --calls--> `cn()`  [EXTRACTED]
  components/ui/drawer.tsx → lib/utils.ts
- `DrawerFooter()` --calls--> `cn()`  [EXTRACTED]
  components/ui/drawer.tsx → lib/utils.ts
- `DropdownMenuShortcut()` --calls--> `cn()`  [EXTRACTED]
  components/ui/dropdown-menu.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (67 total, 5 thin omitted)

### Community 0 - "LOTO Padlock Management"
Cohesion: 0.07
Nodes (33): DeletePadlockDialog(), baseSchema, ConflictPanel(), NewPadlockDialog(), PrintLabelDialog(), Props, ReportInconsistencyDialog(), SectorSelect() (+25 more)

### Community 1 - "Route Tree Registry"
Cohesion: 0.04
Nodes (49): AdminAuditoriaRoute, AdminCargaRoute, AdminCertificadosImportarRoute, AdminEmpresasRoute, AdminQualificacoesCargaRoute, AdminReportsRoute, AdminUsuariosRoute, CadeadosCodigoRoute (+41 more)

### Community 2 - "Auth Guard & Dialogs"
Cohesion: 0.07
Nodes (35): AppRole, AuthContext, AuthState, Membership, Org, ORG_ROLE_RANK, OrgRole, OrgTipo (+27 more)

### Community 3 - "Aptidão NR-10 §10.8 Rules"
Cohesion: 0.08
Nodes (35): Aptidao, AptidaoInput, Bloqueante, BLOQUEANTE_CODES, BLOQUEANTE_LABELS, BloqueanteCode, computeAptidao(), latestBasicoDate() (+27 more)

### Community 4 - "NR-10 Authorization Print"
Cohesion: 0.15
Nodes (27): Employee, Props, FormValues, InstructionDialog(), Props, schema, Props, memberSlug() (+19 more)

### Community 5 - "UI Component Library"
Cohesion: 0.05
Nodes (37): useIsMobile(), Separator, SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay (+29 more)

### Community 6 - "Authorization Dialog Forms"
Cohesion: 0.10
Nodes (32): FormValues, Props, schema, FormValues, Props, schema, FormValues, ITTrainingDialog() (+24 more)

### Community 7 - "EPIs & ASOs"
Cohesion: 0.11
Nodes (19): latestASOByEmployee(), EPI, EPI_TYPE_LABELS, EPITest, epiTestStatus, lastTestByEpi(), nextTestDate(), epiKeys (+11 more)

### Community 8 - "Compliance Aggregation"
Cohesion: 0.12
Nodes (25): ComplianceReport, pct(), snapshotPayloadFrom(), EPI_STATUS_LABELS, INSPECTION_TYPE_SHORT, INSPECTION_TYPES, DOC_STATUS_LABELS, docExpiryStatus (+17 more)

### Community 9 - "Admin Routes"
Cohesion: 0.06
Nodes (32): Route, Route, Route, Route, Route, Route, Route, Route (+24 more)

### Community 10 - "NR-10 Training Dialogs"
Cohesion: 0.17
Nodes (28): AuthorizationDialog(), NR10TrainingDialog(), useASOs(), useComplianceReport(), useEPIs(), useEPITests(), useInspections(), useNR10Documents() (+20 more)

### Community 11 - "RTI Budget & Progress"
Cohesion: 0.10
Nodes (23): computeAndamentoPorCusto(), computeBudget(), matchCustoFiltro(), ncPrazoBucket(), RTI_EVIDENCIA_TIPO_LABELS, RTI_EVIDENCIA_TIPOS, RTI_NC_STATUS_LABELS, RTI_PRAZO_BUCKET_COLORS (+15 more)

### Community 12 - "AppSidebar Navigation"
Cohesion: 0.10
Nodes (25): SidebarGroup(), SidebarSingleLink(), SidebarSubLink(), cn(), Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink (+17 more)

### Community 13 - "Inspeções Page"
Cohesion: 0.15
Nodes (22): ActionPlanDialog(), InspecoesPage(), InspectionDialog(), ACTION_STATUS_LABELS, ACTION_STATUSES, ActionStatus, Inspection, INSPECTION_RESULT_LABELS (+14 more)

### Community 14 - "Campo Inspection UI"
Cohesion: 0.11
Nodes (23): AchadoNovoUI, FIELD_INSPECTION_STATUS_BADGE, FIELD_INSPECTION_STATUS_LABELS, FieldInspection, NIVEL_LABEL_PLURAL, NivelArvore, AchadoNovo, baixarPlanilhaModeloEstrutura() (+15 more)

### Community 15 - "RTI NC Tracking & Costs"
Cohesion: 0.12
Nodes (22): clampPrioridade(), ncPrazoVencido(), rtiFileUrl(), rtiKeys, useAddRtiEvidencia(), useAddRtiHistorico(), useDeleteRtiEvidencia(), useDeleteRtiNc() (+14 more)

### Community 16 - "Incidents Management"
Cohesion: 0.16
Nodes (16): ElectricalIncident, INCIDENT_GRAVIDADE_LABELS, INCIDENT_GRAVIDADES, INCIDENT_STATUS, INCIDENT_STATUS_LABELS, INCIDENT_TIPO_LABELS, INCIDENT_TIPOS, IncidentGravidade (+8 more)

### Community 17 - "Site Header Navigation"
Cohesion: 0.12
Nodes (17): NR10AdminItems(), OrgSwitcher(), QualDropdown(), RACDropdown(), RTIDropdown(), UserMenu(), VencimentosBell(), useAuth() (+9 more)

### Community 18 - "UI Overlay Components"
Cohesion: 0.09
Nodes (14): AccordionContent, AccordionItem, AccordionTrigger, HoverCardContent, InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot (+6 more)

### Community 19 - "ASOs Management"
Cohesion: 0.16
Nodes (17): ASO, ASO_RESULTADO_LABELS, ASO_RESULTADOS, ASO_STATUS_LABELS, ASO_TIPO_LABELS, ASO_TIPOS, ASOResultado, asoStatus (+9 more)

### Community 20 - "Campo & RTI Queries"
Cohesion: 0.16
Nodes (18): useFieldInspections(), bulkAttachRtiEvidencias(), logBulkHistorico(), RtiImportPayload, uploadRtiFile(), useDeleteRtiReport(), useRtiEvidenciaFileIndex(), useRtiReports() (+10 more)

### Community 21 - "Employee Dialog & Badges"
Cohesion: 0.16
Nodes (18): EmployeeDialog(), EMPLOYEE_STATUS_LABELS, useDeleteEmployee(), useEmployees(), useUpsertEmployee(), useWorkInstructions(), SETOR_FULL_NAMES, ASOsPage() (+10 more)

### Community 22 - "Vencimentos & Tables"
Cohesion: 0.15
Nodes (15): VENC_KIND_LABELS, VENC_KINDS, VencKind, ACTION_LABELS, AuditEntry, IGNORED_FIELDS, TABLE_LABELS, VencimentosPage() (+7 more)

### Community 23 - "Campo Finding & Photos"
Cohesion: 0.14
Nodes (20): FieldFinding, FieldPhoto, formatNormas(), modosPorCategoria(), NIVEL_LABEL, useAddFieldPhoto(), useDeleteFieldFinding(), useDeleteFieldPhoto() (+12 more)

### Community 24 - "RTI NC Update Operations"
Cohesion: 0.15
Nodes (16): ncPrazoProximo(), useBulkUpdateRtiNcs(), useCreateRtiArea(), useCreateRtiNc(), useEntregarRtiReport(), useRtiAreas(), useRtiEvidenciaIndex(), RTI_CUSTO_FILTRO_LABELS (+8 more)

### Community 25 - "RTI Format & NC Queries"
Cohesion: 0.13
Nodes (14): formatBRL(), useRtiNcs(), RTI_PRIORIDADE_LABELS, RTI_TIPO_EXECUCAO_LABELS, RtiBudget, RtiNc, RtiTipoExecucao, Agg (+6 more)

### Community 26 - "Tenancy Gates"
Cohesion: 0.11
Nodes (14): EmpresaAdminAccess, EmpresaGateContext, getEmpresaAdminAccess(), ORG_RANK, rank(), RecordAccess, ScopedAccess, ScopedGateContext (+6 more)

### Community 27 - "PageShell & RTI Evidências"
Cohesion: 0.18
Nodes (12): PageShell(), extractNcNumero(), extractNumeroFromText(), FileRow, STATUS_COLORS, Card, CardContent, CardDescription (+4 more)

### Community 28 - "Campo Inspection Tree"
Cohesion: 0.16
Nodes (15): caminhoAbaixoDoSetor(), FIELD_INSPECTION_STATUSES, FieldInspectionStatus, FieldNode, filhosDoNo(), NIVEIS_ARVORE, nodePath(), NormaRef (+7 more)

### Community 29 - "UI Menubar Components"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 30 - "Campo Estrutura & Points"
Cohesion: 0.15
Nodes (13): EstruturaLinha, FieldPoint, normalizarEstrutura(), bulkCreateNodes(), campoKeys, ComporRtiDestino, ComporRtiResult, InspectionFinding (+5 more)

### Community 31 - "Supabase Integration"
Cohesion: 0.14
Nodes (12): requireSupabaseAuth, supabaseAdmin, CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums (+4 more)

### Community 32 - "RTI Snapshots"
Cohesion: 0.22
Nodes (10): Acc, addPayload(), aggregateSnapshotsByMonth(), emptyAcc(), MESES_PT, monthLabel(), reportIdsInSnapshots(), RtiSnapshotPayload (+2 more)

### Community 33 - "UI Carousel"
Cohesion: 0.14
Nodes (12): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+4 more)

### Community 34 - "RTI Import Pipeline"
Cohesion: 0.26
Nodes (11): batchImportRti(), RtiImportNc, norm(), parseMoney(), parsePct(), ParseResult, parseStatus(), parseWorkbook() (+3 more)

### Community 35 - "AppSidebar Sub-components"
Cohesion: 0.22
Nodes (11): AppSidebar(), NavGroup, SubItem, getInitials(), SiteHeader(), useDeleteEPI(), getGestaoCompletaAccess(), getLotoAccess() (+3 more)

### Community 36 - "LOTO Cancel Dialog"
Cohesion: 0.18
Nodes (7): CancelPadlockDialog(), REASONS, formatDateTime(), Report, ReportEvent, ReportStatus, Textarea

### Community 37 - "EPIs Certificates"
Cohesion: 0.21
Nodes (9): EPI_TYPES, EPIType, epiCertificateUrl(), uploadEPICertificate(), useDeleteEPITest(), useInsertEPITest(), useUpsertEPI(), EPIDialog() (+1 more)

### Community 38 - "NR-10 Turmas"
Cohesion: 0.24
Nodes (11): NR10TurmaDialog(), useRegistrarTurma(), getPessoasAccess(), DialogState, EmployeeRow, FormacaoCell(), FormacaoIcon(), NaoObrigatorioCell() (+3 more)

### Community 39 - "Supabase Client & Queries"
Cohesion: 0.26
Nodes (5): useViolations(), Violation, REASON_OPTIONS, attachSupabaseAuth, supabase

### Community 40 - "Snapshots & Compliance"
Cohesion: 0.29
Nodes (8): SnapshotPayload, useIncidents(), ComplianceSnapshot, useComplianceSnapshots(), useEnsureMonthlySnapshot(), RelatorioPage(), Route, TREND_SERIES

### Community 41 - "Qualificações Import"
Cohesion: 0.25
Nodes (9): excelSerialToISO(), batchImportQualificacoes(), isFutureISO(), ParsedData, parseExcelDate(), parseWorkbook(), QualificacoesCargaPage(), strOrNull() (+1 more)

### Community 42 - "Auth Provider & Root"
Cohesion: 0.20
Nodes (6): AuthProvider(), queryClient, Route, FileRoutesById, Toaster(), ToasterProps

### Community 43 - "Chart Components"
Cohesion: 0.18
Nodes (7): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, THEMES

### Community 44 - "Admin Carga Parse"
Cohesion: 0.24
Nodes (5): norm(), parseCancelled(), parseColor(), ParsedRow, TableCell

### Community 45 - "Command UI"
Cohesion: 0.20
Nodes (8): Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut()

### Community 46 - "Context Menu UI"
Cohesion: 0.20
Nodes (9): ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut(), ContextMenuSubContent (+1 more)

### Community 47 - "Dropdown Menu UI"
Cohesion: 0.20
Nodes (9): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut(), DropdownMenuSubContent (+1 more)

### Community 48 - "LOTO Etiquetas"
Cohesion: 0.36
Nodes (7): COR_LABEL, EtiquetaCor, EtiquetaLOTO(), EtiquetaLOTOProps, formatTelefone(), ouTraco(), px()

### Community 49 - "Navigation Menu UI"
Cohesion: 0.25
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 50 - "Drawer UI"
Cohesion: 0.25
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 51 - "Authorization Print & Format"
Cohesion: 0.29
Nodes (7): AuthorizationPrintDialog(), formatDatePtBR(), useUpdateRtiNc(), pctConcl(), RtiDashboardPage(), GestaoCard(), hoje

### Community 52 - "Toggle Group UI"
Cohesion: 0.33
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 53 - "Campo Archive Flow"
Cohesion: 0.33
Nodes (6): useSetArquivadaCampo(), useUpsertFieldInspection(), InspectionCard(), NovaInspecaoDialog(), ReexportarDialog(), ComporRtiDialog()

### Community 54 - "Router Config"
Cohesion: 0.40
Nodes (3): getRouter(), Register, routeTree

### Community 55 - "Alert UI"
Cohesion: 0.40
Nodes (4): Alert, AlertDescription, AlertTitle, alertVariants

### Community 56 - "Campo Ponto Coleta"
Cohesion: 0.50
Nodes (4): useCriarPontoComColeta(), useModosFalha(), CapturaPontoSheet(), CampoModosPage()

### Community 58 - "Tabs UI"
Cohesion: 0.50
Nodes (3): TabsContent, TabsList, TabsTrigger

### Community 59 - "Avatar UI"
Cohesion: 0.50
Nodes (3): Avatar, AvatarFallback, AvatarImage

## Knowledge Gaps
- **324 isolated node(s):** `ViolacoesRoute`, `ResetPasswordRoute`, `LoginRoute`, `DashboardRoute`, `IndexRoute` (+319 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `AppSidebar Navigation` to `Auth Guard & Dialogs`, `NR-10 Authorization Print`, `UI Component Library`, `Authorization Dialog Forms`, `UI Overlay Components`, `Employee Dialog & Badges`, `Vencimentos & Tables`, `RTI NC Update Operations`, `PageShell & RTI Evidências`, `UI Menubar Components`, `UI Carousel`, `AppSidebar Sub-components`, `LOTO Cancel Dialog`, `NR-10 Turmas`, `Chart Components`, `Command UI`, `Context Menu UI`, `Dropdown Menu UI`, `Navigation Menu UI`, `Drawer UI`, `Toggle Group UI`, `Alert UI`, `Tabs UI`, `Avatar UI`?**
  _High betweenness centrality (0.138) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Site Header Navigation` to `LOTO Padlock Management`, `Auth Guard & Dialogs`, `NR-10 Authorization Print`, `EPIs & ASOs`, `Compliance Aggregation`, `NR-10 Training Dialogs`, `RTI Budget & Progress`, `Inspeções Page`, `Campo Inspection UI`, `RTI NC Tracking & Costs`, `Incidents Management`, `ASOs Management`, `Campo & RTI Queries`, `Employee Dialog & Badges`, `Vencimentos & Tables`, `Campo Finding & Photos`, `RTI NC Update Operations`, `Tenancy Gates`, `PageShell & RTI Evidências`, `RTI Import Pipeline`, `AppSidebar Sub-components`, `LOTO Cancel Dialog`, `EPIs Certificates`, `NR-10 Turmas`, `Supabase Client & Queries`, `Snapshots & Compliance`, `Qualificações Import`, `Admin Carga Parse`, `Authorization Print & Format`, `Campo Archive Flow`, `Campo Ponto Coleta`, `Home Page`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Why does `Button` connect `NR-10 Authorization Print` to `LOTO Padlock Management`, `Auth Guard & Dialogs`, `Aptidão NR-10 §10.8 Rules`, `UI Component Library`, `Authorization Dialog Forms`, `Compliance Aggregation`, `NR-10 Training Dialogs`, `RTI Budget & Progress`, `AppSidebar Navigation`, `Inspeções Page`, `Campo Inspection UI`, `RTI NC Tracking & Costs`, `Incidents Management`, `ASOs Management`, `Campo & RTI Queries`, `Employee Dialog & Badges`, `Vencimentos & Tables`, `Campo Finding & Photos`, `RTI NC Update Operations`, `RTI Format & NC Queries`, `PageShell & RTI Evidências`, `UI Carousel`, `RTI Import Pipeline`, `LOTO Cancel Dialog`, `EPIs Certificates`, `NR-10 Turmas`, `Supabase Client & Queries`, `Snapshots & Compliance`, `Qualificações Import`, `Admin Carga Parse`, `Home Page`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `ViolacoesRoute`, `ResetPasswordRoute`, `LoginRoute` to the rest of the system?**
  _324 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `LOTO Padlock Management` be split into smaller, more focused modules?**
  _Cohesion score 0.07058823529411765 - nodes in this community are weakly interconnected._
- **Should `Route Tree Registry` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Auth Guard & Dialogs` be split into smaller, more focused modules?**
  _Cohesion score 0.07358156028368794 - nodes in this community are weakly interconnected._