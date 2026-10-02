<script lang="ts">
  import icon from "$lib/assets/icon.png";

  const { children } = $props();
</script>

<div class="auth-shell forge">
  <div class="auth-frame">
    <div class="notebook">
      <div class="auth-card">
        <div class="auth-grid">
          <div class="auth-page">
            {@render children()}
          </div>
          <div class="auth-art" aria-hidden="true">
            <img src={icon} alt="" />
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

  .notebook {
    position: relative;
  }

  .auth-card {
    position: relative;
    overflow: hidden;
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 2px 6px 4px 2px;
    background: #fffefd;
    box-shadow:
      1px 1px 0 rgba(27, 27, 31, 0.04),
      3px 4px 0 rgba(27, 27, 31, 0.05),
      6px 8px 18px rgba(27, 27, 31, 0.06);
  }

  /* stacked pages peeking under the notebook */
  .auth-card::before,
  .auth-card::after {
    content: "";
    position: absolute;
    inset: auto 0.35rem -0.28rem 0.55rem;
    height: 0.28rem;
    background: #f6f2ea;
    border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
    border-top: none;
    z-index: -1;
  }

  .auth-card::after {
    inset: auto 0.7rem -0.52rem 0.9rem;
    background: #efeae1;
  }

  .auth-grid {
    display: grid;
    padding: 0;
    min-height: 22rem;
  }

  @media (min-width: 768px) {
    .auth-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .auth-page {
    position: relative;
    background-color: #fffefd;
    background-image:
      linear-gradient(
        to right,
        transparent 0,
        transparent 1.85rem,
        color-mix(in srgb, #c45b6a 62%, transparent) 1.85rem,
        color-mix(in srgb, #c45b6a 62%, transparent) calc(1.85rem + 1px),
        transparent calc(1.85rem + 1px)
      ),
      repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgba(90, 130, 180, 0.38) 27px, rgba(90, 130, 180, 0.38) 28px);
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
    background: #fff8e5;
    min-height: 16rem;
    border-left: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
  }

  @media (min-width: 768px) {
    .auth-art {
      display: block;
    }
  }

  .auth-art img {
    position: absolute;
    inset: 8%;
    height: 84%;
    width: 84%;
    object-fit: contain;
    opacity: 1;
  }
</style>
