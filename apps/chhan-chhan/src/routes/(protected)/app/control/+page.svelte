<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { enhance } from "$app/forms";
  import {
    importProgressLabel,
    importProgressPercent,
    importStatementWithProgress,
    previewStatementWithProgress,
    type ImportPreviewStreamEvent,
    type ImportStreamEvent,
  } from "$lib/import-stream";
  import AppSettings from "$lib/components/app-settings.svelte";
  import ImportReviewPanel from "$lib/components/import-review-panel.svelte";
  import SketchSelect from "$lib/components/sketch-select.svelte";
  import {
    FONT_OPTIONS,
    PAPER_OPTIONS,
    THEME_OPTIONS,
    applyAppearanceToDocument,
    readAppearance,
    setAppearance,
    type Appearance,
    type FontId,
    type PaperId,
    type ThemeId,
  } from "$lib/appearance";
  import type { ImportPreview, ImportResult } from "$lib/importers/types";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import Tag from "@lucide/svelte/icons/tag";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Layers from "@lucide/svelte/icons/layers";
  import Plus from "@lucide/svelte/icons/plus";
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";
  import { onMount } from "svelte";
  import type { PageData, ActionData } from "./$types";

  const { data, form }: { data: PageData; form: ActionData } = $props();

  const CONTROL_TABS = [
    { id: "customise", label: "customise", tone: "yellow" },
    { id: "accounts", label: "accounts", tone: "green" },
    { id: "data", label: "data", tone: "blue" },
    { id: "organize", label: "organize", tone: "orange" },
  ] as const;

  type ControlTabId = (typeof CONTROL_TABS)[number]["id"];
  const CONTROL_TAB_STORAGE_KEY = "chhan-control-tab";
  const LEGACY_TAB_MAP: Record<string, ControlTabId> = {
    look: "customise",
    import: "data",
    export: "data",
    categories: "organize",
    tags: "organize",
    groups: "organize",
  };

  let appearance = $state<Appearance>({ fonts: "gaegu", paper: "dots", theme: "light" });
  let activeTab = $state<ControlTabId>("customise");

  onMount(() => {
    appearance = applyAppearanceToDocument(readAppearance());
    try {
      const stored = localStorage.getItem(CONTROL_TAB_STORAGE_KEY);
      if (!stored) return;
      if (CONTROL_TABS.some((tab) => tab.id === stored)) {
        activeTab = stored as ControlTabId;
      } else if (LEGACY_TAB_MAP[stored]) {
        activeTab = LEGACY_TAB_MAP[stored]!;
        localStorage.setItem(CONTROL_TAB_STORAGE_KEY, activeTab);
      }
    } catch {
      /* ignore */
    }
  });

  function setTab(id: ControlTabId) {
    activeTab = id;
    try {
      localStorage.setItem(CONTROL_TAB_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }

  function chooseFonts(fonts: FontId) {
    appearance = setAppearance({ fonts });
  }

  function choosePaper(paper: PaperId) {
    appearance = setAppearance({ paper });
  }

  function chooseTheme(theme: ThemeId) {
    appearance = setAppearance({ theme });
  }

  let importing = $state(false);
  let importProgress = $state(0);
  let importStatus = $state("");
  let importMessage = $state<string | null>(null);
  let importSuccess = $state(true);
  let importReportCsv = $state<string | null>(null);
  let pendingFile = $state<File | null>(null);
  let pendingImporter = $state("kotak");
  let pendingAccountId = $state("");
  let importAccountId = $state("");
  let importPreview = $state<ImportPreview | null>(null);
  let importResult = $state<(ImportResult & { metadata?: Record<string, string> }) | null>(null);
  let reviewMode = $state<"preview" | "result" | null>(null);
  let confirmingImport = $state(false);
  let confirmProgress = $state(0);
  let confirmStatus = $state("");
  let importRowAssignments = $state<Record<number, { tagIds: string[] }>>({});
  let importFormEl = $state<HTMLFormElement | null>(null);
  let addingTag = $state(false);
  let editingTagId = $state<string | null>(null);
  let savingTagId = $state<string | null>(null);
  let deletingTagId = $state<string | null>(null);
  let addingSpace = $state(false);
  let editingSpaceId = $state<string | null>(null);
  let savingSpaceId = $state<string | null>(null);
  let deletingSpaceId = $state<string | null>(null);
  let savingAccount = $state(false);
  let creatingAccount = $state(false);
  let addingAccount = $state(false);
  let configuringDefaults = $state(false);
  let clearingOpeningBalance = $state(false);
  let clearingTransactions = $state(false);

  const COLOR_PRESETS = ["#FFADAD", "#BDE0FE", "#9BE7C4", "#FFB997", "#D4C5F9", "#FFE066", "#C8E7E0", "#E8D5C4"] as const;
  let draftColorHex = $state("#FFADAD");
  let draftName = $state("");
  let draftBankImporterId = $state("");
  let draftCurrencyCode = $state("INR");
  let draftOpeningDate = $state("");
  let draftOpeningAmount = $state("");

  $effect(() => {
    if (addingAccount) return;
    draftColorHex = data.account.colorHex ?? COLOR_PRESETS[0]!;
    draftName = data.account.name;
    draftBankImporterId = data.account.bankImporterId ?? "";
    draftCurrencyCode = data.account.currencyCode;
    draftOpeningDate = data.openingBalance?.balanceAsOf ?? data.firstTransactionOn ?? new Date().toISOString().slice(0, 10);
    draftOpeningAmount = data.openingBalance?.balanceMinor != null ? (data.openingBalance.balanceMinor / 100).toFixed(2) : "";
    if (!importAccountId || !data.accounts.some((account) => account.id === importAccountId)) {
      importAccountId = data.account.id;
    }
  });

  const bankSelectOptions = $derived([
    { value: "", label: "Not set" },
    ...data.importers.map((importer) => ({ value: importer.id, label: importer.label })),
  ]);
  const currencySelectOptions = $derived([
    ...data.currencies.map((currency) => ({ value: currency.code, label: currency.label })),
    ...(!data.currencies.some((currency) => currency.code === data.account.currencyCode)
      ? [{ value: data.account.currencyCode, label: data.account.currencyCode }]
      : []),
  ]);
  const importAccountOptions = $derived(data.accounts.map((account) => ({ value: account.id, label: account.name })));
  const importTargetAccount = $derived(data.accounts.find((account) => account.id === importAccountId) ?? data.account);
  const importImporterId = $derived(importTargetAccount.bankImporterId ?? "");
  const importImporterLabel = $derived(data.importers.find((importer) => importer.id === importImporterId)?.label ?? (importImporterId || "Not set"));
  const importReviewCurrencyCode = $derived(
    data.accounts.find((account) => account.id === (pendingAccountId || importAccountId))?.currencyCode ?? data.account.currencyCode
  );

  function formatDisplayDate(iso: string): string {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function startAddAccount() {
    addingAccount = true;
    draftName = "";
    draftCurrencyCode = "INR";
    draftBankImporterId = data.importers[0]?.id ?? "";
    draftColorHex = COLOR_PRESETS[data.accounts.length % COLOR_PRESETS.length]!;
    draftOpeningDate = new Date().toISOString().slice(0, 10);
    draftOpeningAmount = "";
  }

  function cancelAddAccount() {
    addingAccount = false;
  }

  const formBusy = $derived(savingAccount || creatingAccount);

  const KIND_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "expense", label: "Expense" },
    { value: "income", label: "Income" },
    { value: "transfer", label: "Transfer" },
  ];

  const TAG_KIND_OPTIONS: Array<{ value: string; label: string }> = [{ value: "", label: "Any kind" }, ...KIND_OPTIONS];

  let draftTagKind = $state("");
  let draftTagColor = $state("#FFADAD");
  let editTagKind = $state("");
  let editTagColor = $state("#FFADAD");
  let draftSpaceColor = $state("#BDE0FE");
  let editSpaceColor = $state("#BDE0FE");

  function beginEditTag(tag: (typeof data.tags)[number]) {
    editingTagId = tag.id;
    editTagKind = tag.kind ?? "";
    editTagColor = tag.colorHex ?? COLOR_PRESETS[0]!;
  }

  function beginEditSpace(space: (typeof data.spaces)[number]) {
    editingSpaceId = space.id;
    editSpaceColor = space.colorHex ?? "#BDE0FE";
  }

  function downloadImportReport(csv: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `import-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handlePreviewEvent(event: ImportPreviewStreamEvent) {
    importProgress = importProgressPercent(event);
    importStatus = importProgressLabel(event, "preview");
  }

  function handleImportEvent(event: ImportStreamEvent) {
    confirmProgress = importProgressPercent(event);
    confirmStatus = importProgressLabel(event, "import");
  }

  function clearReview() {
    reviewMode = null;
    importPreview = null;
    importResult = null;
    pendingFile = null;
    pendingAccountId = "";
    confirmingImport = false;
    confirmProgress = 0;
    confirmStatus = "";
    importRowAssignments = {};
  }

  function buildAssignmentsFromPreview(preview: ImportPreview) {
    const next: Record<number, { tagIds: string[] }> = {};
    for (const row of preview.rows) {
      if (row.status !== "will_import" && row.status !== "warning") continue;
      next[row.row] = {
        tagIds: [...(row.suggestion?.tagIds ?? [])],
      };
    }
    return next;
  }

  function updateImportRowAssignment(row: number, next: { tagIds: string[] }) {
    importRowAssignments = { ...importRowAssignments, [row]: next };
  }

  function buildImportFormData(file: File, importer: string, assignments?: Record<number, { tagIds: string[] }>): FormData {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("importer", importer);
    if (assignments) {
      formData.set("assignments", JSON.stringify(assignments));
    }
    return formData;
  }

  async function submitImport(event: SubmitEvent) {
    event.preventDefault();
    const formEl = event.currentTarget as HTMLFormElement;
    const formData = new FormData(formEl);
    const file = formData.get("file");
    const accountId = String(formData.get("accountId") ?? importAccountId);
    const target = data.accounts.find((account) => account.id === accountId) ?? data.account;
    const importer = target.bankImporterId ?? "";

    if (!(file instanceof File) || file.size === 0) {
      importMessage = "Choose a statement file to import";
      importSuccess = false;
      return;
    }

    if (!importer) {
      importMessage = `Set a linked bank on “${target.name}” in Accounts before importing`;
      importSuccess = false;
      return;
    }

    importing = true;
    importProgress = 4;
    importStatus = "Uploading file…";
    importMessage = null;
    importReportCsv = null;
    importSuccess = true;
    importPreview = null;
    importResult = null;
    reviewMode = null;

    try {
      const previewPayload = buildImportFormData(file, importer);
      const preview = await previewStatementWithProgress(accountId, previewPayload, handlePreviewEvent);
      importProgress = 100;
      importStatus = "Preview ready";
      pendingFile = file;
      pendingImporter = importer;
      pendingAccountId = accountId;
      importPreview = preview;
      importRowAssignments = buildAssignmentsFromPreview(preview);
      reviewMode = "preview";
      setTab("data");
    } catch (cause) {
      importMessage = cause instanceof Error ? cause.message : "Failed to preview statement";
      importSuccess = false;
    } finally {
      importing = false;
    }
  }

  async function confirmPendingImport() {
    if (!pendingFile || !importPreview || !pendingAccountId) return;

    confirmingImport = true;
    confirmProgress = 4;
    confirmStatus = "Starting import…";
    importMessage = null;

    try {
      const formData = buildImportFormData(pendingFile, pendingImporter, importRowAssignments);
      const result = await importStatementWithProgress(pendingAccountId, formData, handleImportEvent);
      confirmProgress = 100;
      confirmStatus = "Import complete";
      importResult = result;
      importReportCsv = result.reportCsv ?? null;
      importSuccess = true;
      importMessage = `Imported ${result.accepted} transactions (${result.skipped} skipped, ${result.rejected} rejected)`;
      reviewMode = "result";
      importPreview = null;
      importRowAssignments = {};
      pendingFile = null;
      pendingAccountId = "";
      importFormEl?.reset();
      await invalidateAll();
    } catch (cause) {
      importMessage = cause instanceof Error ? cause.message : "Failed to import statement";
      importSuccess = false;
    } finally {
      confirmingImport = false;
    }
  }
</script>

<svelte:head><title>Control · Chhan Chhan</title></svelte:head>

<header class="topbar">
  <div>
    <h1>Control Center</h1>
    <a class="back-link" href="/app/dashboards">← Back</a>
  </div>
  <div class="actions">
    <AppSettings />
  </div>
</header>

{#if importMessage}
  <p class="flash" class:error={!importSuccess}>{importMessage}</p>
{/if}

{#if !importMessage && form?.message}
  <p class="flash" class:error={!form?.success}>{form.message}</p>
{/if}

{#if importReportCsv && reviewMode !== "result"}
  <p class="flash report">
    Some rows were skipped or rejected.
    <button type="button" class="report-link" onclick={() => downloadImportReport(importReportCsv!)}> Download import report CSV </button>
  </p>
{/if}

{#if reviewMode === "preview" && importPreview}
  <ImportReviewPanel
    mode="preview"
    currencyCode={importReviewCurrencyCode}
    preview={importPreview}
    confirming={confirmingImport}
    {confirmProgress}
    {confirmStatus}
    rowAssignments={importRowAssignments}
    onRowAssignmentChange={updateImportRowAssignment}
    onConfirm={confirmPendingImport}
    onCancel={clearReview}
  />
{:else if reviewMode === "result" && importResult}
  <ImportReviewPanel
    mode="result"
    currencyCode={importReviewCurrencyCode}
    result={importResult}
    onClose={clearReview}
    onDownloadReport={importReportCsv ? () => downloadImportReport(importReportCsv!) : undefined}
  />
{/if}

<div class="control-notebook">
  <div class="paper-tabs" role="tablist" aria-label="Control sections">
    {#each CONTROL_TABS as tab, i (tab.id)}
      <button
        type="button"
        role="tab"
        class="paper-tab tone-{tab.tone}"
        class:active={activeTab === tab.id}
        id="control-tab-{tab.id}"
        aria-selected={activeTab === tab.id}
        aria-controls="control-panel-{tab.id}"
        tabindex={activeTab === tab.id ? 0 : -1}
        style="--depth: {i}"
        onclick={() => setTab(tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <div class="notebook-sheet" data-tone={activeTab}>
    {#if activeTab === "customise"}
      <section class="sheet-panel" id="control-panel-customise" role="tabpanel" aria-labelledby="control-tab-customise">
        <h2>Customise</h2>
        <p class="panel-copy dim">Fonts, paper, and theme apply across the app on this browser.</p>

        <div class="customise-grid">
          <div class="customise-block">
            <p class="customise-label">Theme</p>
            <ul class="customise-list" role="radiogroup" aria-label="Color theme">
              {#each THEME_OPTIONS as option (option.id)}
                <li>
                  <button
                    type="button"
                    class="customise-bullet"
                    class:active={appearance.theme === option.id}
                    role="radio"
                    aria-checked={appearance.theme === option.id}
                    onclick={() => chooseTheme(option.id)}
                  >
                    <span class="dot" aria-hidden="true">•</span>
                    <span class="mark">{option.label}</span>
                  </button>
                </li>
              {/each}
            </ul>
          </div>

          <div class="customise-block">
            <p class="customise-label">Hand fonts</p>
            <ul class="customise-list" role="radiogroup" aria-label="Font pairing">
              {#each FONT_OPTIONS as option (option.id)}
                <li>
                  <button
                    type="button"
                    class="customise-bullet"
                    class:active={appearance.fonts === option.id}
                    role="radio"
                    aria-checked={appearance.fonts === option.id}
                    onclick={() => chooseFonts(option.id)}
                  >
                    <span class="dot" aria-hidden="true">•</span>
                    <span class="mark">{option.label}</span>
                  </button>
                </li>
              {/each}
            </ul>
          </div>

          <div class="customise-block">
            <p class="customise-label">Paper texture</p>
            <ul class="customise-list" role="radiogroup" aria-label="Paper texture">
              {#each PAPER_OPTIONS as option (option.id)}
                <li>
                  <button
                    type="button"
                    class="customise-bullet"
                    class:active={appearance.paper === option.id}
                    role="radio"
                    aria-checked={appearance.paper === option.id}
                    onclick={() => choosePaper(option.id)}
                  >
                    <span class="dot" aria-hidden="true">•</span>
                    <span class="mark">{option.label}</span>
                  </button>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      </section>
    {:else if activeTab === "accounts"}
      <section class="sheet-panel" id="control-panel-accounts" role="tabpanel" aria-labelledby="control-tab-accounts">
        <div class="accounts-head">
          <h2 id="control-tab-accounts-heading">{addingAccount ? "New account" : "Accounts"}</h2>
          {#if addingAccount}
            <button type="button" class="accounts-action" aria-label="Cancel new account" disabled={formBusy} onclick={cancelAddAccount}>
              <X size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          {:else}
            <button type="button" class="accounts-action" aria-label="Add account" onclick={startAddAccount}>
              <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          {/if}
        </div>

        {#if !addingAccount}
          <p class="panel-copy dim">
            Active:
            <span class="account-pill">
              <strong class="mark" style="--account-color: {draftColorHex}">{data.account.name}</strong>
            </span>
            · first transaction
            <strong>{data.firstTransactionOn ? formatDisplayDate(data.firstTransactionOn) : "None yet"}</strong>
          </p>
        {:else}
          <p class="panel-copy dim">Fill in the details below, then create the account.</p>
        {/if}

        <form
          class="account-form"
          method="POST"
          action={addingAccount ? "?/createAccount" : "?/updateAccount"}
          use:enhance={() => {
            if (addingAccount) {
              creatingAccount = true;
              return async ({ update, result }) => {
                creatingAccount = false;
                await update();
                if (result.type === "success") {
                  addingAccount = false;
                  await invalidateAll();
                }
              };
            }
            savingAccount = true;
            return async ({ update }) => {
              savingAccount = false;
              await update();
              await invalidateAll();
            };
          }}
        >
          <div class="account-grid">
            <label class="field">
              <span>Account name</span>
              <input
                name="name"
                type="text"
                bind:value={draftName}
                required
                maxlength="120"
                disabled={formBusy}
                placeholder={addingAccount ? "Kotak salary" : undefined}
              />
            </label>
            <label class="field">
              <span>Currency</span>
              <SketchSelect
                name="currencyCode"
                bind:value={draftCurrencyCode}
                options={currencySelectOptions}
                disabled={formBusy}
                aria-label="Currency"
              />
            </label>
            <label class="field field-span">
              <span>Linked bank (default importer)</span>
              <SketchSelect
                name="bankImporterId"
                bind:value={draftBankImporterId}
                options={bankSelectOptions}
                disabled={formBusy}
                aria-label="Linked bank"
              />
            </label>
            <label class="field">
              <span>Opening date</span>
              <input name="balanceAsOf" type="date" bind:value={draftOpeningDate} disabled={formBusy} />
            </label>
            <label class="field">
              <span>Opening amount</span>
              <input name="amount" type="text" inputmode="decimal" placeholder="0.00" bind:value={draftOpeningAmount} disabled={formBusy} />
            </label>
            <div class="field field-color">
              <span>Account color</span>
              <input type="hidden" name="colorHex" value={draftColorHex} />
              <div class="color-row">
                {#each COLOR_PRESETS as color}
                  <button
                    type="button"
                    class="color-option"
                    class:selected={draftColorHex.toUpperCase() === color.toUpperCase()}
                    aria-label="Use color {color}"
                    disabled={formBusy}
                    onclick={() => (draftColorHex = color)}
                  >
                    <span class="swatch lg" style="background: {color}"></span>
                  </button>
                {/each}
                <label class="color-custom">
                  <span>Custom</span>
                  <input
                    type="color"
                    value={draftColorHex}
                    disabled={formBusy}
                    oninput={(e) => (draftColorHex = (e.currentTarget as HTMLInputElement).value)}
                  />
                </label>
              </div>
            </div>
          </div>
          <button class="add" type="submit" disabled={formBusy}>
            {#if addingAccount}
              {creatingAccount ? "CREATING…" : "CREATE ACCOUNT"}
            {:else}
              {savingAccount ? "SAVING…" : "SAVE ACCOUNT"}
            {/if}
          </button>
        </form>

        {#if !addingAccount && data.openingBalance}
          <form
            class="clear-opening-form"
            method="POST"
            action="?/updateOpeningBalance"
            use:enhance={() => {
              return async ({ update }) => {
                if (!confirm("Clear the opening balance for this account?")) {
                  return;
                }
                clearingOpeningBalance = true;
                await update();
                clearingOpeningBalance = false;
                await invalidateAll();
              };
            }}
          >
            <input type="hidden" name="clear" value="1" />
            <button class="ghost danger" type="submit" disabled={clearingOpeningBalance || formBusy}>
              {clearingOpeningBalance ? "CLEARING…" : "CLEAR OPENING BALANCE"}
            </button>
          </form>
        {/if}
      </section>
    {:else if activeTab === "data"}
      <section class="sheet-panel" id="control-panel-data" role="tabpanel" aria-labelledby="control-tab-data">
        <h2>Data</h2>
        <h3>Import</h3>
        <p class="panel-copy dim">
          Choose the account to import into, then upload a CSV or PDF statement. The statement format comes from that account’s linked bank. You'll
          review every row and the projected balance before anything is written. Imports use
          <strong>{importTargetAccount.currencyCode}</strong>.
        </p>
        <form class="import-form" enctype="multipart/form-data" bind:this={importFormEl} onsubmit={submitImport}>
          <label class="field">
            <span>Account</span>
            <SketchSelect
              name="accountId"
              bind:value={importAccountId}
              options={importAccountOptions}
              disabled={importing || confirmingImport}
              aria-label="Account"
            />
          </label>
          <p class="panel-copy dim import-bank-hint">
            {#if importImporterId}
              Statement format: <strong>{importImporterLabel}</strong>
            {:else}
              No linked bank on this account — set one under Accounts first.
            {/if}
          </p>
          <label class="field">
            <span>Statement file</span>
            <input name="file" type="file" accept=".csv,.pdf,text/csv,application/pdf" required disabled={importing || confirmingImport} />
          </label>

          {#if importing}
            <div class="import-progress" aria-hidden="true">
              <div class="import-progress-bar" style="width: {importProgress}%"></div>
            </div>
            <p class="import-status dim">{importStatus}</p>
          {/if}

          <button class="add" type="submit" disabled={importing || confirmingImport || !importImporterId}>
            {importing ? "ANALYZING…" : "IMPORT STATEMENT"}
          </button>
        </form>

        <h3>Export</h3>
        <p class="panel-copy dim">Download all transactions for this account as CSV.</p>
        <a class="add export-link" href="/api/accounts/{data.account.id}/transactions/export">EXPORT CSV</a>

        <div class="danger-block">
          <h3>Danger zone</h3>
          <p class="panel-copy dim">
            Permanently delete every transaction for this account ({data.transactionCount.toLocaleString()} now). Tags and spaces are kept. Account balance
            is cleared.
          </p>
          <form
            method="POST"
            action="?/clearAllTransactions"
            use:enhance={({ cancel }) => {
              const countLabel = data.transactionCount.toLocaleString();
              if (!confirm(`Delete all ${countLabel} transactions? This cannot be undone. Tag and space links on those rows will be removed.`)) {
                cancel();
                return;
              }
              clearingTransactions = true;
              return async ({ update }) => {
                await update();
                clearingTransactions = false;
                await invalidateAll();
              };
            }}
          >
            <button class="add danger" type="submit" disabled={clearingTransactions || data.transactionCount === 0}>
              {clearingTransactions ? "DELETING…" : "CLEAR ALL TRANSACTIONS"}
            </button>
          </form>
        </div>
      </section>
    {:else if activeTab === "organize"}
      <section class="sheet-panel" id="control-panel-organize" role="tabpanel" aria-labelledby="control-tab-organize">
        <h2>Organize</h2>

        {#if data.needsDefaultTaxonomy}
          <form
            class="defaults-callout"
            method="POST"
            action="?/configureDefaults"
            use:enhance={() => {
              configuringDefaults = true;
              return async ({ update }) => {
                configuringDefaults = false;
                await update();
              };
            }}
          >
            <p>
              This account is missing starter tags. Configure defaults to add Food, Monthly Bill, Personal, and the rest — existing names stay put.
            </p>
            <button type="submit" class="defaults-btn" disabled={configuringDefaults}>
              {configuringDefaults ? "Configuring…" : "Configure defaults"}
            </button>
          </form>
        {/if}

        <div class="organize-grid">
          <div class="organize-col">
            <h3>Tags</h3>
            <form
              class="organize-add"
              method="POST"
              action="?/createTag"
              use:enhance={() => {
                addingTag = true;
                return async ({ update, result }) => {
                  addingTag = false;
                  await update();
                  if (result.type === "success") {
                    draftTagColor = "#FFADAD";
                    draftTagKind = "";
                  }
                };
              }}
            >
              <input class="organize-name" name="name" placeholder="Tag name" required />
              <SketchSelect name="kind" bind:value={draftTagKind} options={TAG_KIND_OPTIONS} aria-label="Tag kind" />
              <input type="hidden" name="colorHex" value={draftTagColor} />
              <div class="color-row compact">
                {#each COLOR_PRESETS as color}
                  <button
                    type="button"
                    class="color-option"
                    class:selected={draftTagColor.toUpperCase() === color.toUpperCase()}
                    aria-label="Use color {color}"
                    disabled={addingTag}
                    onclick={() => (draftTagColor = color)}
                  >
                    <span class="swatch" style="background: {color}"></span>
                  </button>
                {/each}
              </div>
              <button class="organize-plus" type="submit" disabled={addingTag} aria-label={addingTag ? "Adding tag" : "Add tag"}>
                <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </form>
            <ul class="list organize-list">
              {#if data.tags.length === 0}
                <li class="dim empty">No tags yet.</li>
              {:else}
                {#each data.tags as tag (tag.id)}
                  <li class:editing={editingTagId === tag.id}>
                    {#if editingTagId === tag.id}
                      <form
                        class="organize-edit"
                        method="POST"
                        action="?/updateTag"
                        use:enhance={() => {
                          savingTagId = tag.id;
                          return async ({ update, result }) => {
                            savingTagId = null;
                            if (result.type === "success") editingTagId = null;
                            await update();
                          };
                        }}
                      >
                        <input type="hidden" name="id" value={tag.id} />
                        <input class="organize-name" name="name" value={tag.name} required />
                        <SketchSelect name="kind" bind:value={editTagKind} options={TAG_KIND_OPTIONS} aria-label="Tag kind" />
                        <input type="hidden" name="colorHex" value={editTagColor} />
                        <div class="color-row compact">
                          {#each COLOR_PRESETS as color}
                            <button
                              type="button"
                              class="color-option"
                              class:selected={editTagColor.toUpperCase() === color.toUpperCase()}
                              aria-label="Use color {color}"
                              disabled={savingTagId === tag.id}
                              onclick={() => (editTagColor = color)}
                            >
                              <span class="swatch" style="background: {color}"></span>
                            </button>
                          {/each}
                        </div>
                        <div class="edit-actions">
                          <button
                            class="icon-btn ok"
                            type="submit"
                            aria-label={savingTagId === tag.id ? "Saving" : "Save"}
                            disabled={savingTagId === tag.id}
                          >
                            <Check size={16} strokeWidth={1.6} aria-hidden="true" />
                          </button>
                          <button type="button" class="icon-btn danger" aria-label="Cancel" onclick={() => (editingTagId = null)}>
                            <X size={16} strokeWidth={1.6} aria-hidden="true" />
                          </button>
                        </div>
                      </form>
                    {:else}
                      <span class="tag-chip">
                        <Tag size={14} strokeWidth={1.25} class="tag-icon" style="color: {tag.colorHex ?? '#FFADAD'}" aria-hidden="true" />
                        <span class="mark" style="--item-color: {tag.colorHex ?? '#FFADAD'}">{tag.name}</span>
                      </span>
                      {#if tag.kind}
                        <span class="kind kind-{tag.kind}">{tag.kind}</span>
                      {/if}
                      <div class="row-actions">
                        <button type="button" class="icon-btn" aria-label="Edit {tag.name}" onclick={() => beginEditTag(tag)}>
                          <SquarePen size={16} strokeWidth={1.25} aria-hidden="true" />
                        </button>
                        <form
                          method="POST"
                          action="?/deleteTag"
                          use:enhance={({ cancel }) => {
                            if (!confirm(`Delete “${tag.name}”? It will be removed from linked transactions.`)) {
                              cancel();
                              return;
                            }
                            deletingTagId = tag.id;
                            return async ({ update }) => {
                              await update();
                              deletingTagId = null;
                              if (editingTagId === tag.id) editingTagId = null;
                            };
                          }}
                        >
                          <input type="hidden" name="id" value={tag.id} />
                          <button type="submit" class="icon-btn danger" aria-label="Delete {tag.name}" disabled={deletingTagId === tag.id}>
                            <Trash2 size={16} strokeWidth={1.25} aria-hidden="true" />
                          </button>
                        </form>
                      </div>
                    {/if}
                  </li>
                {/each}
              {/if}
            </ul>
          </div>

          <div class="organize-col">
            <h3>Spaces</h3>
            <form
              class="organize-add"
              method="POST"
              action="?/createSpace"
              use:enhance={() => {
                addingSpace = true;
                return async ({ update, result }) => {
                  addingSpace = false;
                  await update();
                  if (result.type === "success") draftSpaceColor = "#BDE0FE";
                };
              }}
            >
              <input class="organize-name" name="name" placeholder="Space name" required />
              <input class="organize-name" name="notes" placeholder="Notes (optional)" />
              <input type="hidden" name="colorHex" value={draftSpaceColor} />
              <div class="color-row compact">
                {#each COLOR_PRESETS as color}
                  <button
                    type="button"
                    class="color-option"
                    class:selected={draftSpaceColor.toUpperCase() === color.toUpperCase()}
                    aria-label="Use color {color}"
                    disabled={addingSpace}
                    onclick={() => (draftSpaceColor = color)}
                  >
                    <span class="swatch" style="background: {color}"></span>
                  </button>
                {/each}
              </div>
              <button class="organize-plus" type="submit" disabled={addingSpace} aria-label={addingSpace ? "Adding space" : "Add space"}>
                <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </form>
            <ul class="list organize-list">
              {#if data.spaces.length === 0}
                <li class="dim empty">No spaces yet.</li>
              {:else}
                {#each data.spaces as space (space.id)}
                  <li class:editing={editingSpaceId === space.id}>
                    {#if editingSpaceId === space.id}
                      <form
                        class="organize-edit"
                        method="POST"
                        action="?/updateSpace"
                        use:enhance={() => {
                          savingSpaceId = space.id;
                          return async ({ update, result }) => {
                            savingSpaceId = null;
                            if (result.type === "success") editingSpaceId = null;
                            await update();
                          };
                        }}
                      >
                        <input type="hidden" name="id" value={space.id} />
                        <input class="organize-name" name="name" value={space.name} required />
                        <input class="organize-name" name="notes" value={space.notes ?? ""} placeholder="Notes (optional)" />
                        <input type="hidden" name="colorHex" value={editSpaceColor} />
                        <div class="color-row compact">
                          {#each COLOR_PRESETS as color}
                            <button
                              type="button"
                              class="color-option"
                              class:selected={editSpaceColor.toUpperCase() === color.toUpperCase()}
                              aria-label="Use color {color}"
                              disabled={savingSpaceId === space.id}
                              onclick={() => (editSpaceColor = color)}
                            >
                              <span class="swatch" style="background: {color}"></span>
                            </button>
                          {/each}
                        </div>
                        <div class="edit-actions">
                          <button
                            class="icon-btn ok"
                            type="submit"
                            aria-label={savingSpaceId === space.id ? "Saving" : "Save"}
                            disabled={savingSpaceId === space.id}
                          >
                            <Check size={16} strokeWidth={1.6} aria-hidden="true" />
                          </button>
                          <button type="button" class="icon-btn danger" aria-label="Cancel" onclick={() => (editingSpaceId = null)}>
                            <X size={16} strokeWidth={1.6} aria-hidden="true" />
                          </button>
                        </div>
                      </form>
                    {:else}
                      <span class="tag-chip space-chip" title={space.notes ?? undefined}>
                        <Layers size={14} strokeWidth={1.25} class="tag-icon" style="color: {space.colorHex ?? '#BDE0FE'}" aria-hidden="true" />
                        <span class="mark" style="--item-color: {space.colorHex ?? '#BDE0FE'}">{space.name}</span>
                      </span>
                      <span class="dim space-count">{space.transactionCount} txn{space.transactionCount === 1 ? "" : "s"}</span>
                      <div class="row-actions">
                        <button type="button" class="icon-btn" aria-label="Edit {space.name}" onclick={() => beginEditSpace(space)}>
                          <SquarePen size={16} strokeWidth={1.25} aria-hidden="true" />
                        </button>
                        <form
                          method="POST"
                          action="?/deleteSpace"
                          use:enhance={({ cancel }) => {
                            if (!confirm(`Delete “${space.name}”? It will be removed from linked transactions.`)) {
                              cancel();
                              return;
                            }
                            deletingSpaceId = space.id;
                            return async ({ update }) => {
                              await update();
                              deletingSpaceId = null;
                              if (editingSpaceId === space.id) editingSpaceId = null;
                            };
                          }}
                        >
                          <input type="hidden" name="id" value={space.id} />
                          <button type="submit" class="icon-btn danger" aria-label="Delete {space.name}" disabled={deletingSpaceId === space.id}>
                            <Trash2 size={16} strokeWidth={1.25} aria-hidden="true" />
                          </button>
                        </form>
                      </div>
                    {/if}
                  </li>
                {/each}
              {/if}
            </ul>
          </div>
        </div>
      </section>
    {/if}
  </div>
</div>

<style>
  .back-link {
    display: inline-block;
    margin-top: 0.45rem;
    color: var(--muted);
    text-decoration: none;
    font-family: var(--hand);
    font-size: 1.05rem;
    letter-spacing: 0.01em;
  }

  .back-link:hover {
    color: var(--ink);
  }

  .control-notebook {
    margin-top: 0.35rem;
    position: relative;
  }

  .paper-tabs {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0;
    padding: 0 0.65rem;
    position: relative;
    z-index: 1;
    /* sit under the page edge */
    margin-bottom: -1.5px;
  }

  .paper-tab {
    --depth: 0;
    appearance: none;
    border: 1.5px solid color-mix(in srgb, var(--ink) 22%, transparent);
    border-bottom: none;
    border-radius: 3px 3px 0 0;
    font-family: var(--hand);
    font-size: 1.02rem;
    color: var(--ink);
    padding: 0.22rem 0.95rem 0.7rem;
    cursor: pointer;
    position: relative;
    background: color-mix(in srgb, var(--yellow) 72%, var(--mix-wash));
    margin-right: -0.2rem;
    /* deeper bookmarks tuck further under the stack */
    z-index: calc(4 - var(--depth));
    transform: translate(calc(var(--depth) * 2px), calc(var(--depth) * 3px));
  }

  .paper-tab.tone-yellow {
    background: color-mix(in srgb, var(--yellow) 78%, var(--mix-wash));
  }
  .paper-tab.tone-green {
    background: color-mix(in srgb, var(--green) 72%, var(--mix-wash));
  }
  .paper-tab.tone-blue {
    background: color-mix(in srgb, var(--blue) 74%, var(--mix-wash));
  }
  .paper-tab.tone-orange {
    background: color-mix(in srgb, var(--orange) 76%, var(--mix-wash));
  }

  .paper-tab:hover {
    filter: brightness(0.98);
  }

  .paper-tab.active {
    z-index: 5;
    transform: translate(0, 0);
    padding-bottom: 0.85rem;
    filter: none;
  }

  .notebook-sheet {
    --page: var(--surface-raised);
    position: relative;
    z-index: 6;
    background: var(--page);
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 1px 4px 3px 1px;
    padding: 1.2rem 1.35rem 1.55rem 1.55rem;
    min-height: 18rem;
    /* stacked pages peeking out — bookmarks sit between these layers */
    box-shadow:
      3px 3px 0 0 var(--shadow-paper),
      3px 3px 0 1.5px color-mix(in srgb, var(--ink) 22%, transparent),
      6px 6px 0 0 #f1ece0,
      6px 6px 0 1.5px color-mix(in srgb, var(--ink) 18%, transparent);
  }

  /* binding edge / margin gutter */
  .notebook-sheet::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 0.85rem;
    background: color-mix(in srgb, var(--page) 88%, #e8e0d0);
    border-right: 1.5px solid color-mix(in srgb, var(--pink) 55%, #e85d4c);
    pointer-events: none;
    z-index: 0;
  }

  /* faint ruled lines on the page */
  .notebook-sheet::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 1.65rem,
      color-mix(in srgb, var(--blue) 36%, #9ec9e8) 1.65rem,
      color-mix(in srgb, var(--blue) 36%, #9ec9e8) calc(1.65rem + 1px)
    );
    background-position: 0 0.35rem;
    opacity: 0.58;
    pointer-events: none;
    z-index: 0;
    border-radius: inherit;
  }

  .sheet-panel {
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    box-shadow: none;
    position: relative;
    z-index: 1;
  }

  .sheet-panel h2 {
    margin: 0 0 0.55rem;
    font-family: var(--hand);
    font-size: 1.35rem;
    font-weight: 400;
    color: var(--ink-muted);
  }

  .sheet-panel h3 {
    margin: 1.1rem 0 0.35rem;
    font-family: var(--hand);
    font-size: 1.05rem;
    font-weight: 400;
    color: var(--ink-muted);
  }

  .organize-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem 1.35rem;
    align-items: start;
  }

  .defaults-callout {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    margin: 0 0 1.15rem;
    padding: 0.7rem 0.85rem;
    background: color-mix(in srgb, var(--yellow) 38%, var(--paper));
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 3px 12px 4px 10px / 10px 3px 12px 4px;
    box-shadow: 2px 2px 0 0 color-mix(in srgb, var(--ink) 10%, transparent);
    font-family: var(--hand);
    transform: rotate(-0.2deg);
  }

  .defaults-callout p {
    margin: 0;
    flex: 1 1 14rem;
    font-size: 0.98rem;
    line-height: 1.35;
    color: var(--ink);
  }

  .defaults-btn {
    appearance: none;
    flex: none;
    border: 1.5px solid color-mix(in srgb, var(--ink) 32%, transparent);
    background: color-mix(in srgb, var(--yellow) 72%, transparent);
    color: var(--ink);
    font-family: var(--hand);
    font-size: 0.98rem;
    padding: 0.35rem 0.75rem;
    border-radius: 255px 10px 225px 8px / 10px 225px 8px 255px;
    cursor: pointer;
    transform: rotate(-0.6deg);
  }

  .defaults-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--yellow) 88%, transparent);
    border-color: var(--brand);
  }

  .defaults-btn:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .organize-col h3 {
    margin-top: 0;
  }

  .organize-col .list li {
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 0.35rem;
  }

  .organize-add,
  .organize-edit {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin-bottom: 0.75rem;
  }

  .organize-name {
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 32%, transparent);
    border-radius: 0;
    color: var(--ink);
    font-family: var(--hand);
    font-size: 1rem;
    padding: 0.05rem 0.1rem 0.28rem;
    box-shadow: none;
  }

  .organize-name:focus {
    outline: none;
    border-bottom-color: var(--brand);
  }

  .organize-submit {
    appearance: none;
    align-self: flex-start;
    background: color-mix(in srgb, var(--brand-soft) 85%, var(--mix-wash));
    border: 1.5px solid var(--brand);
    color: var(--brand);
    font-family: var(--hand);
    font-size: 0.95rem;
    padding: 0.28rem 0.85rem;
    cursor: pointer;
    border-radius: 255px 10px 225px 8px / 10px 225px 8px 255px;
  }

  .organize-plus {
    appearance: none;
    align-self: flex-start;
    width: 1.85rem;
    height: 1.85rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: color-mix(in srgb, var(--yellow) 55%, var(--mix-wash));
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    color: var(--ink);
    cursor: pointer;
    border-radius: 4px 10px 5px 9px / 9px 4px 10px 5px;
  }

  .organize-plus:hover:not(:disabled) {
    background: color-mix(in srgb, var(--yellow) 75%, var(--mix-wash));
  }

  .organize-submit:hover:not(:disabled) {
    background: color-mix(in srgb, var(--brand-soft) 70%, var(--yellow));
    border-color: color-mix(in srgb, var(--brand) 75%, var(--ink));
    color: color-mix(in srgb, var(--brand) 70%, var(--ink));
  }

  .organize-submit:disabled,
  .organize-plus:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .color-row.compact {
    gap: 0.35rem 0.4rem;
  }

  .color-row.compact .swatch {
    width: 0.95rem;
    height: 0.85rem;
  }

  .organize-list .cat,
  .organize-list .tag-chip {
    min-width: 0;
  }

  .organize-list .mark {
    padding: 0.02rem 0.12rem;
    background: color-mix(in srgb, var(--item-color, var(--yellow)) 45%, transparent);
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }

  @media (max-width: 900px) {
    .organize-grid {
      grid-template-columns: 1fr;
    }
  }

  .danger-block {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px dashed color-mix(in srgb, var(--danger) 45%, transparent);
  }

  .customise-block + .customise-block {
    margin-top: 0;
  }

  .customise-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.25rem 2rem;
    align-items: start;
  }

  @media (max-width: 900px) {
    .customise-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 640px) {
    .customise-grid {
      grid-template-columns: 1fr;
    }
  }

  .customise-label {
    margin: 0 0 0.45rem;
    font-family: var(--hand);
    font-size: 1rem;
    color: var(--ink-muted);
  }

  .customise-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .customise-bullet {
    appearance: none;
    border: none;
    background: transparent;
    color: var(--ink);
    font-family: var(--hand);
    font-size: 1.05rem;
    padding: 0.1rem 0;
    cursor: pointer;
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
    width: 100%;
    text-align: left;
  }

  .customise-bullet .dot {
    color: var(--ink-muted);
    line-height: 1;
    flex: none;
  }

  .customise-bullet .mark {
    line-height: 1.25;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
    padding: 0.05rem 0.15rem;
  }

  .customise-bullet:hover .mark {
    background: color-mix(in srgb, var(--yellow) 28%, transparent);
  }

  .customise-bullet.active .dot {
    color: var(--ink);
  }

  .customise-bullet.active .mark {
    background: color-mix(in srgb, var(--yellow) 62%, transparent);
  }

  .flash {
    margin: 0 0 1rem;
    padding: 0.65rem 0.85rem;
    border: 1.5px solid var(--brand);
    font-size: 0.9rem;
    border-radius: 4px 12px 6px 10px / 10px 4px 12px 6px;
    background: var(--brand-soft);
  }

  .flash.error {
    border-color: var(--danger);
    color: var(--danger);
    background: color-mix(in srgb, var(--pink) 35%, var(--mix-wash));
  }

  .flash.report {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
    align-items: center;
  }

  .report-link {
    background: none;
    border: none;
    padding: 0;
    color: var(--brand);
    font-family: inherit;
    font-size: inherit;
    text-decoration: underline;
    text-decoration-style: wavy;
    text-underline-offset: 0.2em;
    cursor: pointer;
  }

  .import-form {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .import-bank-hint {
    margin: 0.1rem 0 0.35rem;
  }

  .import-progress {
    height: 10px;
    margin: 0.35rem 0 0.15rem;
    border: 1.5px solid var(--chrome-line);
    background: var(--surface2);
    overflow: hidden;
    border-radius: 2px 8px 3px 6px;
  }

  .import-progress-bar {
    height: 100%;
    background: color-mix(in srgb, var(--green) 70%, var(--brand));
    transition: width 180ms ease;
  }

  .import-status {
    margin: 0 0 0.55rem;
    font-size: 0.85rem;
  }

  .panel-copy {
    margin: 0 0 0.85rem;
    font-size: 0.9rem;
    line-height: 1.45;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    margin-bottom: 0.75rem;
    font-size: 0.9rem;
    letter-spacing: 0.01em;
    text-transform: none;
    color: var(--muted);
  }

  .field select,
  .field input[type="date"],
  .field input[type="text"] {
    background: transparent;
    border: none;
    border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 32%, transparent);
    color: var(--main-text);
    padding: 0.05rem 0.1rem 0.28rem;
    font-family: inherit;
    font-size: 0.95rem;
    text-transform: none;
    letter-spacing: normal;
    border-radius: 0;
    box-shadow: none;
  }

  .field input[type="file"] {
    background: var(--surface);
    border: 1.5px solid var(--chrome-line);
    color: var(--main-text);
    padding: 0.45rem 0.6rem;
    font-family: inherit;
    font-size: 0.95rem;
    text-transform: none;
    letter-spacing: normal;
    border-radius: 3px 10px 4px 8px / 8px 3px 10px 4px;
  }

  .field select:focus,
  .field input[type="date"]:focus-visible,
  .field input[type="text"]:focus-visible {
    outline: none;
    border-bottom-color: var(--brand);
    box-shadow: none;
  }

  .field input[type="file"]:focus-visible {
    outline: none;
    border-color: var(--brand);
    box-shadow: 0 0 0 2px var(--brand-soft);
  }

  .account-form .add {
    margin-top: 0.35rem;
  }

  .accounts-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.55rem;
  }

  .accounts-head h2 {
    margin: 0;
  }

  .accounts-action {
    appearance: none;
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    background: color-mix(in srgb, var(--yellow) 55%, var(--mix-wash));
    color: var(--ink);
    width: 2rem;
    height: 2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 4px 10px 5px 9px / 9px 4px 10px 5px;
    padding: 0;
  }

  .accounts-action:hover:not(:disabled) {
    background: color-mix(in srgb, var(--yellow) 75%, var(--mix-wash));
  }

  .accounts-action:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .account-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.35rem 1.5rem;
    align-items: start;
  }

  .account-grid .field {
    margin-bottom: 0.35rem;
  }

  .account-grid .field-color,
  .account-grid .field-span {
    grid-column: 1 / -1;
  }

  @media (max-width: 640px) {
    .account-grid {
      grid-template-columns: 1fr;
    }
  }

  .clear-opening-form {
    margin-top: 0.65rem;
  }

  .account-pill {
    display: inline-flex;
    align-items: center;
  }

  .account-pill .mark {
    font-weight: 400;
    padding: 0.05rem 0.2rem;
    color: var(--ink);
    background: color-mix(in srgb, var(--account-color, var(--yellow)) 55%, transparent);
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }

  .swatch {
    display: inline-block;
    width: 0.85rem;
    height: 0.75rem;
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 40% 55% 45% 50% / 50% 40% 55% 45%;
    vertical-align: middle;
    box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--ink) 8%, transparent);
  }

  .swatch.lg {
    width: 1.35rem;
    height: 1.2rem;
    border-radius: 42% 58% 48% 52% / 55% 42% 58% 45%;
  }

  .color-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem 0.65rem;
    align-items: center;
  }

  .color-option {
    appearance: none;
    border: none;
    background: transparent;
    padding: 0.2rem;
    cursor: pointer;
    border-radius: 3px 8px 4px 7px / 7px 3px 8px 4px;
    line-height: 0;
  }

  .color-option:hover .swatch {
    transform: rotate(-3deg) scale(1.05);
  }

  .color-option.selected {
    background: transparent;
  }

  .color-option.selected .swatch {
    border-color: var(--ink);
    border-width: 2.5px;
    box-shadow: none;
  }

  .color-custom {
    margin: 0;
    min-width: auto;
    display: flex;
    flex-direction: row;
    gap: 0.4rem;
    align-items: center;
  }

  .color-custom > span {
    font-family: var(--hand);
    font-size: 0.85rem;
    color: var(--ink-muted);
    letter-spacing: 0;
    text-transform: none;
  }

  .color-custom input[type="color"] {
    appearance: none;
    -webkit-appearance: none;
    width: 2.6rem;
    height: 1.35rem;
    padding: 0;
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 4px 10px 5px 9px / 9px 4px 10px 5px;
    background: transparent;
    cursor: pointer;
    overflow: hidden;
  }

  .color-custom input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .color-custom input[type="color"]::-webkit-color-swatch {
    border: none;
    border-radius: 3px 8px 4px 7px / 7px 3px 8px 4px;
  }

  .color-custom input[type="color"]::-moz-color-swatch {
    border: none;
    border-radius: 3px 8px 4px 7px / 7px 3px 8px 4px;
  }

  .color-field {
    border: none;
    padding: 0;
    margin: 0 0 0.75rem;
  }

  .color-field legend {
    font-family: var(--hand);
    font-size: 0.95rem;
    letter-spacing: 0;
    text-transform: none;
    color: var(--ink-muted);
    margin-bottom: 0.35rem;
  }

  .create-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .clear-opening-form {
    margin-top: 0.65rem;
  }

  .clear-opening-form .ghost {
    width: 100%;
    padding: 0.45rem 0.6rem;
  }

  .danger-panel {
    border-color: color-mix(in srgb, var(--danger) 35%, var(--chrome-line));
  }

  .add.danger {
    background: transparent;
    color: var(--danger);
    border-color: color-mix(in srgb, var(--danger) 45%, var(--chrome-line));
    box-shadow: 3px 3px 0 color-mix(in srgb, var(--danger) 25%, var(--chrome-line));
  }

  .add.danger:hover:not(:disabled) {
    border-color: var(--danger);
    box-shadow: 3px 3px 0 var(--danger);
  }

  .add.danger:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .export-link {
    display: inline-block;
    text-align: center;
    text-decoration: none;
  }

  .list li.editing {
    display: block;
    padding: 0.65rem 0;
  }

  .row-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.35rem;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: color-mix(in srgb, var(--paper) 80%, var(--mix-wash));
    border: 1.5px solid color-mix(in srgb, var(--ink) 22%, transparent);
    color: var(--ink-muted);
    cursor: pointer;
    border-radius: 4px 9px 5px 8px / 8px 4px 9px 5px;
  }

  .icon-btn:hover:not(:disabled) {
    color: var(--ink);
    background: color-mix(in srgb, var(--yellow) 45%, var(--mix-wash));
    border-color: color-mix(in srgb, var(--ink) 35%, transparent);
  }

  .icon-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .icon-btn.ok {
    color: var(--brand-success);
    background: color-mix(in srgb, var(--green) 45%, var(--mix-wash));
    border-color: color-mix(in srgb, var(--brand-success) 40%, transparent);
  }

  .icon-btn.ok:hover:not(:disabled) {
    color: var(--brand-success);
    background: color-mix(in srgb, var(--green) 70%, var(--mix-wash));
    border-color: var(--brand-success);
  }

  .icon-btn.danger {
    color: var(--danger);
    background: color-mix(in srgb, var(--pink) 40%, var(--mix-wash));
    border-color: color-mix(in srgb, var(--danger) 40%, transparent);
  }

  .icon-btn.danger:hover:not(:disabled) {
    color: var(--danger);
    background: color-mix(in srgb, var(--pink) 65%, var(--mix-wash));
    border-color: var(--danger);
  }

  .ghost {
    appearance: none;
    background: transparent;
    border: none;
    border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    color: var(--ink-muted);
    font-family: var(--hand);
    font-size: 0.95rem;
    padding: 0.1rem 0.15rem;
    cursor: pointer;
  }

  .ghost:hover {
    color: var(--ink);
    border-bottom-color: var(--brand);
  }

  .ghost.danger {
    color: var(--danger);
    border-bottom-color: color-mix(in srgb, var(--danger) 45%, transparent);
  }

  .ghost.danger:hover {
    color: var(--danger);
    border-bottom-color: var(--danger);
  }

  .edit-actions {
    display: flex;
    gap: 0.55rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .span-all {
    grid-column: 1 / -1;
  }

  .empty {
    display: block;
    padding: 0.5rem 0;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.95rem;
    color: var(--ink);
    min-width: 0;
  }

  .tag-chip :global(.tag-icon) {
    flex-shrink: 0;
  }

  .cat {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
  }
</style>
