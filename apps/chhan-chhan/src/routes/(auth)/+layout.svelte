<script lang="ts">
  import BrandMark from "$lib/components/brand-mark.svelte";
  import ThemeToggle from "$lib/components/theme-toggle.svelte";

  const { children } = $props();
</script>

<div class="auth-shell forge">
  <div class="auth-frame">
    <div class="auth-toolbar">
      <ThemeToggle />
    </div>
    <div class="notebook">
      <div class="auth-card">
        <div class="auth-grid">
          <div class="auth-page">
            {@render children()}
          </div>
          <div class="auth-art" aria-hidden="true">
            <BrandMark size={280} variant="auth" />
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .auth-shell {
    display: flex;
    min-height: 100svh;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .auth-frame {
    width: 100%;
    max-width: 56rem;
  }

  .auth-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.65rem;
  }

  .notebook {
    position: relative;
  }

  .auth-card {
    position: relative;
    overflow: hidden;
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 2px 6px 4px 2px;
    background: var(--paper);
    box-shadow:
      1px 1px 0 color-mix(in srgb, var(--ink) 4%, transparent),
      3px 4px 0 color-mix(in srgb, var(--ink) 5%, transparent),
      6px 8px 18px color-mix(in srgb, var(--ink) 6%, transparent);
  }

  /* stacked pages peeking under the notebook */
  .auth-card::before,
  .auth-card::after {
    content: "";
    position: absolute;
    inset: auto 0.35rem -0.28rem 0.55rem;
    height: 0.28rem;
    background: color-mix(in srgb, var(--paper) 70%, var(--mix-wash));
    border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
    border-top: none;
    z-index: -1;
  }

  .auth-card::after {
    inset: auto 0.7rem -0.52rem 0.9rem;
    background: color-mix(in srgb, var(--paper) 55%, var(--mix-wash));
  }

  .auth-grid {
    display: grid;
    padding: 0;
    min-height: 22rem;
    align-items: stretch;
  }

  .auth-page {
    position: relative;
    background-color: var(--paper);
    background-image:
      linear-gradient(
        to right,
        transparent 0,
        transparent 1.85rem,
        color-mix(in srgb, var(--danger) 62%, transparent) 1.85rem,
        color-mix(in srgb, var(--danger) 62%, transparent) calc(1.85rem + 1px),
        transparent calc(1.85rem + 1px)
      ),
      repeating-linear-gradient(
        to bottom,
        transparent 0,
        transparent 27px,
        color-mix(in srgb, var(--blue) 45%, transparent) 27px,
        color-mix(in srgb, var(--blue) 45%, transparent) 28px
      );
    background-position: 0 0.85rem;
    padding-left: 0.35rem;
  }

  .auth-page :global(form) {
    position: relative;
    z-index: 1;
  }

  .auth-art {
    position: relative;
    display: none;
    /* Match icon.png circle fill (#fff8e5) so the mark blends into the panel */
    background: #fff8e5;
    min-height: 16rem;
    border-left: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
  }

  /* Match icon-dark.png circle fill (#060b0f) so the mark blends into the panel */
  :global(html[data-theme="dark"]) .auth-art {
    background: #060b0f;
  }

  @media (min-width: 768px) {
    .auth-grid {
      grid-template-columns: 1fr 1fr;
    }

    .auth-art {
      display: grid;
      place-items: center;
      min-height: 0;
      align-self: stretch;
    }
  }
</style>
