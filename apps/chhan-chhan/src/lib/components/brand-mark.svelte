<script lang="ts">
  import icon from "$lib/assets/icon.png";
  import iconDark from "$lib/assets/icon-dark.png";

  type Props = {
    size?: number;
    class?: string;
    /** Disable the default doodle tilt (auth panel, etc.) */
    flat?: boolean;
    /** Large centered mark for auth art panel */
    variant?: "default" | "auth";
  };

  const { size = 44, class: className = "", flat = false, variant = "default" }: Props = $props();
</script>

<span class="brand-mark {className}" class:flat class:auth={variant === "auth"} aria-hidden="true">
  <img class="brand-mark-light" src={icon} alt="" width={size} height={size} />
  <img class="brand-mark-dark" src={iconDark} alt="" width={size} height={size} />
</span>

<style>
  .brand-mark {
    position: relative;
    display: inline-grid;
    place-items: center;
    flex: none;
    width: clamp(1.85rem, 4.2vw, 2.45rem);
    height: clamp(1.85rem, 4.2vw, 2.45rem);
    aspect-ratio: 1;
    transform: rotate(-5deg);
  }

  .brand-mark.flat,
  .brand-mark.auth {
    transform: none;
  }

  .brand-mark.auth {
    width: min(15rem, 68%);
    height: min(15rem, 68%);
    max-width: 15rem;
    max-height: 15rem;
    aspect-ratio: 1;
  }

  .brand-mark.auth img {
    /* crop residual square/asset rim so the coin sits clean on the panel */
    clip-path: circle(49.5%);
  }

  .brand-mark img {
    grid-area: 1 / 1;
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
  }

  .brand-mark-dark {
    opacity: 0;
  }

  :global(html[data-theme="dark"]) .brand-mark-light {
    opacity: 0;
  }

  :global(html[data-theme="dark"]) .brand-mark-dark {
    opacity: 1;
  }
</style>
