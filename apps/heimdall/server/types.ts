export type StoryStatus = "backlog" | "ready-for-dev" | "in-progress" | "review" | "blocked" | "done";

export type EpicStatus = "backlog" | "in-progress" | "done";

export type DocCategory = "project" | "requirements" | "planning" | "implementation";

export interface StoryCounts {
  backlog: number;
  readyForDev: number;
  inProgress: number;
  review: number;
  blocked: number;
  done: number;
  total: number;
}

export interface EpicRecord {
  id: string;
  number: number;
  /** Display code when non-numeric family (e.g. C1.1). */
  code?: string;
  title: string;
  goal: string;
  status: EpicStatus;
  storyCounts: StoryCounts;
  featureIds: string[];
  isEnabler: boolean;
  approvalTag?: string;
  /** Present in Modules mode (FR-14). */
  moduleId?: string;
  moduleLabel?: string;
  /** Config `modules[].idPrefix` — display-time epic/story label prefix. */
  idPrefix?: string;
}

export interface TaskProgress {
  completed: number;
  total: number;
}

export interface StoryRecord {
  id: string;
  epicId: string;
  epicNumber: number;
  number: number;
  /** Display code when non-numeric family (e.g. C1.1.1). */
  code?: string;
  title: string;
  status: StoryStatus;
  userStory?: string;
  acceptanceCriteria?: string;
  hasImplementationFile: boolean;
  implementationPath?: string;
  taskProgress?: TaskProgress;
  blockers: string[];
  featureIds: string[];
  /** Present in Modules mode (FR-14). */
  moduleId?: string;
  moduleLabel?: string;
  /** Config `modules[].idPrefix` — display-time epic/story label prefix. */
  idPrefix?: string;
}

export interface DeliverySlice {
  name: string;
  storyIds: string[];
}

export interface FeatureRecord {
  id: string;
  name: string;
  epicId: string;
  screens: string[];
  status: string;
  goal?: string;
  includes: string[];
  /** True product/engineering deferrals for this feature. */
  deferred: string[];
  /** Capabilities owned by other features (not gaps). */
  seeAlso: string[];
  /** @deprecated Alias of `deferred` for older consumers. */
  outOfScope: string[];
  areaId: string;
  area: string;
  /** Present in Modules mode (FR-14). */
  moduleId?: string;
  moduleLabel?: string;
}

export interface ExternalGap {
  id: string;
  summary: string;
  owner: string;
  status: "open" | "partial" | "closed";
}

export interface OpenQuestion {
  id: string;
  question: string;
  source: string;
}

export type DeferredItemKind = "product" | "integration" | "engineering" | "tooling";
export type DeferredItemStatus = "deferred" | "done" | "cancelled";

export interface DeferredItem {
  id: string;
  kind: DeferredItemKind;
  summary: string;
  source: string;
  timing: string;
  status: DeferredItemStatus;
}

export interface RetrospectiveRecord {
  epicId: string;
  status: "optional" | "done";
}

export interface DashboardSnapshot {
  meta: {
    /** Sprint-tracking slug from sprint-status `project:` (default `project`). */
    project: string;
    /** From docs/project-context.md → module_name. */
    moduleName: string;
    /** From docs/project-context.md → project_name. */
    projectName: string;
    lastUpdated: string;
    generatedAt: string;
  };
  summary: {
    epics: Record<EpicStatus, number>;
    stories: Record<StoryStatus, number>;
    storyCompletionPct: number;
    openBlockers: number;
    openQuestions: number;
    openExtGaps: number;
    deferredItems: number;
  };
  epics: EpicRecord[];
  stories: StoryRecord[];
  deliverySlices: DeliverySlice[];
  features: FeatureRecord[];
  externalGaps: ExternalGap[];
  openQuestions: OpenQuestion[];
  deferredItems: DeferredItem[];
  retrospectives: RetrospectiveRecord[];
}

export interface DocRecord {
  path: string;
  title: string;
  category: DocCategory;
  section?: string;
  wordCount: number;
  modifiedAt: string;
  relatedStoryIds: string[];
  relatedFeatureIds: string[];
  isYaml?: boolean;
}

export interface SearchResult {
  path: string;
  title: string;
  category: DocCategory;
  score: number;
  snippets: string[];
}

export interface DocCatalog {
  docs: DocRecord[];
  generatedAt: string;
}

