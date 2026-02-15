<script lang="ts">
  let {
    color = $bindable(undefined),
    hueOnly = false,
  }: {
    color?: string;
    hueOnly?: boolean;
  } = $props();

  // --- Color conversion helpers ---

  function hexToHsv(hex?: string): { h: number; s: number; v: number } {
    if (!hex) return { h: 0, s: 0, v: 100 };
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 0, s: 0, v: 100 };
    const r = parseInt(result[1], 16) / 255;
    const g = parseInt(result[2], 16) / 255;
    const b = parseInt(result[3], 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    const s = max === 0 ? 0 : d / max;
    return { h: h * 360, s: s * 100, v: max * 100 };
  }

  function hsvToHex(h: number, s: number, v: number): string {
    s /= 100;
    v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0,
      g = 0,
      b = 0;
    if (h < 60) {
      r = c;
      g = x;
    } else if (h < 120) {
      r = x;
      g = c;
    } else if (h < 180) {
      g = c;
      b = x;
    } else if (h < 240) {
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }
    const toHex = (n: number) =>
      Math.round((n + m) * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function hsvToHsl(h: number, s: number, v: number): string {
    s /= 100;
    v /= 100;
    const l = v * (1 - s / 2);
    const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
    return `hsl(${Math.round(h)}, ${Math.round(sl * 100)}%, ${Math.round(l * 100)}%)`;
  }

  // --- State ---

  let hsv = $state(hexToHsv(color));
  let draggingSV = $state(false);
  let draggingHue = $state(false);
  let svArea: HTMLDivElement;
  let hueBar: HTMLDivElement;

  function updateColor() {
    const s = hueOnly ? 100 : hsv.s;
    const v = hueOnly ? 50 : hsv.v;
    const newHex = hsvToHex(hsv.h, s, v);
    lastSetColor = newHex;
    color = newHex;
  }

  // --- Saturation/Value area ---

  function handleSV(e: MouseEvent | TouchEvent) {
    if (!svArea) return;
    const rect = svArea.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    hsv.s = (x / rect.width) * 100;
    hsv.v = 100 - (y / rect.height) * 100;
    updateColor();
  }

  function startSV(e: MouseEvent | TouchEvent) {
    draggingSV = true;
    handleSV(e);
  }

  // --- Hue bar ---

  function handleHue(e: MouseEvent | TouchEvent) {
    if (!hueBar) return;
    const rect = hueBar.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    hsv.h = (x / rect.width) * 360;
    updateColor();
  }

  function startHue(e: MouseEvent | TouchEvent) {
    draggingHue = true;
    handleHue(e);
  }

  // --- Global pointer move/up ---

  function handlePointerMove(e: MouseEvent | TouchEvent) {
    if (draggingSV) handleSV(e);
    if (draggingHue) handleHue(e);
  }

  function handlePointerUp() {
    draggingSV = false;
    draggingHue = false;
  }

  // Keep hsv in sync if color prop changes externally
  // Track the last color we set ourselves to avoid re-entrancy
  let lastSetColor = $state(color);

  $effect(() => {
    if (!color) return;
    // Only update hsv if the color was changed externally (not by us)
    if (color !== lastSetColor) {
      hsv = hexToHsv(color);
      lastSetColor = color;
    }
  });
</script>

<svelte:window onmousemove={handlePointerMove} onmouseup={handlePointerUp} ontouchmove={handlePointerMove} ontouchend={handlePointerUp} />

<div class="colorful" class:colorful--hue-only={hueOnly}>
  {#if !hueOnly}
    <!-- Saturation/Value area -->
    <div class="colorful__saturation" style="background-color: hsl({Math.round(hsv.h)}, 100%, 50%);">
      <div
        bind:this={svArea}
        class="colorful__interactive"
        role="slider"
        tabindex="0"
        aria-label="Color"
        aria-valuenow={Math.round(hsv.s)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext="Saturation {Math.round(hsv.s)}%, Brightness {Math.round(hsv.v)}%"
        onmousedown={startSV}
        ontouchstart={startSV}
      >
        <!-- Saturation pointer -->
        <div class="colorful__pointer colorful__saturation-pointer" style="top: {100 - hsv.v}%; left: {hsv.s}%;">
          <div class="colorful__pointer-fill" style="background-color: {color ?? '#ffffff'};"></div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Hue bar -->
  <div class="colorful__hue" class:colorful__last-control={!hueOnly} class:colorful__hue--standalone={hueOnly}>
    <div
      bind:this={hueBar}
      class="colorful__interactive"
      role="slider"
      tabindex="0"
      aria-label="Hue"
      aria-valuenow={Math.round(hsv.h)}
      aria-valuemax={360}
      aria-valuemin={0}
      onmousedown={startHue}
      ontouchstart={startHue}
    >
      <!-- Hue pointer -->
      <div class="colorful__pointer colorful__hue-pointer" style="top: 50%; left: {(hsv.h / 360) * 100}%;">
        <div class="colorful__pointer-fill" style="background-color: hsl({Math.round(hsv.h)}, 100%, 50%);"></div>
      </div>
    </div>
  </div>
</div>

<style>
  .colorful {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    aspect-ratio: 1 / 1;
    max-width: 280px;
    user-select: none;
    cursor: default;
  }

  .colorful--hue-only {
    aspect-ratio: unset;
  }

  .colorful__hue--standalone {
    border-radius: 12px;
    height: 32px;
  }

  .colorful__saturation {
    position: relative;
    flex-grow: 1;
    border-color: transparent;
    border-bottom: 12px solid #000;
    border-radius: 12px 12px 0 0;
    background-image: linear-gradient(to top, #000, rgba(0, 0, 0, 0)), linear-gradient(to right, #fff, rgba(255, 255, 255, 0));
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
  }

  .colorful__hue {
    position: relative;
    height: 28px;
    background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
  }

  .colorful__last-control {
    border-radius: 0 0 12px 12px;
  }

  .colorful__interactive {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    border-radius: inherit;
    outline: none;
    touch-action: none;
  }

  .colorful__pointer {
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
    width: 28px;
    height: 28px;
    transform: translate(-50%, -50%);
    background-color: #fff;
    border: 2px solid #fff;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: transform 0.1s ease;
  }

  .colorful__pointer-fill {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    border-radius: inherit;
  }

  .colorful__interactive:focus .colorful__pointer {
    transform: translate(-50%, -50%) scale(1.1);
  }

  .colorful__saturation-pointer {
    z-index: 3;
  }

  .colorful__hue-pointer {
    z-index: 2;
  }
</style>
