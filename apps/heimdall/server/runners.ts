import type { TestRunCapability, UiTestRunCapability } from "./types.js";

export type SseSend = (event: string, data: unknown) => void;

export type PlaywrightReportResolve =
  | { kind: "redirect"; location: string }
  | {
      kind: "file";
      filePath?: string;
      body?: string;
      contentType: string;
    }
  | { kind: "json"; status: number; body: unknown };

export type RunnerAdapter = {
  getVitestCapability(): TestRunCapability | Promise<TestRunCapability>;
  startVitest(body: unknown): Promise<{ status: number; body: unknown }>;
  cancelVitest(): Promise<{ status: number; body: unknown }>;
  attachVitestStream?(send: SseSend): () => void;
  getUiCapability(): UiTestRunCapability | Promise<UiTestRunCapability>;
  startUi(body: unknown): Promise<{ status: number; body: unknown }>;
  cancelUi(): Promise<{ status: number; body: unknown }>;
  attachUiStream?(send: SseSend): () => void;
  resolvePlaywrightReport?(pathname: string): PlaywrightReportResolve | null;
};

let runnerAdapter: RunnerAdapter | null = null;

export function setRunnerAdapter(adapter: RunnerAdapter | null): void {
  runnerAdapter = adapter;
}

export function getRunnerAdapter(): RunnerAdapter | null {
  return runnerAdapter;
}

export function unavailableVitestCapability(): TestRunCapability {
  return { available: false, run: null };
}

export function unavailableUiCapability(): UiTestRunCapability {
  return {
    available: false,
    webAppConfigured: false,
    hostCredentialsConfigured: false,
    defaultBaseUrl: null,
    webAppRoot: "",
    run: null,
    playwrightReportUrl: null,
  };
}

export function runnersNotConfigured(): { status: number; body: { error: string } } {
  return { status: 403, body: { error: "runners not configured" } };
}
