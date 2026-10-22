<script lang="ts">
  import { page } from "$app/state";

  let { children }: { children: import("svelte").Snippet } = $props();

  const tabs = [
    { href: "/admin", label: "Activity" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/tags", label: "System tags" },
    { href: "/admin/songs", label: "Songs" },
  ] as const;

  const path = $derived(page.url.pathname);
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));
</script>

<section class="flex min-h-0 flex-1 flex-col gap-6">
  <div class="shrink-0">
    <p class="font-mono text-[10px] tracking-[0.18em] text-signal uppercase">Zap admin</p>
    <h1 class="mt-1 text-3xl font-semibold tracking-tight">Admin</h1>
    <nav class="mt-6 flex flex-wrap gap-1 border-b border-border/60 pb-2 font-mono text-[11px]" aria-label="Admin">
      {#each tabs as tab (tab.href)}
        <a
          href={tab.href}
          class={`zap-nav-link ${isActive(tab.href) ? "zap-nav-link-active" : ""}`}
          aria-current={isActive(tab.href) ? "page" : undefined}>{tab.label}</a
        >
      {/each}
    </nav>
  </div>
  <div class="flex min-h-0 flex-1 flex-col">
    {@render children()}
  </div>
</section>
