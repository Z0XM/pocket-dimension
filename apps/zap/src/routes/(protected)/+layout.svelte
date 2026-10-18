<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { CatalogQueueClient, setCatalogQueue } from "$lib/catalog-queue-client.svelte";
  import CatalogQueueDock from "$lib/components/CatalogQueueDock.svelte";
  import PageSkeleton from "$lib/components/PageSkeleton.svelte";
  import StartSessionButton from "$lib/components/StartSessionButton.svelte";
  import WaveBars from "$lib/components/WaveBars.svelte";
  import type { LayoutData } from "../$types";
  import { navigating, page } from "$app/state";
  import { goto } from "$app/navigation";

  let { data, children }: { data: LayoutData; children: import("svelte").Snippet } = $props();

  const catalogQueue = new CatalogQueueClient();
  setCatalogQueue(catalogQueue);

  const path = $derived(page.url.pathname);
  const navTo = $derived(navigating.to?.url.pathname ?? null);
  const isNavigating = $derived(Boolean(navTo));
  const homeActive = $derived(path === "/home");
  const catalogueActive = $derived(path === "/catalogue" || path.startsWith("/catalogue/"));
  const playlistsActive = $derived(path === "/playlists" || path.startsWith("/playlists/"));
  const historyActive = $derived(path === "/history" || path.startsWith("/history/"));
  const joinActive = $derived(path === "/join" || path.startsWith("/join/"));
  const sessionActive = $derived(path === "/session" || path.startsWith("/session/"));
  const adminActive = $derived(path === "/admin" || path.startsWith("/admin/"));

  /** Catalogue pins the shell to the viewport so only its song list scrolls. */
  const fillViewport = $derived(catalogueActive && !isNavigating);

  const skeletonPath = $derived(navTo ?? path);
  const skeletonShowFilters = $derived(skeletonPath.startsWith("/catalogue") || skeletonPath.startsWith("/session/"));
  const skeletonVariant = $derived<"list" | "form" | "home">(
    skeletonPath.startsWith("/home") || skeletonPath === "/session" ? "home" : skeletonPath.startsWith("/join") ? "form" : "list"
  );
  const skeletonTitle = $derived(
    skeletonPath.startsWith("/catalogue")
      ? "Loading catalogue"
      : skeletonPath.startsWith("/playlists")
        ? "Loading playlists"
        : skeletonPath.startsWith("/session")
          ? "Loading session"
          : skeletonPath.startsWith("/history")
            ? "Loading history"
            : skeletonPath.startsWith("/home")
              ? "Loading home"
              : skeletonPath.startsWith("/join")
                ? "Loading join"
                : skeletonPath.startsWith("/admin")
                  ? "Loading admin"
                  : "Loading"
  );

  async function signOut() {
    catalogQueue.disconnect();
    await authClient.signOut();
    await goto("/");
  }
</script>

<div class={`zap-wave-field zap-grid flex flex-col ${fillViewport ? "h-dvh overflow-hidden" : "min-h-screen"}`}>
  <header class="relative shrink-0 border-b border-border/60 bg-background/70 backdrop-blur">
    {#if isNavigating}
      <div class="zap-nav-progress" aria-hidden="true"></div>
      <span class="sr-only" role="status" aria-live="polite">Loading page…</span>
    {/if}
    <div class="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <a href="/home" class="flex items-center gap-3" aria-label="Zap home" aria-current={homeActive ? "page" : undefined}>
        <span class="text-xl font-semibold tracking-tight text-foreground">Zap</span>
        <WaveBars />
      </a>
      <nav class="flex flex-wrap items-center gap-1 font-mono text-[11px] sm:gap-2" aria-label="Primary">
        <a
          href="/catalogue"
          class={`zap-nav-link ${catalogueActive ? "zap-nav-link-active" : ""}`}
          aria-current={catalogueActive ? "page" : undefined}>Catalogue</a
        >
        <a
          href="/playlists"
          class={`zap-nav-link ${playlistsActive ? "zap-nav-link-active" : ""}`}
          aria-current={playlistsActive ? "page" : undefined}>Playlists</a
        >
        <a href="/join" class={`zap-nav-link ${joinActive ? "zap-nav-link-active" : ""}`} aria-current={joinActive ? "page" : undefined}>Join</a>
        <StartSessionButton
          label="Session"
          class={`text-[11px] disabled:opacity-40 ${
            sessionActive
              ? "zap-nav-link zap-nav-link-active"
              : "rounded border border-signal/40 bg-signal/10 px-2 py-1 text-signal hover:bg-signal/20"
          }`}
        />
        <span class="mx-1 hidden text-border sm:inline" aria-hidden="true">|</span>
        <a href="/history" class={`zap-nav-link ${historyActive ? "zap-nav-link-active" : ""}`} aria-current={historyActive ? "page" : undefined}
          >History</a
        >
        {#if data.zapAdmin}
          <a href="/admin" class={`zap-nav-link ${adminActive ? "zap-nav-link-active" : ""}`} aria-current={adminActive ? "page" : undefined}>Admin</a
          >
        {/if}
        <span class="hidden text-muted-foreground sm:inline">{data.user?.username ?? data.user?.email}</span>
        <button type="button" class="rounded border border-border px-2 py-1 text-muted-foreground hover:bg-secondary" onclick={signOut}>
          Sign out
        </button>
      </nav>
    </div>
  </header>
  <main class={`mx-auto w-full max-w-5xl px-6 ${fillViewport ? "flex min-h-0 flex-1 flex-col overflow-y-auto py-4 sm:py-6" : "py-8"}`}>
    {#if isNavigating}
      <PageSkeleton title={skeletonTitle} showFilters={skeletonShowFilters} variant={skeletonVariant} />
    {:else}
      {@render children()}
    {/if}
  </main>
</div>

<CatalogQueueDock queue={catalogQueue} />
