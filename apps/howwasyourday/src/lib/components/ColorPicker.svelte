<script lang="ts">
  let {
    color = $bindable(undefined),
  }: {
    color?: string;
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

  // --- State ---

  let hsv = $state(hexToHsv(color));
  let draggingSV = $state(false);
  let draggingHue = $state(false);
  let svArea: HTMLDivElement;
  let hueBar: HTMLDivElement;

  function updateColor() {
    color = hsvToHex(hsv.h, hsv.s, hsv.v);
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
  $effect(() => {
    if (!color) return;
    const newHsv = hexToHsv(color);
    // Only update if hex actually differs (avoid loops)
    if (hsvToHex(hsv.h, hsv.s, hsv.v) !== color) {
      hsv = newHsv;
    }
  });
</script>

<svelte:window
  onmousemove={handlePointerMove}
  onmouseup={handlePointerUp}
  ontouchmove={handlePointerMove}
  ontouchend={handlePointerUp}
/>

<div class="flex flex-col gap-3 w-full select-none">
  <!-- Saturation/Value area -->
  <div
    bind:this={svArea}
    class="relative w-full aspect-[4/3] rounded-lg cursor-crosshair overflow-hidden border border-border"
    style="background: hsl({hsv.h}, 100%, 50%);"
    role="slider"
    tabindex="0"
    aria-label="Saturation and brightness"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(hsv.s)}
    onmousedown={startSV}
    ontouchstart={startSV}
  >
    <!-- White gradient (left to right) -->
    <div
      class="absolute inset-0"
      style="background: linear-gradient(to right, #fff, transparent);"
    ></div>
    <!-- Black gradient (top to bottom) -->
    <div
      class="absolute inset-0"
      style="background: linear-gradient(to bottom, transparent, #000);"
    ></div>
    <!-- Thumb -->
    <div
      class="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
      style="left: {hsv.s}%; top: {100 -
        hsv.v}%; background: {color}; box-shadow: 0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2);"
    ></div>
  </div>

  <!-- Hue bar -->
  <div
    bind:this={hueBar}
    class="relative w-full h-4 rounded-full cursor-pointer overflow-hidden border border-border"
    style="background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);"
    role="slider"
    tabindex="0"
    aria-label="Hue"
    aria-valuemin={0}
    aria-valuemax={360}
    aria-valuenow={Math.round(hsv.h)}
    onmousedown={startHue}
    ontouchstart={startHue}
  >
    <!-- Hue thumb -->
    <div
      class="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
      style="left: {(hsv.h / 360) *
        100}%; background: hsl({hsv.h}, 100%, 50%); box-shadow: 0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2);"
    ></div>
  </div>

  <!-- Hex input + preview -->
  <!-- <div class="flex items-center gap-2">
    <div
      class="w-8 h-8 rounded-md border border-border shrink-0"
      style="background: {color};"
    ></div>
    <input
      type="text"
      class="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      value={color}
      maxlength={7}
      oninput={(e) => {
        const val = (e.target as HTMLInputElement).value;
        if (/^#[0-9a-f]{6}$/i.test(val)) {
          color = val;
        }
      }}
    />
  </div> -->
</div>
