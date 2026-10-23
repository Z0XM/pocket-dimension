<script lang="ts">
  import { page } from "$app/state";
  import ClapperboardIcon from "@lucide/svelte/icons/clapperboard";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import UploadIcon from "@lucide/svelte/icons/upload";
  import PageHeader from "$lib/components/PageHeader.svelte";

  let { children }: { children: import("svelte").Snippet } = $props();

  const tabs = [
    { href: "/history", label: "Catalog Views", Icon: ClapperboardIcon },
    { href: "/history/plays", label: "Play History", Icon: HistoryIcon },
    { href: "/history/uploads", label: "Uploads and Imports", Icon: UploadIcon },
  ] as const;

  const path = $derived(page.url.pathname);
  const isActive = (href: string) => (href === "/history" ? path === "/history" : path === href || path.startsWith(`${href}/`));
</script>

<section class="zap-page">
  <PageHeader title="History">
    <nav class="flex flex-wrap gap-1 font-mono text-[11px]" aria-label="History">
      {#each tabs as tab (tab.href)}
        <a
          href={tab.href}
          class={`zap-nav-link inline-flex items-center gap-1.5 ${isActive(tab.href) ? "zap-nav-link-active" : ""}`}
          aria-current={isActive(tab.href) ? "page" : undefined}
        >
          <tab.Icon class="size-3.5 shrink-0" aria-hidden="true" />
          {tab.label}
        </a>
      {/each}
    </nav>
  </PageHeader>
  <div class="flex min-h-0 flex-1 flex-col">
    {@render children()}
  </div>
</section>
