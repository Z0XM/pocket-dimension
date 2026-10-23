<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    crumb,
    meta,
    actions,
    children,
  }: {
    title: string;
    /** Optional nav crumb above the title (e.g. back to list). */
    crumb?: Snippet;
    /** Compact status / count line under the title — not a marketing subtitle. */
    meta?: Snippet;
    actions?: Snippet;
    /** Tabs or secondary chrome below the title row. */
    children?: Snippet;
  } = $props();
</script>

<header class="zap-page-header">
  {#if crumb}
    <div class="mb-2 font-mono text-[10px] text-muted-foreground">
      {@render crumb()}
    </div>
  {/if}
  <div class="zap-page-header-row">
    <div class="min-w-0">
      <h1 class="zap-page-title">{title}</h1>
      {#if meta}
        <div class="mt-2 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          {@render meta()}
        </div>
      {/if}
    </div>
    {#if actions}
      <div class="zap-page-actions">
        {@render actions()}
      </div>
    {/if}
  </div>
  {#if children}
    <div class="zap-page-tabs">
      {@render children()}
    </div>
  {/if}
</header>
