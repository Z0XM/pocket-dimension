<script lang="ts">
  import UserMenu from "$lib/components/UserMenu.svelte";
  import type { LayoutData } from "../$types";

  const { data, children }: { data: LayoutData; children: import("svelte").Snippet } = $props();
</script>

<div class="relative min-h-screen overflow-hidden">
  <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,245,240,0.04),transparent_60%)]"></div>

  <div class="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
    {#if data.user?.email}
      <div class="absolute top-10 right-4 z-20 sm:right-6 lg:right-8">
        <UserMenu email={data.user.email} username={data.user.username} isAdmin={data.user.role === "admin"} />
      </div>
    {/if}

    {@render children()}
  </div>
</div>
