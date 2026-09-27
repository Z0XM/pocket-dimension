<script lang="ts">
  import type { CountItem } from "./types";

  type Props = {
    items: CountItem[];
    kind?: "emoji" | "color" | "text";
  };

  let { items, kind = "text" }: Props = $props();
</script>

{#if items.length}
  <ul class="freq" data-kind={kind}>
    {#each items as item}
      <li style={kind === "color" ? `--swatch: ${item.label}` : undefined}>
        {#if kind === "color"}
          <span class="swatch" aria-hidden="true"></span>
          <code>{item.label}</code>
        {:else if kind === "emoji"}
          <span class="emoji">{item.label}</span>
        {:else}
          <span class="label">{item.label}</span>
        {/if}
        <span class="count">×{item.count}</span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .freq {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  li {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.7rem;
    background: color-mix(in srgb, var(--accent) 8%, white);
    border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
    font-size: 0.92rem;
  }

  .emoji {
    font-size: 1.25rem;
    line-height: 1;
  }

  .label {
    font-family: var(--display);
    font-weight: 500;
  }

  .swatch {
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 50%;
    background: var(--swatch);
    border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
  }

  code {
    font-size: 0.78rem;
    color: var(--ink-soft);
  }

  .count {
    font-size: 0.78rem;
    color: var(--ink-mute);
    font-variant-numeric: tabular-nums;
  }
</style>
