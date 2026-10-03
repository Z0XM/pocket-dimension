<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import AppSettings from "$lib/components/app-settings.svelte";
  import SketchSelect from "$lib/components/sketch-select.svelte";
  import { formatMoney, parseIndianAmount } from "$lib/finance/money";
  import { canAllocateTransactionTypes, maxAllocationMinor, spaceRemainders } from "$lib/finance/space-settlement";
  import ArrowLeftRight from "@lucide/svelte/icons/arrow-left-right";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import type { PageData } from "./$types";

  type Props = { data: PageData };
  const { data }: Props = $props();

  type Txn = PageData["transactions"][number];
  type Allocation = PageData["allocations"][number];

  let transactions = $state<Txn[]>([]);
  let allocations = $state<Allocation[]>([]);
  let incomingId = $state("");
  let outgoingId = $state("");
  let amountMajor = $state("");
  let busy = $state(false);
  let errorMessage = $state<string | null>(null);
  let removingTxnId = $state<string | null>(null);
  let deletingAllocationId = $state<string | null>(null);

  $effect(() => {
    transactions = [...data.transactions];
    allocations = [...data.allocations];
  });

  const remainders = $derived(spaceRemainders(transactions, allocations));
  const remainderById = $derived(new Map(remainders.map((row) => [row.transactionId, row])));

  const incomingOpenMinor = $derived(
    transactions.filter((txn) => txn.type === "income").reduce((sum, txn) => sum + (remainderById.get(txn.id)?.remainderMinor ?? 0), 0)
  );
  const outgoingOpenMinor = $derived(
    transactions.filter((txn) => txn.type === "expense").reduce((sum, txn) => sum + (remainderById.get(txn.id)?.remainderMinor ?? 0), 0)
  );
  const allocatedTotalMinor = $derived(allocations.reduce((sum, row) => sum + row.amountMinor, 0));

  function txnById(id: string) {
    return transactions.find((row) => row.id === id);
  }

  const incomingTxn = $derived(incomingId ? (txnById(incomingId) ?? null) : null);
  const outgoingTxn = $derived(outgoingId ? (txnById(outgoingId) ?? null) : null);
  const incomingRemainder = $derived(incomingId ? (remainderById.get(incomingId)?.remainderMinor ?? 0) : 0);
  const outgoingRemainder = $derived(outgoingId ? (remainderById.get(outgoingId)?.remainderMinor ?? 0) : 0);
  const pairOk = $derived(incomingTxn != null && outgoingTxn != null && canAllocateTransactionTypes(incomingTxn.type, outgoingTxn.type));
  const maxMinor = $derived(pairOk ? maxAllocationMinor(incomingRemainder, outgoingRemainder) : 0);

  function formatMajorFromMinor(minor: number) {
    return (minor / 100).toFixed(2);
  }

  /** Parse typed major amount; return null if empty/invalid. */
  function parseTypedMajor(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return parseIndianAmount(trimmed);
    } catch {
      return null;
    }
  }

  function clampAmountToMax(raw: string): string {
    if (maxMinor <= 0) return "";
    const parsed = parseTypedMajor(raw);
    if (parsed == null) return raw;
    if (parsed > maxMinor) return formatMajorFromMinor(maxMinor);
    return raw;
  }

  function onAmountInput(value: string) {
    amountMajor = clampAmountToMax(value);
    if (errorMessage?.includes("exceed") || errorMessage?.includes("incoming")) errorMessage = null;
  }

  $effect(() => {
    // Re-clamp when the selected pair (and thus max) changes.
    maxMinor;
    if (!amountMajor.trim()) return;
    const next = clampAmountToMax(amountMajor);
    if (next !== amountMajor) amountMajor = next;
  });

  $effect(() => {
    // Keep each picker on its direction if data changes.
    if (incomingTxn && incomingTxn.type !== "income") {
      incomingId = "";
      amountMajor = "";
    }
    if (outgoingTxn && outgoingTxn.type !== "expense") {
      outgoingId = "";
      amountMajor = "";
    }
  });

  function txnOptionLabel(txn: Txn) {
    return `${txn.occurredOn} · ${txn.merchant?.trim() || "Untitled"} · ${formatMoney(txn.amountMinor, data.account.currencyCode)}`;
  }

  function optionsForType(type: "income" | "expense") {
    return [
      { value: "", label: type === "income" ? "Pick incoming…" : "Pick outgoing…" },
      ...transactions.filter((txn) => txn.type === type).map((txn) => ({ value: txn.id, label: txnOptionLabel(txn) })),
    ];
  }

  const incomingSelectOptions = $derived(optionsForType("income"));
  const outgoingSelectOptions = $derived(optionsForType("expense"));

  function typeClass(type: Txn["type"]) {
    if (type === "income") return "pos";
    if (type === "expense") return "neg";
    return "";
  }

  /** Signed open remainder for display: income +, expense −. */
  function signedOpenMinor(type: Txn["type"], remainderMinor: number) {
    if (type === "expense") return -remainderMinor;
    return remainderMinor;
  }

  function formatSignedMoney(minor: number, currencyCode: string) {
    const formatted = formatMoney(minor, currencyCode);
    if (minor > 0) return `+${formatted}`;
    return formatted;
  }

  async function createAllocation() {
    if (busy) return;
    errorMessage = null;

    if (!incomingId || !outgoingId || incomingId === outgoingId) {
      errorMessage = "Pick an incoming and an outgoing transaction.";
      return;
    }
    if (!pairOk) {
      errorMessage = "Link an incoming (income) with an outgoing (expense).";
      return;
    }

    let amountMinor: number;
    try {
      amountMinor = parseIndianAmount(amountMajor);
    } catch {
      errorMessage = "Enter a valid amount.";
      return;
    }
    if (amountMinor <= 0) {
      errorMessage = "Amount must be positive.";
      return;
    }
    if (maxMinor <= 0) {
      errorMessage = "Nothing left to allocate on one of these rows.";
      return;
    }
    if (amountMinor > maxMinor) {
      errorMessage = `Amount can’t exceed the smaller open remainder (${formatMoney(maxMinor, data.account.currencyCode)}).`;
      return;
    }

    busy = true;
    try {
      const response = await fetch(`/api/accounts/${data.account.id}/spaces/${data.space.id}/allocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leftTransactionId: incomingId,
          rightTransactionId: outgoingId,
          amountMinor,
        }),
      });
      if (!response.ok) {
        errorMessage = response.status === 400 ? "Pick an incoming and an outgoing transaction in this space." : "Could not create allocation.";
        return;
      }
      const payload = (await response.json()) as { allocation: Allocation };
      allocations = [...allocations, payload.allocation];
      amountMajor = "";
      await invalidateAll();
    } finally {
      busy = false;
    }
  }

  async function deleteAllocation(allocationId: string) {
    if (busy) return;
    deletingAllocationId = allocationId;
    errorMessage = null;
    try {
      const response = await fetch(`/api/accounts/${data.account.id}/spaces/${data.space.id}/allocations/${allocationId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        errorMessage = "Could not delete allocation.";
        return;
      }
      allocations = allocations.filter((row) => row.id !== allocationId);
      await invalidateAll();
    } finally {
      deletingAllocationId = null;
    }
  }

  async function detachTransaction(transactionId: string) {
    if (busy) return;
    if (!confirm("Remove this transaction from the space? Allocations that touch it will be deleted.")) return;

    removingTxnId = transactionId;
    errorMessage = null;
    try {
      const response = await fetch(`/api/accounts/${data.account.id}/transactions/${transactionId}/spaces/${data.space.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        errorMessage = "Could not remove transaction.";
        return;
      }
      transactions = transactions.filter((row) => row.id !== transactionId);
      allocations = allocations.filter((row) => row.leftTransactionId !== transactionId && row.rightTransactionId !== transactionId);
      if (incomingId === transactionId) incomingId = "";
      if (outgoingId === transactionId) outgoingId = "";
      await invalidateAll();
    } finally {
      removingTxnId = null;
    }
  }

  function useMaxAmount() {
    if (maxMinor > 0) amountMajor = formatMajorFromMinor(maxMinor);
  }
</script>

<svelte:head><title>{data.space.name} · Space · Chhan Chhan</title></svelte:head>

<header class="topbar">
  <div class="title-row">
    <a class="back-link" href="/app/transactions?space={data.space.id}">← Back</a>
    <h1>
      <span class="swatch" style="background: {data.space.colorHex ?? '#BDE0FE'}" aria-hidden="true"></span>
      {data.space.name}
    </h1>
  </div>
  <div class="actions">
    <AppSettings />
  </div>
</header>

{#if data.space.notes}
  <p class="space-notes dim">{data.space.notes}</p>
{/if}

{#if errorMessage}
  <p class="flash error">{errorMessage}</p>
{/if}

<div class="summary-row">
  <div class="flow" aria-label="Space summary">
    <div class="node">
      <span class="node-k">in space</span>
      <span class="node-v">{transactions.length}</span>
    </div>
    <span class="flow-arrow" aria-hidden="true">→</span>
    <div class="node">
      <span class="node-k">allocations</span>
      <span class="node-v">{allocations.length}</span>
    </div>
    <span class="flow-arrow" aria-hidden="true">→</span>
    <div class="node">
      <span class="node-k">linked</span>
      <span class="node-v">
        <span class="rough-mark is-linked">
          <svg class="stroke" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
            <rect x="1" y="3" width="118" height="20" rx="2" fill="color-mix(in srgb, var(--blue) 55%, transparent)" />
          </svg>
          <span class="txt">{formatMoney(allocatedTotalMinor, data.account.currencyCode)}</span>
        </span>
      </span>
    </div>
    <span class="flow-arrow" aria-hidden="true">=</span>
    <div class="node" class:open-rem={incomingOpenMinor > 0} class:settled={incomingOpenMinor === 0 && transactions.length > 0}>
      <span class="node-k">open in</span>
      <span class="node-v">
        <span class="rough-mark is-open">
          <svg class="stroke" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
            <rect
              x="1"
              y="3"
              width="118"
              height="20"
              rx="2"
              fill={incomingOpenMinor > 0 ? "color-mix(in srgb, var(--green) 55%, transparent)" : "color-mix(in srgb, var(--green) 35%, transparent)"}
            />
          </svg>
          <span class="txt amt pos">{formatSignedMoney(incomingOpenMinor, data.account.currencyCode)}</span>
        </span>
      </span>
    </div>
    <div class="node" class:open-rem={outgoingOpenMinor > 0} class:settled={outgoingOpenMinor === 0 && transactions.length > 0}>
      <span class="node-k">open out</span>
      <span class="node-v">
        <span class="rough-mark is-open">
          <svg class="stroke" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
            <rect
              x="1"
              y="3"
              width="118"
              height="20"
              rx="2"
              fill={outgoingOpenMinor > 0 ? "color-mix(in srgb, var(--pink) 55%, transparent)" : "color-mix(in srgb, var(--green) 35%, transparent)"}
            />
          </svg>
          <span class="txt amt neg">{formatSignedMoney(-outgoingOpenMinor, data.account.currencyCode)}</span>
        </span>
      </span>
    </div>
  </div>
  <a class="manage-link" href="/app/control">Manage</a>
</div>

<div class="space-notebook">
  <div class="notebook-sheet">
    <div class="organize-grid">
      <section class="sheet-panel">
        <h2>Transactions</h2>
        <p class="panel-copy dim">Attach more from the ledger’s space icon, then settle here.</p>

        {#if transactions.length === 0}
          <p class="dim empty">No transactions in this space yet.</p>
        {:else}
          <div class="table-block table-sheet space-table">
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Merchant</th>
                    <th class="right">Amount</th>
                    <th class="right">Open</th>
                    <th class="right"></th>
                  </tr>
                </thead>
                <tbody>
                  {#each transactions as txn (txn.id)}
                    {@const rem = remainderById.get(txn.id)}
                    <tr>
                      <td class="mono dim">{txn.occurredOn}</td>
                      <td class="merchant">{txn.merchant ?? "—"}</td>
                      <td class="right mono amt {typeClass(txn.type)}">
                        {formatMoney(txn.amountMinor, data.account.currencyCode)}
                      </td>
                      <td class="right mono amt {typeClass(txn.type)}" class:rem-open={(rem?.remainderMinor ?? 0) > 0}>
                        {formatSignedMoney(signedOpenMinor(txn.type, rem?.remainderMinor ?? 0), data.account.currencyCode)}
                      </td>
                      <td class="right">
                        <button
                          type="button"
                          class="icon-btn danger"
                          aria-label="Remove from space"
                          disabled={removingTxnId === txn.id}
                          onclick={() => detachTransaction(txn.id)}
                        >
                          <X size={14} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
      </section>

      <section class="sheet-panel">
        <h2>Allocate</h2>
        <p class="panel-copy dim">Link an incoming with an outgoing — refunds, splits, partial pays.</p>

        {#if transactions.length < 2}
          <p class="dim empty">Need at least two transactions to allocate.</p>
        {:else}
          <form
            class="alloc-form"
            onsubmit={(e) => {
              e.preventDefault();
              void createAllocation();
            }}
          >
            <label class="field">
              <span class="field-k">Incoming</span>
              <SketchSelect name="alloc-incoming" options={incomingSelectOptions} bind:value={incomingId} aria-label="Incoming transaction" />
            </label>

            <div class="alloc-mid" aria-hidden="true">
              <ArrowLeftRight size={16} strokeWidth={1.6} />
            </div>

            <label class="field">
              <span class="field-k">Outgoing</span>
              <SketchSelect name="alloc-outgoing" options={outgoingSelectOptions} bind:value={outgoingId} aria-label="Outgoing transaction" />
            </label>

            <label class="field">
              <span class="field-k">Amount</span>
              <div class="amount-row">
                <input
                  class="underline-input"
                  type="text"
                  inputmode="decimal"
                  placeholder="0.00"
                  value={amountMajor}
                  disabled={maxMinor <= 0}
                  required
                  oninput={(e) => onAmountInput(e.currentTarget.value)}
                />
                {#if maxMinor > 0}
                  <button type="button" class="suggest-btn" onclick={useMaxAmount}>
                    Max {formatMoney(maxMinor, data.account.currencyCode)}
                  </button>
                {/if}
              </div>
              {#if incomingId && outgoingId}
                <span class="field-hint">
                  {#if maxMinor > 0}
                    Suggested / max = smaller open remainder ({formatMoney(incomingRemainder, data.account.currencyCode)} vs
                    {formatMoney(outgoingRemainder, data.account.currencyCode)}).
                  {:else}
                    Nothing left to allocate on one of these rows.
                  {/if}
                </span>
              {/if}
            </label>

            <button type="submit" class="add" disabled={busy}>
              <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
              {busy ? "Linking…" : "Add allocation"}
            </button>
          </form>
        {/if}

        <div class="alloc-scroll">
          <h3>Allocations</h3>
          {#if allocations.length === 0}
            <p class="dim empty">None yet.</p>
          {:else}
            <ul class="alloc-list">
              {#each allocations as allocation (allocation.id)}
                {@const left = txnById(allocation.leftTransactionId)}
                {@const right = txnById(allocation.rightTransactionId)}
                <li>
                  <div class="alloc-body">
                    <span class="pair">
                      {left?.merchant ?? "Txn"}
                      <span class="dim">↔</span>
                      {right?.merchant ?? "Txn"}
                    </span>
                    <span class="mono amt">{formatMoney(allocation.amountMinor, data.account.currencyCode)}</span>
                  </div>
                  <button
                    type="button"
                    class="icon-btn danger"
                    aria-label="Delete allocation"
                    disabled={deletingAllocationId === allocation.id}
                    onclick={() => deleteAllocation(allocation.id)}
                  >
                    <X size={14} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </section>
    </div>
  </div>
</div>

<style>
  .title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .topbar h1 {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .swatch {
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 2px 5px 3px 4px;
    border: 1.5px solid color-mix(in srgb, var(--ink) 25%, transparent);
    flex: 0 0 auto;
  }

  .back-link {
    flex: 0 0 auto;
    color: var(--muted);
    text-decoration: none;
    font-family: var(--hand);
    font-size: 1.05rem;
    letter-spacing: 0.01em;
  }

  .back-link:hover {
    color: var(--ink);
  }

  .manage-link {
    display: inline-flex;
    align-items: center;
    font-family: var(--hand);
    font-size: 1.05rem;
    color: var(--ink-muted);
    text-decoration: none;
    padding: 0.25rem 0.55rem;
    border: 1.5px solid color-mix(in srgb, var(--ink) 22%, transparent);
    border-radius: 3px 10px 4px 8px / 8px 3px 10px 4px;
    background: color-mix(in srgb, var(--yellow) 35%, var(--mix-wash));
  }

  .manage-link:hover {
    color: var(--ink);
    border-color: color-mix(in srgb, var(--ink) 35%, transparent);
    background: color-mix(in srgb, var(--yellow) 55%, var(--mix-wash));
  }

  .space-notes {
    margin: -0.35rem 0 0.85rem;
    font-family: var(--hand);
    font-size: 1.05rem;
    flex: 0 0 auto;
  }

  .flash {
    margin: 0 0 1rem;
    padding: 0.65rem 0.85rem;
    border: 1.5px solid var(--brand);
    font-size: 0.9rem;
    font-family: var(--hand);
    border-radius: 4px 12px 6px 10px / 10px 4px 12px 6px;
    background: var(--brand-soft);
    flex: 0 0 auto;
  }

  .flash.error {
    border-color: var(--danger);
    color: var(--danger);
    background: color-mix(in srgb, var(--pink) 35%, var(--mix-wash));
  }

  .flow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem 0.65rem;
    margin: 0;
    font-family: var(--hand);
    min-width: 0;
    flex: 1 1 auto;
  }

  .node {
    display: inline-flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .node-k {
    font-size: 0.85rem;
    color: var(--ink-muted);
    letter-spacing: 0.02em;
  }

  .node-v {
    font-size: 1.2rem;
    color: var(--ink);
  }

  .flow-arrow {
    color: var(--ink-muted);
    font-size: 1.1rem;
    margin-top: 0.85rem;
  }

  .rough-mark {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-width: 4.5rem;
  }

  .rough-mark .stroke {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .rough-mark .txt {
    position: relative;
    z-index: 1;
    padding: 0.1rem 0.35rem;
  }

  .summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    margin: 0 0 1.1rem;
    flex: 0 0 auto;
  }

  .summary-row .manage-link {
    flex: 0 0 auto;
  }

  .space-notebook {
    margin-top: 0.15rem;
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .notebook-sheet {
    --page: var(--surface-raised);
    position: relative;
    z-index: 1;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--page);
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 1px 4px 3px 1px;
    padding: 1.2rem 1.35rem 1.55rem 1.55rem;
    box-shadow:
      3px 3px 0 0 var(--shadow-paper),
      3px 3px 0 1.5px color-mix(in srgb, var(--ink) 22%, transparent),
      6px 6px 0 0 #f1ece0,
      6px 6px 0 1.5px color-mix(in srgb, var(--ink) 18%, transparent);
  }

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
    opacity: 0.45;
    pointer-events: none;
    z-index: 0;
    border-radius: inherit;
  }

  .organize-grid {
    position: relative;
    z-index: 1;
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.15rem 1.5rem;
    align-items: stretch;
  }

  .sheet-panel {
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    box-shadow: none;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .sheet-panel h2 {
    margin: 0 0 0.35rem;
    font-family: var(--hand);
    font-size: 1.35rem;
    font-weight: 400;
    color: var(--ink-muted);
    flex: 0 0 auto;
  }

  .sheet-panel h3 {
    margin: 1.15rem 0 0.45rem;
    font-family: var(--hand);
    font-size: 1.1rem;
    font-weight: 400;
    color: var(--ink-muted);
    flex: 0 0 auto;
  }

  .panel-copy {
    margin: 0 0 0.85rem;
    font-family: var(--hand);
    font-size: 1rem;
    flex: 0 0 auto;
  }

  .dim.empty {
    margin: 0;
    font-family: var(--hand);
  }

  .space-table {
    flex: 1 1 auto;
    min-height: 12rem;
  }

  :global(.forge .table-sheet.space-table) {
    max-height: none;
    min-height: 12rem;
    flex: 1 1 auto;
  }

  .alloc-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
  }

  .merchant {
    font-family: var(--hand);
  }

  .amt.pos {
    color: var(--pos, var(--success));
  }

  .amt.neg {
    color: var(--neg, var(--danger));
  }

  .rem-open {
    color: var(--brand);
    font-weight: 600;
  }

  .alloc-form {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    flex: 0 0 auto;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .field-k {
    font-family: var(--hand);
    font-size: 0.95rem;
    color: var(--ink-muted);
  }

  .field-hint {
    font-family: var(--hand);
    font-size: 0.9rem;
    color: var(--ink-muted);
  }

  .alloc-mid {
    display: flex;
    justify-content: center;
    align-items: center;
    color: var(--ink-muted);
    margin-block: -0.2rem;
    line-height: 1;
  }

  .alloc-mid + .field {
    margin-top: -0.35rem;
  }

  .amount-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .underline-input {
    appearance: none;
    flex: 1 1 7rem;
    min-width: 6rem;
    padding: 0.35rem 0.15rem;
    border: none;
    border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 32%, transparent);
    border-radius: 0;
    background: transparent;
    font-family: var(--hand);
    font-size: 1.1rem;
    color: var(--ink);
  }

  .underline-input:focus {
    outline: none;
    border-bottom-color: var(--brand);
  }

  .suggest-btn {
    appearance: none;
    font-family: var(--hand);
    font-size: 0.95rem;
    padding: 0.25rem 0.55rem;
    border: 1.5px dashed color-mix(in srgb, var(--ink) 28%, transparent);
    background: color-mix(in srgb, var(--yellow) 42%, transparent);
    color: var(--ink);
    cursor: pointer;
    border-radius: 3px 10px 4px 8px / 8px 3px 10px 4px;
  }

  .suggest-btn:hover {
    border-style: solid;
    border-color: var(--brand);
    color: var(--brand);
  }

  .alloc-form .add {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    margin-top: 0.15rem;
  }

  .alloc-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .alloc-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.55rem;
    padding: 0.45rem 0.55rem;
    border: 1.5px solid color-mix(in srgb, var(--ink) 16%, transparent);
    border-radius: 2px 8px 3px 6px / 6px 2px 8px 3px;
    background: color-mix(in srgb, var(--yellow) 22%, var(--mix-wash));
  }

  .alloc-body {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
    flex: 1;
  }

  .pair {
    font-family: var(--hand);
    font-size: 1.05rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .icon-btn.danger:hover:not(:disabled) {
    color: var(--danger);
    border-color: color-mix(in srgb, var(--danger) 55%, transparent);
    background: color-mix(in srgb, var(--pink) 35%, var(--mix-wash));
  }

  .icon-btn:disabled {
    opacity: 0.45;
    cursor: wait;
  }

  .mono {
    font-variant-numeric: tabular-nums;
  }

  .right {
    text-align: right;
  }

  @media (max-width: 860px) {
    .organize-grid {
      grid-template-columns: 1fr;
      overflow: auto;
    }

    .space-table {
      min-height: 10rem;
      max-height: 40vh;
    }
  }
</style>
