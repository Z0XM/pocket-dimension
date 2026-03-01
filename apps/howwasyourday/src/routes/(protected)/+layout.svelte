<script lang="ts">
  import HelloUser from "$lib/components/HelloUser.svelte";
  import NotificationPrompt from "$lib/components/NotificationPrompt.svelte";
  import type { LayoutData } from "./$types";

  const { data, children }: { data: LayoutData; children: import("svelte").Snippet } = $props();
</script>

<div class="flex w-full items-center justify-center py-6 md:px-10">
  <div class="mx-4 flex flex-col gap-4 md:w-1/2">
    <HelloUser />
    <NotificationPrompt />
    {@render children()}
  </div>
</div>
