<script lang="ts">
  import type { Component } from "svelte";
  import Check from "@lucide/svelte/icons/check";
  import Copy from "@lucide/svelte/icons/copy";
  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";
  import Tag from "@lucide/svelte/icons/tag";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import X from "@lucide/svelte/icons/x";
  import SketchSelect from "$lib/components/sketch-select.svelte";
  import { formatMoney } from "$lib/finance/money";
  import type { ImportPreview, ImportPreviewRow, ImportResult } from "$lib/importers/types";

  type FilterKey = "all" | "will_import" | "duplicate" | "invalid" | "warning" | "accepted" | "skipped" | "rejected";

  type RowAssignment = {
    categoryId: string | null;
    tagIds: string[];
  };

  type Props = {
    mode: "preview" | "result";
    currencyCode: string;
    preview?: ImportPreview | null;
    result?: (ImportResult & { metadata?: Record<string, string> }) | null;
    confirming?: boolean;
    confirmProgress?: number;
    confirmStatus?: string;
    rowAssignments?: Record<number, RowAssignment>;
    onRowAssignmentChange?: (row: number, next: RowAssignment) => void;
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
    rowAssignments = {},
    onRowAssignmentChange,
    onConfirm,
    onCancel,
    onClose,
    onDownloadReport,
  }: Props = $props();

  let filter = $state<FilterKey>("all");
  let openTagMenuRow = $state<number | null>(null);

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
  const categories = $derived(preview?.taxonomy.categories ?? []);
  const tags = $derived(preview?.taxonomy.tags ?? []);

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

  const autoFilledCount = $derived(
    previewRows.filter((row) => {
      if (row.status !== "will_import" && row.status !== "warning") return false;
      const assignment = rowAssignments[row.row];
      return Boolean(assignment?.categoryId || assignment?.tagIds.length);
    }).length
  );

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

  function statusIcon(status: string): Component {
    switch (status) {
      case "will_import":
      case "accepted":
        return Check;
      case "duplicate":
        return Copy;
      case "warning":
        return TriangleAlert;
      case "skipped":
        return Minus;
      case "invalid":
      case "rejected":
        return X;
      default:
        return TriangleAlert;
    }
  }

  function canClassify(row: ImportPreviewRow): boolean {
    return row.status === "will_import" || row.status === "warning";
  }

  function assignmentFor(row: ImportPreviewRow): RowAssignment {
    return rowAssignments[row.row] ?? { categoryId: null, tagIds: [] };
  }

  function categoriesForType(type: string | undefined, selectedId: string | null) {
    const kind = type === "income" || type === "transfer" || type === "expense" ? type : "expense";
    return categories.filter((category) => category.kind === kind || category.id === selectedId);
  }

  function categoryOptionsFor(row: ImportPreviewRow) {
    const assignment = assignmentFor(row);
    return [
      { value: "", label: "Uncategorized" },
      ...categoriesForType(row.type, assignment.categoryId).map((category) => ({
        value: category.id,
        label: category.name,
      })),
    ];
  }

  function setCategory(row: ImportPreviewRow, categoryId: string | null) {
    const current = assignmentFor(row);
    onRowAssignmentChange?.(row.row, { ...current, categoryId });
  }

  function toggleTag(row: ImportPreviewRow, tagId: string) {
    const current = assignmentFor(row);
    const tagIds = current.tagIds.includes(tagId) ? current.tagIds.filter((id) => id !== tagId) : [...current.tagIds, tagId];
    onRowAssignmentChange?.(row.row, { ...current, tagIds });
  }

  function availableTagsFor(row: ImportPreviewRow) {
    const selected = new Set(assignmentFor(row).tagIds);
    return tags.filter((tag) => !selected.has(tag.id));
  }

  function tagMeta(tagId: string) {
    return tags.find((tag) => tag.id === tagId);
  }

  function isAutoSuggested(row: ImportPreviewRow): boolean {
    const suggestion = row.suggestion;
    if (!suggestion) return false;
    const assignment = assignmentFor(row);
    const sameCategory = (assignment.categoryId ?? null) === (suggestion.categoryId ?? null);
    const sameTags =
      assignment.tagIds.length === suggestion.tagIds.length &&
      [...assignment.tagIds].sort().every((id, index) => id === [...suggestion.tagIds].sort()[index]);
    return sameCategory && sameTags && Boolean(suggestion.categoryId || suggestion.tagIds.length);
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

      <div class="filters" role="tablist" aria-label="Preview filter">
        {#each [["all", `All (${preview.totalRows})`], ["will_import", `Will import (${preview.willImport})`], ["duplicate", `Duplicates (${preview.duplicates})`], ["warning", `Warnings (${preview.warnings})`], ["invalid", `Invalid (${preview.invalid})`]] as [key, label]}
          <button
            type="button"
            role="tab"
            class:active={filter === key}
            aria-selected={filter === key}
            onclick={() => (filter = key as FilterKey)}
            disabled={confirming}
          >
            {label}
          </button>
        {/each}
      </div>

      {#if autoFilledCount > 0}
        <p class="auto-note dim">
          Auto-filled category/tags on {autoFilledCount.toLocaleString()} row{autoFilledCount === 1 ? "" : "s"} from past merchants — change any before
          confirming.
        </p>
      {/if}

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
              <th>Category</th>
              <th>Tags</th>
              <th>Notes / issues</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredPreview as row (row.row)}
              {@const StatusIcon = statusIcon(row.status)}
              {@const assignment = assignmentFor(row)}
              {@const editable = canClassify(row)}
              <tr class={row.status}>
                <td>{row.row}</td>
                <td>
                  <span class="badge {row.status}" title={statusLabel(row.status)} aria-label={statusLabel(row.status)}>
                    <StatusIcon size={14} strokeWidth={2.1} aria-hidden="true" />
                  </span>
                </td>
                <td>{formatDisplayDate(row.occurredOn)}</td>
                <td>{row.type ?? "—"}</td>
                <td class="num">{money(row.amountMinor)}</td>
                <td>
                  <div class="merchant-cell">
                    <span>{row.merchant || "—"}</span>
                    {#if editable && isAutoSuggested(row) && row.suggestion}
                      <span
                        class="auto-chip"
                        title="From {row.suggestion.matchedMerchant} ({row.suggestion.source}, {row.suggestion.sampleCount} past)"
                      >
                        auto
                      </span>
                    {/if}
                  </div>
                </td>
                <td class="classify-cell">
                  {#if editable}
                    <SketchSelect
                      name="import-category-{row.row}"
                      compact
                      aria-label="Category for row {row.row}"
                      value={assignment.categoryId ?? ""}
                      options={categoryOptionsFor(row)}
                      disabled={confirming}
                      onChange={(next) => setCategory(row, next || null)}
                    />
                  {:else}
                    <span class="dim">—</span>
                  {/if}
                </td>
                <td class="classify-cell tags-cell">
                  {#if editable}
                    <div class="tag-list">
                      {#each assignment.tagIds as tagId (tagId)}
                        {@const tag = tagMeta(tagId)}
                        {#if tag}
                          <span class="tag-chip" style="--tag-color: {tag.colorHex ?? 'var(--orange)'}">
                            <Tag size={11} strokeWidth={1.4} aria-hidden="true" />
                            {tag.name}
                            <button
                              type="button"
                              class="tag-remove"
                              aria-label="Remove {tag.name}"
                              disabled={confirming}
                              onclick={() => toggleTag(row, tag.id)}
                            >
                              ×
                            </button>
                          </span>
                        {/if}
                      {/each}
                      {#if availableTagsFor(row).length > 0}
                        <div class="tag-add-wrap">
                          <button
                            type="button"
                            class="tag-add-btn"
                            aria-label="Add tag to row {row.row}"
                            aria-expanded={openTagMenuRow === row.row}
                            disabled={confirming}
                            onclick={() => (openTagMenuRow = openTagMenuRow === row.row ? null : row.row)}
                          >
                            <Plus size={12} strokeWidth={2} aria-hidden="true" />
                          </button>
                          {#if openTagMenuRow === row.row}
                            <div class="tag-add-menu" role="menu">
                              {#each availableTagsFor(row) as tag (tag.id)}
                                <button
                                  type="button"
                                  role="menuitem"
                                  disabled={confirming}
                                  onclick={() => {
                                    toggleTag(row, tag.id);
                                    openTagMenuRow = null;
                                  }}
                                >
                                  {tag.name}
                                </button>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      {:else if assignment.tagIds.length === 0}
                        <span class="dim">—</span>
                      {/if}
                    </div>
                  {:else}
                    <span class="dim">—</span>
                  {/if}
                </td>
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
            {confirming ? "Importing…" : "Confirm import"}
          </button>
        </div>
      </footer>
    {:else if mode === "result" && result}
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
        <div class="filters" role="tablist" aria-label="Issue filter">
          {#each [["all", `Issues (${result.issues.length})`], ["skipped", `Skipped (${result.skipped})`], ["rejected", `Rejected (${result.rejected})`]] as [key, label]}
            <button type="button" role="tab" class:active={filter === key} aria-selected={filter === key} onclick={() => (filter = key as FilterKey)}>
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
                {@const StatusIcon = statusIcon(row.status)}
                <tr class={row.status}>
                  <td>{row.row}</td>
                  <td>
                    <span class="badge {row.status}" title={statusLabel(row.status)} aria-label={statusLabel(row.status)}>
                      <StatusIcon size={14} strokeWidth={2.1} aria-hidden="true" />
                    </span>
                  </td>
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
    background: color-mix(in srgb, var(--ink) 32%, transparent);
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
    background: var(--surface-raised);
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 4px 18px 8px 14px / 14px 6px 16px 8px;
    box-shadow:
      3px 4px 0 0 color-mix(in srgb, var(--yellow) 40%, var(--shadow-paper)),
      3px 4px 0 1.5px color-mix(in srgb, var(--ink) 16%, transparent);
    padding: 1.05rem 1.15rem 1.1rem;
    font-family: var(--hand);
    color: var(--ink);
    transform: rotate(-0.15deg);
  }

  .sheet-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
  }

  .eyebrow {
    margin: 0;
    font-family: var(--hand);
    font-size: 0.85rem;
    letter-spacing: 0.01em;
    text-transform: none;
    color: var(--ink-muted);
  }

  h2 {
    margin: 0.1rem 0 0;
    font-family: var(--hand);
    font-size: 1.45rem;
    font-weight: 400;
    letter-spacing: 0.01em;
    text-transform: none;
    line-height: 1.15;
    color: var(--ink);
  }

  .icon-close,
  .ghost,
  .primary,
  .filters button {
    font-family: var(--hand);
    cursor: pointer;
  }

  .icon-close,
  .ghost {
    background: transparent;
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    color: var(--ink);
    padding: 0.32rem 0.7rem;
    font-size: 0.95rem;
    letter-spacing: 0.01em;
    text-transform: none;
    border-radius: 255px 12px 225px 10px / 12px 225px 10px 255px;
  }

  .icon-close:hover:not(:disabled),
  .ghost:hover:not(:disabled) {
    border-color: var(--brand);
    color: var(--brand);
    background: var(--brand-soft);
  }

  .primary {
    background: color-mix(in srgb, var(--blue) 72%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    color: var(--ink);
    font-weight: 400;
    padding: 0.4rem 0.9rem;
    font-size: 1rem;
    letter-spacing: 0.01em;
    border-radius: 255px 12px 225px 10px / 12px 225px 10px 255px;
    box-shadow: 1.5px 2px 0 0 color-mix(in srgb, var(--ink) 10%, transparent);
  }

  .primary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--blue) 88%, transparent);
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
    gap: 0.5rem;
  }

  .stat {
    border: none;
    background: color-mix(in srgb, var(--blue) 28%, transparent);
    padding: 0.5rem 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    border-radius: 3px 10px 4px 8px / 8px 3px 10px 4px;
    transform: rotate(-0.3deg);
  }

  .stat:nth-child(2) {
    transform: rotate(0.4deg);
  }

  .stat:nth-child(3) {
    transform: rotate(-0.5deg);
  }

  .stat:nth-child(4) {
    transform: rotate(0.25deg);
  }

  .stat:nth-child(5) {
    transform: rotate(-0.2deg);
  }

  .stat.ok {
    background: color-mix(in srgb, var(--green) 55%, transparent);
  }

  .stat.warn {
    background: color-mix(in srgb, var(--orange) 55%, transparent);
  }

  .stat.caution {
    background: color-mix(in srgb, var(--yellow) 62%, transparent);
  }

  .stat.bad {
    background: color-mix(in srgb, var(--pink) 55%, transparent);
  }

  .stat strong {
    font-size: 1.2rem;
    font-weight: 400;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }

  .stat-label {
    font-size: 0.85rem;
    letter-spacing: 0.01em;
    text-transform: none;
    color: var(--ink-muted);
  }

  .balance-card {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.25rem;
    align-items: center;
    border: 1.5px solid color-mix(in srgb, var(--ink) 22%, transparent);
    background: color-mix(in srgb, var(--yellow) 28%, var(--paper));
    padding: 0.75rem 0.9rem;
    border-radius: 3px 12px 5px 10px / 10px 4px 12px 5px;
    box-shadow: 2px 2px 0 0 color-mix(in srgb, var(--ink) 8%, transparent);
  }

  .balance-card > div {
    flex: 1;
    min-width: 160px;
  }

  .balance-card strong {
    display: inline-block;
    margin-top: 0.2rem;
    font-size: 1.25rem;
    font-weight: 400;
    padding: 0.05rem 0.28rem;
    background: color-mix(in srgb, var(--blue) 55%, transparent);
    border-radius: 2px 8px 3px 7px / 7px 2px 8px 2px;
    transform: rotate(-0.4deg);
  }

  .projected {
    color: var(--ink);
  }

  .arrow {
    color: var(--brand);
    font-size: 1.35rem;
  }

  .dim {
    display: block;
    margin-top: 0.2rem;
    color: var(--ink-muted);
    font-size: 0.85rem;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .filters button {
    background: transparent;
    border: none;
    color: var(--muted-foreground);
    padding: 0.15rem 0.5rem;
    font-size: 0.95rem;
    letter-spacing: 0.01em;
    text-transform: none;
    border-radius: 2px 8px 3px 7px / 7px 3px 8px 2px;
  }

  .filters button:hover:not(:disabled):not(.active) {
    color: var(--ink);
  }

  .filters button.active {
    color: var(--ink);
    background: color-mix(in srgb, var(--yellow) 72%, transparent);
  }

  .auto-note {
    margin: -0.15rem 0 0;
    font-size: 0.88rem;
  }

  .table-wrap {
    flex: 1;
    min-height: 220px;
    overflow: auto;
    border: 1.5px solid color-mix(in srgb, var(--ink) 18%, transparent);
    border-radius: 3px 10px 4px 8px / 8px 3px 10px 4px;
    background: linear-gradient(to bottom, color-mix(in srgb, var(--paper) 92%, var(--mix-wash)), var(--paper)), var(--surface-raised);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
  }

  th,
  td {
    padding: 0.45rem 0.65rem;
    border-bottom: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    text-align: left;
    vertical-align: top;
  }

  th {
    position: sticky;
    top: 0;
    background: color-mix(in srgb, var(--paper) 88%, var(--yellow) 12%);
    font-family: var(--hand);
    font-size: 0.9rem;
    font-weight: 400;
    letter-spacing: 0.01em;
    text-transform: none;
    color: var(--ink-muted);
    z-index: 1;
    border-bottom: 2px solid color-mix(in srgb, var(--ink) 22%, transparent);
  }

  tbody tr:nth-child(even) td {
    background: color-mix(in srgb, var(--blue) 8%, transparent);
  }

  tbody tr:hover td {
    background: color-mix(in srgb, var(--blue) 18%, transparent);
  }

  .num {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .mono {
    font-family: var(--hand);
    font-size: 0.88rem;
    word-break: break-all;
    color: var(--ink-muted);
  }

  .merchant-cell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    min-width: 7rem;
  }

  .auto-chip {
    display: inline-block;
    padding: 0.02rem 0.28rem;
    font-size: 0.72rem;
    color: var(--ink-muted);
    background: color-mix(in srgb, var(--blue) 45%, transparent);
    border-radius: 2px 7px 3px 6px / 6px 2px 7px 2px;
  }

  .classify-cell {
    min-width: 8.5rem;
    vertical-align: middle;
  }

  .classify-cell :global(.sketch-select.compact) {
    max-width: 11rem;
  }

  .tags-cell {
    min-width: 9rem;
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.18rem;
    padding: 0.05rem 0.28rem;
    background: color-mix(in srgb, var(--tag-color, var(--orange)) 45%, transparent);
    border-radius: 2px 8px 3px 7px / 7px 2px 8px 2px;
    font-size: 0.82rem;
    color: var(--ink);
  }

  .tag-remove {
    appearance: none;
    border: none;
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    padding: 0;
    line-height: 1;
    font-size: 0.9rem;
  }

  .tag-remove:hover:not(:disabled) {
    color: var(--danger);
  }

  .tag-add-wrap {
    position: relative;
  }

  .tag-add-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.35rem;
    height: 1.35rem;
    padding: 0;
    border: 1.5px dashed color-mix(in srgb, var(--ink) 28%, transparent);
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    border-radius: 3px 8px 4px 7px / 7px 3px 8px 4px;
  }

  .tag-add-btn:hover:not(:disabled) {
    color: var(--brand);
    border-color: var(--brand);
  }

  .tag-add-menu {
    position: absolute;
    top: calc(100% + 0.2rem);
    left: 0;
    z-index: 5;
    min-width: 7rem;
    max-height: 10rem;
    overflow: auto;
    padding: 0.25rem;
    background: var(--surface-raised);
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 2px 8px 3px 6px / 6px 2px 8px 3px;
    box-shadow:
      2px 2px 0 0 var(--shadow-paper),
      2px 2px 0 1.5px color-mix(in srgb, var(--ink) 16%, transparent);
  }

  .tag-add-menu button {
    appearance: none;
    display: block;
    width: 100%;
    border: none;
    background: transparent;
    text-align: left;
    font-family: var(--hand);
    font-size: 0.9rem;
    color: var(--ink);
    padding: 0.25rem 0.4rem;
    cursor: pointer;
    border-radius: 2px 6px 3px 5px / 5px 2px 6px 2px;
  }

  .tag-add-menu button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--yellow) 45%, transparent);
  }

  .reasons {
    color: var(--ink-muted);
    max-width: 280px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.55rem;
    height: 1.55rem;
    padding: 0;
    border: none;
    white-space: nowrap;
    border-radius: 2px 8px 3px 7px / 7px 2px 8px 2px;
    color: var(--ink);
  }

  .badge.will_import,
  .badge.accepted {
    background: color-mix(in srgb, var(--green) 62%, transparent);
  }

  .badge.duplicate,
  .badge.skipped {
    background: color-mix(in srgb, var(--orange) 62%, transparent);
  }

  .badge.warning {
    background: color-mix(in srgb, var(--yellow) 72%, transparent);
  }

  .badge.invalid,
  .badge.rejected {
    background: color-mix(in srgb, var(--pink) 62%, transparent);
  }

  tr.invalid td,
  tr.rejected td {
    background: color-mix(in srgb, var(--pink) 12%, transparent);
  }

  tr.duplicate td,
  tr.skipped td,
  tr.warning td {
    background: color-mix(in srgb, var(--yellow) 14%, transparent);
  }

  .empty,
  .all-good {
    text-align: center;
    color: var(--ink-muted);
    padding: 1.25rem;
    font-size: 1rem;
  }

  .all-good {
    background: color-mix(in srgb, var(--green) 35%, transparent);
    border-radius: 3px 10px 4px 8px / 8px 3px 10px 4px;
    margin: 0;
  }

  .confirm-progress {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .confirm-progress .bar {
    height: 0.7rem;
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    background: color-mix(in srgb, var(--paper) 80%, var(--mix-wash));
    overflow: hidden;
    border-radius: 255px 8px 225px 6px / 8px 225px 6px 255px;
  }

  .confirm-progress .bar > div {
    height: 100%;
    background: color-mix(in srgb, var(--green) 70%, var(--yellow));
    transition: width 180ms ease;
  }

  .confirm-progress .dim {
    margin: 0;
  }

  .sheet-foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: center;
    border-top: 1.5px solid color-mix(in srgb, var(--ink) 18%, transparent);
    padding-top: 0.75rem;
  }

  .foot-copy {
    margin: 0;
    flex: 1;
    min-width: 200px;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .foot-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  @media (max-width: 720px) {
    .arrow {
      display: none;
    }

    .sheet {
      padding: 0.85rem;
      max-height: 96vh;
      transform: none;
    }
  }
</style>
