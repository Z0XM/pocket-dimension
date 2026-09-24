<script lang="ts">
  import { CombineIcon, RefreshCwIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { goto, invalidateAll } from "$app/navigation";
  import { Button } from "$components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  type Cluster = (typeof data.clusters)[number];
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

  let clusters = $state<Cluster[]>(data.clusters);
  let counts = $state(data.counts);
  let tier = $state(data.tier);
  let includeDismissed = $state(data.includeDismissed);
  let loading = $state(false);
  let busyId = $state<string | null>(null);

  // Per-cluster UI state
  let keepByCluster = $state<Record<string, string>>({});
  let strategyByCluster = $state<Record<string, string>>({});
  let confirmByCluster = $state<Record<string, "merge" | "delete" | null>>({});
  let previewByCluster = $state<Record<string, Preview | null>>({});

  $effect(() => {
    clusters = data.clusters;
    counts = data.counts;
    tier = data.tier;
    includeDismissed = data.includeDismissed;
    const nextKeep: Record<string, string> = {};
    const nextStrategy: Record<string, string> = {};
    for (const c of data.clusters) {
      nextKeep[c.id] = keepByCluster[c.id] ?? c.members[0]?.id ?? "";
      nextStrategy[c.id] = strategyByCluster[c.id] ?? "prefer_kept";
    }
    keepByCluster = nextKeep;
    strategyByCluster = nextStrategy;
  });

  async function refreshQuery() {
    const params = new URLSearchParams();
    if (tier !== "all") params.set("tier", tier);
    if (includeDismissed) params.set("includeDismissed", "1");
    const qs = params.toString();
    await goto(`/admin/duplicates${qs ? `?${qs}` : ""}`, { invalidateAll: true, keepFocus: true });
  }

  async function reloadClient() {
    loading = true;
    try {
      const params = new URLSearchParams();
      if (tier !== "all") params.set("tier", tier);
      if (includeDismissed) params.set("includeDismissed", "1");
      const res = await fetch(`/api/admin/duplicates?${params}`, { credentials: "include" });
      if (!res.ok) {
        toast.error("Failed to refresh");
        return;
      }
      const body = await res.json();
      clusters = body.clusters ?? [];
      counts = body.counts ?? counts;
    } finally {
      loading = false;
    }
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

  async function previewMerge(cluster: Cluster) {
    const keepId = keepByCluster[cluster.id];
    const mergeIds = cluster.members.map((m) => m.id).filter((id) => id !== keepId);
    if (!keepId || mergeIds.length === 0) {
      toast.error("Pick a title to keep");
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
          keepId,
          mergeIds,
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
    } finally {
      busyId = null;
    }
  }

  async function confirmMerge(cluster: Cluster) {
    const keepId = keepByCluster[cluster.id];
    const mergeIds = cluster.members.map((m) => m.id).filter((id) => id !== keepId);
    busyId = cluster.id;
    try {
      const res = await fetch("/api/admin/duplicates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "merge",
          keepId,
          mergeIds,
          strategy: strategyByCluster[cluster.id] || "prefer_kept",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        toast.error(body.error || "Merge failed");
        return;
      }
      toast.success(`Merged ${mergeIds.length} into kept title`);
      confirmByCluster = { ...confirmByCluster, [cluster.id]: null };
      previewByCluster = { ...previewByCluster, [cluster.id]: null };
      await invalidateAll();
      await reloadClient();
    } finally {
      busyId = null;
    }
  }

  function startDelete(cluster: Cluster) {
    confirmByCluster = { ...confirmByCluster, [cluster.id]: "delete" };
    previewByCluster = { ...previewByCluster, [cluster.id]: null };
  }

  async function confirmDelete(cluster: Cluster) {
    const keepId = keepByCluster[cluster.id];
    const deleteIds = cluster.members.map((m) => m.id).filter((id) => id !== keepId);
    busyId = cluster.id;
    try {
      const res = await fetch("/api/admin/duplicates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_others", keepId, deleteIds }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        toast.error(body.error || "Delete failed");
        return;
      }
      toast.success(`Deleted ${deleteIds.length} catalog row(s); ratings on those rows were removed`);
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
          Review suggested duplicate clusters, merge ratings into one survivor, or dismiss false positives.
        </p>
        <p class="text-xs text-muted-foreground">
          <a href="/admin" class="text-accent hover:underline">← Admin center</a>
        </p>
      </div>
      <Button size="sm" variant="outline" onclick={reloadClient} disabled={loading}>
        <RefreshCwIcon class="size-3.5 mr-1" />
        Refresh
      </Button>
    </div>

    <Card.Root>
      <Card.Content class="pt-4 flex flex-wrap gap-3 items-end text-xs">
        <label class="space-y-1">
          <span class="text-muted-foreground">Tier</span>
          <select
            class="block h-8 rounded-md border border-border bg-background px-2"
            bind:value={tier}
            onchange={() => refreshQuery()}
          >
            <option value="all">All ({counts.total})</option>
            <option value="direct">Direct ({counts.direct})</option>
            <option value="indirect">Indirect ({counts.indirect})</option>
            <option value="fuzzy">Fuzzy ({counts.fuzzy})</option>
          </select>
        </label>
        <label class="flex items-center gap-2 cursor-pointer pb-1">
          <input
            type="checkbox"
            bind:checked={includeDismissed}
            onchange={() => refreshQuery()}
            class="rounded border-border"
          />
          <span>Show dismissed</span>
        </label>
        <p class="text-muted-foreground self-center pb-1">
          Direct = exact title · Indirect = alphanumeric · Fuzzy = close match (confidence shown)
        </p>
      </Card.Content>
    </Card.Root>

    {#if clusters.length === 0}
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
        <Card.Root class={cluster.dismissed ? "opacity-70" : ""}>
          <Card.Header class="pb-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${tierBadge(cluster.tier)}`}>
                {cluster.tier}
              </span>
              {#if confidenceLabel(cluster)}
                <span class="text-[10px] text-muted-foreground">{confidenceLabel(cluster)}</span>
              {/if}
              <span class="text-[10px] text-muted-foreground">{cluster.members.length} titles · {cluster.totalRatings} ratings</span>
              {#if cluster.dismissed}
                <span class="text-[10px] uppercase tracking-wide text-muted-foreground">dismissed</span>
              {/if}
            </div>
            {#if cluster.sampleRaters.length > 0}
              <p class="text-[11px] text-muted-foreground mt-1">Raters: {cluster.sampleRaters.join(", ")}</p>
            {/if}
          </Card.Header>
          <Card.Content class="space-y-4 text-xs">
            <div class="space-y-2">
              {#each cluster.memberStats as member}
                <label class="flex items-start gap-2 cursor-pointer rounded-md border border-border/40 p-2 hover:bg-muted/30">
                  <input
                    type="radio"
                    name={`keep-${cluster.id}`}
                    class="mt-1"
                    checked={keepId === member.id}
                    onchange={() => {
                      keepByCluster = { ...keepByCluster, [cluster.id]: member.id };
                      cancelConfirm(cluster.id);
                    }}
                  />
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-foreground truncate">{member.title}</p>
                    <p class="text-[11px] text-muted-foreground">
                      {member.type} · {member.language ?? "—"} · {member.ratingCount} rating{member.ratingCount === 1 ? "" : "s"}
                      {#if keepId === member.id}
                        <span class="text-accent"> · keep</span>
                      {/if}
                    </p>
                  </div>
                </label>
              {/each}
            </div>

            {#if !cluster.dismissed}
              <div class="flex flex-wrap gap-2 items-end">
                <label class="space-y-1">
                  <span class="text-muted-foreground">Merge strategy</span>
                  <select
                    class="block h-8 rounded-md border border-border bg-background px-2"
                    value={strategyByCluster[cluster.id] || "prefer_kept"}
                    onchange={(e) => {
                      strategyByCluster = {
                        ...strategyByCluster,
                        [cluster.id]: (e.currentTarget as HTMLSelectElement).value,
                      };
                      cancelConfirm(cluster.id);
                    }}
                  >
                    <option value="prefer_kept">Prefer kept row</option>
                    <option value="prefer_highest">Prefer highest rating</option>
                    <option value="prefer_recent">Prefer most recently updated</option>
                  </select>
                </label>
                <Button size="sm" disabled={busyId === cluster.id} onclick={() => previewMerge(cluster)}>
                  Merge into kept…
                </Button>
                <Button size="sm" variant="secondary" disabled={busyId === cluster.id} onclick={() => startDelete(cluster)}>
                  Keep / delete others…
                </Button>
                <Button size="sm" variant="outline" disabled={busyId === cluster.id} onclick={() => dismiss(cluster)}>
                  Not duplicates
                </Button>
              </div>
            {:else}
              <Button size="sm" variant="outline" disabled={busyId === cluster.id} onclick={() => undismiss(cluster)}>
                Undo dismiss
              </Button>
            {/if}

            {#if confirm === "merge" && preview}
              <div class="rounded-md border border-accent/40 bg-accent/5 p-3 space-y-3">
                <p class="text-foreground font-medium text-xs">Confirm merge</p>
                <p class="text-muted-foreground">
                  Keep <span class="text-foreground">{preview.keep.title}</span>; remove
                  {preview.losers.map((l) => l.title).join(", ")}. Strategy:
                  <span class="text-foreground">{preview.strategy.replaceAll("_", " ")}</span>.
                  {preview.userCount} user rating(s) across {preview.ratingRowCount} row(s).
                  <span class="text-foreground">{preview.conflictCount} conflict{preview.conflictCount === 1 ? "" : "s"}</span>
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
                <p class="text-foreground font-medium text-xs">Confirm keep / delete</p>
                <p class="text-muted-foreground">
                  Keep the selected title. Delete the other catalog rows
                  <span class="text-destructive">and their ratings</span>
                  (no merge). Prefer Merge if you want ratings preserved.
                </p>
                <div class="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={busyId === cluster.id} onclick={() => confirmDelete(cluster)}>
                    Delete others
                  </Button>
                  <Button size="sm" variant="ghost" onclick={() => cancelConfirm(cluster.id)}>Cancel</Button>
                </div>
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      {/each}
    {/if}
  </div>
</div>
