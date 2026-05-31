<script lang="ts">
  type Props = {
    name: string;
    valueLabel: string;
    pct: number;
    color: string;
    meta?: string;
  };

  const { name, valueLabel, pct, color, meta }: Props = $props();
</script>

<div class="meter">
  <div class="meter-top">
    <span>{name}</span>
    <span>{valueLabel}</span>
  </div>
  <div class="track">
    <div class="fill" style="width:{pct}%; background:{color}"></div>
  </div>
  {#if meta}
    <p class="meter-meta dim">{meta}</p>
  {/if}
</div>

<style>
  .meter-meta {
    margin: 0.35rem 0 0;
    font-size: 0.68rem;
    line-height: 1.35;
  }
</style>
