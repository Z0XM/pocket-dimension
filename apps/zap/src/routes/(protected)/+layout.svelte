<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { CatalogQueueClient, setCatalogQueue } from "$lib/catalog-queue-client.svelte";
  import CatalogQueueDock from "$lib/components/CatalogQueueDock.svelte";
  import PageSkeleton from "$lib/components/PageSkeleton.svelte";
  import SettingsMenu from "$lib/components/SettingsMenu.svelte";
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
  const sessionActive = $derived(path === "/session" || path.startsWith("/session/"));
  const adminActivityActive = $derived(path === "/admin");

  /** Catalogue / Admin activity pin the shell so only their list panes scroll. */
  const fillViewport = $derived((catalogueActive || adminActivityActive) && !isNavigating);

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

{#snippet primaryNav(rail = false)}
  <nav
    class={rail ? "flex flex-col gap-1 font-mono text-[11px]" : "flex flex-wrap items-center gap-1 font-mono text-[11px] sm:gap-2"}
    aria-label="Primary"
  >
    <a
      href="/catalogue"
      class={`zap-nav-link ${catalogueActive ? "zap-nav-link-active" : ""} ${rail ? "block w-full px-2" : ""}`}
      aria-current={catalogueActive ? "page" : undefined}>Catalogue</a
    >
    <a
      href="/playlists"
      class={`zap-nav-link ${playlistsActive ? "zap-nav-link-active" : ""} ${rail ? "block w-full px-2" : ""}`}
      aria-current={playlistsActive ? "page" : undefined}>Playlists</a
    >
    <a
      href="/session?stay=1"
      class={`zap-nav-link ${sessionActive ? "zap-nav-link-active" : ""} ${rail ? "block w-full px-2" : ""}`}
      aria-current={sessionActive ? "page" : undefined}>Sessions</a
    >
  </nav>
{/snippet}

<div class={`zap-shell zap-wave-field zap-grid ${fillViewport ? "h-dvh overflow-hidden" : "min-h-screen"}`}>
  <aside class="zap-shell-rail" aria-label="App rail">
    <a href="/home" class="flex items-center gap-2 px-2" aria-label="Zap home" aria-current={homeActive ? "page" : undefined}>
      <span class="text-lg font-semibold tracking-tight text-foreground">Zap</span>
      <WaveBars />
    </a>
    {@render primaryNav(true)}
    <div class="mt-auto px-2 py-2">
      <SettingsMenu username={data.user?.username ?? data.user?.email} isAdmin={data.zapAdmin} onSignOut={signOut} />
    </div>
  </aside>

  <div class="zap-shell-body min-h-0">
    <header class="zap-shell-top">
      {#if isNavigating}
        <div class="zap-nav-progress" aria-hidden="true"></div>
        <span class="sr-only" role="status" aria-live="polite">Loading page…</span>
      {/if}
      <div class="zap-shell-top-inner mx-auto flex max-w-5xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <a href="/home" class="zap-shell-brand flex items-center gap-3" aria-label="Zap home" aria-current={homeActive ? "page" : undefined}>
          <span class="text-xl font-semibold tracking-tight text-foreground">Zap</span>
          <WaveBars />
        </a>
        <div class="zap-shell-nav-links flex flex-wrap items-center gap-2 sm:gap-3">
          {@render primaryNav(false)}
          <SettingsMenu username={data.user?.username ?? data.user?.email} isAdmin={data.zapAdmin} onSignOut={signOut} />
        </div>
      </div>
    </header>
    <main class={`zap-shell-main ${fillViewport ? "is-fill" : ""}`}>
      {#if isNavigating}
        <PageSkeleton title={skeletonTitle} showFilters={skeletonShowFilters} variant={skeletonVariant} />
      {:else}
        {@render children()}
      {/if}
    </main>
  </div>
</div>

<CatalogQueueDock queue={catalogQueue} />
