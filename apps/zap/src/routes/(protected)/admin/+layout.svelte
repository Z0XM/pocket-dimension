<script lang="ts">
  import { page } from "$app/state";
  import ActivityIcon from "@lucide/svelte/icons/activity";
  import HashIcon from "@lucide/svelte/icons/hash";
  import MusicIcon from "@lucide/svelte/icons/music";
  import UsersIcon from "@lucide/svelte/icons/users";
  import PageHeader from "$lib/components/PageHeader.svelte";

  let { children }: { children: import("svelte").Snippet } = $props();

  const tabs = [
    { href: "/admin", label: "Activity", Icon: ActivityIcon },
    { href: "/admin/users", label: "Users", Icon: UsersIcon },
    { href: "/admin/tags", label: "System tags", Icon: HashIcon },
    { href: "/admin/songs", label: "Songs", Icon: MusicIcon },
  ] as const;

  const path = $derived(page.url.pathname);
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));
</script>

<section class="zap-page">
  <PageHeader title="Admin">
    <nav class="flex flex-wrap gap-1 font-mono text-[11px]" aria-label="Admin">
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
