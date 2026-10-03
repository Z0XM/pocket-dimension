<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import AppSettings from "$lib/components/app-settings.svelte";
  import SketchSelect from "$lib/components/sketch-select.svelte";
  import { formatMoney, parseIndianAmount } from "$lib/finance/money";
  import {
    canAllocateTransactionTypes,
    equalSplitShares,
    maxAllocationMinor,
    maxItemPaymentMinor,
    sharesSumToAmount,
    spaceRemainders,
    weightedSplitShares,
  } from "$lib/finance/space-settlement";
  import ArrowLeftRight from "@lucide/svelte/icons/arrow-left-right";
  import Plus from "@lucide/svelte/icons/plus";
  import type { PageData } from "./$types";

  type Props = { data: PageData };
  const { data }: Props = $props();

  type Txn = PageData["transactions"][number];
  type Allocation = PageData["allocations"][number];
  type Person = PageData["people"][number];
  type Item = PageData["items"][number];
  type ItemPayment = PageData["itemPayments"][number];
  type PersonBalance = PageData["personBalances"][number];

  let transactions = $state<Txn[]>([]);
  let allocations = $state<Allocation[]>([]);
  let people = $state<Person[]>([]);
  let items = $state<Item[]>([]);
  let itemPayments = $state<ItemPayment[]>([]);
  let personBalances = $state<PersonBalance[]>([]);

  let incomingId = $state("");
  let outgoingId = $state("");
  let amountMajor = $state("");
  let busy = $state(false);
  let errorMessage = $state<string | null>(null);
  let removingTxnId = $state<string | null>(null);
  let deletingAllocationId = $state<string | null>(null);

  let newPersonName = $state("");
  let itemName = $state("");
  let itemAmountMajor = $state("");
  type SplitMode = "equal" | "amounts" | "shares";
  const SPLIT_MODES: Array<{ id: SplitMode; label: string; hint: string }> = [
    { id: "equal", label: "Equal", hint: "Split the total evenly across everyone." },
    {
      id: "amounts",
      label: "Amounts",
      hint: "Enter amounts for people in this event — blank/zero are skipped; filled amounts must sum to the total.",
    },
    { id: "shares", label: "Shares", hint: "Enter share weights (e.g. 1 : 2 : 1) — converted to amounts." },
  ];
  let splitMode = $state<SplitMode>("equal");
  let splitAmountByPerson = $state<Record<string, string>>({});
  let splitWeightByPerson = $state<Record<string, string>>({});
  let payTxnId = $state("");
  let payItemId = $state("");
  let payPersonId = $state("");
  let payAmountMajor = $state("");
  let deletingPersonId = $state<string | null>(null);
  let deletingItemId = $state<string | null>(null);
  let deletingPaymentId = $state<string | null>(null);

  type SpaceTabId = "transactions" | "settlements" | "event-payments" | "events" | "people";
  const SPACE_TABS = [
    { id: "transactions" as const, label: "Transactions", tone: "yellow" },
    { id: "settlements" as const, label: "Settlements", tone: "green" },
    { id: "event-payments" as const, label: "Event Payments", tone: "orange" },
    { id: "events" as const, label: "Events", tone: "blue" },
    { id: "people" as const, label: "People", tone: "yellow" },
  ];
  let activeTab = $state<SpaceTabId>("transactions");

  $effect(() => {
    transactions = [...data.transactions];
    allocations = [...data.allocations];
    people = [...data.people];
    items = [...data.items];
    itemPayments = [...data.itemPayments];
    personBalances = [...data.personBalances];
  });

  $effect(() => {
    const nextAmounts = { ...splitAmountByPerson };
    const nextWeights = { ...splitWeightByPerson };
    let changed = false;
    for (const person of people) {
      if (!(person.id in nextAmounts)) {
        nextAmounts[person.id] = "";
        changed = true;
      }
      if (!(person.id in nextWeights)) {
        nextWeights[person.id] = "1";
        changed = true;
      }
    }
    for (const id of Object.keys(nextAmounts)) {
      if (!people.some((person) => person.id === id)) {
        delete nextAmounts[id];
        changed = true;
      }
    }
    for (const id of Object.keys(nextWeights)) {
      if (!people.some((person) => person.id === id)) {
        delete nextWeights[id];
        changed = true;
      }
    }
    if (changed) {
      splitAmountByPerson = nextAmounts;
      splitWeightByPerson = nextWeights;
    }
  });

  const remainders = $derived(spaceRemainders(transactions, allocations, itemPayments));
  const remainderById = $derived(new Map(remainders.map((row) => [row.transactionId, row])));
  const shareOpenByKey = $derived(new Map(data.shareOpens.map((row) => [`${row.itemId}:${row.personId}`, row.openMinor] as const)));
  const itemOpenById = $derived(new Map(data.itemOpens.map((row) => [row.itemId, row.openMinor] as const)));

  const incomingOpenMinor = $derived(
    transactions.filter((txn) => txn.type === "income").reduce((sum, txn) => sum + (remainderById.get(txn.id)?.remainderMinor ?? 0), 0)
  );
  const outgoingOpenMinor = $derived(
    transactions.filter((txn) => txn.type === "expense").reduce((sum, txn) => sum + (remainderById.get(txn.id)?.remainderMinor ?? 0), 0)
  );
  const allocatedTotalMinor = $derived(
    allocations.reduce((sum, row) => sum + row.amountMinor, 0) + itemPayments.reduce((sum, row) => sum + row.amountMinor, 0)
  );

  function txnById(id: string) {
    return transactions.find((row) => row.id === id);
  }
  function personById(id: string) {
    return people.find((row) => row.id === id);
  }
  function itemById(id: string) {
    return items.find((row) => row.id === id);
  }

  const incomingTxn = $derived(incomingId ? (txnById(incomingId) ?? null) : null);
  const outgoingTxn = $derived(outgoingId ? (txnById(outgoingId) ?? null) : null);
  const incomingRemainder = $derived(incomingId ? (remainderById.get(incomingId)?.remainderMinor ?? 0) : 0);
  const outgoingRemainder = $derived(outgoingId ? (remainderById.get(outgoingId)?.remainderMinor ?? 0) : 0);
  const pairOk = $derived(incomingTxn != null && outgoingTxn != null && canAllocateTransactionTypes(incomingTxn.type, outgoingTxn.type));
  const maxMinor = $derived(pairOk ? maxAllocationMinor(incomingRemainder, outgoingRemainder) : 0);

  const payTxnOpen = $derived(payTxnId ? (remainderById.get(payTxnId)?.remainderMinor ?? 0) : 0);
  const payShareOpen = $derived(payItemId && payPersonId ? (shareOpenByKey.get(`${payItemId}:${payPersonId}`) ?? 0) : 0);
  const payItemOpen = $derived(payItemId ? (itemOpenById.get(payItemId) ?? 0) : 0);
  const payMaxMinor = $derived(maxItemPaymentMinor(payTxnOpen, payShareOpen, payItemOpen));

  function formatMajorFromMinor(minor: number) {
    return (minor / 100).toFixed(2);
  }

  function parseTypedMajor(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return parseIndianAmount(trimmed);
    } catch {
      return null;
    }
  }

  function clampToMax(raw: string, max: number): string {
    if (max <= 0) return "";
    const parsed = parseTypedMajor(raw);
    if (parsed == null) return raw;
    if (parsed > max) return formatMajorFromMinor(max);
    return raw;
  }

  function onAmountInput(value: string) {
    amountMajor = clampToMax(value, maxMinor);
    if (errorMessage?.includes("exceed") || errorMessage?.includes("incoming")) errorMessage = null;
  }

  function onPayAmountInput(value: string) {
    payAmountMajor = clampToMax(value, payMaxMinor);
  }

  $effect(() => {
    maxMinor;
    if (!amountMajor.trim()) return;
    const next = clampToMax(amountMajor, maxMinor);
    if (next !== amountMajor) amountMajor = next;
  });

  $effect(() => {
    payMaxMinor;
    if (!payAmountMajor.trim()) return;
    const next = clampToMax(payAmountMajor, payMaxMinor);
    if (next !== payAmountMajor) payAmountMajor = next;
  });

  $effect(() => {
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
  const personSelectOptions = $derived([
    { value: "", label: "Pick person…" },
    ...people.map((person) => ({ value: person.id, label: person.isSelf ? `${person.name} (Me)` : person.name })),
  ]);
  const itemSelectOptions = $derived([
    { value: "", label: "Pick event…" },
    ...items.map((item) => ({
      value: item.id,
      label: `${item.name} · open ${formatMoney(itemOpenById.get(item.id) ?? 0, data.account.currencyCode)}`,
    })),
  ]);
  const splitModeHint = $derived(SPLIT_MODES.find((mode) => mode.id === splitMode)?.hint ?? "");
  const splitPreview = $derived.by(() => {
    if (splitMode === "equal" || people.length === 0) return [] as Array<{ personId: string; shareMinor: number }>;
    let amountMinor = 0;
    try {
      amountMinor = itemAmountMajor.trim() ? parseIndianAmount(itemAmountMajor) : 0;
    } catch {
      return [];
    }
    if (amountMinor <= 0) return [];
    if (splitMode === "shares") {
      const weights = people.map((person) => {
        const weight = Number((splitWeightByPerson[person.id] ?? "").trim());
        return { personId: person.id, weight: Number.isFinite(weight) && weight > 0 ? Math.floor(weight) : 0 };
      });
      if (weights.every((row) => row.weight === 0)) return [];
      return weightedSplitShares(weights, amountMinor);
    }
    return [];
  });
  const payTxnSelectOptions = $derived([
    { value: "", label: "Pick transaction…" },
    ...transactions.map((txn) => ({
      value: txn.id,
      label: `${txnOptionLabel(txn)} · open ${formatMoney(remainderById.get(txn.id)?.remainderMinor ?? 0, data.account.currencyCode)}`,
    })),
  ]);

  function typeClass(type: Txn["type"]) {
    if (type === "income") return "pos";
    if (type === "expense") return "neg";
    return "";
  }

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
      itemPayments = itemPayments.filter((row) => row.transactionId !== transactionId);
      if (incomingId === transactionId) incomingId = "";
      if (outgoingId === transactionId) outgoingId = "";
      if (payTxnId === transactionId) payTxnId = "";
      await invalidateAll();
    } finally {
      removingTxnId = null;
    }
  }

  async function addPerson() {
    if (busy) return;
    const name = newPersonName.trim();
    if (!name) return;
    busy = true;
    errorMessage = null;
    try {
      const response = await fetch(`/api/accounts/${data.account.id}/spaces/${data.space.id}/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        errorMessage = "Could not add person (name may already exist).";
        return;
      }
      newPersonName = "";
      await invalidateAll();
    } finally {
      busy = false;
    }
  }

  async function removePerson(personId: string) {
    if (busy) return;
    if (!confirm("Remove this person? Their shares and cover payments will be deleted.")) return;
    deletingPersonId = personId;
    errorMessage = null;
    try {
      const response = await fetch(`/api/accounts/${data.account.id}/spaces/${data.space.id}/people/${personId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        errorMessage = "Could not remove person (Me cannot be deleted).";
        return;
      }
      await invalidateAll();
    } finally {
      deletingPersonId = null;
    }
  }

  function personLabel(person: Person) {
    return person.isSelf ? `${person.name} (Me)` : person.name;
  }

  function buildEventShares(amountMinor: number): Array<{ personId: string; shareMinor: number }> | null {
    if (splitMode === "equal") {
      return equalSplitShares(
        people.map((person) => person.id),
        amountMinor
      );
    }

    if (splitMode === "amounts") {
      const shares: Array<{ personId: string; shareMinor: number }> = [];
      for (const person of people) {
        const raw = (splitAmountByPerson[person.id] ?? "").trim();
        if (!raw || raw === "0" || raw === "0.0" || raw === "0.00") continue;
        let shareMinor: number;
        try {
          shareMinor = parseIndianAmount(raw);
        } catch {
          errorMessage = `Enter a valid amount for ${personLabel(person)}.`;
          return null;
        }
        if (shareMinor < 0) {
          errorMessage = `Amount for ${personLabel(person)} can’t be negative.`;
          return null;
        }
        if (shareMinor === 0) continue;
        shares.push({ personId: person.id, shareMinor });
      }
      if (shares.length === 0) {
        errorMessage = "Enter at least one person’s amount.";
        return null;
      }
      if (!sharesSumToAmount(shares, amountMinor)) {
        const sum = shares.reduce((s, row) => s + row.shareMinor, 0);
        errorMessage = `Entered amounts must sum to the event total (got ${formatMoney(sum, data.account.currencyCode)}).`;
        return null;
      }
      return shares;
    }

    // shares mode
    const weights: Array<{ personId: string; weight: number }> = [];
    for (const person of people) {
      const raw = (splitWeightByPerson[person.id] ?? "").trim();
      if (!raw) {
        errorMessage = `Enter a share weight for ${personLabel(person)}.`;
        return null;
      }
      const weight = Number(raw);
      if (!Number.isFinite(weight) || weight < 0 || !Number.isInteger(weight)) {
        errorMessage = `Share for ${personLabel(person)} must be a whole number ≥ 0.`;
        return null;
      }
      weights.push({ personId: person.id, weight });
    }
    if (weights.every((row) => row.weight === 0)) {
      errorMessage = "At least one person needs a share greater than 0.";
      return null;
    }
    return weightedSplitShares(weights, amountMinor);
  }

  async function addItem() {
    if (busy) return;
    errorMessage = null;
    if (people.length === 0) {
      errorMessage = "Add people before creating events.";
      return;
    }
    let amountMinor: number;
    try {
      amountMinor = parseIndianAmount(itemAmountMajor);
    } catch {
      errorMessage = "Enter a valid event amount.";
      return;
    }
    if (amountMinor <= 0) {
      errorMessage = "Event amount must be positive.";
      return;
    }
    const name = itemName.trim();
    if (!name) {
      errorMessage = "Event needs a name.";
      return;
    }

    const shares = buildEventShares(amountMinor);
    if (!shares) return;

    busy = true;
    try {
      const response = await fetch(`/api/accounts/${data.account.id}/spaces/${data.space.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, amountMinor, shares }),
      });
      if (!response.ok) {
        errorMessage = "Could not create event.";
        return;
      }
      itemName = "";
      itemAmountMajor = "";
      splitAmountByPerson = Object.fromEntries(people.map((person) => [person.id, ""]));
      splitWeightByPerson = Object.fromEntries(people.map((person) => [person.id, "1"]));
      await invalidateAll();
    } finally {
      busy = false;
    }
  }

  async function removeItem(itemId: string) {
    if (busy) return;
    if (!confirm("Delete this event and its payments?")) return;
    deletingItemId = itemId;
    errorMessage = null;
    try {
      const response = await fetch(`/api/accounts/${data.account.id}/spaces/${data.space.id}/items/${itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        errorMessage = "Could not delete event.";
        return;
      }
      if (payItemId === itemId) payItemId = "";
      await invalidateAll();
    } finally {
      deletingItemId = null;
    }
  }

  async function createItemPayment() {
    if (busy) return;
    errorMessage = null;
    if (!payTxnId || !payItemId || !payPersonId) {
      errorMessage = "Pick a transaction, event, and person to cover.";
      return;
    }
    let amountMinor: number;
    try {
      amountMinor = parseIndianAmount(payAmountMajor);
    } catch {
      errorMessage = "Enter a valid payment amount.";
      return;
    }
    if (amountMinor <= 0 || amountMinor > payMaxMinor) {
      errorMessage = "Amount must be within the open remainder.";
      return;
    }

    busy = true;
    try {
      const response = await fetch(`/api/accounts/${data.account.id}/spaces/${data.space.id}/item-payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: payTxnId,
          itemId: payItemId,
          coversPersonId: payPersonId,
          amountMinor,
        }),
      });
      if (!response.ok) {
        errorMessage = "Payment exceeds open txn, share, or event remainder.";
        return;
      }
      payAmountMajor = "";
      await invalidateAll();
    } finally {
      busy = false;
    }
  }

  async function removeItemPayment(paymentId: string) {
    if (busy) return;
    deletingPaymentId = paymentId;
    errorMessage = null;
    try {
      const response = await fetch(`/api/accounts/${data.account.id}/spaces/${data.space.id}/item-payments/${paymentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        errorMessage = "Could not delete payment.";
        return;
      }
      await invalidateAll();
    } finally {
      deletingPaymentId = null;
    }
  }

  function useMaxAmount() {
    if (maxMinor > 0) amountMajor = formatMajorFromMinor(maxMinor);
  }

  function usePayMaxAmount() {
    if (payMaxMinor > 0) payAmountMajor = formatMajorFromMinor(payMaxMinor);
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
  <div class="paper-tabs" role="tablist" aria-label="Space sections">
    {#each SPACE_TABS as tab, i (tab.id)}
      <button
        type="button"
        role="tab"
        class="paper-tab tone-{tab.tone}"
        class:active={activeTab === tab.id}
        id="space-tab-{tab.id}"
        aria-selected={activeTab === tab.id}
        aria-controls="space-panel-{tab.id}"
        tabindex={activeTab === tab.id ? 0 : -1}
        style="--depth: {i}"
        onclick={() => (activeTab = tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>
  <div class="notebook-sheet" data-tone={activeTab}>
    {#if activeTab === "transactions"}
      <section class="sheet-panel" id="space-panel-transactions" role="tabpanel" aria-labelledby="space-tab-transactions">
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
                          ×
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
    {:else if activeTab === "settlements"}
      <section class="sheet-panel" id="space-panel-settlements" role="tabpanel" aria-labelledby="space-tab-settlements">
        <p class="panel-copy dim">Link an incoming with an outgoing — refunds, splits, partial pays.</p>
        {#if transactions.length < 2}
          <p class="dim empty">Need at least two transactions to allocate.</p>
        {:else}
          <form
            class="alloc-form settle-form"
            onsubmit={(e) => {
              e.preventDefault();
              void createAllocation();
            }}
          >
            <div class="settle-pair-row">
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
            </div>
            <div class="settle-amount-row">
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
                  aria-label="Amount"
                  oninput={(e) => onAmountInput(e.currentTarget.value)}
                />
                {#if maxMinor > 0}
                  <button type="button" class="suggest-btn" onclick={useMaxAmount}>
                    Max {formatMoney(maxMinor, data.account.currencyCode)}
                  </button>
                {/if}
                <button type="submit" class="sketch-action" disabled={busy}>
                  <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
                  {busy ? "Saving…" : "Add settlement"}
                </button>
              </div>
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
                    ×
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </section>
    {:else if activeTab === "event-payments"}
      <section class="sheet-panel" id="space-panel-event-payments" role="tabpanel" aria-labelledby="space-tab-event-payments">
        <p class="panel-copy dim">Apply bank money to a person’s open share on an event.</p>
        {#if people.length === 0 || items.length === 0 || transactions.length === 0}
          <p class="dim empty">Need people, events, and transactions first.</p>
        {:else}
          <form
            class="alloc-form settle-form"
            onsubmit={(e) => {
              e.preventDefault();
              void createItemPayment();
            }}
          >
            <div class="settle-pair-row pay-pair-row">
              <label class="field">
                <span class="field-k">Transaction</span>
                <SketchSelect name="pay-txn" options={payTxnSelectOptions} bind:value={payTxnId} aria-label="Payment transaction" />
              </label>
              <div class="alloc-mid" aria-hidden="true">→</div>
              <label class="field">
                <span class="field-k">Event</span>
                <SketchSelect name="pay-item" options={itemSelectOptions} bind:value={payItemId} aria-label="Event" />
              </label>
              <div class="alloc-mid" aria-hidden="true">→</div>
              <label class="field">
                <span class="field-k">Covers</span>
                <SketchSelect name="pay-person" options={personSelectOptions} bind:value={payPersonId} aria-label="Person covered" />
              </label>
            </div>
            <div class="settle-amount-row">
              <span class="field-k">Amount</span>
              <div class="amount-row">
                <input
                  class="underline-input"
                  type="text"
                  inputmode="decimal"
                  placeholder="0.00"
                  value={payAmountMajor}
                  disabled={payMaxMinor <= 0}
                  required
                  aria-label="Amount"
                  oninput={(e) => onPayAmountInput(e.currentTarget.value)}
                />
                {#if payMaxMinor > 0}
                  <button type="button" class="suggest-btn" onclick={usePayMaxAmount}>
                    Max {formatMoney(payMaxMinor, data.account.currencyCode)}
                  </button>
                {/if}
                <button type="submit" class="sketch-action" disabled={busy}>
                  <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
                  {busy ? "Paying…" : "Add payment"}
                </button>
              </div>
            </div>
          </form>
        {/if}
        <div class="alloc-scroll">
          <h3>Payments</h3>
          {#if itemPayments.length === 0}
            <p class="dim empty">None yet.</p>
          {:else}
            <ul class="alloc-list">
              {#each itemPayments as payment (payment.id)}
                {@const item = itemById(payment.itemId)}
                {@const person = personById(payment.coversPersonId)}
                {@const txn = txnById(payment.transactionId)}
                <li>
                  <div class="alloc-body">
                    <span class="pair">
                      {txn?.merchant ?? "Txn"}
                      <span class="dim">→</span>
                      {item?.name ?? "Event"}
                      <span class="dim">covers</span>
                      {person?.name ?? "Person"}
                    </span>
                    <span class="mono amt">{formatMoney(payment.amountMinor, data.account.currencyCode)}</span>
                  </div>
                  <button
                    type="button"
                    class="icon-btn danger"
                    aria-label="Delete payment"
                    disabled={deletingPaymentId === payment.id}
                    onclick={() => removeItemPayment(payment.id)}
                  >
                    ×
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </section>
    {:else if activeTab === "events"}
      <section class="sheet-panel" id="space-panel-events" role="tabpanel" aria-labelledby="space-tab-events">
        <p class="panel-copy dim">Planned events split across people — equal, by amounts, or by share weights.</p>
        <form
          class="event-form"
          onsubmit={(e) => {
            e.preventDefault();
            void addItem();
          }}
        >
          <div class="event-basics">
            <input class="underline-input" type="text" placeholder="Event name" bind:value={itemName} maxlength="120" />
            <input class="underline-input" type="text" inputmode="decimal" placeholder="Total amount" bind:value={itemAmountMajor} />
          </div>

          <div class="split-modes" role="radiogroup" aria-label="Split mode">
            {#each SPLIT_MODES as mode (mode.id)}
              <button
                type="button"
                class="split-mode"
                class:active={splitMode === mode.id}
                role="radio"
                aria-checked={splitMode === mode.id}
                onclick={() => (splitMode = mode.id)}
              >
                {mode.label}
              </button>
            {/each}
          </div>
          <p class="field-hint split-hint">{splitModeHint}</p>

          {#if splitMode === "amounts" && people.length > 0}
            <ul class="split-grid">
              {#each people as person (person.id)}
                <li>
                  <span class="split-name">{personLabel(person)}</span>
                  <input
                    class="underline-input"
                    type="text"
                    inputmode="decimal"
                    placeholder="0.00"
                    aria-label="Amount for {personLabel(person)}"
                    value={splitAmountByPerson[person.id] ?? ""}
                    oninput={(e) => {
                      splitAmountByPerson = { ...splitAmountByPerson, [person.id]: e.currentTarget.value };
                    }}
                  />
                </li>
              {/each}
            </ul>
          {:else if splitMode === "shares" && people.length > 0}
            <ul class="split-grid has-preview">
              {#each people as person (person.id)}
                {@const preview = splitPreview.find((row) => row.personId === person.id)}
                <li>
                  <span class="split-name">{personLabel(person)}</span>
                  <input
                    class="underline-input weight-input"
                    type="text"
                    inputmode="numeric"
                    placeholder="1"
                    aria-label="Share weight for {personLabel(person)}"
                    value={splitWeightByPerson[person.id] ?? "1"}
                    oninput={(e) => {
                      splitWeightByPerson = { ...splitWeightByPerson, [person.id]: e.currentTarget.value };
                    }}
                  />
                  <span class="mono dim split-preview">
                    {preview ? formatMoney(preview.shareMinor, data.account.currencyCode) : "—"}
                  </span>
                </li>
              {/each}
            </ul>
          {/if}

          <button type="submit" class="sketch-action" disabled={busy || people.length === 0}>Add event</button>
        </form>
        {#if items.length === 0}
          <p class="dim empty">No events yet.</p>
        {:else}
          <ul class="item-list">
            {#each items as item (item.id)}
              {@const open = itemOpenById.get(item.id) ?? 0}
              <li>
                <div class="item-head">
                  <strong>{item.name}</strong>
                  <span class="mono">{formatMoney(item.amountMinor, data.account.currencyCode)}</span>
                  <span class="dim mono">open {formatMoney(open, data.account.currencyCode)}</span>
                  <button
                    type="button"
                    class="icon-btn danger"
                    aria-label="Delete {item.name}"
                    disabled={deletingItemId === item.id}
                    onclick={() => removeItem(item.id)}
                  >
                    ×
                  </button>
                </div>
                <ul class="share-list">
                  {#each item.shares as share (share.personId)}
                    {@const person = personById(share.personId)}
                    {@const shareOpen = shareOpenByKey.get(`${item.id}:${share.personId}`) ?? 0}
                    <li>
                      <span>{person ? personLabel(person) : "Person"}</span>
                      <span class="mono dim">{formatMoney(share.shareMinor, data.account.currencyCode)}</span>
                      <span class="mono" class:neg={shareOpen > 0}>open {formatMoney(shareOpen, data.account.currencyCode)}</span>
                    </li>
                  {/each}
                </ul>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {:else}
      <section class="sheet-panel" id="space-panel-people" role="tabpanel" aria-labelledby="space-tab-people">
        <p class="panel-copy dim">Named folks in this space — Me is created when you add the first person.</p>
        <form
          class="inline-add"
          onsubmit={(e) => {
            e.preventDefault();
            void addPerson();
          }}
        >
          <input class="underline-input" type="text" placeholder="Name" bind:value={newPersonName} maxlength="80" />
          <button type="submit" class="organize-plus" disabled={busy || !newPersonName.trim()} aria-label="Add person">
            <Plus size={15} strokeWidth={1.75} />
          </button>
        </form>
        {#if people.length === 0}
          <p class="dim empty">No people yet — add flatmates to start the ledger.</p>
        {:else}
          <ul class="chip-list" aria-label="Who still owes toward shares">
            {#each people as person (person.id)}
              {@const balance = personBalances.find((row) => row.personId === person.id)}
              {@const openMinor = balance?.openMinor ?? 0}
              <li class:is-self={person.isSelf}>
                <span class="person-mark" class:me={person.isSelf}>
                  {person.isSelf ? `${person.name} (Me)` : person.name}
                </span>
                <span class="mono amt person-open" class:neg={openMinor > 0} class:pos={openMinor === 0}>
                  {openMinor > 0 ? formatSignedMoney(openMinor, data.account.currencyCode) : formatMoney(0, data.account.currencyCode)}
                </span>
                {#if !person.isSelf}
                  <button
                    type="button"
                    class="icon-btn danger"
                    aria-label="Remove {person.name}"
                    disabled={deletingPersonId === person.id}
                    onclick={() => removePerson(person.id)}
                  >
                    ×
                  </button>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
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
    margin: 0 0 0.75rem;
    flex: 0 0 auto;
  }

  .summary-row .manage-link {
    flex: 0 0 auto;
  }

  .inline-add,
  .item-add,
  .event-form {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    align-items: center;
    margin-bottom: 0.65rem;
  }

  .event-form {
    flex-direction: column;
    align-items: stretch;
    gap: 0.55rem;
  }

  .event-basics {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    align-items: center;
  }

  .event-basics .underline-input {
    flex: 1 1 8rem;
  }

  .split-modes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .split-mode {
    appearance: none;
    font-family: var(--hand);
    font-size: 0.95rem;
    padding: 0.2rem 0.7rem;
    border: 1.5px dashed color-mix(in srgb, var(--ink) 28%, transparent);
    background: color-mix(in srgb, var(--yellow) 28%, transparent);
    color: var(--ink-muted);
    cursor: pointer;
    border-radius: 3px 10px 4px 8px / 8px 3px 10px 4px;
  }

  .split-mode:hover {
    border-style: solid;
    color: var(--ink);
  }

  .split-mode.active {
    border-style: solid;
    border-color: color-mix(in srgb, var(--ink) 35%, transparent);
    background: color-mix(in srgb, var(--yellow) 62%, var(--mix-wash));
    color: var(--ink);
  }

  .split-hint {
    margin: -0.15rem 0 0;
  }

  .split-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .split-grid li {
    display: grid;
    grid-template-columns: minmax(6rem, 10rem) minmax(0, 1fr);
    gap: 0.45rem 0.65rem;
    align-items: center;
    font-family: var(--hand);
  }

  .split-grid.has-preview li {
    grid-template-columns: minmax(6rem, 10rem) minmax(0, 5rem) auto;
  }

  .split-grid .split-name {
    color: var(--ink);
  }

  .split-grid .weight-input {
    max-width: 5rem;
    flex: 0 0 auto;
  }

  .split-preview {
    min-width: 4.5rem;
    text-align: right;
  }

  .event-form .sketch-action {
    align-self: flex-start;
    width: auto;
  }

  .inline-add .underline-input {
    flex: 1 1 8rem;
  }

  .item-add .underline-input {
    flex: 1 1 6rem;
  }

  .organize-plus {
    appearance: none;
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
    border-radius: 255px 12px 225px 10px / 12px 225px 10px 255px;
  }

  .chip-list,
  .item-list,
  .share-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .chip-list li,
  .item-head,
  .share-list li {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-family: var(--hand);
  }

  .chip-list li {
    justify-content: flex-start;
    padding: 0.15rem 0;
    border-bottom: none;
  }

  .chip-list li .person-open {
    margin-left: auto;
    margin-right: 0.35rem;
    font-size: 1.05rem;
  }

  .chip-list li.is-self {
    font-weight: 400;
  }

  .item-list > li {
    padding: 0.35rem 0;
    border-bottom: 1px dashed color-mix(in srgb, var(--ink) 12%, transparent);
  }

  .item-head {
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .share-list {
    margin: 0.25rem 0 0 0.65rem;
    gap: 0.15rem;
  }

  .share-list li {
    justify-content: space-between;
    font-size: 0.95rem;
    color: var(--ink-muted);
  }

  .person-mark {
    display: inline-flex;
    align-items: center;
    padding: 0.12rem 0.45rem;
    font-family: var(--hand);
    font-size: 1.05rem;
    color: var(--ink);
    background: color-mix(in srgb, var(--yellow) 48%, transparent);
    box-decoration-break: clone;
    border-radius: 2px 6px 3px 5px / 5px 2px 6px 3px;
    transform: rotate(-0.4deg);
  }

  .person-mark.me {
    background: color-mix(in srgb, var(--blue) 42%, transparent);
    transform: rotate(0.3deg);
  }

  .space-notebook {
    margin-top: 0.15rem;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .paper-tabs {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0;
    padding: 0 0.65rem;
    position: relative;
    z-index: 1;
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
    display: flex;
    flex-direction: column;
    background: var(--page);
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 1px 4px 3px 1px;
    padding: 1.2rem 1.35rem 1.55rem 1.55rem;
    min-height: 16rem;
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

  .sheet-panel {
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    box-shadow: none;
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 0;
    position: relative;
    z-index: 1;
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
    max-height: 28rem;
  }

  :global(.forge .table-sheet.space-table) {
    max-height: 28rem;
    min-height: 0;
  }

  .alloc-scroll {
    margin-top: 0.35rem;
    max-height: 14rem;
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

  .settle-pair-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 0.65rem 0.85rem;
    align-items: end;
  }

  .settle-pair-row.pay-pair-row {
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
  }

  .settle-pair-row .alloc-mid {
    margin-block: 0;
    padding-bottom: 0.35rem;
    font-family: var(--hand);
    font-size: 1.15rem;
  }

  .settle-pair-row .alloc-mid + .field {
    margin-top: 0;
  }

  .settle-amount-row {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .settle-amount-row .amount-row {
    flex-wrap: nowrap;
    width: 100%;
  }

  .settle-amount-row .underline-input {
    flex: 1 1 auto;
    min-width: 0;
  }

  .settle-amount-row .sketch-action {
    width: auto;
    flex: 0 0 auto;
    margin-top: 0;
    white-space: nowrap;
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

  .sketch-action {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    margin-top: 0.15rem;
    align-self: flex-start;
    font-family: var(--hand);
    font-size: 1.05rem;
    padding: 0.28rem 0.75rem;
    background: color-mix(in srgb, var(--yellow) 45%, var(--mix-wash));
    border: 1.5px solid color-mix(in srgb, var(--ink) 22%, transparent);
    color: var(--ink-muted);
    cursor: pointer;
    border-radius: 3px 10px 4px 8px / 8px 3px 10px 4px;
  }

  .sketch-action:hover:not(:disabled) {
    color: var(--ink);
    border-color: color-mix(in srgb, var(--ink) 35%, transparent);
    background: color-mix(in srgb, var(--yellow) 65%, var(--mix-wash));
  }

  .sketch-action:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .alloc-form:not(.settle-form) .sketch-action {
    width: 100%;
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
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.35rem;
    height: 1.35rem;
    padding: 0 0.1rem;
    background: transparent;
    border: none;
    color: var(--ink-muted);
    cursor: pointer;
    border-radius: 0;
    font-family: var(--hand);
    font-size: 1.35rem;
    line-height: 1;
    opacity: 0.78;
    transform: rotate(2deg);
  }

  .icon-btn:hover:not(:disabled) {
    opacity: 1;
    color: var(--ink);
  }

  .icon-btn.danger:hover:not(:disabled) {
    color: var(--danger);
    background: color-mix(in srgb, var(--pink) 32%, transparent);
    border-radius: 3px 8px 4px 7px / 7px 3px 8px 4px;
  }

  .icon-btn:disabled {
    opacity: 0.35;
    cursor: wait;
  }

  .mono {
    font-variant-numeric: tabular-nums;
  }

  .right {
    text-align: right;
  }

  @media (max-width: 860px) {
    .settle-pair-row,
    .settle-pair-row.pay-pair-row {
      grid-template-columns: 1fr;
    }

    .settle-pair-row .alloc-mid {
      justify-content: center;
      padding-bottom: 0;
    }

    .settle-pair-row:not(.pay-pair-row) .alloc-mid {
      transform: rotate(90deg);
    }

    .space-table,
    :global(.forge .table-sheet.space-table) {
      max-height: 40vh;
    }
  }
</style>
