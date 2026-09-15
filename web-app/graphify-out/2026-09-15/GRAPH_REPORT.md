# Graph Report - web-app  (2026-09-15)

## Corpus Check
- 462 files · ~341,683 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 4, .css 2, .zip 1)

## Summary
- 1623 nodes · 2846 edges · 236 communities (96 shown, 132 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown
- Unknown & Unknown

## God Nodes (most connected - your core abstractions)
1. `@supabase/supabase-js` - 176 edges
2. `react` - 86 edges
3. `xlsx` - 69 edges
4. `useDatabaseStore` - 63 edges
5. `lucide-react` - 62 edges
6. `createClient()` - 60 edges
7. `createClient()` - 46 edges
8. `useAuth()` - 42 edges
9. `dotenv` - 31 edges
10. `cn()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `DialogOverlay` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/Dialog.tsx → src/utils/cn.ts
- `ActivityLogPage()` --calls--> `exportToCSV()`  [EXTRACTED]
  src/app/activity-log/page.tsx → src/utils/exportCsv.ts
- `AdsReportPage()` --calls--> `getAdsReportData()`  [EXTRACTED]
  src/app/ads-report/page.tsx → src/app/ads-report/actions.ts
- `BudgetingAdsPage()` --calls--> `createClient()`  [EXTRACTED]
  src/app/ads-report/budgeting-ads/page.tsx → src/utils/supabase/client.ts
- `AdsReportPage()` --calls--> `createClient()`  [EXTRACTED]
  src/app/ads-report/page.tsx → src/utils/supabase/client.ts

## Import Cycles
- None detected.

## Communities (236 total, 132 thin omitted)

### Community 0 - "Unknown & Unknown"
Cohesion: 0.07
Nodes (62): getAdsReportData(), GlobalBudgetingContent(), supabase, addPaymentItem(), autoSplitUnpaidBatchItems(), bulkApproveExecutive1(), bulkApproveExecutiveFinal(), bulkApproveManager() (+54 more)

### Community 1 - "Unknown & Unknown"
Cohesion: 0.06
Nodes (51): fetchMutationsExport(), getInternalVideoData(), supabase, AlamatPage(), supabase, CreatorRow, CreatorRowProps, CampaignListingContent() (+43 more)

### Community 2 - "Unknown & Unknown"
Cohesion: 0.05
Nodes (39): nextConfig, next, supabase, metadata, DataLoader(), GlobalLoadingOverlay(), LayoutWrapper(), useSmartRealtime() (+31 more)

### Community 3 - "Unknown & Unknown"
Cohesion: 0.06
Nodes (16): { createClient }, { createClient }, supabase, { createClient }, supabase, { createClient }, supabase, @supabase/supabase-js (+8 more)

### Community 4 - "Unknown & Unknown"
Cohesion: 0.11
Nodes (24): papaparse, supabase, AddressSyncModal(), supabase, CreatorSyncModal(), supabase, supabase, UsernameAutocomplete() (+16 more)

### Community 5 - "Unknown & Unknown"
Cohesion: 0.07
Nodes (15): { Pool }, { createClient }, { Pool }, { Client }, { Client }, { Client }, env, fs (+7 more)

### Community 6 - "Unknown & Unknown"
Cohesion: 0.11
Nodes (23): ActivityLogPage(), BudgetingAdsPage(), AdsReportPage(), CampaignConceptsPage(), supabase, CampaignFilterContextWrapper(), CampaignLayoutInner(), determineContentType() (+15 more)

### Community 7 - "Unknown & Unknown"
Cohesion: 0.30
Nodes (16): supabase, MemoizedTableRow, Badge(), BadgeProps, Card, CardContent, CardDescription, CardHeader (+8 more)

### Community 8 - "Unknown & Unknown"
Cohesion: 0.12
Nodes (14): CampaignLiveStreamClient(), AddCreatorClient(), SearchableSelect(), LoginPage(), PendingPage(), SearchableSelect(), navItems, Sidebar() (+6 more)

### Community 9 - "Unknown & Unknown"
Cohesion: 0.12
Nodes (11): lucide-react, AdsImport(), FileConfig, CreatorGMV, OrganicImport(), PreviewRow, PreviewStats, SkuInfo (+3 more)

### Community 10 - "Unknown & Unknown"
Cohesion: 0.16
Nodes (16): react, BudgetSyncModal(), supabase, LiveSyncModal(), parseRp(), supabase, DialogContent, DialogHeader() (+8 more)

### Community 11 - "Unknown & Unknown"
Cohesion: 0.20
Nodes (14): @supabase/ssr, addWhitelistEmail(), approveUser(), assignCampaignsToUser(), changeUserRole(), deactivateUser(), getSupabaseAdmin(), rejectUser() (+6 more)

### Community 12 - "Unknown & Unknown"
Cohesion: 0.10
Nodes (21): dependencies, clsx, dotenv, exceljs, file-saver, lucide-react, next, papaparse (+13 more)

### Community 13 - "Unknown & Unknown"
Cohesion: 0.10
Nodes (19): action, default_icon, default_popup, background, service_worker, content_scripts, 128, 16 (+11 more)

### Community 14 - "Unknown & Unknown"
Cohesion: 0.10
Nodes (8): run(), supabase, dotenv, supabase, supabase, supabase, supabase, supabase

### Community 15 - "Unknown & Unknown"
Cohesion: 0.10
Nodes (19): name, private, version, clsx, eslint, eslint-config-next, @radix-ui/react-dialog, react-dom (+11 more)

### Community 17 - "Unknown & Unknown"
Cohesion: 0.16
Nodes (14): BatchUpdateData, batchUpdateResiByClient(), getPortalData(), loginPortal(), logoutPortal(), submitClientApproval(), supabase, updateClientNotes() (+6 more)

### Community 18 - "Unknown & Unknown"
Cohesion: 0.11
Nodes (11): xlsx, xlsx, workbook, xlsx, data, workbook, xlsx, xlsx (+3 more)

### Community 19 - "Unknown & Unknown"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 20 - "Unknown & Unknown"
Cohesion: 0.28
Nodes (16): addCurrentToQueue(), appDatabase, formatFollowers(), getTier(), init(), isInDatabase(), isInQueue(), loadAppDatabase() (+8 more)

### Community 21 - "Unknown & Unknown"
Cohesion: 0.26
Nodes (9): exceljs, file-saver, dynamic, SummaryPage(), ExcelExportButton(), Props, fetchAll(), fetchReportData() (+1 more)

### Community 22 - "Unknown & Unknown"
Cohesion: 0.29
Nodes (9): CampaignSyncModal(), supabase, ErrorLogItem, CampaignColumnMapping, CampaignParseResult, downloadCampaignSyncTemplate(), parseCampaignSyncFile(), ParsedCampaignCreatorRow (+1 more)

### Community 23 - "Unknown & Unknown"
Cohesion: 0.26
Nodes (11): { createClient }, getOrCreateBrand(), getOrCreateCampaign(), parseApproval(), parseGMV(), parsePrice(), processAll(), processSheet() (+3 more)

### Community 24 - "Unknown & Unknown"
Cohesion: 0.36
Nodes (9): deleteBatchSkusAction(), deleteSkuAction(), getCampaignSkus(), saveBatchSkusAction(), SkuInput, supabase, updateSkuAction(), SkuPage() (+1 more)

### Community 25 - "Unknown & Unknown"
Cohesion: 0.20
Nodes (7): allCreators, diffs, legacy, raw1, raw2, rawCreators, xlsx

### Community 26 - "Unknown & Unknown"
Cohesion: 0.20
Nodes (7): allCreators, diffs, legacy, raw1, raw2, rawCreators, xlsx

### Community 27 - "Unknown & Unknown"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/file-saver, @types/node, @types/react (+2 more)

### Community 28 - "Unknown & Unknown"
Cohesion: 0.31
Nodes (8): { createClient }, parseAudienceAge(), parseGMV(), parsePrice(), run(), sheetMapping, supabase, XLSX

### Community 29 - "Unknown & Unknown"
Cohesion: 0.28
Nodes (8): dataPath, fileBudgeting, fileListing, fileTracking, findHeaderRow(), normalizeStr(), runRelationsMigration(), supabase

### Community 30 - "Unknown & Unknown"
Cohesion: 0.31
Nodes (5): CampaignDailyPerformanceClient(), supabase, toWIBDateStr(), TimelineTarget(), TimelineTargetProps

### Community 31 - "Unknown & Unknown"
Cohesion: 0.39
Nodes (7): dataPath, fileListing, findHeaderRow(), normalizeLink(), normalizePhone(), normalizeUsername(), runAudit()

### Community 32 - "Unknown & Unknown"
Cohesion: 0.29
Nodes (7): dataPath, fileBudgeting, fileListing, fileTracking, findDifferences(), normalizeStr(), supabase

### Community 33 - "Unknown & Unknown"
Cohesion: 0.32
Nodes (7): dataPath, fileListing, fileTracking, findHeaderRow(), fixCampaigns(), normalizeStr(), supabase

### Community 34 - "Unknown & Unknown"
Cohesion: 0.29
Nodes (7): dataPath, fileListing, fixIswhite(), normalizeStr(), require, supabase, XLSX

### Community 35 - "Unknown & Unknown"
Cohesion: 0.32
Nodes (7): dataPath, fileListing, fileTracking, findHeaderRow(), normalizeStr(), runMigration(), supabase

### Community 36 - "Unknown & Unknown"
Cohesion: 0.29
Nodes (7): dataPath, fileBudgeting, fileListing, fileTracking, normalizeStr(), supabase, validate()

### Community 37 - "Unknown & Unknown"
Cohesion: 0.29
Nodes (7): { createClient }, dotenv, fs, mapCampaign(), run(), supabase, XLSX

### Community 38 - "Unknown & Unknown"
Cohesion: 0.29
Nodes (6): data, newKeySet, oldKeySet, OMG_MAKEUP_SKUS, workbook, XLSX

### Community 39 - "Unknown & Unknown"
Cohesion: 0.29
Nodes (6): approvals, data, parsedData, rows, workbook, xlsx

### Community 40 - "Unknown & Unknown"
Cohesion: 0.29
Nodes (6): approved, data, parsedData, rows, workbook, xlsx

### Community 41 - "Unknown & Unknown"
Cohesion: 0.33
Nodes (6): { createClient }, parseApproval(), run(), sheetMapping, supabase, XLSX

### Community 42 - "Unknown & Unknown"
Cohesion: 0.29
Nodes (6): bdContent, bdFile, ccContent, ccFile, fs, path

### Community 43 - "Unknown & Unknown"
Cohesion: 0.38
Nodes (6): dataPath, fileListing, findHeaderRow(), fixCampaignsFast(), normalizeStr(), supabase

### Community 44 - "Unknown & Unknown"
Cohesion: 0.38
Nodes (4): DragFillState, getEmptyRow(), SpreadsheetImportAddressClient(), SpreadsheetRow

### Community 45 - "Unknown & Unknown"
Cohesion: 0.38
Nodes (4): DragFillState, getEmptyRow(), SpreadsheetImportClient(), SpreadsheetRow

### Community 46 - "Unknown & Unknown"
Cohesion: 0.33
Nodes (3): ColumnMapping, EnrichedAdsRow, ParsedAdsRow

### Community 47 - "Unknown & Unknown"
Cohesion: 0.33
Nodes (5): data, parsedData, rows, workbook, xlsx

### Community 48 - "Unknown & Unknown"
Cohesion: 0.33
Nodes (5): fs, grouped, rows, workbook, XLSX

### Community 49 - "Unknown & Unknown"
Cohesion: 0.33
Nodes (5): basePath, files, fs, path, XLSX

### Community 50 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (5): dataPath, fileListing, findSpecificDiffs(), normalizeStr(), supabase

### Community 51 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (5): dataPath, fileBudgeting, normalizeStr(), runFinanceMigration(), supabase

### Community 52 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (4): data, uniqueVideos, workbook, xlsx

### Community 53 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): { createClient }, fs, supabase

### Community 54 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): fs, path, XLSX

### Community 55 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (4): brands, data, workbook, xlsx

### Community 56 - "Unknown & Unknown"
Cohesion: 0.50
Nodes (4): checkCount(), { createClient }, run(), supabase

### Community 57 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (4): data, wardahRows, workbook, xlsx

### Community 58 - "Unknown & Unknown"
Cohesion: 0.50
Nodes (4): checkColumns(), { createClient }, run(), supabase

### Community 59 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): fs, path, XLSX

### Community 60 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 61 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 62 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 63 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, start

### Community 64 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 65 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (4): content, file, fs, path

### Community 66 - "Unknown & Unknown"
Cohesion: 0.50
Nodes (4): { createClient }, levenshteinDistance(), run(), supabase

### Community 67 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 68 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): { createClient }, fs, path

### Community 69 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (4): content1, file1, fs, path

### Community 70 - "Unknown & Unknown"
Cohesion: 0.50
Nodes (4): dataPath, fileListing, findDupesInSheet(), normalizeStr()

### Community 71 - "Unknown & Unknown"
Cohesion: 0.50
Nodes (4): fileListing, fixContactsAndSnapshots(), normalizeStr(), supabase

### Community 72 - "Unknown & Unknown"
Cohesion: 0.50
Nodes (4): { createClient }, parseTikTokDate(), run(), supabase

### Community 73 - "Unknown & Unknown"
Cohesion: 0.50
Nodes (4): fileListing, fixVideos(), normalizeStr(), supabase

### Community 74 - "Unknown & Unknown"
Cohesion: 0.50
Nodes (4): fileBudgeting, normalizeStr(), runFinanceMigrationFast(), supabase

### Community 75 - "Unknown & Unknown"
Cohesion: 0.60
Nodes (3): getLivestreamData(), supabase, CampaignLiveStreamPage()

### Community 76 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 77 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 78 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 79 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 80 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 81 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): { createClient }, dotenv, supabase

### Community 82 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): { createClient }, dotenv, supabase

### Community 83 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 84 - "Unknown & Unknown"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 85 - "Unknown & Unknown"
Cohesion: 0.60
Nodes (4): findHeaderRow(), normalizeStr(), run(), xlsx

### Community 111 - "Unknown & Unknown"
Cohesion: 0.50
Nodes (3): data, xlsx, workbook

### Community 114 - "Unknown & Unknown"
Cohesion: 0.50
Nodes (3): sheets, workbook, XLSX

### Community 134 - "Unknown & Unknown"
Cohesion: 0.83
Nodes (3): extractPartnerCenter(), parseCount(), saveData()

### Community 140 - "Unknown & Unknown"
Cohesion: 0.50
Nodes (3): fs, path, tabs

### Community 149 - "Unknown & Unknown"
Cohesion: 0.50
Nodes (3): data, workbook, xlsx

### Community 150 - "Unknown & Unknown"
Cohesion: 0.50
Nodes (3): data, workbook, xlsx

### Community 157 - "Unknown & Unknown"
Cohesion: 0.50
Nodes (3): data, workbook, xlsx

### Community 158 - "Unknown & Unknown"
Cohesion: 0.50
Nodes (3): fs, workbook, XLSX

### Community 159 - "Unknown & Unknown"
Cohesion: 0.50
Nodes (3): data, workbook, XLSX

### Community 164 - "Unknown & Unknown"
Cohesion: 0.67
Nodes (3): fs, roundImage(), sharp

### Community 174 - "Unknown & Unknown"
Cohesion: 0.67
Nodes (3): getDailyData(), supabase, toWIBDateStr()

## Knowledge Gaps
- **690 isolated node(s):** `{ createClient }`, `supabaseAdmin`, `xlsx`, `workbook`, `data` (+685 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 918 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **132 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@supabase/supabase-js` connect `Unknown & Unknown` to `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`?**
  _High betweenness centrality (0.562) - this node is a cross-community bridge._
- **Why does `xlsx` connect `Unknown & Unknown` to `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`?**
  _High betweenness centrality (0.258) - this node is a cross-community bridge._
- **Why does `react` connect `Unknown & Unknown` to `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`, `Unknown & Unknown`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **What connects `{ createClient }`, `supabaseAdmin`, `xlsx` to the rest of the system?**
  _690 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Unknown & Unknown` be split into smaller, more focused modules?**
  _Cohesion score 0.0725685034628124 - nodes in this community are weakly interconnected._
- **Should `Unknown & Unknown` be split into smaller, more focused modules?**
  _Cohesion score 0.05621621621621622 - nodes in this community are weakly interconnected._
- **Should `Unknown & Unknown` be split into smaller, more focused modules?**
  _Cohesion score 0.05224963715529753 - nodes in this community are weakly interconnected._