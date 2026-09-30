<script lang="ts">
  import { formatMoney } from "$lib/finance/money";
  import type { ImportPreview, ImportResult } from "$lib/importers/types";

  type FilterKey = "all" | "will_import" | "duplicate" | "invalid" | "warning" | "accepted" | "skipped" | "rejected";

  type Props = {
    mode: "preview" | "result";
    currencyCode: string;
    preview?: ImportPreview | null;
    result?: (ImportResult & { metadata?: Record<string, string> }) | null;
    confirming?: boolean;
    confirmProgress?: number;
    confirmStatus?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    onClose?: () => void;
    onDownloadReport?: () => void;
  };

  const {
    mode,
    currencyCode,
    preview = null,
    result = null,
    confirming = false,
    confirmProgress = 0,
    confirmStatus = "",
    onConfirm,
    onCancel,
    onClose,
    onDownloadReport,
  }: Props = $props();

  let filter = $state<FilterKey>("all");

  function formatDisplayDate(iso?: string): string {
    if (!iso) return "—";
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function money(minor?: number | null): string {
    if (minor == null) return "—";
    return formatMoney(minor, currencyCode);
  }

  const previewRows = $derived(preview?.rows ?? []);

  const resultRows = $derived(
    (result?.issues ?? []).map((issue) => ({
      row: issue.row,
      status: issue.status as "skipped" | "rejected",
      reasons: [issue.reason],
      occurredOn: issue.occurredOn,
      amountMinor: issue.amountMinor,
      type: issue.type,
      merchant: issue.merchant,
      externalRef: issue.externalRef,
      notes: issue.notes,
    }))
  );

  const filteredPreview = $derived.by(() => {
    if (filter === "all") return previewRows;
    return previewRows.filter((row) => row.status === filter);
  });

  const filteredResult = $derived.by(() => {
    if (filter === "all") return resultRows;
    return resultRows.filter((row) => row.status === filter);
  });

  function statusLabel(status: string): string {
    switch (status) {
      case "will_import":
        return "Will import";
      case "duplicate":
        return "Duplicate";
      case "invalid":
        return "Invalid";
      case "warning":
        return "Warning";
      case "skipped":
        return "Skipped";
      case "rejected":
        return "Rejected";
      case "accepted":
        return "Accepted";
      default:
        return status;
    }
  }
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="import-review-title">
  <div class="sheet">
    <header class="sheet-head">
      <div>
        <p class="eyebrow">{mode === "preview" ? "Pre-import review" : "Post-import report"}</p>
        <h2 id="import-review-title">
          {#if mode === "preview"}
            {preview?.fileName ?? "Statement preview"}
          {:else}
            Import finished
          {/if}
        </h2>
      </div>
      <button type="button" class="icon-close" onclick={() => (mode === "preview" ? onCancel?.() : onClose?.())} disabled={confirming}>
        Close
      </button>
    </header>

    {#if mode === "preview" && preview}
      <section class="summary">
        <div class="stat">
          <span class="stat-label">Rows parsed</span>
          <strong>{preview.totalRows.toLocaleString()}</strong>
        </div>
        <div class="stat ok">
          <span class="stat-label">Will import</span>
          <strong>{preview.willImport.toLocaleString()}</strong>
        </div>
        <div class="stat warn">
          <span class="stat-label">Duplicates</span>
          <strong>{preview.duplicates.toLocaleString()}</strong>
        </div>
        <div class="stat bad">
          <span class="stat-label">Invalid</span>
          <strong>{preview.invalid.toLocaleString()}</strong>
        </div>
        <div class="stat warn">
          <span class="stat-label">Warnings</span>
          <strong>{preview.warnings.toLocaleString()}</strong>
        </div>
      </section>

      <section class="balance-card">
        <div>
          <span class="stat-label">Current balance</span>
          <strong>{preview.currentBalance ? money(preview.currentBalance.balanceMinor) : "None yet"}</strong>
          {#if preview.currentBalance}
            <span class="dim">as of {formatDisplayDate(preview.currentBalance.asOf)}</span>
          {/if}
        </div>
        <div class="arrow" aria-hidden="true">→</div>
        <div>
          <span class="stat-label">Balance after this import</span>
          <strong class="projected">
            {preview.projectedBalance ? money(preview.projectedBalance.balanceMinor) : "Unchanged / unknown"}
          </strong>
          {#if preview.projectedBalance}
            <span class="dim">
              as of {formatDisplayDate(preview.projectedBalance.asOf)}
              {#if preview.projectedBalance.willUpdateAccount}
                · will update account snapshot
              {:else}
                · will not replace current snapshot
              {/if}
            </span>
          {/if}
        </div>
      </section>

      <div class="filters">
        {#each [["all", `All (${preview.totalRows})`], ["will_import", `Will import (${preview.willImport})`], ["duplicate", `Duplicates (${preview.duplicates})`], ["warning", `Warnings (${preview.warnings})`], ["invalid", `Invalid (${preview.invalid})`]] as [key, label]}
          <button type="button" class:active={filter === key} onclick={() => (filter = key as FilterKey)} disabled={confirming}>
            {label}
          </button>
        {/each}
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Status</th>
              <th>Date</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Balance</th>
              <th>Merchant</th>
              <th>Reference</th>
              <th>Notes / issues</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredPreview as row (row.row)}
              <tr class={row.status}>
                <td>{row.row}</td>
                <td><span class="badge {row.status}">{statusLabel(row.status)}</span></td>
                <td>{formatDisplayDate(row.occurredOn)}</td>
                <td>{row.type ?? "—"}</td>
                <td class="num">{money(row.amountMinor)}</td>
                <td class="num">{money(row.balanceMinor)}</td>
                <td>{row.merchant || "—"}</td>
                <td class="mono">{row.externalRef || "—"}</td>
                <td class="reasons">
                  {#if row.reasons.length}
                    {row.reasons.join(" · ")}
                  {:else}
                    —
                  {/if}
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan="9" class="empty">No rows in this filter.</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if confirming}
        <div class="confirm-progress">
          <div class="bar"><div style="width: {confirmProgress}%"></div></div>
          <p class="dim">{confirmStatus}</p>
        </div>
      {/if}

      <footer class="sheet-foot">
        <p class="dim foot-copy">
          Nothing has been written yet. Confirm to import {preview.willImport.toLocaleString()} new row{preview.willImport === 1 ? "" : "s"}
          {#if preview.duplicates}
            · {preview.duplicates.toLocaleString()} duplicate{preview.duplicates === 1 ? "" : "s"} will be skipped (balances may still sync)
          {/if}.
        </p>
        <div class="foot-actions">
          <button type="button" class="ghost" onclick={() => onCancel?.()} disabled={confirming}>Cancel</button>
          <button
            type="button"
            class="primary"
            onclick={() => onConfirm?.()}
            disabled={confirming || (preview.willImport === 0 && preview.duplicates === 0)}
          >
            {confirming ? "IMPORTING…" : "CONFIRM IMPORT"}
          </button>
        </div>
      </footer>
    {:else if mode === "result" && result}
      <section class="summary">
        <div class="stat">
          <span class="stat-label">Total rows</span>
          <strong>{result.totalRows.toLocaleString()}</strong>
        </div>
        <div class="stat ok">
          <span class="stat-label">Accepted</span>
          <strong>{result.accepted.toLocaleString()}</strong>
        </div>
        <div class="stat warn">
          <span class="stat-label">Skipped</span>
          <strong>{result.skipped.toLocaleString()}</strong>
        </div>
        <div class="stat bad">
          <span class="stat-label">Rejected</span>
          <strong>{result.rejected.toLocaleString()}</strong>
        </div>
      </section>

      <section class="balance-card">
        <div>
          <span class="stat-label">Balance after import</span>
          <strong class="projected">
            {result.resultingBalance ? money(result.resultingBalance.balanceMinor) : "Unavailable"}
          </strong>
          {#if result.resultingBalance}
            <span class="dim">as of {formatDisplayDate(result.resultingBalance.asOf)}</span>
          {/if}
        </div>
      </section>

      {#if result.issues.length}
        <div class="filters">
          {#each [["all", `Issues (${result.issues.length})`], ["skipped", `Skipped (${result.skipped})`], ["rejected", `Rejected (${result.rejected})`]] as [key, label]}
            <button type="button" class:active={filter === key} onclick={() => (filter = key as FilterKey)}>
              {label}
            </button>
          {/each}
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Status</th>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Merchant</th>
                <th>Reference</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredResult as row (row.row + row.status + row.reasons[0])}
                <tr class={row.status}>
                  <td>{row.row}</td>
                  <td><span class="badge {row.status}">{statusLabel(row.status)}</span></td>
                  <td>{formatDisplayDate(row.occurredOn)}</td>
                  <td>{row.type ?? "—"}</td>
                  <td class="num">{money(row.amountMinor)}</td>
                  <td>{row.merchant || "—"}</td>
                  <td class="mono">{row.externalRef || "—"}</td>
                  <td class="reasons">{row.reasons.join(" · ")}</td>
                </tr>
              {:else}
                <tr>
                  <td colspan="8" class="empty">No issues in this filter.</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="all-good">All parsed rows were imported. No skips or rejections.</p>
      {/if}

      <footer class="sheet-foot">
        <div class="foot-actions">
          {#if result.reportCsv && onDownloadReport}
            <button type="button" class="ghost" onclick={() => onDownloadReport()}>Download report CSV</button>
          {/if}
          <button type="button" class="primary" onclick={() => onClose?.()}>Done</button>
        </div>
      </footer>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: color-mix(in srgb, #0b0a12 72%, transparent);
    display: grid;
    place-items: center;
    padding: 1rem;
  }

  .sheet {
    width: min(1120px, 100%);
    max-height: min(92vh, 960px);
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    background: var(--surface);
    border: 2px solid var(--chrome-line);
    box-shadow: 0 24px 80px color-mix(in srgb, #000 45%, transparent);
    padding: 1rem 1.1rem 1.1rem;
  }

  .sheet-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
  }

  .eyebrow {
    margin: 0;
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }

  h2 {
    margin: 0.15rem 0 0;
    font-family: "Archivo Black", sans-serif;
    font-size: 1.05rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .icon-close,
  .ghost,
  .primary,
  .filters button {
    font-family: inherit;
    cursor: pointer;
  }

  .icon-close,
  .ghost {
    background: transparent;
    border: 2px solid var(--chrome-line);
    color: var(--main-text);
    padding: 0.4rem 0.7rem;
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .primary {
    background: linear-gradient(90deg, var(--hi-purple), var(--hi-cyan));
    border: none;
    color: #0b0a12;
    font-weight: 700;
    padding: 0.5rem 0.9rem;
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .primary:disabled,
  .ghost:disabled,
  .icon-close:disabled,
  .filters button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 0.55rem;
  }

  .stat {
    border: 1px solid var(--chrome-line);
    background: var(--surface2);
    padding: 0.55rem 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .stat strong {
    font-size: 1.05rem;
  }

  .stat.ok strong {
    color: color-mix(in srgb, #3ecf8e 85%, white);
  }

  .stat.warn strong {
    color: color-mix(in srgb, #f0b429 90%, white);
  }

  .stat.bad strong {
    color: color-mix(in srgb, #ff6b6b 90%, white);
  }

  .stat-label {
    font-size: 0.64rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .balance-card {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.25rem;
    align-items: center;
    border: 2px solid var(--chrome-line);
    background: var(--surface2);
    padding: 0.75rem 0.85rem;
  }

  .balance-card > div {
    flex: 1;
    min-width: 160px;
  }

  .balance-card strong {
    display: block;
    margin-top: 0.15rem;
    font-size: 1.15rem;
  }

  .projected {
    color: var(--hi-cyan);
  }

  .arrow {
    color: var(--muted);
    font-size: 1.2rem;
  }

  .dim {
    display: block;
    margin-top: 0.15rem;
    color: var(--muted);
    font-size: 0.72rem;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .filters button {
    background: var(--surface2);
    border: 1px solid var(--chrome-line);
    color: var(--muted);
    padding: 0.3rem 0.55rem;
    font-size: 0.68rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .filters button.active {
    color: var(--main-text);
    border-color: var(--hi-cyan);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hi-cyan) 35%, transparent);
  }

  .table-wrap {
    flex: 1;
    min-height: 220px;
    overflow: auto;
    border: 1px solid var(--chrome-line);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.74rem;
  }

  th,
  td {
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid color-mix(in srgb, var(--chrome-line) 70%, transparent);
    text-align: left;
    vertical-align: top;
  }

  th {
    position: sticky;
    top: 0;
    background: var(--surface2);
    font-size: 0.62rem;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--muted);
    z-index: 1;
  }

  .num {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .mono {
    font-family: "Fira Mono", ui-monospace, monospace;
    font-size: 0.68rem;
    word-break: break-all;
  }

  .reasons {
    color: var(--muted);
    max-width: 280px;
  }

  .badge {
    display: inline-block;
    padding: 0.12rem 0.35rem;
    border: 1px solid var(--chrome-line);
    font-size: 0.62rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .badge.will_import,
  .badge.accepted {
    color: #3ecf8e;
    border-color: color-mix(in srgb, #3ecf8e 45%, var(--chrome-line));
  }

  .badge.duplicate,
  .badge.skipped,
  .badge.warning {
    color: #f0b429;
    border-color: color-mix(in srgb, #f0b429 45%, var(--chrome-line));
  }

  .badge.invalid,
  .badge.rejected {
    color: #ff6b6b;
    border-color: color-mix(in srgb, #ff6b6b 45%, var(--chrome-line));
  }

  tr.invalid,
  tr.rejected {
    background: color-mix(in srgb, #ff6b6b 8%, transparent);
  }

  tr.duplicate,
  tr.skipped,
  tr.warning {
    background: color-mix(in srgb, #f0b429 7%, transparent);
  }

  .empty,
  .all-good {
    text-align: center;
    color: var(--muted);
    padding: 1.25rem;
  }

  .confirm-progress {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .confirm-progress .bar {
    height: 10px;
    border: 2px solid var(--chrome-line);
    background: var(--surface2);
    overflow: hidden;
  }

  .confirm-progress .bar > div {
    height: 100%;
    background: linear-gradient(90deg, var(--hi-purple), var(--hi-cyan));
    transition: width 180ms ease;
  }

  .sheet-foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: center;
    border-top: 1px solid var(--chrome-line);
    padding-top: 0.75rem;
  }

  .foot-copy {
    margin: 0;
    flex: 1;
    min-width: 200px;
    font-size: 0.74rem;
    line-height: 1.4;
  }

  .foot-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  @media (max-width: 720px) {
    .balance-card {
      grid-template-columns: 1fr;
    }

    .arrow {
      display: none;
    }

    .sheet {
      padding: 0.85rem;
      max-height: 96vh;
    }
  }
</style>
