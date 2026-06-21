<script lang="ts">
  interface Props {
    canCreate: boolean;
  }

  const { canCreate }: Props = $props();

  let draftBody = $state("");
  let saveState = $state<"idle" | "saving" | "saved" | "error">("idle");
  let savedTitle = $state<string | null>(null);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  async function saveDraft() {
    const body = draftBody.trim();

    if (!body || saveState === "saving") {
      return;
    }

    saveState = "saving";

    try {
      const response = await fetch("/api/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        throw new Error("Failed to save draft");
      }

      const result = (await response.json()) as { title: string };
      draftBody = "";
      savedTitle = result.title;
      saveState = "saved";

      if (resetTimer) {
        clearTimeout(resetTimer);
      }

      resetTimer = setTimeout(() => {
        saveState = "idle";
        savedTitle = null;
      }, 4000);
    } catch {
      saveState = "error";
    }
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
        <p class="text-[0.625rem] text-theme-peach-3">Enter saves draft · Shift+Enter for newline</p>
      </div>

      <div class="flex flex-col gap-2 md:flex-row md:items-end">
        <textarea
          bind:value={draftBody}
          rows="2"
          placeholder="Capture a new poem, article, song, or diary entry..."
          class="min-h-[4.5rem] w-full flex-1 resize-y border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-sm text-theme-peach-1 outline-none placeholder:text-theme-peach-3"
          onkeydown={handleKeydown}
        ></textarea>

        <button
          type="button"
          onclick={() => void saveDraft()}
          disabled={saveState === "saving" || draftBody.trim().length === 0}
          class="border border-theme-peach-2 bg-theme-peach-2 px-4 py-2 text-xs font-heading text-theme-pink-5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveState === "saving" ? "Saving..." : "Save draft"}
        </button>
      </div>

      {#if saveState === "saved" && savedTitle}
        <p class="text-xs text-theme-peach-2" role="status">Draft saved: “{savedTitle}”. It stays private until you publish.</p>
      {:else if saveState === "error"}
        <p class="text-xs text-theme-red-2" role="alert">Could not save draft. Try again.</p>
      {/if}
    </div>
  </section>
{/if}
