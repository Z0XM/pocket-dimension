<script lang="ts">
  interface Props {
    canCreate: boolean;
    onOpenEditor?: () => void;
  }

  const { canCreate, onOpenEditor }: Props = $props();

  let draftBody = $state("");
  let saveState = $state<"idle" | "saving" | "saved" | "published" | "error">("idle");
  let savedTitle = $state<string | null>(null);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  async function saveDraft() {
    const body = draftBody.trim();
    if (!body || saveState === "saving") return;

    saveState = "saving";

    try {
      const response = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) throw new Error("Failed to save draft");

      const result = (await response.json()) as { title: string };
      draftBody = "";
      savedTitle = result.title;
      saveState = "saved";
      scheduleReset();
    } catch {
      saveState = "error";
    }
  }

  async function publishNow() {
    const body = draftBody.trim();
    if (!body || saveState === "saving") return;

    saveState = "saving";

    try {
      const response = await fetch("/api/pieces/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) throw new Error("Failed to publish");

      const result = (await response.json()) as { title: string; slug: string };
      draftBody = "";
      savedTitle = `${result.title} (${result.slug})`;
      saveState = "published";
      scheduleReset();
    } catch {
      saveState = "error";
    }
  }

  function scheduleReset() {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      saveState = "idle";
      savedTitle = null;
    }, 4000);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void saveDraft();
    }
  }
</script>

{#if canCreate}
  <section class="border-t border-theme-red-2/40 bg-theme-pink-4/95 px-4 py-3 md:px-6" aria-label="Quick composer">
    <div class="mx-auto flex max-w-5xl flex-col gap-2">
      <div class="flex items-center justify-between gap-3">
        <p class="text-[0.625rem] font-heading uppercase tracking-[0.18em] text-theme-peach-3">Quick composer</p>
        <div class="flex items-center gap-3 text-[0.625rem] text-theme-peach-3">
          <span>Enter saves draft · Shift+Enter for newline</span>
          {#if onOpenEditor}
            <button type="button" class="underline" onclick={onOpenEditor}>Open expanded editor</button>
          {/if}
        </div>
      </div>

      <div class="flex flex-col gap-2 md:flex-row md:items-end">
        <textarea
          bind:value={draftBody}
          rows="2"
          placeholder="Capture a new poem, article, song, or diary entry..."
          class="min-h-[4.5rem] w-full flex-1 resize-y border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-sm text-theme-peach-1 outline-none placeholder:text-theme-peach-3"
          onkeydown={handleKeydown}
        ></textarea>

        <div class="flex gap-2">
          <button
            type="button"
            onclick={() => void saveDraft()}
            disabled={saveState === "saving" || draftBody.trim().length === 0}
            class="border border-theme-peach-2 bg-theme-peach-2 px-4 py-2 text-xs font-heading text-theme-pink-5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveState === "saving" ? "Saving..." : "Save draft"}
          </button>
          <button
            type="button"
            onclick={() => void publishNow()}
            disabled={saveState === "saving" || draftBody.trim().length === 0}
            class="border border-theme-red-2/40 bg-theme-pink-3 px-4 py-2 text-xs font-heading text-theme-peach-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Publish
          </button>
        </div>
      </div>

      {#if saveState === "saved" && savedTitle}
        <p class="text-xs text-theme-peach-2" role="status">Draft saved: “{savedTitle}”. It stays private until you publish.</p>
      {:else if saveState === "published" && savedTitle}
        <p class="text-xs text-theme-peach-2" role="status">Published: “{savedTitle}”. It is now public in the reader catalog.</p>
      {:else if saveState === "error"}
        <p class="text-xs text-theme-red-2" role="alert">Could not save. Try again.</p>
      {/if}
    </div>
  </section>
{/if}
