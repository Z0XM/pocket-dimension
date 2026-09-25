<script lang="ts">
  import { CombineIcon, RefreshCwIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { goto, invalidateAll } from "$app/navigation";
  import { Button } from "$components/ui/button";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { Label } from "$lib/components/ui/label";
  import * as Card from "$lib/components/ui/card";
  import * as Select from "$lib/components/ui/select";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  type Cluster = {
    id: string;
    tier: "direct" | "indirect" | "fuzzy";
    confidence: number;
    fingerprint: string;
    members: Array<{ id: string; title: string; type: string; languageId: string; language: string | null }>;
    dismissed: boolean;
    totalRatings: number;
    sampleRaters: string[];
    memberStats: Array<{
      id: string;
      title: string;
      type: string;
      language: string | null;
      ratingCount: number;
    }>;
  };

  type Preview = {
    keep: { id: string; title: string };
    losers: Array<{ id: string; title: string }>;
    strategy: string;
    conflictCount: number;
    conflicts: Array<{
      userId: string;
      username: string | null;
      chosenRatingId: string | null;
      ratings: Array<{
        id: string;
        watchItemId: string;
        title?: string;
        rating: string | null;
        infinity: boolean | null;
        shitty: boolean | null;
        progressStatus: string | null;
      }>;
    }>;
    userCount: number;
    ratingRowCount: number;
  };

  type Counts = {
    total: number;
    direct: number;
    indirect: number;
    fuzzy: number | null;
  };

  const TIER_OPTIONS = [
    { value: "all", label: "All" },
    { value: "direct", label: "Direct" },
    { value: "indirect", label: "Indirect" },
    { value: "fuzzy", label: "Fuzzy" },
  ] as const;

  const STRATEGY_OPTIONS = [
    { value: "prefer_kept", label: "Prefer kept row" },
    { value: "prefer_highest", label: "Prefer highest rating" },
    { value: "prefer_recent", label: "Prefer most recently updated" },
  ] as const;

  let summary = $state(data.summary);
  let counts = $state<Counts>({ ...data.summary.counts });
  let tier = $state(data.tier);
  let includeDismissed = $state(data.includeDismissed);
  let pageSize = $state(data.pageSize);

  let clusters = $state<Cluster[]>([]);
  let offset = $state(0);
  let hasMore = $state(false);
  let totalMatching = $state(0);
  let loadingPage = $state(false);
  let loadingFuzzySummary = $state(false);
  let initialLoadDone = $state(false);
  let busyId = $state<string | null>(null);
  /** Skip one effect-driven reload after we already reloaded from a filter change. */
  let skipEffectReload = $state(false);

  let keepByCluster = $state<Record<string, string>>({});
  /** Item ids included in merge/delete for each cluster (partial selection). */
  let selectedByCluster = $state<Record<string, string[]>>({});
  let strategyByCluster = $state<Record<string, string>>({});
  let confirmByCluster = $state<Record<string, "merge" | "delete" | null>>({});
  let previewByCluster = $state<Record<string, Preview | null>>({});

  function applyClusterDefaults(list: Cluster[], replace: boolean) {
    const nextKeep = replace ? {} : { ...keepByCluster };
    const nextStrategy = replace ? {} : { ...strategyByCluster };
    const nextSelected = replace ? {} : { ...selectedByCluster };
    for (const c of list) {
      const allIds = c.members.map((m) => m.id);
      if (!nextSelected[c.id]?.length) nextSelected[c.id] = [...allIds];
      // Keep must be one of the selected ids
      const selected = nextSelected[c.id];
      if (!nextKeep[c.id] || !selected.includes(nextKeep[c.id])) {
        nextKeep[c.id] = selected[0] ?? allIds[0] ?? "";
      }
      if (!nextStrategy[c.id]) nextStrategy[c.id] = "prefer_kept";
    }
    keepByCluster = nextKeep;
    strategyByCluster = nextStrategy;
    selectedByCluster = nextSelected;
    if (replace) {
      confirmByCluster = {};
      previewByCluster = {};
    }
  }

  function selectedIds(cluster: Cluster): string[] {
    return selectedByCluster[cluster.id] ?? cluster.members.map((m) => m.id);
  }

  function isSelected(clusterId: string, itemId: string): boolean {
    return (selectedByCluster[clusterId] ?? []).includes(itemId);
  }

  function toggleMemberSelected(cluster: Cluster, itemId: string, checked: boolean) {
    const cur = new Set(selectedIds(cluster));
    if (checked) cur.add(itemId);
    else cur.delete(itemId);
    const next = [...cur];
    selectedByCluster = { ...selectedByCluster, [cluster.id]: next };
    // If keep was deselected, move keep to first remaining selection
    if (!next.includes(keepByCluster[cluster.id] ?? "")) {
      keepByCluster = { ...keepByCluster, [cluster.id]: next[0] ?? "" };
    }
    cancelConfirm(cluster.id);
  }

  function setKeep(cluster: Cluster, itemId: string) {
    // Selecting keep also ensures the item is in the merge set
    const cur = new Set(selectedIds(cluster));
    cur.add(itemId);
    selectedByCluster = { ...selectedByCluster, [cluster.id]: [...cur] };
    keepByCluster = { ...keepByCluster, [cluster.id]: itemId };
    cancelConfirm(cluster.id);
  }

  function actionTargets(cluster: Cluster): { keepId: string; otherIds: string[] } | null {
    const keepId = keepByCluster[cluster.id];
    const selected = selectedIds(cluster);
    if (!keepId || !selected.includes(keepId)) return null;
    const otherIds = selected.filter((id) => id !== keepId);
    if (otherIds.length === 0) return null;
    return { keepId, otherIds };
  }

  function buildParams(extra: Record<string, string> = {}) {
    const params = new URLSearchParams(extra);
    if (tier !== "all") params.set("tier", tier);
    if (includeDismissed) params.set("includeDismissed", "1");
    return params;
  }

  async function fetchSummary(includeFuzzy = false) {
    const params = buildParams({ view: "summary" });
    if (includeFuzzy) params.set("includeFuzzy", "1");
    const res = await fetch(`/api/admin/duplicates?${params}`, { credentials: "include" });
    if (!res.ok) throw new Error("summary failed");
    const body = await res.json();
    summary = body.summary;
    counts = {
      ...body.summary.counts,
      // Preserve fuzzy if already loaded and this call deferred it
      fuzzy: body.summary.counts.fuzzy ?? counts.fuzzy,
    };
    return body.summary;
  }

  async function fetchPage(nextOffset: number, replace: boolean) {
    loadingPage = true;
    try {
      const params = buildParams({
        view: "page",
        limit: String(pageSize),
        offset: String(nextOffset),
      });
      const res = await fetch(`/api/admin/duplicates?${params}`, { credentials: "include" });
      if (!res.ok) {
        toast.error("Failed to load clusters");
        return;
      }
      const body = await res.json();
      const pageClusters: Cluster[] = body.clusters ?? [];
      if (replace) {
        clusters = pageClusters;
      } else {
        const seen = new Set(clusters.map((c) => c.id));
        clusters = [...clusters, ...pageClusters.filter((c) => !seen.has(c.id))];
      }
      applyClusterDefaults(pageClusters, replace);
      offset = nextOffset + pageClusters.length;
      hasMore = Boolean(body.page?.hasMore);
      totalMatching = Number(body.page?.totalMatching ?? clusters.length);
      if (body.counts) {
        counts = {
          total: body.counts.total ?? counts.total,
          direct: body.counts.direct ?? counts.direct,
          indirect: body.counts.indirect ?? counts.indirect,
          fuzzy: body.counts.fuzzy ?? counts.fuzzy,
        };
      }
    } finally {
      loadingPage = false;
      initialLoadDone = true;
    }
  }

  async function loadFuzzyCountInBackground() {
    if (counts.fuzzy != null) return;
    loadingFuzzySummary = true;
    try {
      await fetchSummary(true);
    } catch {
      // non-fatal — fuzzy count stays unknown
    } finally {
      loadingFuzzySummary = false;
    }
  }

  async function resetAndLoad() {
    clusters = [];
    offset = 0;
    hasMore = false;
    initialLoadDone = false;
    try {
      await fetchSummary(false);
    } catch {
      toast.error("Failed to load summary");
    }
    await fetchPage(0, true);
    void loadFuzzyCountInBackground();
  }

  // Sync filter props from SSR (back/forward / invalidate), then load first page.
  $effect(() => {
    summary = data.summary;
    counts = { ...data.summary.counts };
    tier = data.tier;
    includeDismissed = data.includeDismissed;
    pageSize = data.pageSize;
    if (skipEffectReload) {
      skipEffectReload = false;
      return;
    }
    void resetAndLoad();
  });

  /** Apply filter locally first (so API params are correct), then sync URL. */
  async function applyFilters(next: { tier?: typeof tier; includeDismissed?: boolean }) {
    if (next.tier != null) tier = next.tier;
    if (next.includeDismissed != null) includeDismissed = next.includeDismissed;

    const params = new URLSearchParams();
    if (tier !== "all") params.set("tier", tier);
    if (includeDismissed) params.set("includeDismissed", "1");
    const qs = params.toString();

    // Reload with local filter state immediately — don't wait on SSR round-trip
    // (previous bind+goto+effect path left Show dismissed out of sync).
    await resetAndLoad();

    skipEffectReload = true;
    await goto(`/admin/duplicates${qs ? `?${qs}` : ""}`, {
      replaceState: true,
      keepFocus: true,
      noScroll: true,
      invalidateAll: true,
    });
  }

  async function reloadClient() {
    await resetAndLoad();
  }

  async function loadMore() {
    if (!hasMore || loadingPage) return;
    await fetchPage(offset, false);
  }

  function tierBadge(t: string) {
    if (t === "direct") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    if (t === "indirect") return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    return "bg-sky-500/15 text-sky-700 dark:text-sky-400";
  }

  function confidenceLabel(c: Cluster) {
    if (c.tier !== "fuzzy") return null;
    return `${Math.round(c.confidence * 100)}% match`;
  }

  function fuzzyLabel() {
    if (counts.fuzzy == null) return loadingFuzzySummary ? "…" : "?";
    return String(counts.fuzzy);
  }

  function tierTriggerLabel() {
    const base = TIER_OPTIONS.find((o) => o.value === tier)?.label ?? "All";
    if (tier === "all") return `${base} (${counts.direct + counts.indirect + (counts.fuzzy ?? 0)})`;
    if (tier === "direct") return `${base} (${counts.direct})`;
    if (tier === "indirect") return `${base} (${counts.indirect})`;
    return `${base} (${fuzzyLabel()})`;
  }

  function strategyLabel(value: string) {
    return STRATEGY_OPTIONS.find((o) => o.value === value)?.label ?? value;
  }

  async function previewMerge(cluster: Cluster) {
    const targets = actionTargets(cluster);
    if (!targets) {
      toast.error("Select at least two titles (and a keep) to merge");
      return;
    }
    busyId = cluster.id;
    try {
      const res = await fetch("/api/admin/duplicates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          keepId: targets.keepId,
          mergeIds: targets.otherIds,
          strategy: strategyByCluster[cluster.id] || "prefer_kept",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        toast.error(body.error || "Preview failed");
        return;
      }
      previewByCluster = { ...previewByCluster, [cluster.id]: body.preview };
      confirmByCluster = { ...confirmByCluster, [cluster.id]: "merge" };
      toast.message(
        body.preview.conflictCount
          ? `Preview ready — ${body.preview.conflictCount} rating conflict(s)`
          : "Preview ready — no rating conflicts"
      );
      queueMicrotask(() => {
        document.getElementById(`confirm-${cluster.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } finally {
      busyId = null;
    }
  }

  async function confirmMerge(cluster: Cluster) {
    const targets = actionTargets(cluster);
    if (!targets) {
      toast.error("Select at least two titles (and a keep) to merge");
      return;
    }
    busyId = cluster.id;
    try {
      const res = await fetch("/api/admin/duplicates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "merge",
          keepId: targets.keepId,
          mergeIds: targets.otherIds,
          strategy: strategyByCluster[cluster.id] || "prefer_kept",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        toast.error(body.error || "Merge failed");
        return;
      }
      toast.success(`Merged ${targets.otherIds.length} into kept title`);
      confirmByCluster = { ...confirmByCluster, [cluster.id]: null };
      previewByCluster = { ...previewByCluster, [cluster.id]: null };
      await invalidateAll();
      await reloadClient();
    } finally {
      busyId = null;
    }
  }

  function startDelete(cluster: Cluster) {
    if (!actionTargets(cluster)) {
      toast.error("Select at least two titles (and a keep) to delete others");
      return;
    }
    confirmByCluster = { ...confirmByCluster, [cluster.id]: "delete" };
    previewByCluster = { ...previewByCluster, [cluster.id]: null };
  }

  async function confirmDelete(cluster: Cluster) {
    const targets = actionTargets(cluster);
    if (!targets) {
      toast.error("Select at least two titles (and a keep) to delete others");
      return;
    }
    busyId = cluster.id;
    try {
      const res = await fetch("/api/admin/duplicates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_others",
          keepId: targets.keepId,
          deleteIds: targets.otherIds,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        toast.error(body.error || "Delete failed");
        return;
      }
      toast.success(`Deleted ${targets.otherIds.length} catalog row(s); ratings on those rows were removed`);
      confirmByCluster = { ...confirmByCluster, [cluster.id]: null };
      await invalidateAll();
      await reloadClient();
    } finally {
      busyId = null;
    }
  }

  async function dismiss(cluster: Cluster) {
    busyId = cluster.id;
    try {
      const res = await fetch("/api/admin/duplicates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dismiss",
          fingerprint: cluster.fingerprint,
          itemIds: cluster.members.map((m) => m.id),
          tier: cluster.tier,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        toast.error(body.error || "Dismiss failed");
        return;
      }
      toast.success("Marked as not duplicates");
      await invalidateAll();
      await reloadClient();
    } finally {
      busyId = null;
    }
  }

  async function undismiss(cluster: Cluster) {
    busyId = cluster.id;
    try {
      const res = await fetch("/api/admin/duplicates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "undismiss", fingerprint: cluster.fingerprint }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        toast.error(body.error || "Undo dismiss failed");
        return;
      }
      toast.success("Dismissal cleared");
      await invalidateAll();
      await reloadClient();
    } finally {
      busyId = null;
    }
  }

  function cancelConfirm(clusterId: string) {
    confirmByCluster = { ...confirmByCluster, [clusterId]: null };
    previewByCluster = { ...previewByCluster, [clusterId]: null };
  }

  function formatRating(r: { rating: string | null; infinity: boolean | null; shitty: boolean | null }) {
    if (r.infinity) return "∞";
    if (r.shitty) return "💩";
    return r.rating ?? "—";
  }
</script>

<div class="h-screen overflow-y-scroll pb-24">
  <div class="max-w-4xl mx-auto px-4 py-8 space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3 mb-2">
      <div class="space-y-1">
        <div class="inline-flex items-center gap-2 text-accent">
          <CombineIcon class="size-5" />
          <span class="text-[10px] uppercase tracking-wide">Admin</span>
        </div>
        <h1 class="text-3xl font-medium">Duplicates &amp; merge</h1>
        <p class="text-muted-foreground text-sm">
          Review suggested duplicate clusters, merge a selected subset into one survivor, or dismiss false positives.
        </p>
        <p class="text-xs text-muted-foreground">
          <a href="/admin" class="text-accent hover:underline">← Admin center</a>
        </p>
      </div>
      <Button size="sm" variant="outline" onclick={reloadClient} disabled={loadingPage}>
        <RefreshCwIcon class="size-3.5 mr-1" />
        Refresh
      </Button>
    </div>

    <Card.Root>
      <Card.Header class="pb-2">
        <Card.Title class="text-sm">Overview</Card.Title>
      </Card.Header>
      <Card.Content class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <p class="text-muted-foreground">Catalog</p>
          <p class="text-lg font-medium text-foreground">{summary.catalogSize}</p>
        </div>
        <div>
          <p class="text-muted-foreground">Direct</p>
          <p class="text-lg font-medium text-foreground">{counts.direct}</p>
          <p class="text-[10px] text-muted-foreground">{summary.involvedItems.direct} items</p>
        </div>
        <div>
          <p class="text-muted-foreground">Indirect</p>
          <p class="text-lg font-medium text-foreground">{counts.indirect}</p>
          <p class="text-[10px] text-muted-foreground">{summary.involvedItems.indirect} items</p>
        </div>
        <div>
          <p class="text-muted-foreground">Fuzzy</p>
          <p class="text-lg font-medium text-foreground">{fuzzyLabel()}</p>
          <p class="text-[10px] text-muted-foreground">
            {#if counts.fuzzy == null}
              {loadingFuzzySummary ? "scanning…" : "pending"}
            {:else}
              {summary.involvedItems.fuzzy ?? "—"} items
            {/if}
          </p>
        </div>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Content class="pt-4 flex flex-wrap gap-4 items-end text-xs">
        <div class="space-y-1.5">
          <Label class="text-muted-foreground font-normal">Tier</Label>
          <Select.Root
            type="single"
            value={tier}
            onValueChange={(v) => {
              if (v) void applyFilters({ tier: v as typeof tier });
            }}
          >
            <Select.Trigger size="sm" class="min-w-[10rem] bg-background/60 backdrop-blur-sm cursor-pointer">
              {tierTriggerLabel()}
            </Select.Trigger>
            <Select.Content class="bg-background/80 backdrop-blur-md text-xs">
              {#each TIER_OPTIONS as opt}
                <Select.Item class="text-xs" value={opt.value}>
                  {opt.label}
                  {#if opt.value === "all"}
                    ({counts.direct + counts.indirect + (counts.fuzzy ?? 0)})
                  {:else if opt.value === "direct"}
                    ({counts.direct})
                  {:else if opt.value === "indirect"}
                    ({counts.indirect})
                  {:else}
                    ({fuzzyLabel()})
                  {/if}
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <label class="flex items-center gap-2 cursor-pointer pb-1.5">
          <Checkbox
            checked={includeDismissed}
            onCheckedChange={(v) => void applyFilters({ includeDismissed: v === true })}
            class="cursor-pointer border-border"
          />
          <span class="text-foreground">Show dismissed</span>
        </label>
        <p class="text-muted-foreground self-center pb-1.5">
          Showing {clusters.length} of {totalMatching || "…"} · Direct = exact · Indirect = alphanumeric · Fuzzy = close
          match · Numbered parts are not merged
        </p>
      </Card.Content>
    </Card.Root>

    {#if !initialLoadDone && loadingPage}
      <Card.Root>
        <Card.Content class="py-10 text-center text-sm text-muted-foreground">Loading clusters…</Card.Content>
      </Card.Root>
    {:else if clusters.length === 0}
      <Card.Root>
        <Card.Content class="py-10 text-center text-sm text-muted-foreground">
          No duplicate suggestions{tier !== "all" ? ` in ${tier}` : ""}. Nice catalog hygiene.
        </Card.Content>
      </Card.Root>
    {:else}
      {#each clusters as cluster (cluster.id)}
        {@const keepId = keepByCluster[cluster.id]}
        {@const confirm = confirmByCluster[cluster.id]}
        {@const preview = previewByCluster[cluster.id]}
        {@const selected = selectedIds(cluster)}
        {@const canAct = selected.length >= 2 && selected.includes(keepId)}
        <Card.Root class={cluster.dismissed ? "opacity-70" : ""}>
          <Card.Header class="pb-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${tierBadge(cluster.tier)}`}>
                {cluster.tier}
              </span>
              {#if confidenceLabel(cluster)}
                <span class="text-[10px] text-muted-foreground">{confidenceLabel(cluster)}</span>
              {/if}
              <span class="text-[10px] text-muted-foreground"
                >{cluster.members.length} titles · {selected.length} selected · {cluster.totalRatings} ratings</span
              >
              {#if cluster.dismissed}
                <span class="text-[10px] uppercase tracking-wide text-muted-foreground">dismissed</span>
              {/if}
            </div>
            {#if cluster.sampleRaters.length > 0}
              <p class="text-[11px] text-muted-foreground mt-1">Raters: {cluster.sampleRaters.join(", ")}</p>
            {/if}
            <p class="text-[11px] text-muted-foreground mt-1">
              Uncheck titles that are unique — merge / delete only the selected set.
            </p>
          </Card.Header>
          <Card.Content class="space-y-4 text-xs">
            <div class="space-y-2">
              {#each cluster.memberStats as member}
                {@const inSet = isSelected(cluster.id, member.id)}
                {@const isKeep = keepId === member.id}
                <div
                  class="flex items-start gap-2 rounded-md border border-border/40 p-2 {inSet
                    ? 'hover:bg-muted/30'
                    : 'opacity-55 bg-muted/10'}"
                >
                  <Checkbox
                    checked={inSet}
                    onCheckedChange={(v) => toggleMemberSelected(cluster, member.id, v === true)}
                    class="mt-1 cursor-pointer border-border"
                    aria-label={`Include ${member.title} in merge set`}
                  />
                  <button
                    type="button"
                    class="min-w-0 flex-1 text-left cursor-pointer"
                    disabled={!inSet && !isKeep}
                    onclick={() => setKeep(cluster, member.id)}
                  >
                    <p class="text-sm font-medium text-foreground truncate">{member.title}</p>
                    <p class="text-[11px] text-muted-foreground">
                      {member.type} · {member.language ?? "—"} · {member.ratingCount} rating{member.ratingCount === 1
                        ? ""
                        : "s"}
                      {#if !inSet}
                        <span> · excluded</span>
                      {:else if isKeep}
                        <span class="text-accent"> · keep</span>
                      {:else}
                        <span> · click to keep</span>
                      {/if}
                    </p>
                  </button>
                  {#if inSet}
                    <Button
                      size="sm"
                      variant={isKeep ? "default" : "outline"}
                      class="shrink-0 h-7 text-[10px] px-2"
                      onclick={() => setKeep(cluster, member.id)}
                    >
                      {isKeep ? "Keeping" : "Keep"}
                    </Button>
                  {/if}
                </div>
              {/each}
            </div>

            {#if !cluster.dismissed}
              <div class="flex flex-wrap gap-2 items-end">
                <div class="space-y-1.5">
                  <Label class="text-muted-foreground font-normal">Merge strategy</Label>
                  <Select.Root
                    type="single"
                    value={strategyByCluster[cluster.id] || "prefer_kept"}
                    onValueChange={(v) => {
                      if (!v) return;
                      strategyByCluster = { ...strategyByCluster, [cluster.id]: v };
                      cancelConfirm(cluster.id);
                    }}
                  >
                    <Select.Trigger size="sm" class="min-w-[12rem] bg-background/60 backdrop-blur-sm cursor-pointer">
                      {strategyLabel(strategyByCluster[cluster.id] || "prefer_kept")}
                    </Select.Trigger>
                    <Select.Content class="bg-background/80 backdrop-blur-md text-xs">
                      {#each STRATEGY_OPTIONS as opt}
                        <Select.Item class="text-xs" value={opt.value}>{opt.label}</Select.Item>
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>
                <Button
                  size="sm"
                  disabled={busyId === cluster.id || !canAct}
                  onclick={() => previewMerge(cluster)}
                >
                  Merge selected…
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busyId === cluster.id || !canAct}
                  onclick={() => startDelete(cluster)}
                >
                  Keep / delete selected…
                </Button>
                <Button size="sm" variant="outline" disabled={busyId === cluster.id} onclick={() => dismiss(cluster)}>
                  Not duplicates
                </Button>
              </div>
              {#if !canAct}
                <p class="text-[11px] text-muted-foreground">
                  Select 2+ titles and pick one to keep before merging or deleting.
                </p>
              {/if}
            {:else}
              <Button size="sm" variant="outline" disabled={busyId === cluster.id} onclick={() => undismiss(cluster)}>
                Undo dismiss
              </Button>
            {/if}

            {#if confirm === "merge" && preview}
              <div id={`confirm-${cluster.id}`} class="rounded-md border border-accent/40 bg-accent/5 p-3 space-y-3">
                <p class="text-foreground font-medium text-xs">Confirm merge (selected subset)</p>
                <p class="text-muted-foreground">
                  Keep <span class="text-foreground">{preview.keep.title}</span>; remove
                  {preview.losers.map((l) => l.title).join(", ")}. Unselected titles in this cluster stay untouched.
                  Strategy:
                  <span class="text-foreground">{preview.strategy.replaceAll("_", " ")}</span>.
                  {preview.userCount} user rating(s) across {preview.ratingRowCount} row(s).
                  <span class="text-foreground"
                    >{preview.conflictCount} conflict{preview.conflictCount === 1 ? "" : "s"}</span
                  >
                  (users with disagreeing ratings).
                </p>
                {#if preview.conflicts.length > 0}
                  <div class="space-y-2 max-h-40 overflow-y-auto">
                    {#each preview.conflicts as conflict}
                      <div class="border-b border-border/30 pb-2">
                        <p class="text-foreground">{conflict.username ?? conflict.userId}</p>
                        <ul class="mt-1 space-y-0.5 text-muted-foreground">
                          {#each conflict.ratings as r}
                            <li>
                              {r.title}: {formatRating(r)}
                              {#if r.id === conflict.chosenRatingId}
                                <span class="text-accent">← chosen</span>
                              {/if}
                            </li>
                          {/each}
                        </ul>
                      </div>
                    {/each}
                  </div>
                {/if}
                <div class="flex gap-2">
                  <Button size="sm" disabled={busyId === cluster.id} onclick={() => confirmMerge(cluster)}>
                    Confirm merge
                  </Button>
                  <Button size="sm" variant="ghost" onclick={() => cancelConfirm(cluster.id)}>Cancel</Button>
                </div>
              </div>
            {/if}

            {#if confirm === "delete"}
              <div class="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-3">
                <p class="text-foreground font-medium text-xs">Confirm keep / delete selected</p>
                <p class="text-muted-foreground">
                  Keep the selected survivor. Delete the other <span class="text-foreground">selected</span> catalog
                  rows
                  <span class="text-destructive">and their ratings</span>
                  (no merge). Excluded titles are left alone. Prefer Merge if you want ratings preserved.
                </p>
                <div class="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busyId === cluster.id}
                    onclick={() => confirmDelete(cluster)}
                  >
                    Delete selected others
                  </Button>
                  <Button size="sm" variant="ghost" onclick={() => cancelConfirm(cluster.id)}>Cancel</Button>
                </div>
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      {/each}

      {#if hasMore}
        <div class="flex justify-center pt-2">
          <Button size="sm" variant="outline" disabled={loadingPage} onclick={loadMore}>
            {loadingPage ? "Loading…" : `Load more (${clusters.length} / ${totalMatching})`}
          </Button>
        </div>
      {/if}
    {/if}
  </div>
</div>
