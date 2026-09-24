<script lang="ts">
  import { CableIcon, PlayIcon, RefreshCwIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { Button } from "$components/ui/button";
  import { Input } from "$components/ui/input";
  import * as Card from "$lib/components/ui/card";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  type SettingsRow = (typeof data.settings)[number];
  type RunRow = (typeof data.runs)[number];

  let settings = $state<SettingsRow[]>(data.settings);
  let runs = $state<RunRow[]>(data.runs);
  let saving = $state(false);
  let syncing = $state(false);

  let bunko = $derived(settings.find((s) => s.connectorId === "bunko") ?? settings[0]);

  let enabled = $state(false);
  let cronExpression = $state("0 6 * * *");
  let pageSize = $state(100);
  let statusFilter = $state("");
  let destinationUsername = $state("lordsparos");
  let catalogActorUsername = $state("lordsparos");

  $effect(() => {
    if (!bunko) return;
    enabled = bunko.enabled;
    cronExpression = bunko.cronExpression;
    pageSize = bunko.pageSize;
    statusFilter = bunko.statusFilter ?? "";
    destinationUsername = bunko.destinationUsername;
    catalogActorUsername = bunko.catalogActorUsername;
  });

  async function refresh() {
    const res = await fetch("/api/admin/connectors", { credentials: "include" });
    if (!res.ok) {
      toast.error("Failed to refresh");
      return;
    }
    const body = await res.json();
    settings = body.settings ?? [];
    runs = (body.runs ?? []).map((r: any) => ({
      ...r,
      startedAt: typeof r.startedAt === "string" ? r.startedAt : new Date(r.startedAt).toISOString(),
      finishedAt: r.finishedAt ? (typeof r.finishedAt === "string" ? r.finishedAt : new Date(r.finishedAt).toISOString()) : null,
    }));
  }

  async function saveSettings() {
    saving = true;
    try {
      const res = await fetch("/api/admin/connectors", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorId: "bunko",
          enabled,
          cronExpression,
          pageSize: Number(pageSize) || 100,
          statusFilter,
          destinationUsername,
          catalogActorUsername,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Save failed");
        return;
      }
      toast.success(enabled ? "Bunko connector enabled" : "Bunko connector disabled");
      await refresh();
    } catch {
      toast.error("Save failed");
    } finally {
      saving = false;
    }
  }

  async function runSync() {
    syncing = true;
    try {
      const res = await fetch("/api/admin/connectors", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", connectorId: "bunko" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        toast.error(body.error || "Sync failed");
        await refresh();
        return;
      }
      const s = body.summary;
      toast.success(`Sync ${s.status}: fetched ${s.fetched}, catalog +${s.catalog?.imported}/~${s.catalog?.updated}, ratings +${s.ratings?.imported}/~${s.ratings?.updated}`);
      await refresh();
    } catch {
      toast.error("Sync failed");
    } finally {
      syncing = false;
    }
  }

  function statusClass(status: string) {
    if (status === "success") return "text-emerald-600";
    if (status === "partial") return "text-amber-600";
    if (status === "failure") return "text-destructive";
    return "text-muted-foreground";
  }
</script>

<div class="h-screen overflow-y-scroll pb-24">
  <div class="max-w-4xl mx-auto px-4 py-8 space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3 mb-2">
      <div class="space-y-1">
        <div class="inline-flex items-center gap-2 text-accent">
          <CableIcon class="size-5" />
          <span class="text-[10px] uppercase tracking-wide">Admin</span>
        </div>
        <h1 class="text-3xl font-medium">Connectors</h1>
        <p class="text-muted-foreground text-sm">Enable auto imports, edit safe settings, and inspect load history.</p>
        <p class="text-xs text-muted-foreground">
          <a href="/admin" class="text-accent hover:underline">← Admin center</a>
          ·
          <a href="/admin/duplicates" class="text-accent hover:underline">Duplicates</a>
        </p>
      </div>
      <div class="flex gap-2">
        <Button size="sm" variant="outline" onclick={refresh}>
          <RefreshCwIcon class="size-3.5 mr-1" />
          Refresh
        </Button>
        <a href="/connectors" class="text-xs text-accent hover:underline self-center">Public docs →</a>
      </div>
    </div>

    <Card.Root>
      <Card.Header>
        <Card.Title>Ops notes</Card.Title>
      </Card.Header>
      <Card.Content class="space-y-2 text-xs/relaxed text-muted-foreground">
        <p>
          Cron also needs <code class="text-foreground">BUNKO_IMPORT_ENABLED=true</code> (optional
          <code class="text-foreground">BUNKO_IMPORT_CRON</code>, default <code class="text-foreground">0 6 * * *</code> UTC). Manual sync accepts an admin
          session or <code class="text-foreground">BUNKO_SYNC_SECRET</code>:
        </p>
        <pre class="bg-muted/40 rounded-md p-3 overflow-x-auto text-[11px] font-mono text-foreground/90">curl -X POST /api/connectors/integrators/bunko \
  -H "Authorization: Bearer $BUNKO_SYNC_SECRET"

curl /api/connectors/integrators/bunko</pre>
        <p>Public users see a lean overview at <a href="/connectors" class="text-accent hover:underline">/connectors</a> — secrets, cron, and run internals stay here.</p>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>Registered connectors</Card.Title>
      </Card.Header>
      <Card.Content class="space-y-2">
        {#each data.connectors as connector}
          <div class="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 pb-2 last:border-0">
            <div>
              <p class="text-sm font-medium">{connector.label}</p>
              <p class="text-xs text-muted-foreground">{connector.description}</p>
            </div>
            <div class="text-[10px] uppercase tracking-wide text-muted-foreground text-right space-y-0.5">
              <div>{connector.kind} · {connector.status ?? "—"}</div>
              {#if connector.trigger}
                <div>{connector.trigger}{#if connector.scope} · {connector.scope}{/if}</div>
              {/if}
              {#if connector.accountUsername}
                <div>@{connector.accountUsername}</div>
              {/if}
            </div>
          </div>
        {/each}
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>Bunko auto account import</Card.Title>
      </Card.Header>
      <Card.Content class="space-y-4 text-xs">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" bind:checked={enabled} class="rounded border-border" />
          <span class="text-sm font-medium">Enabled</span>
          <span class="text-muted-foreground">(DB toggle — cron also needs BUNKO_IMPORT_ENABLED=true)</span>
        </label>

        <div class="grid sm:grid-cols-2 gap-3">
          <label class="space-y-1">
            <span class="text-muted-foreground">Cron (UTC)</span>
            <Input class="h-8 text-xs font-mono" bind:value={cronExpression} />
          </label>
          <label class="space-y-1">
            <span class="text-muted-foreground">Page size (≤500)</span>
            <Input class="h-8 text-xs" type="number" min="1" max="500" bind:value={pageSize} />
          </label>
          <label class="space-y-1">
            <span class="text-muted-foreground">Status filter (empty = all)</span>
            <Input class="h-8 text-xs" bind:value={statusFilter} placeholder="watched | watchlist" />
          </label>
          <label class="space-y-1">
            <span class="text-muted-foreground">Destination username</span>
            <Input class="h-8 text-xs" bind:value={destinationUsername} />
          </label>
          <label class="space-y-1 sm:col-span-2">
            <span class="text-muted-foreground">Catalog actor username (contributor/admin)</span>
            <Input class="h-8 text-xs" bind:value={catalogActorUsername} />
          </label>
        </div>

        <div class="flex flex-wrap gap-2">
          <Button size="sm" onclick={saveSettings} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
          <Button size="sm" variant="secondary" onclick={runSync} disabled={syncing}>
            <PlayIcon class="size-3.5 mr-1" />
            {syncing ? "Syncing…" : "Run sync now"}
          </Button>
        </div>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>Run history</Card.Title>
      </Card.Header>
      <Card.Content>
        {#if runs.length === 0}
          <p class="text-xs text-muted-foreground">No runs yet.</p>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-left text-[11px]">
              <thead class="text-muted-foreground border-b border-border/40">
                <tr>
                  <th class="py-2 pr-2 font-medium">Started</th>
                  <th class="py-2 pr-2 font-medium">Trigger</th>
                  <th class="py-2 pr-2 font-medium">Status</th>
                  <th class="py-2 pr-2 font-medium">Fetched</th>
                  <th class="py-2 pr-2 font-medium">Catalog</th>
                  <th class="py-2 pr-2 font-medium">Ratings</th>
                  <th class="py-2 pr-2 font-medium">ms</th>
                  <th class="py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {#each runs as run}
                  <tr class="border-b border-border/20 align-top">
                    <td class="py-2 pr-2 whitespace-nowrap font-mono">{run.startedAt?.replace("T", " ").slice(0, 19)}</td>
                    <td class="py-2 pr-2">{run.trigger}</td>
                    <td class={`py-2 pr-2 font-medium ${statusClass(run.status)}`}>{run.status}</td>
                    <td class="py-2 pr-2">{run.fetched ?? 0}</td>
                    <td class="py-2 pr-2 whitespace-nowrap">+{run.catalogImported ?? 0} / ~{run.catalogUpdated ?? 0} / skip {run.catalogSkipped ?? 0}</td>
                    <td class="py-2 pr-2 whitespace-nowrap">+{run.ratingsImported ?? 0} / ~{run.ratingsUpdated ?? 0} / skip {run.ratingsSkipped ?? 0}</td>
                    <td class="py-2 pr-2">{run.durationMs ?? "—"}</td>
                    <td class="py-2 max-w-[14rem] truncate text-muted-foreground" title={run.errorSnippet ?? ""}>{run.errorSnippet ?? "—"}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  </div>
</div>