export interface StoryDetail extends StoryRecord {
  blockingSection?: string;
  devNotes?: string;
  rawImplementation?: string;
  epicTitle?: string;
}

export type TestLevel = "L1" | "L2" | "L3" | "L4" | "tooling";

export interface TestCaseRecord {
  name: string;
  suitePath: string[];
  /** Runtime overlay from docs/validation/reports/vitest-runs/latest.json */
  lastRun?: VitestCaseRunResult | null;
}

export interface TestFileRecord {
  path: string;
  area: string;
  level: TestLevel;
  suiteName: string;
  cases: TestCaseRecord[];
  caseCount: number;
  lastRun?: VitestFileRunResult | null;
}

export interface TestCatalog {
  files: TestFileRecord[];
  summary: {
    fileCount: number;
    caseCount: number;
    byLevel: Record<TestLevel, number>;
  };
  generatedAt: string;
  /** Present when GET /tests merges vitest-runs overlay */
  lastRun?: VitestRunSnapshot | null;
  /** From `pages.testLevels` — UI must gate cards/filters on this when present. */
  enabledLevels?: Array<TestLevel | "L5">;
}

export type VitestRunOutcome = "passed" | "failed" | "skipped";

export interface VitestCaseRunResult {
  outcome: VitestRunOutcome;
  durationMs?: number;
  error?: string;
}

export interface VitestFileRunResult {
  outcome: VitestRunOutcome;
  passed: number;
  failed: number;
  skipped: number;
  durationMs?: number;
  runAt?: string;
}

export interface VitestRunSnapshot {
  schemaVersion: 1;
  runAt: string | null;
  source: string;
  command?: string;
  branch?: string;
  commit?: string;
  summary: {
    passed: number;
    failed: number;
    skipped: number;
  };
  files: Record<string, VitestFileRunResult>;
  cases: Record<string, VitestCaseRunResult>;
}

export type RunnableTestLevel = "L1" | "L2";

export type TestRunScope = { scope: "level"; level: RunnableTestLevel } | { scope: "file"; path: string } | { scope: "files"; paths: string[] };

export type TestRunPhase = "running" | "passed" | "failed" | "cancelled";

export interface TestRunSummary {
  passed: number;
  failed: number;
  skipped: number;
}

export interface TestRunSnapshot {
  runId: string;
  scope: TestRunScope;
  paths: string[];
  status: TestRunPhase;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  cancelled: boolean;
  log: string;
  summary: TestRunSummary | null;
}

export interface TestRunCapability {
  available: boolean;
  run: TestRunSnapshot | null;
}

/** L5 Playwright run scope (dashboard → WebApp). */
export type UiTestRunScope = { scope: "all" } | { scope: "screen"; screenId: string } | { scope: "case"; caseId: string };

export interface UiTestRunCredentials {
  adminEmail?: string;
  adminPassword?: string;
  viewerEmail?: string;
  viewerPassword?: string;
}

export type UiTestRunPhase = "running" | "passed" | "failed" | "cancelled";

export interface UiTestRunSummary {
  passed: number;
  failed: number;
  skipped: number;
}

export interface UiTestRunSnapshot {
  runId: string;
  scope: UiTestRunScope;
  grep: string | null;
  baseUrl: string | null;
  credentialsProvided: boolean;
  status: UiTestRunPhase;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  cancelled: boolean;
  log: string;
  summary: UiTestRunSummary | null;
  phase: "setup" | "suite" | null;
  playwrightReportAvailable: boolean;
  playwrightReportUrl: string | null;
}

export interface UiTestRunCapability {
  available: boolean;
  webAppConfigured: boolean;
  hostCredentialsConfigured: boolean;
  defaultBaseUrl: string | null;
  formDefaults?: UiPlaywrightFormDefaults;
  webAppRoot: string;
  run: UiTestRunSnapshot | null;
  playwrightReportUrl: string | null;
}

export interface UiPlaywrightFormDefaults {
  baseUrl?: string;
  adminEmail?: string;
  adminPassword?: string;
  viewerEmail?: string;
  viewerPassword?: string;
}

export interface UiTestRunStartBody {
  scope: "all" | "screen" | "case";
  screenId?: string;
  caseId?: string;
  baseUrl?: string;
  credentials?: UiTestRunCredentials;
}
