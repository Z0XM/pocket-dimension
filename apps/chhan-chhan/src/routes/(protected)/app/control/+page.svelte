<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { enhance } from "$app/forms";
  import { importProgressLabel, importProgressPercent, importStatementWithProgress, type ImportStreamEvent } from "$lib/import-stream";
  import AppSettings from "$lib/components/app-settings.svelte";
  import { SquarePen, Tag, Trash2, Layers } from "@lucide/svelte";
  import type { PageData, ActionData } from "./$types";

  const { data, form }: { data: PageData; form: ActionData } = $props();

  let importing = $state(false);
  let importProgress = $state(0);
  let importStatus = $state("");
  let importMessage = $state<string | null>(null);
  let importSuccess = $state(true);
  let importReportCsv = $state<string | null>(null);
  let addingCategory = $state(false);
  let editingId = $state<string | null>(null);
  let savingCategoryId = $state<string | null>(null);
  let deletingCategoryId = $state<string | null>(null);
  let addingTag = $state(false);
  let editingTagId = $state<string | null>(null);
  let savingTagId = $state<string | null>(null);
  let deletingTagId = $state<string | null>(null);
  let addingGroup = $state(false);
  let editingGroupId = $state<string | null>(null);
  let savingGroupId = $state<string | null>(null);
  let deletingGroupId = $state<string | null>(null);
  let savingCurrency = $state(false);

  function downloadImportReport(csv: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `import-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleImportEvent(event: ImportStreamEvent) {
    importProgress = importProgressPercent(event);
    importStatus = importProgressLabel(event);
  }

  async function submitImport(event: SubmitEvent) {
    event.preventDefault();
    const formEl = event.currentTarget as HTMLFormElement;
    const formData = new FormData(formEl);
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      importMessage = "Choose a statement file to import";
      importSuccess = false;
      return;
    }

    importing = true;
    importProgress = 4;
    importStatus = "Uploading file…";
    importMessage = null;
    importReportCsv = null;
    importSuccess = true;

    try {
      const result = await importStatementWithProgress(data.account.id, formData, handleImportEvent);
      importProgress = 100;
      importStatus = "Import complete";
      importMessage = `Imported ${result.accepted} transactions (${result.skipped} skipped, ${result.rejected} rejected)`;
      importSuccess = true;
      importReportCsv = result.reportCsv ?? null;
      formEl.reset();
      await invalidateAll();
    } catch (cause) {
      importMessage = cause instanceof Error ? cause.message : "Failed to import statement";
      importSuccess = false;
    } finally {
      importing = false;
    }
  }
</script>

<svelte:head><title>Control · Chhan Chhan</title></svelte:head>

<header class="topbar">
  <div>
    <h1>CONTROL</h1>
    <p class="sub">Import · export · categories · tags · groups</p>
  </div>
  <div class="actions">
    <a class="back" href="/app">← Transactions</a>
    <AppSettings />
  </div>
</header>

{#if importMessage}
  <p class="flash" class:error={!importSuccess}>{importMessage}</p>
{/if}

{#if !importMessage && form?.message}
  <p class="flash" class:error={!form?.success}>{form.message}</p>
{/if}

{#if importReportCsv}
  <p class="flash report">
    Some rows were skipped or rejected.
    <button type="button" class="report-link" onclick={() => downloadImportReport(importReportCsv!)}> Download import report CSV </button>
  </p>
{/if}

<div class="cols">
  <section class="panel">
    <h2>Import</h2>
    <p class="panel-copy dim">
      Upload a bank statement as CSV or PDF (Kotak, ICICI, HDFC, or Generic CSV). Imports use
      <strong>{data.account.currencyCode}</strong>.
    </p>
    <form class="import-form" enctype="multipart/form-data" onsubmit={submitImport}>
      <label class="field">
        <span>Bank</span>
        <select name="importer" disabled={importing}>
          {#each data.importers as importer}
            <option value={importer.id}>{importer.label}</option>
          {/each}
        </select>
      </label>
      <label class="field">
        <span>Statement file</span>
        <input name="file" type="file" accept=".csv,.pdf,text/csv,application/pdf" required disabled={importing} />
      </label>

      {#if importing}
        <div class="import-progress" aria-hidden="true">
          <div class="import-progress-bar" style="width: {importProgress}%"></div>
        </div>
        <p class="import-status dim">{importStatus}</p>
      {/if}

      <button class="add" type="submit" disabled={importing}>
        {importing ? "IMPORTING…" : "IMPORT STATEMENT"}
      </button>
    </form>
  </section>

  <section class="panel">
    <h2>Account</h2>
    <p class="panel-copy dim">Default currency for imports and amount display.</p>
    <form
      method="POST"
      action="?/updateCurrency"
      use:enhance={() => {
        savingCurrency = true;
        return async ({ update }) => {
          savingCurrency = false;
          await update();
        };
      }}
    >
      <label class="field">
        <span>Currency</span>
        <select name="currencyCode">
          {#each data.currencies as currency}
            <option value={currency.code} selected={currency.code === data.account.currencyCode}>
              {currency.label}
            </option>
          {/each}
          {#if !data.currencies.some((currency) => currency.code === data.account.currencyCode)}
            <option value={data.account.currencyCode} selected>{data.account.currencyCode}</option>
          {/if}
        </select>
      </label>
      <button class="add" type="submit" disabled={savingCurrency}>
        {savingCurrency ? "SAVING…" : "SAVE CURRENCY"}
      </button>
    </form>
  </section>

  <section class="panel">
    <h2>Export</h2>
    <p class="panel-copy dim">Download all transactions for this account as CSV.</p>
    <a class="add export-link" href="/api/accounts/{data.account.id}/transactions/export">EXPORT CSV</a>
  </section>

  <section class="panel span-all">
    <h2>Categories</h2>
    <form
      class="category-add"
      method="POST"
      action="?/createCategory"
      use:enhance={() => {
        addingCategory = true;
        return async ({ update }) => {
          addingCategory = false;
          await update();
        };
      }}
    >
      <input name="name" placeholder="Category name" required />
      <select name="kind">
        <option value="expense">Expense</option>
        <option value="income">Income</option>
        <option value="transfer">Transfer</option>
      </select>
      <input name="colorHex" type="color" value="#ee7c02" aria-label="Category color" />
      <button type="submit" disabled={addingCategory}>{addingCategory ? "ADDING…" : "ADD"}</button>
    </form>
    <ul class="list">
      {#if data.categories.length === 0}
        <li class="dim empty">No categories yet.</li>
      {:else}
        {#each data.categories as category (category.id)}
          <li class:editing={editingId === category.id}>
            {#if editingId === category.id}
              <form
                class="category-edit"
                method="POST"
                action="?/updateCategory"
                use:enhance={() => {
                  savingCategoryId = category.id;
                  return async ({ update, result }) => {
                    savingCategoryId = null;
                    if (result.type === "success") editingId = null;
                    await update();
                  };
                }}
              >
                <input type="hidden" name="id" value={category.id} />
                <input name="name" value={category.name} required />
                <select name="kind">
                  <option value="expense" selected={category.kind === "expense"}>Expense</option>
                  <option value="income" selected={category.kind === "income"}>Income</option>
                  <option value="transfer" selected={category.kind === "transfer"}>Transfer</option>
                </select>
                <input name="colorHex" type="color" value={category.colorHex ?? "#ee7c02"} aria-label="Category color" />
                <div class="edit-actions">
                  <button type="submit" disabled={savingCategoryId === category.id}>
                    {savingCategoryId === category.id ? "SAVING…" : "SAVE"}
                  </button>
                  <button type="button" class="ghost" onclick={() => (editingId = null)}>CANCEL</button>
                </div>
              </form>
            {:else}
              <span class="cat"><span class="sq" style="background:{category.colorHex ?? '#ee7c02'}"></span>{category.name}</span>
              <span class="kind kind-{category.kind}">{category.kind}</span>
              <div class="row-actions">
                <button type="button" class="icon-btn" aria-label="Edit {category.name}" onclick={() => (editingId = category.id)}>
                  <SquarePen size={16} strokeWidth={1.25} aria-hidden="true" />
                </button>
                <form
                  method="POST"
                  action="?/deleteCategory"
                  use:enhance={() => {
                    return async ({ cancel, update }) => {
                      if (!confirm(`Delete “${category.name}”? Linked transactions will become uncategorized.`)) {
                        cancel();
                        return;
                      }
                      deletingCategoryId = category.id;
                      await update();
                      deletingCategoryId = null;
                      if (editingId === category.id) editingId = null;
                    };
                  }}
                >
                  <input type="hidden" name="id" value={category.id} />
                  <button type="submit" class="icon-btn danger" aria-label="Delete {category.name}" disabled={deletingCategoryId === category.id}>
                    <Trash2 size={16} strokeWidth={1.25} aria-hidden="true" />
                  </button>
                </form>
              </div>
            {/if}
          </li>
        {/each}
      {/if}
    </ul>
  </section>

  <section class="panel span-all">
    <h2>Tags</h2>
    <form
      class="tag-add-form"
      method="POST"
      action="?/createTag"
      use:enhance={() => {
        addingTag = true;
        return async ({ update }) => {
          addingTag = false;
          await update();
        };
      }}
    >
      <input name="name" placeholder="Tag name" required />
      <input name="colorHex" type="color" value="#ee7c02" aria-label="Tag color" />
      <button type="submit" disabled={addingTag}>{addingTag ? "ADDING…" : "ADD"}</button>
    </form>
    <ul class="list">
      {#if data.tags.length === 0}
        <li class="dim empty">No tags yet.</li>
      {:else}
        {#each data.tags as tag (tag.id)}
          <li class:editing={editingTagId === tag.id}>
            {#if editingTagId === tag.id}
              <form
                class="tag-edit"
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
                <input name="name" value={tag.name} required />
                <input name="colorHex" type="color" value={tag.colorHex ?? "#ee7c02"} aria-label="Tag color" />
                <div class="edit-actions">
                  <button type="submit" disabled={savingTagId === tag.id}>
                    {savingTagId === tag.id ? "SAVING…" : "SAVE"}
                  </button>
                  <button type="button" class="ghost" onclick={() => (editingTagId = null)}>CANCEL</button>
                </div>
              </form>
            {:else}
              <span class="tag-chip">
                <Tag size={14} strokeWidth={1.25} class="tag-icon" style="color: {tag.colorHex ?? '#ee7c02'}" aria-hidden="true" />
                {tag.name}
              </span>
              <div class="row-actions">
                <button type="button" class="icon-btn" aria-label="Edit {tag.name}" onclick={() => (editingTagId = tag.id)}>
                  <SquarePen size={16} strokeWidth={1.25} aria-hidden="true" />
                </button>
                <form
                  method="POST"
                  action="?/deleteTag"
                  use:enhance={() => {
                    return async ({ cancel, update }) => {
                      if (!confirm(`Delete “${tag.name}”? It will be removed from linked transactions.`)) {
                        cancel();
                        return;
                      }
                      deletingTagId = tag.id;
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
  </section>

  <section class="panel span-all">
    <h2>Groups</h2>
    <form
      class="tag-add-form"
      method="POST"
      action="?/createGroup"
      use:enhance={() => {
        addingGroup = true;
        return async ({ update }) => {
          addingGroup = false;
          await update();
        };
      }}
    >
      <input name="name" placeholder="Group name" required />
      <button type="submit" disabled={addingGroup}>{addingGroup ? "ADDING…" : "ADD"}</button>
    </form>
    <ul class="list">
      {#if data.groups.length === 0}
        <li class="dim empty">No groups yet.</li>
      {:else}
        {#each data.groups as group (group.id)}
          <li class:editing={editingGroupId === group.id}>
            {#if editingGroupId === group.id}
              <form
                class="tag-edit"
                method="POST"
                action="?/updateGroup"
                use:enhance={() => {
                  savingGroupId = group.id;
                  return async ({ update, result }) => {
                    savingGroupId = null;
                    if (result.type === "success") editingGroupId = null;
                    await update();
                  };
                }}
              >
                <input type="hidden" name="id" value={group.id} />
                <input name="name" value={group.name} required />
                <div class="row-actions">
                  <button type="submit" disabled={savingGroupId === group.id}>
                    {savingGroupId === group.id ? "SAVING…" : "SAVE"}
                  </button>
                  <button type="button" onclick={() => (editingGroupId = null)}>CANCEL</button>
                </div>
              </form>
            {:else}
              <span class="tag-chip group-chip">
                <Layers size={14} strokeWidth={1.25} class="tag-icon" aria-hidden="true" />
                {group.name}
              </span>
              <div class="row-actions">
                <button type="button" class="icon-btn" aria-label="Edit {group.name}" onclick={() => (editingGroupId = group.id)}>
                  <SquarePen size={16} strokeWidth={1.25} aria-hidden="true" />
                </button>
                <form
                  method="POST"
                  action="?/deleteGroup"
                  use:enhance={() => {
                    return async ({ update }) => {
                      if (!confirm(`Delete “${group.name}”? It will be removed from linked transactions.`)) {
                        return;
                      }
                      deletingGroupId = group.id;
                      await update();
                      deletingGroupId = null;
                      if (editingGroupId === group.id) editingGroupId = null;
                    };
                  }}
                >
                  <input type="hidden" name="id" value={group.id} />
                  <button type="submit" class="icon-btn danger" aria-label="Delete {group.name}" disabled={deletingGroupId === group.id}>
                    <Trash2 size={16} strokeWidth={1.25} aria-hidden="true" />
                  </button>
                </form>
              </div>
            {/if}
          </li>
        {/each}
      {/if}
    </ul>
  </section>
</div>

<style>
  .flash {
    margin: 0 0 1rem;
    padding: 0.65rem 0.85rem;
    border: 1px solid var(--hi-purple);
    font-size: 0.78rem;
  }

  .flash.error {
    border-color: var(--danger);
    color: var(--danger);
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
    color: var(--hi-cyan);
    font-family: inherit;
    font-size: inherit;
    text-decoration: underline;
    cursor: pointer;
  }

  .import-form {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .import-progress {
    height: 10px;
    margin: 0.35rem 0 0.15rem;
    border: 2px solid var(--chrome-line);
    background: var(--surface2);
    overflow: hidden;
  }

  .import-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--hi-purple), var(--hi-cyan));
    transition: width 180ms ease;
  }

  .import-status {
    margin: 0 0 0.55rem;
    font-size: 0.74rem;
  }

  .panel-copy {
    margin: 0 0 0.85rem;
    font-size: 0.76rem;
    line-height: 1.45;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-bottom: 0.75rem;
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .field select,
  .field input[type="file"] {
    background: var(--surface2);
    border: 2px solid var(--chrome-line);
    color: var(--main-text);
    padding: 0.45rem 0.6rem;
    font-family: inherit;
    font-size: 0.8rem;
    text-transform: none;
    letter-spacing: normal;
  }

  .field select:focus,
  .field input[type="file"]:focus-visible {
    outline: none;
    border-color: var(--hi-focus);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--hi-focus) 45%, transparent);
  }

  .export-link {
    display: inline-block;
    text-align: center;
    text-decoration: none;
  }

  .category-add {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    gap: 0.5rem;
    margin-bottom: 0.9rem;
  }

  .category-add input,
  .category-add select,
  .category-add button {
    background: var(--surface2);
    border: 2px solid var(--chrome-line);
    color: var(--main-text);
    padding: 0.45rem 0.6rem;
    font-family: inherit;
    font-size: 0.8rem;
  }

  .category-add button {
    background: var(--accent);
    color: var(--background);
    font-weight: 700;
    cursor: pointer;
  }

  .category-add input[type="color"],
  .category-edit input[type="color"],
  .tag-add-form input[type="color"],
  .tag-edit input[type="color"] {
    width: 42px;
    height: 42px;
    min-width: 42px;
    min-height: 42px;
    padding: 0.2rem;
    box-sizing: border-box;
    flex-shrink: 0;
  }

  .category-add input[type="color"]::-webkit-color-swatch-wrapper,
  .category-edit input[type="color"]::-webkit-color-swatch-wrapper,
  .tag-add-form input[type="color"]::-webkit-color-swatch-wrapper,
  .tag-edit input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .category-add input[type="color"]::-webkit-color-swatch,
  .category-edit input[type="color"]::-webkit-color-swatch,
  .tag-add-form input[type="color"]::-webkit-color-swatch,
  .tag-edit input[type="color"]::-webkit-color-swatch {
    border: none;
  }

  .list li.editing {
    display: block;
    padding: 0.65rem 0;
  }

  .category-edit {
    display: grid;
    grid-template-columns: 1fr auto auto auto auto;
    gap: 0.5rem;
    align-items: center;
  }

  .category-edit input,
  .category-edit select,
  .category-edit button {
    background: var(--surface2);
    border: 2px solid var(--chrome-line);
    color: var(--main-text);
    padding: 0.45rem 0.6rem;
    font-family: inherit;
    font-size: 0.8rem;
  }

  .category-edit button[type="submit"] {
    background: var(--accent);
    color: var(--background);
    font-weight: 700;
    cursor: pointer;
  }

  .edit-actions {
    display: flex;
    gap: 0.35rem;
  }

  .ghost {
    background: none;
    border: 1px solid var(--chrome-line);
    color: var(--muted);
    font-family: inherit;
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.35rem 0.55rem;
    cursor: pointer;
  }

  .ghost:hover {
    color: var(--hi-green);
    border-color: var(--hi-purple);
  }

  .ghost.danger {
    color: var(--danger);
    border-color: color-mix(in srgb, var(--danger) 45%, transparent);
  }

  .ghost.danger:hover {
    color: var(--danger);
    border-color: var(--danger);
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
    background: none;
    border: 1px solid var(--chrome-line);
    color: var(--muted);
    cursor: pointer;
  }

  .icon-btn:hover:not(:disabled) {
    color: var(--hi-green);
    border-color: var(--hi-cyan);
  }

  .icon-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .icon-btn.danger {
    color: var(--danger);
    border-color: color-mix(in srgb, var(--danger) 45%, transparent);
  }

  .icon-btn.danger:hover:not(:disabled) {
    color: var(--danger);
    border-color: var(--danger);
  }

  .span-all {
    grid-column: 1 / -1;
  }

  .empty {
    display: block;
    padding: 0.5rem 0;
  }

  .tag-add-form {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 0.5rem;
    margin-bottom: 0.9rem;
  }

  .tag-add-form input,
  .tag-add-form button {
    background: var(--surface2);
    border: 2px solid var(--chrome-line);
    color: var(--main-text);
    padding: 0.45rem 0.6rem;
    font-family: inherit;
    font-size: 0.8rem;
  }

  .tag-add-form button {
    background: var(--accent);
    color: var(--background);
    font-weight: 700;
    cursor: pointer;
  }

  .tag-edit {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    gap: 0.5rem;
    align-items: center;
  }

  .tag-edit input,
  .tag-edit button {
    background: var(--surface2);
    border: 2px solid var(--chrome-line);
    color: var(--main-text);
    padding: 0.45rem 0.6rem;
    font-family: inherit;
    font-size: 0.8rem;
  }

  .tag-edit button[type="submit"] {
    background: var(--accent);
    color: var(--background);
    font-weight: 700;
    cursor: pointer;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: var(--main-text);
  }

  .tag-chip :global(.tag-icon) {
    flex-shrink: 0;
  }

  @media (max-width: 760px) {
    .category-add,
    .category-edit,
    .tag-add-form,
    .tag-edit {
      grid-template-columns: 1fr 1fr;
    }

    .edit-actions {
      grid-column: 1 / -1;
    }
  }
</style>
