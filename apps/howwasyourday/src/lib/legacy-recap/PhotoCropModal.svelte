<script lang="ts">
  import { onDestroy } from "svelte";
  import Cropper from "cropperjs";
  import "cropperjs/dist/cropper.css";

  type Props = {
    open: boolean;
    /** Object URL or data URL of the source image. */
    src: string;
    personLabel: string;
    /** Face aspect (width / height). ~0.95 for polaroid face above name. */
    aspectRatio?: number;
    onconfirm: (croppedObjectUrl: string) => void;
    oncancel: () => void;
  };

  let { open, src, personLabel, aspectRatio = 0.95, onconfirm, oncancel }: Props = $props();

  let imgEl = $state<HTMLImageElement | null>(null);
  let cropper: Cropper | null = null;
  let busy = $state(false);
  let alive = true;

  function destroyCropper() {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
  }

  function initCropper(el: HTMLImageElement) {
    destroyCropper();
    cropper = new Cropper(el, {
      aspectRatio,
      viewMode: 1,
      dragMode: "move",
      autoCropArea: 0.9,
      responsive: true,
      background: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
    });
  }

  $effect(() => {
    if (!open || !src || !imgEl) {
      destroyCropper();
      return;
    }
    const el = imgEl;
    const ready = () => {
      if (el.naturalWidth <= 0) {
        oncancel();
        return;
      }
      initCropper(el);
    };
    const onError = () => oncancel();
    if (el.complete) {
      if (el.naturalWidth > 0) ready();
      else onError();
    } else {
      el.addEventListener("load", ready, { once: true });
      el.addEventListener("error", onError, { once: true });
    }
    return () => {
      el.removeEventListener("load", ready);
      el.removeEventListener("error", onError);
      destroyCropper();
    };
  });

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) oncancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  onDestroy(() => {
    alive = false;
    destroyCropper();
  });

  function confirm() {
    if (!cropper || busy) return;
    busy = true;
    try {
      const canvas = cropper.getCroppedCanvas({
        maxWidth: 1024,
        maxHeight: 1024,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
        fillColor: "#fbfaf7",
      });
      if (!canvas) {
        busy = false;
        oncancel();
        return;
      }
      canvas.toBlob(
        (blob) => {
          if (!alive) {
            if (blob) {
              /* discard */
            }
            return;
          }
          busy = false;
          if (!blob) {
            oncancel();
            return;
          }
          onconfirm(URL.createObjectURL(blob));
        },
        "image/jpeg",
        0.92
      );
    } catch {
      busy = false;
      oncancel();
    }
  }
</script>

{#if open}
  <div class="overlay" role="dialog" aria-modal="true" aria-label="Crop photo for {personLabel}">
    <div class="sheet">
      <header class="head">
        <h3>Photo for {personLabel}</h3>
        <p>Drag to move · pinch/scroll to zoom · resize the crop box</p>
      </header>
      <div class="stage">
        <img bind:this={imgEl} {src} alt="Crop preview" />
      </div>
      <footer class="foot">
        <button type="button" class="btn" onclick={oncancel} disabled={busy}>Cancel</button>
        <button type="button" class="btn primary" onclick={confirm} disabled={busy}>
          {busy ? "Saving…" : "Use photo"}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: color-mix(in srgb, var(--ink, #1a1f1c) 55%, transparent);
  }

  .sheet {
    display: flex;
    flex-direction: column;
    width: min(36rem, 100%);
    max-height: min(92vh, 40rem);
    overflow: hidden;
    border-radius: 0.75rem;
    background: #fbfaf7;
    border: 1px solid color-mix(in srgb, var(--ink, #1a1f1c) 14%, transparent);
    box-shadow: 0 18px 48px color-mix(in srgb, var(--ink, #1a1f1c) 28%, transparent);
  }

  .head {
    padding: 0.85rem 1rem 0.55rem;
  }

  .head h3 {
    margin: 0;
    font-family: var(--display, Georgia, serif);
    font-size: 1.15rem;
    font-weight: 500;
    color: var(--ink, #1a1f1c);
  }

  .head p {
    margin: 0.25rem 0 0;
    font-size: 0.78rem;
    color: color-mix(in srgb, var(--ink, #1a1f1c) 55%, transparent);
  }

  .stage {
    flex: 1 1 auto;
    min-height: 14rem;
    max-height: 28rem;
    background: #1a1f1c;
  }

  .stage :global(.cropper-container) {
    max-height: 28rem;
  }

  .stage img {
    display: block;
    max-width: 100%;
  }

  .foot {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.75rem 1rem 1rem;
  }

  .btn {
    padding: 0.45rem 0.9rem;
    border: 1px solid color-mix(in srgb, var(--ink, #1a1f1c) 16%, transparent);
    border-radius: 0.5rem;
    background: color-mix(in srgb, white 75%, transparent);
    color: var(--ink-soft, #3a403c);
    font-family: var(--sans, system-ui, sans-serif);
    font-size: 0.85rem;
    cursor: pointer;
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn.primary {
    border-color: color-mix(in srgb, var(--accent, #214247) 45%, transparent);
    background: color-mix(in srgb, var(--accent, #214247) 12%, white);
    color: var(--accent, #214247);
  }
</style>
