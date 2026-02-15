<script lang="ts">
  import { onMount } from "svelte";

  let {
    currentDrawing = $bindable(undefined),
    initialDrawing = undefined,
  }: {
    currentDrawing?: string;
    initialDrawing?: string;
  } = $props();

  const COLORS = [
    { hex: "#ffffff", label: "White" },
    { hex: "#eab308", label: "Yellow" },
    { hex: "#ff7e01", label: "Orange" },
    { hex: "#ef4444", label: "Red" },
    { hex: "#22c55e", label: "Green" },
    { hex: "#3b82f6", label: "Blue" },
    { hex: "#fc77fe", label: "Pink" },
    { hex: "#a855f7", label: "Purple" },
  ];

  const BRUSH_SIZES = [2, 4, 8];

  let canvasEl: HTMLCanvasElement;
  let containerEl: HTMLDivElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let isDrawing = $state(false);
  let isEraser = $state(false);
  let drawColor = $state("#ffffff");
  let brushSize = $state(4);
  let collapsed = $state(!initialDrawing);
  let hasDrawn = $state(!!initialDrawing);
  let undoStack: ImageData[] = $state([]);

  // Update the bound drawing output from current canvas state
  function updateDrawingOutput() {
    currentDrawing = hasDrawn ? canvasEl?.toDataURL() || undefined : undefined;
  }

  onMount(() => {
    ctx = canvasEl.getContext("2d", { willReadFrequently: true });

    // Set canvas dimensions
    canvasEl.width = containerEl.clientWidth;
    canvasEl.height = canvasEl.width * 0.6;

    if (initialDrawing) {
      const img = new Image();
      img.onload = () => {
        if (ctx && canvasEl) {
          ctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
          updateDrawingOutput();
        }
      };
      img.src = initialDrawing;
    }

    const handleResize = () => resize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  function resize() {
    if (!canvasEl || !containerEl) return;
    const prevWidth = canvasEl.width;
    const prevHeight = canvasEl.height;
    const existingData = ctx?.getImageData(0, 0, prevWidth, prevHeight);

    canvasEl.width = containerEl.clientWidth;
    canvasEl.height = canvasEl.width * 0.6;

    if (existingData && ctx) {
      // Create a temp canvas to scale the old content to the new size
      const tmp = document.createElement("canvas");
      tmp.width = prevWidth;
      tmp.height = prevHeight;
      tmp.getContext("2d")?.putImageData(existingData, 0, 0);
      ctx.drawImage(tmp, 0, 0, canvasEl.width, canvasEl.height);
    }
  }

  function saveUndo() {
    if (ctx && canvasEl) {
      const data = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
      undoStack = [...undoStack.slice(-19), data]; // keep last 20
    }
  }

  function undo() {
    if (ctx && canvasEl && undoStack.length > 0) {
      const prev = undoStack[undoStack.length - 1];
      undoStack = undoStack.slice(0, -1);
      ctx.putImageData(prev, 0, 0);
      updateDrawingOutput();
    }
  }

  function getOffset(e: MouseEvent | TouchEvent, el: HTMLCanvasElement): { x: number; y: number } {
    const rect = el.getBoundingClientRect();
    if ("touches" in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    const me = e as MouseEvent;
    return { x: me.clientX - rect.left, y: me.clientY - rect.top };
  }

  function onDown(e: MouseEvent | TouchEvent) {
    if (!ctx) return;

    saveUndo();
    hasDrawn = true;
    isDrawing = true;

    const { x, y } = getOffset(e, canvasEl);

    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (isEraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = brushSize * 3;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = brushSize;
    }

    ctx.moveTo(x, y);
  }

  function onMove(e: MouseEvent | TouchEvent) {
    if (!isDrawing || !ctx) return;

    const { x, y } = getOffset(e, canvasEl);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (isEraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = brushSize * 3;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = brushSize;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function onUp() {
    if (isDrawing) {
      isDrawing = false;
      updateDrawingOutput();
    }
  }

  function clearCanvas() {
    if (ctx && canvasEl) {
      saveUndo();
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      ctx.beginPath();
      hasDrawn = false;
      updateDrawingOutput();
    }
  }

  function selectColor(hex: string) {
    isEraser = false;
    drawColor = hex;
  }
</script>

<svelte:window onmouseup={onUp} ontouchend={onUp} />

<div bind:this={containerEl} class="relative col-span-8 flex w-full flex-col justify-center gap-2">
  <!-- Toggle button -->
  <button
    type="button"
    class="flex w-full cursor-pointer items-center justify-between rounded-lg bg-card border border-primary/10 px-4 py-2 text-sm hover:bg-primary/10 transition-colors"
    onclick={() => (collapsed = !collapsed)}
  >
    <span>Draw your day?</span>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 256 256"
      fill="currentColor"
      class="transition-transform duration-200"
      style:transform={collapsed ? "rotate(0deg)" : "rotate(180deg)"}
    >
      <path
        d="M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48a8,8,0,0,0,11.32,11.32Z"
      />
    </svg>
  </button>

  <div class="relative w-full rounded-lg ring-2 ring-primary/15" style="display: {collapsed ? 'none' : 'block'};">
    <!-- Canvas -->
    <canvas
      bind:this={canvasEl}
      class="relative touch-none cursor-crosshair"
      onmousedown={onDown}
      onmousemove={onMove}
      ontouchstart={(e) => {
        e.preventDefault();
        onDown(e);
      }}
      ontouchmove={(e) => {
        e.preventDefault();
        onMove(e);
      }}
    ></canvas>

    <!-- Right-side color palette -->
    <div class="z-[1] flex w-full flex-col items-center border-t border-primary/15 justify-center lg:flex-row gap-1.5 py-2">
      <div class="flex flex-row gap-1.5">
        {#each COLORS as { hex, label }}
          <button
            type="button"
            class="h-7 w-7 cursor-pointer rounded-sm transition-transform duration-200 hover:scale-110 lg:h-8 lg:w-8"
            class:ring-2={!isEraser && drawColor === hex}
            class:ring-primary={!isEraser && drawColor === hex}
            style="background-color: {hex};"
            aria-label={label}
            onclick={() => selectColor(hex)}
          ></button>
        {/each}
      </div>

      <!-- Separator -->
      <!-- <div class="row-span-2 my-1 h-px bg-white/20 xl:row-span-1"></div> -->

      <div class="flex flex-row gap-1.5">
        <!-- Brush size buttons -->
        {#each BRUSH_SIZES as size}
          <button
            type="button"
            class="flex h-7 w-7 cursor-pointer items-center justify-center transition-transform duration-200 hover:scale-110 lg:h-8 lg:w-8"
            class:text-primary={brushSize === size && !isEraser}
            class:text-muted-foreground={brushSize !== size || isEraser}
            aria-label="Brush size {size}"
            onclick={() => {
              brushSize = size;
              isEraser = false;
            }}
          >
            <div class="rounded-full bg-current" style="width: {size + 4}px; height: {size + 4}px;"></div>
          </button>
        {/each}

        <!-- Separator -->
        <!-- <div class="row-span-2 my-1 h-px bg-white/20 xl:row-span-1"></div> -->

        <!-- Eraser -->
        <!-- <div class="row-span-2 flex items-center justify-center xl:row-span-1"> -->
        <button
          type="button"
          class="flex h-7 w-7 cursor-pointer items-center justify-center transition-all duration-200 hover:scale-110 hover:text-primary lg:h-8 lg:w-8"
          class:text-primary={isEraser}
          class:text-muted-foreground={!isEraser}
          aria-label="Eraser"
          onclick={() => (isEraser = !isEraser)}
        >
          <!-- Eraser icon -->
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 256 256" fill="currentColor">
            <path
              d="M225,80.4,183.6,39a24,24,0,0,0-33.94,0L31,157.66a24,24,0,0,0,0,33.94l30.06,30.06A8,8,0,0,0,66.74,224H216a8,8,0,0,0,0-16h-84.7L225,114.34A24,24,0,0,0,225,80.4ZM213.67,103,160,156.69,107.31,104,161,50.34a8,8,0,0,1,11.32,0l41.38,41.38A8,8,0,0,1,213.67,103Z"
            />
          </svg>
        </button>
        <!-- </div> -->

        <!-- Undo -->
        <!-- <div class="row-span-2 flex items-center justify-center xl:row-span-1"> -->
        <button
          type="button"
          class="flex h-7 w-7 cursor-pointer items-center justify-center text-muted-foreground transition-all duration-200 hover:scale-110 hover:text-primary lg:h-8 lg:w-8 disabled:opacity-30 disabled:hover:scale-100 disabled:hover:text-muted-foreground"
          aria-label="Undo"
          disabled={undoStack.length === 0}
          onclick={undo}
        >
          <!-- Undo icon -->
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 256 256" fill="currentColor">
            <path
              d="M232,200a8,8,0,0,1-16,0,88.1,88.1,0,0,0-88-88H51.31l34.35,34.34a8,8,0,0,1-11.32,11.32l-48-48a8,8,0,0,1,0-11.32l48-48A8,8,0,0,1,85.66,61.66L51.31,96H128A104.11,104.11,0,0,1,232,200Z"
            />
          </svg>
        </button>
        <!-- </div> -->

        <!-- Clear all -->
        <!-- <div class="row-span-2 flex items-center justify-center xl:row-span-1"> -->
        <button
          type="button"
          class="flex h-7 w-7 cursor-pointer items-center justify-center text-muted-foreground transition-all duration-200 hover:scale-110 hover:text-destructive lg:h-8 lg:w-8"
          aria-label="Clear canvas"
          onclick={clearCanvas}
        >
          <!-- Trash icon -->
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 256 256" fill="currentColor">
            <path
              d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"
            />
          </svg>
        </button>
      </div>
      <!-- </div> -->
    </div>
  </div>
</div>
