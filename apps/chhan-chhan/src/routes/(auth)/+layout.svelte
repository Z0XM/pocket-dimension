<script lang="ts">
  import icon from "$lib/assets/icon.png";

  const { children } = $props();
</script>

<div class="auth-shell forge">
  <div class="auth-frame">
    <div class="auth-card">
      <div class="auth-grid">
        {@render children()}
        <div class="auth-art" aria-hidden="true">
          <img src={icon} alt="" />
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

  .auth-card {
    overflow: hidden;
    border: 1.5px solid var(--chrome-line);
    background: color-mix(in srgb, var(--paper) 92%, white);
    border-radius: 255px 22px 225px 18px / 22px 225px 18px 255px;
    box-shadow: 2px 3px 0 rgba(27, 27, 31, 0.05);
  }

  .auth-grid {
    display: grid;
    padding: 0;
  }

  @media (min-width: 768px) {
    .auth-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .auth-art {
    position: relative;
    display: none;
    background: color-mix(in srgb, var(--blue) 35%, var(--paper));
    min-height: 16rem;
  }

  @media (min-width: 768px) {
    .auth-art {
      display: block;
    }
  }

  .auth-art img {
    position: absolute;
    inset: 0;
    height: 100%;
    width: 100%;
    object-fit: cover;
    opacity: 0.88;
    mix-blend-mode: multiply;
  }
</style>
