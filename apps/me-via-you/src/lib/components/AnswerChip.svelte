<script lang="ts">
  import { censorText } from "$lib/censor";

  type Props = {
    text: string;
    count: number;
    expandDetails?: string[];
    variant: "positive" | "negative";
  };

  let { text, count, expandDetails = [], variant }: Props = $props();

  let open = $state(false);

  const censoredExpandDetails = $derived(expandDetails.map((detail) => censorText(detail)).filter(Boolean));
  const hasExpand = $derived(censoredExpandDetails.length > 0);
</script>

<span
  class="relative inline-flex {hasExpand ? 'cursor-default' : ''}"
  onmouseenter={() => {
    if (hasExpand) open = true;
  }}
  onmouseleave={() => (open = false)}
  role={hasExpand ? "group" : undefined}
>
  <span
    class="relative inline-flex items-center rounded-full border px-3 py-1.5 text-sm
      {variant === 'positive' ? 'border-positive/40 bg-positive/10 text-foreground' : 'border-primary/40 bg-primary/10 text-foreground'}
      {open ? (variant === 'positive' ? 'ring-1 ring-positive/40' : 'ring-1 ring-primary/40') : ''}"
  >
    {text}
    {#if count > 1}
      <span
        class="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold
          {variant === 'positive' ? 'bg-positive text-positive-foreground' : 'bg-primary text-primary-foreground'}"
      >
        {count}
      </span>
    {/if}
  </span>

  {#if open && hasExpand}
    <span class="absolute left-0 top-full z-30 block pt-1">
      <span class="block w-64 rounded-lg border border-border bg-popover p-2.5 text-xs leading-relaxed text-popover-foreground shadow-md">
        {#each censoredExpandDetails as detail, index (detail)}
          {#if index > 0}
            <span class="my-2 block border-t border-border"></span>
          {/if}
          {detail}
        {/each}
      </span>
    </span>
  {/if}
</span>
