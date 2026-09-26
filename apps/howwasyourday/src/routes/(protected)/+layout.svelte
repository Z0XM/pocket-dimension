<script lang="ts">
  import HelloUser from "$lib/components/HelloUser.svelte";
  import NotificationPrompt from "$lib/components/NotificationPrompt.svelte";
  import type { LayoutData } from "./$types";

  const { data, children }: { data: LayoutData; children: import("svelte").Snippet } = $props();
</script>

<div class="flex w-full items-center justify-center px-0 py-8 md:px-10 md:py-12">
  <div class="mx-4 flex w-full max-w-xl flex-col gap-5 md:mx-0">
    <HelloUser />
    <NotificationPrompt />
    {@render children()}
  </div>
</div>
