<script lang="ts">
  import AppShell from "$lib/components/app-shell.svelte";
  import type { LayoutTreeData } from "$lib/types";

  let { children, data }: { children: import("svelte").Snippet; data: LayoutTreeData } = $props();
</script>

<AppShell trees={data.trees} tree={data.tree} bmadRootError={data.bmadRootError}>
  {@render children()}
</AppShell>
