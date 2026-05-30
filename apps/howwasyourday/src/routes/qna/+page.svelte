<script lang="ts">
  import { onMount } from "svelte";
  import { ChevronLeftIcon, ChevronRightIcon, Maximize2Icon, SearchIcon, ShuffleIcon, SparklesIcon, XIcon } from "@lucide/svelte";
  import { Input } from "$components/ui/input/index.js";
  import { cn } from "$lib/utils";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  let query = $state("");
  let spotlightId = $state<number | null>(null);
  let popupOpen = $state(false);
  let popupIndex = $state(0);

  const filtered = $derived(
    data.questions.filter((item) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return item.question.toLowerCase().includes(q) || String(item.id).includes(q);
    })
  );

  const currentPopupQuestion = $derived(filtered[popupIndex] ?? null);

  function openPopup(index = 0) {
    if (filtered.length === 0) return;
    popupIndex = Math.min(Math.max(index, 0), filtered.length - 1);
    popupOpen = true;
  }

  function openPopupForId(id: number) {
    const index = filtered.findIndex((item) => item.id === id);
    openPopup(index >= 0 ? index : 0);
  }

  function closePopup() {
    popupOpen = false;
  }

  function goPrev() {
    if (popupIndex > 0) popupIndex -= 1;
  }

  function goNext() {
    if (popupIndex < filtered.length - 1) popupIndex += 1;
  }

  function pickRandom() {
    const pool = filtered.length > 0 ? filtered : data.questions;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    spotlightId = pick.id;
    document.getElementById(`qna-${pick.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function pickRandomPopup() {
    if (filtered.length === 0) return;
    let next = Math.floor(Math.random() * filtered.length);
    if (filtered.length > 1 && next === popupIndex) {
      next = (next + 1) % filtered.length;
    }
    popupIndex = next;
  }

  onMount(() => {
    function onKeydown(e: KeyboardEvent) {
      if (!popupOpen) return;
      if (e.key === "Escape") closePopup();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "r" || e.key === "R") pickRandomPopup();
    }

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });

  $effect(() => {
    if (popupOpen && filtered.length === 0) {
      popupOpen = false;
    } else if (popupOpen && popupIndex >= filtered.length) {
      popupIndex = Math.max(0, filtered.length - 1);
    }
  });
</script>

<svelte:head>
  <title>Daily Questions · How Was Your Day</title>
  <meta name="description" content="174 daily reflection questions for How Was Your Day — browse, search, or pick one at random." />
</svelte:head>

<div class="relative min-h-svh overflow-hidden">
  <div
    aria-hidden="true"
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.18),transparent)]"
  ></div>
  <div aria-hidden="true" class="pointer-events-none absolute -right-24 top-32 h-72 w-72 rounded-full bg-primary/10 blur-3xl"></div>
  <div aria-hidden="true" class="pointer-events-none absolute -left-24 bottom-24 h-64 w-64 rounded-full bg-primary/5 blur-3xl"></div>

  <div class="relative mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
    <header class="mb-10 text-center">
      <div
        class="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium tracking-wide text-primary uppercase"
      >
        <SparklesIcon class="size-3.5" />
        Daily prompts
      </div>
      <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Questions</h1>
      <p class="text-muted-foreground mx-auto mt-3 max-w-lg text-sm leading-relaxed sm:text-base">
        {data.questions.length} questions to reflect on your day. Search the list or shuffle for a random one.
      </p>
    </header>

    <div class="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="relative flex-1">
        <SearchIcon class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input type="search" placeholder="Search by text or number…" bind:value={query} class="border-border/60 bg-card/60 pl-9 backdrop-blur-sm" />
      </div>
      <button
        type="button"
        onclick={() => openPopup(0)}
        disabled={filtered.length === 0}
        class="border-border/60 bg-card/60 text-foreground hover:bg-accent inline-flex shrink-0 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium backdrop-blur-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        <Maximize2Icon class="size-4" />
        Popup
      </button>
      <button
        type="button"
        onclick={pickRandom}
        class="border-border/60 bg-card/60 text-foreground hover:bg-accent inline-flex shrink-0 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium backdrop-blur-sm transition-colors"
      >
        <ShuffleIcon class="size-4" />
        Random
      </button>
    </div>

    <p class="text-muted-foreground mb-4 text-xs">
      Showing {filtered.length} of {data.questions.length}
    </p>

    {#if filtered.length === 0}
      <div class="border-border/60 bg-card/40 rounded-xl border px-6 py-12 text-center backdrop-blur-sm">
        <p class="text-muted-foreground text-sm">No questions match your search.</p>
      </div>
    {:else}
      <ol class="flex flex-col gap-3">
        {#each filtered as item (item.id)}
          <li
            id="qna-{item.id}"
            class={cn(
              "group border-border/60 bg-card/40 hover:border-primary/30 hover:bg-card/70 cursor-pointer rounded-xl border p-4 backdrop-blur-sm transition-all duration-200 sm:p-5",
              spotlightId === item.id && "ring-2 ring-primary/40 border-primary/30"
            )}
            onclick={() => openPopupForId(item.id)}
            onkeydown={(e) => e.key === "Enter" && openPopupForId(item.id)}
            role="button"
            tabindex="0"
          >
            <div class="flex gap-4">
              <span
                class="bg-primary/15 text-primary inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums"
              >
                {item.id}
              </span>
              <p class="text-foreground pt-1 text-sm leading-relaxed sm:text-base">{item.question}</p>
            </div>
          </li>
        {/each}
      </ol>
    {/if}

    <footer class="text-muted-foreground mt-12 border-t border-border/40 pt-8 text-center text-sm">
      <a href="/" class="hover:text-primary transition-colors">← Back to How Was Your Day</a>
    </footer>
  </div>
</div>

{#if popupOpen && currentPopupQuestion}
  <div
    class="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md"
    role="dialog"
    aria-modal="true"
    aria-labelledby="popup-question-title"
  >
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,hsl(var(--primary)/0.15),transparent)]"
    ></div>

    <header class="relative flex items-center justify-between px-4 py-4 sm:px-6">
      <span class="text-muted-foreground text-sm tabular-nums">
        {popupIndex + 1} / {filtered.length}
      </span>
      <button
        type="button"
        onclick={closePopup}
        aria-label="Close popup mode"
        class="border-border/60 bg-card/60 text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-md border transition-colors"
      >
        <XIcon class="size-4" />
      </button>
    </header>

    <main class="relative flex flex-1 flex-col items-center justify-center px-6 pb-8">
      <span class="bg-primary/15 text-primary mb-6 inline-flex size-14 items-center justify-center rounded-2xl text-lg font-semibold tabular-nums">
        {currentPopupQuestion.id}
      </span>
      <p id="popup-question-title" class="max-w-2xl text-center text-xl leading-relaxed font-medium sm:text-2xl md:text-3xl">
        {currentPopupQuestion.question}
      </p>
    </main>

    <footer class="relative border-t border-border/40 px-4 py-5 sm:px-6">
      <div class="mx-auto flex max-w-md items-center justify-center gap-3">
        <button
          type="button"
          onclick={goPrev}
          disabled={popupIndex === 0}
          aria-label="Previous question"
          class="border-border/60 bg-card/60 text-foreground hover:bg-accent inline-flex size-11 items-center justify-center rounded-full border transition-colors disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeftIcon class="size-5" />
        </button>
        <button
          type="button"
          onclick={pickRandomPopup}
          class="border-border/60 bg-card/60 text-foreground hover:bg-accent inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors"
        >
          <ShuffleIcon class="size-4" />
          Random
        </button>
        <button
          type="button"
          onclick={goNext}
          disabled={popupIndex >= filtered.length - 1}
          aria-label="Next question"
          class="border-border/60 bg-card/60 text-foreground hover:bg-accent inline-flex size-11 items-center justify-center rounded-full border transition-colors disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRightIcon class="size-5" />
        </button>
      </div>
      <p class="text-muted-foreground mt-3 text-center text-xs">← → navigate · R random · Esc close</p>
    </footer>
  </div>
{/if}
