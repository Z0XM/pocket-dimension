<script lang="ts">
  import { CableIcon, CopyIcon, KeyRoundIcon, TrashIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { Button } from "$components/ui/button";
  import { Input } from "$components/ui/input";
  import * as Card from "$lib/components/ui/card";
  import { authClient } from "$lib/auth-client";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const session = authClient.useSession();
  let isLoggedIn = $derived(!!$session.data?.user && !!data.user);

  type TokenMeta = {
    id: string;
    name: string;
    prefix: string;
    createdAt: string;
    expiresAt: string | null;
    revokedAt: string | null;
    lastUsedAt: string | null;
  };

  let tokens = $state<TokenMeta[]>([]);
  let tokensLoading = $state(false);
  let tokenName = $state("Watchlist connectors");
  let createdToken = $state<string | null>(null);
  let creating = $state(false);

  async function loadTokens() {
    if (!isLoggedIn) return;
    tokensLoading = true;
    try {
      const res = await fetch(`${data.authBaseUrl}/api-tokens`, { credentials: "include" });
      if (!res.ok) {
        if (res.status !== 401) toast.error("Failed to load API tokens");
        tokens = [];
        return;
      }
      const body = await res.json();
      tokens = (body.tokens ?? []).filter((t: TokenMeta) => !t.revokedAt);
    } catch {
      toast.error("Could not reach auth-service for tokens");
    } finally {
      tokensLoading = false;
    }
  }

  $effect(() => {
    if (isLoggedIn) {
      void loadTokens();
    }
  });

  async function createToken() {
    if (!tokenName.trim()) {
      toast.error("Name your token");
      return;
    }
    creating = true;
    createdToken = null;
    try {
      const res = await fetch(`${data.authBaseUrl}/api-tokens`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tokenName.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Failed to create token");
        return;
      }
      createdToken = body.token?.token ?? null;
      toast.success("Token created — copy it now; it won’t be shown again");
      await loadTokens();
    } catch {
      toast.error("Could not create token");
    } finally {
      creating = false;
    }
  }

  async function revokeToken(id: string) {
    try {
      const res = await fetch(`${data.authBaseUrl}/api-tokens/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        toast.error("Failed to revoke token");
        return;
      }
      toast.success("Token revoked");
      await loadTokens();
    } catch {
      toast.error("Could not revoke token");
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  function originExample(): string {
    if (typeof window !== "undefined") return window.location.origin;
    return "http://localhost:3002";
  }

  let csvExportExample = $derived(`GET ${originExample()}/api/connectors/csv/catalog
GET ${originExample()}/api/connectors/csv/ratings
  -H "Authorization: Bearer pd_…"`);

  let csvImportExample = $derived(`curl -X POST ${originExample()}/api/connectors/csv/ratings \\
  -H "Authorization: Bearer pd_…" \\
  -F "file=@my-ratings.csv"`);

  let apiGetExample = $derived(`curl ${originExample()}/api/connectors/api/catalog
curl ${originExample()}/api/connectors/api/ratings \\
  -H "X-Api-Key: pd_…"`);

  let apiPostExample = $derived(`curl -X POST ${originExample()}/api/connectors/api/ratings \\
  -H "Authorization: Bearer pd_…" \\
  -H "Content-Type: application/json" \\
  -d '{"rows":[{"title":"Example","rating":"8","progress_status":"watched"}]}'`);

  let bunkoSyncExample = $derived(`# Manual sync (admin session cookie, or secret)
curl -X POST ${originExample()}/api/connectors/integrators/bunko \\
  -H "Authorization: Bearer $BUNKO_SYNC_SECRET"

# Status / last run
curl ${originExample()}/api/connectors/integrators/bunko`);
</script>

<div class="h-screen overflow-y-scroll pb-24">
  <div class="max-w-4xl mx-auto px-4 py-8 space-y-6">
    <div class="text-center space-y-2 mb-8">
      <div class="inline-flex items-center justify-center gap-2 text-accent">
        <CableIcon class="size-6" />
      </div>
      <h1 class="text-3xl font-medium">Connectors</h1>
      <p class="text-muted-foreground text-sm">Export and import watchlist data via CSV, JSON API, or partner integrators.</p>
      {#if data.user?.role === "admin"}
        <p class="text-xs">
          <a href="/admin/connectors" class="text-accent hover:underline">Admin console — enable connectors & view run history →</a>
        </p>
      {/if}
    </div>

    <Card.Root>
      <Card.Header>
        <Card.Title>How it works</Card.Title>
      </Card.Header>
      <Card.Content class="space-y-3 text-xs/relaxed text-muted-foreground">
        <p>
          Connectors move datasets in and out of Watchlist. <span class="text-foreground">Public</span> datasets (catalog) can be read without signing
          in. <span class="text-foreground">Private</span> datasets (your ratings, saved views) require a logged-in verified account — use a browser session
          or an API token.
        </p>
        <p>
          API tokens are issued by the shared auth service so other Pocket Dimension apps can reuse the same create / list / revoke / validate flow.
        </p>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>Datasets</Card.Title>
      </Card.Header>
      <Card.Content class="space-y-4">
        {#each data.datasets as dataset}
          <div class="border-b border-border/40 pb-3 last:border-0 last:pb-0">
            <div class="flex flex-wrap items-baseline gap-2 mb-1">
              <h3 class="text-sm font-medium">{dataset.label}</h3>
              <span class="text-[10px] uppercase tracking-wide text-muted-foreground">{dataset.access}</span>
              <span class="text-[10px] uppercase tracking-wide text-muted-foreground">{dataset.direction}</span>
            </div>
            <p class="text-xs/relaxed text-muted-foreground mb-2">{dataset.description}</p>
            <p class="text-[11px] font-mono text-muted-foreground">
              columns: {dataset.columns.join(", ")}
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              {#if dataset.direction !== "import"}
                <a href="/api/connectors/csv/{dataset.id}" class="text-xs text-accent hover:underline" download> Download CSV </a>
                <a href="/api/connectors/api/{dataset.id}" class="text-xs text-accent hover:underline" target="_blank" rel="noreferrer">
                  View JSON
                </a>
              {/if}
            </div>
          </div>
        {/each}
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>CSV</Card.Title>
      </Card.Header>
      <Card.Content class="space-y-3 text-xs/relaxed text-muted-foreground">
        <p><span class="text-foreground font-medium">Export</span> — open or curl the download URL:</p>
        <pre class="bg-muted/40 rounded-md p-3 overflow-x-auto text-[11px] font-mono text-foreground/90">{csvExportExample}</pre>
        <p>
          <span class="text-foreground font-medium">Import</span> — POST a CSV file (multipart field <code class="text-foreground">file</code>) or raw
          <code class="text-foreground">text/csv</code>:
        </p>
        <pre class="bg-muted/40 rounded-md p-3 overflow-x-auto text-[11px] font-mono text-foreground/90">{csvImportExample}</pre>
        <p>
          Catalog import requires contributor or admin. Ratings import matches rows by <code class="text-foreground">title</code> against the existing catalog.
        </p>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>JSON API</Card.Title>
      </Card.Header>
      <Card.Content class="space-y-3 text-xs/relaxed text-muted-foreground">
        <p>
          <span class="text-foreground font-medium">GET</span> returns <code class="text-foreground">{"{ dataset, columns, count, rows }"}</code>.
        </p>
        <pre class="bg-muted/40 rounded-md p-3 overflow-x-auto text-[11px] font-mono text-foreground/90">{apiGetExample}</pre>
        <p>
          <span class="text-foreground font-medium">POST</span> accepts <code class="text-foreground">{'{ "rows": [ … ] }'}</code> with the same columns
          as CSV.
        </p>
        <pre class="bg-muted/40 rounded-md p-3 overflow-x-auto text-[11px] font-mono text-foreground/90">{apiPostExample}</pre>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <KeyRoundIcon class="size-4" />
          API tokens
        </Card.Title>
      </Card.Header>
      <Card.Content class="space-y-4 text-xs/relaxed text-muted-foreground">
        {#if !isLoggedIn}
          <p>
            <a href="/login" class="text-accent hover:underline">Sign in</a> with a verified email to create API tokens for private connectors.
          </p>
        {:else}
          <p>
            Tokens are managed on auth-service (<code class="text-foreground">{data.authBaseUrl}/api-tokens</code>). Send them as
            <code class="text-foreground">Authorization: Bearer …</code>
            or
            <code class="text-foreground">X-Api-Key</code>.
          </p>

          <div class="flex flex-wrap gap-2 items-center">
            <Input class="max-w-xs h-8 text-xs" bind:value={tokenName} placeholder="Token name" />
            <Button size="sm" onclick={createToken} disabled={creating}>
              {creating ? "Creating…" : "Create token"}
            </Button>
          </div>

          {#if createdToken}
            <div class="rounded-md border border-accent/40 bg-accent/10 p-3 space-y-2">
              <p class="text-foreground text-xs font-medium">Copy this token now — it is only shown once.</p>
              <div class="flex gap-2 items-start">
                <code class="flex-1 break-all text-[11px] font-mono text-foreground">{createdToken}</code>
                <Button size="icon" variant="ghost" class="h-7 w-7 shrink-0" onclick={() => copyText(createdToken!)} title="Copy">
                  <CopyIcon class="size-3.5" />
                </Button>
              </div>
            </div>
          {/if}

          {#if tokensLoading}
            <p>Loading tokens…</p>
          {:else if tokens.length === 0}
            <p>No active tokens yet.</p>
          {:else}
            <ul class="space-y-2">
              {#each tokens as token}
                <li class="flex items-center justify-between gap-2 border-b border-border/30 pb-2">
                  <div>
                    <p class="text-foreground text-xs font-medium">{token.name}</p>
                    <p class="font-mono text-[10px] text-muted-foreground">{token.prefix}…</p>
                  </div>
                  <Button size="icon" variant="ghost" class="h-7 w-7 text-destructive" onclick={() => revokeToken(token.id)} title="Revoke">
                    <TrashIcon class="size-3.5" />
                  </Button>
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>Partner integrators</Card.Title>
      </Card.Header>
      <Card.Content class="space-y-4">
        <p class="text-xs/relaxed text-muted-foreground">
          Partner syncs pull external catalogs into Watchlist. IMDb / Letterboxd remain stubs (501). Bunko is the first live auto account import.
        </p>
        {#each data.integrators as integrator}
          <div class="border-b border-border/40 pb-3 last:border-0 last:pb-0 space-y-1">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 class="text-sm font-medium">{integrator.label}</h3>
                <p class="text-xs text-muted-foreground">{integrator.description}</p>
              </div>
              <span class="text-[10px] uppercase tracking-wide text-muted-foreground">{integrator.status.replace("_", " ")}</span>
            </div>
            {#if integrator.trigger || integrator.scope || integrator.accountUsername}
              <p class="text-[11px] text-muted-foreground font-mono">
                {#if integrator.trigger}trigger: {integrator.trigger}{/if}
                {#if integrator.scope} · scope: {integrator.scope}{/if}
                {#if integrator.accountUsername} · account: @{integrator.accountUsername}{/if}
              </p>
            {/if}
            {#if integrator.id === "bunko"}
              <div class="space-y-2 text-xs/relaxed text-muted-foreground pt-1">
                <p>
                  Pulls <a class="text-accent hover:underline" href="https://bunko.byimti.tools/" target="_blank" rel="noreferrer">Bunko</a>
                  public Movies API → catalog + ratings for <code class="text-foreground">BUNKO_IMPORT_USERNAME</code> (default
                  <code class="text-foreground">lordsparos</code>). Posters ignored; title-keyed upsert; Bunko wins on conflict; never auto-deletes.
                </p>
                <p>
                  Cron: set <code class="text-foreground">BUNKO_IMPORT_ENABLED=true</code> (and optional
                  <code class="text-foreground">BUNKO_IMPORT_CRON</code>, default <code class="text-foreground">0 6 * * *</code> UTC). Admins can also
                  enable/disable and inspect history at <a href="/admin/connectors" class="text-accent hover:underline">/admin/connectors</a>.
                </p>
                <p>Manual sync (secret or admin):</p>
                <pre class="bg-muted/40 rounded-md p-3 overflow-x-auto text-[11px] font-mono text-foreground/90">{bunkoSyncExample}</pre>
              </div>
            {/if}
          </div>
        {/each}
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>Connector catalog</Card.Title>
      </Card.Header>
      <Card.Content class="text-xs/relaxed text-muted-foreground space-y-2">
        <p>
          Machine-readable list: <a href="/api/connectors" class="text-accent hover:underline">/api/connectors</a>
        </p>
        <ul class="list-disc list-inside space-y-1">
          {#each data.connectors as connector}
            <li>
              <span class="text-foreground">{connector.label}</span>
              ({connector.kind}
              {#if connector.status}
                · {connector.status}
              {/if})
            </li>
          {/each}
        </ul>
      </Card.Content>
    </Card.Root>
  </div>
</div>
