<script lang="ts">
  import type { AiAnalysisBody } from "./ai-analysis-types";

  type Props = {
    analysis: AiAnalysisBody;
  };

  let { analysis }: Props = $props();
</script>

<section class="ai-panel" aria-label="A note on your year, AI-generated">
  <div class="panel-head">
    <h2>A note on your year</h2>
    <span class="ai-tag">AI-generated</span>
  </div>

  <p class="headline">{analysis.headline}</p>
  <p class="reflection">{analysis.reflection}</p>

  {#if analysis.themes?.length}
    <ul class="themes" aria-label="Themes">
      {#each analysis.themes as theme}
        <li>{theme}</li>
      {/each}
    </ul>
  {/if}

  {#if analysis.disclaimers?.length}
    <p class="disclaimer">{analysis.disclaimers.join(" · ")}</p>
  {/if}
</section>

<style>
  .ai-panel {
    width: 100%;
    max-width: 36rem;
    margin-bottom: 3rem;
  }

  .panel-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.55rem 0.75rem;
    margin-bottom: 0.75rem;
  }

  .panel-head h2 {
    margin: 0;
    font-family: var(--display);
    font-size: 1.45rem;
    font-weight: 500;
    color: var(--ink);
  }

  .ai-tag {
    font-family: var(--sans);
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-mute);
    border: 1px solid color-mix(in srgb, var(--ink-mute) 45%, transparent);
    padding: 0.15rem 0.45rem;
  }

  .headline {
    margin: 0 0 0.85rem;
    font-family: var(--display);
    font-size: clamp(1.2rem, 2.6vw, 1.45rem);
    font-weight: 500;
    line-height: 1.3;
    color: var(--accent);
  }

  .reflection {
    margin: 0;
    color: var(--ink-soft);
    font-size: 1.02rem;
    line-height: 1.55;
  }

  .themes {
    list-style: none;
    margin: 1.15rem 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.55rem;
  }

  .themes li {
    font-family: var(--sans);
    font-size: 0.86rem;
    color: var(--ink);
    border-bottom: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    padding: 0.05rem 0;
  }

  .disclaimer {
    margin: 1rem 0 0;
    font-size: 0.76rem;
    color: var(--ink-mute);
    line-height: 1.4;
  }
</style>
