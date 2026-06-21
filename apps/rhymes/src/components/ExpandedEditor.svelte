<script lang="ts">
  import type { ContentType, ReaderMode } from "$lib/rhymes";
  import type { SourceMode, TitleRichStyle } from "$lib/document";

  interface CreatorPieceSummary {
    id: string;
    slug: string;
    title: string;
    status: string;
    visibility: string;
    updatedAt: string;
  }

  interface Props {
    open: boolean;
    canCreate: boolean;
    creatorPieces: CreatorPieceSummary[];
    onClose: () => void;
  }

  const { open, canCreate, creatorPieces, onClose }: Props = $props();

  let selectedPieceId = $state<string | null>(null);
  let titleText = $state("");
  let bodyPlain = $state("");
  let contentType = $state<ContentType>("poem");
  let sourceMode = $state<SourceMode>("plain");
  let defaultReaderMode = $state<ReaderMode>("continuous");
  let creatorRating = $state<number | "">("");
  let displayTitleMode = $state<"text" | "art">("text");
  let titleColor = $state("#f7f4ee");
  let titleBackground = $state("");
  let titleFontFamily = $state("var(--font-heading)");
  let titleFontSize = $state("1.5rem");
  let shareUserId = $state("");
  let statusMessage = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);
  let isSaving = $state(false);
  let history = $state<Array<{ action: string; createdAt: string }>>([]);

  async function loadPiece(pieceId: string) {
    selectedPieceId = pieceId;
    const response = await fetch(`/api/pieces/${pieceId}`);
    if (!response.ok) {
      errorMessage = "Could not load piece";
      return;
    }

    const data = (await response.json()) as { piece: Record<string, unknown> };
    const piece = data.piece;
    titleText = String(piece.titleText ?? "");
    bodyPlain = String(piece.bodyPlain ?? "");
    contentType = (piece.contentType as ContentType) ?? "poem";
    sourceMode = (piece.sourceMode as SourceMode) ?? "plain";
    defaultReaderMode = (piece.defaultReaderMode as ReaderMode) ?? "continuous";
    creatorRating = typeof piece.creatorRating === "number" ? piece.creatorRating : "";
    displayTitleMode = piece.displayTitleMode === "art" ? "art" : "text";

    const titleRich = piece.titleRichJson as TitleRichStyle | null;
    titleColor = titleRich?.color ?? "#f7f4ee";
    titleBackground = titleRich?.backgroundColor ?? "";
    titleFontFamily = titleRich?.fontFamily ?? "var(--font-heading)";
    titleFontSize = titleRich?.fontSize ?? "1.5rem";

    const historyResponse = await fetch(`/api/pieces/${pieceId}?action=history`, { method: "POST" });
    if (historyResponse.ok) {
      const historyData = (await historyResponse.json()) as {
        events: Array<{ action: string; createdAt: string | Date }>;
      };
      history = historyData.events.map((event) => ({
        action: event.action,
        createdAt: new Date(event.createdAt).toLocaleString(),
      }));
    }
  }

  function resetEditor() {
    selectedPieceId = null;
    titleText = "";
    bodyPlain = "";
    contentType = "poem";
    sourceMode = "plain";
    defaultReaderMode = "continuous";
    creatorRating = "";
    displayTitleMode = "text";
    history = [];
    statusMessage = null;
    errorMessage = null;
  }

  async function savePiece() {
    if (!selectedPieceId || isSaving) return;
    isSaving = true;
    errorMessage = null;

    const response = await fetch(`/api/pieces/${selectedPieceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleText,
        bodyPlain,
        contentType,
        sourceMode,
        defaultReaderMode,
        creatorRating: creatorRating === "" ? null : Number(creatorRating),
        displayTitleMode,
        titleRichJson: {
          color: titleColor,
          backgroundColor: titleBackground || undefined,
          fontFamily: titleFontFamily,
          fontSize: titleFontSize,
        },
      }),
    });

    isSaving = false;

    if (!response.ok) {
      errorMessage = "Could not save piece";
      return;
    }

    statusMessage = "Saved";
    await loadPiece(selectedPieceId);
  }

  async function publishSelected() {
    if (!selectedPieceId) return;
    const response = await fetch(`/api/pieces/${selectedPieceId}?action=publish`, { method: "POST" });
    if (!response.ok) {
      errorMessage = "Could not publish piece";
      return;
    }
    statusMessage = "Published";
    await loadPiece(selectedPieceId);
  }

  async function toggleVisibility() {
    if (!selectedPieceId) return;
    const current = creatorPieces.find((piece) => piece.id === selectedPieceId);
    const nextVisibility = current?.visibility === "hidden" ? "public" : "hidden";
    const response = await fetch(`/api/pieces/${selectedPieceId}/visibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: nextVisibility }),
    });
    if (!response.ok) {
      errorMessage = "Could not update visibility";
      return;
    }
    statusMessage = nextVisibility === "hidden" ? "Hidden (still published)" : "Visible again";
    await loadPiece(selectedPieceId);
  }

  function insertPageBreak() {
    bodyPlain = `${bodyPlain.trim()}\n\n---\n\n`;
  }

  async function uploadTitleArt(event: Event) {
    if (!selectedPieceId) return;
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("pieceId", selectedPieceId);
    formData.set("file", file);

    const response = await fetch("/api/assets", { method: "POST", body: formData });
    if (!response.ok) {
      errorMessage = "Could not upload title art";
      return;
    }

    statusMessage = "Title art uploaded";
    displayTitleMode = "art";
    await loadPiece(selectedPieceId);
  }

  async function grantEditAccess() {
    if (!selectedPieceId || !shareUserId.trim()) return;
    const response = await fetch(`/api/pieces/${selectedPieceId}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: shareUserId.trim() }),
    });
    if (!response.ok) {
      errorMessage = "Could not grant edit access";
      return;
    }
    statusMessage = "Edit access granted";
    shareUserId = "";
  }
</script>

{#if open && canCreate}
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:items-center">
    <section class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden border border-theme-peach-2/40 bg-theme-pink-4">
      <header class="flex items-center justify-between border-b border-theme-red-2/30 px-4 py-3">
        <div>
          <h2 class="font-heading text-lg text-theme-peach-1">Expanded editor</h2>
          <p class="text-xs text-theme-peach-3">Manage drafts and published pieces without leaving the reader.</p>
        </div>
        <button type="button" class="text-sm text-theme-peach-2" onclick={() => { resetEditor(); onClose(); }}>Close</button>
      </header>

      <div class="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[12rem_minmax(0,1fr)]">
        <aside class="space-y-2">
          <p class="text-[0.625rem] font-heading uppercase tracking-[0.18em] text-theme-peach-3">Your pieces</p>
          <button type="button" class="w-full border border-theme-red-2/40 px-2 py-2 text-left text-xs text-theme-peach-2" onclick={resetEditor}>
            New draft
          </button>
          {#each creatorPieces as piece}
            <button
              type="button"
              class="w-full border px-2 py-2 text-left text-xs {selectedPieceId === piece.id
                ? 'border-theme-peach-2 bg-theme-pink-2 text-theme-peach-1'
                : 'border-theme-red-2/40 text-theme-peach-2'}"
              onclick={() => loadPiece(piece.id)}
            >
              <div>{piece.title}</div>
              <div class="mt-1 text-[0.625rem] uppercase tracking-[0.14em] text-theme-peach-3">
                {piece.status} · {piece.visibility}
              </div>
            </button>
          {/each}
        </aside>

        <div class="space-y-4">
          {#if selectedPieceId}
            <div class="grid gap-3 md:grid-cols-2">
              <label class="block text-xs text-theme-peach-3">
                Title
                <input bind:value={titleText} class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-2 py-2 text-sm text-theme-peach-1" />
              </label>
              <label class="block text-xs text-theme-peach-3">
                Content type
                <select bind:value={contentType} class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-2 py-2 text-sm text-theme-peach-1">
                  <option value="poem">Poem</option>
                  <option value="article">Article</option>
                  <option value="song">Song</option>
                  <option value="diary">Diary</option>
                </select>
              </label>
              <label class="block text-xs text-theme-peach-3">
                Source mode
                <select bind:value={sourceMode} class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-2 py-2 text-sm text-theme-peach-1">
                  <option value="plain">Plain text</option>
                  <option value="markdown">Markdown</option>
                  <option value="html">HTML</option>
                </select>
              </label>
              <label class="block text-xs text-theme-peach-3">
                Default reader mode
                <select bind:value={defaultReaderMode} class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-2 py-2 text-sm text-theme-peach-1">
                  <option value="continuous">Continuous</option>
                  <option value="paged">Paged</option>
                </select>
              </label>
              <label class="block text-xs text-theme-peach-3">
                Creator rating (0-10)
                <input type="number" min="0" max="10" bind:value={creatorRating} class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-2 py-2 text-sm text-theme-peach-1" />
              </label>
              <label class="block text-xs text-theme-peach-3">
                Display title mode
                <select bind:value={displayTitleMode} class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-2 py-2 text-sm text-theme-peach-1">
                  <option value="text">Styled text</option>
                  <option value="art">Title art</option>
                </select>
              </label>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              <label class="block text-xs text-theme-peach-3">
                Title color
                <input type="color" bind:value={titleColor} class="mt-1 h-10 w-full border border-theme-red-2/40 bg-theme-pink-3" />
              </label>
              <label class="block text-xs text-theme-peach-3">
                Title background
                <input type="color" bind:value={titleBackground} class="mt-1 h-10 w-full border border-theme-red-2/40 bg-theme-pink-3" />
              </label>
              <label class="block text-xs text-theme-peach-3">
                Title font
                <select bind:value={titleFontFamily} class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-2 py-2 text-sm text-theme-peach-1">
                  <option value="var(--font-heading)">Heading</option>
                  <option value="var(--font-content)">Content</option>
                  <option value="serif">Serif</option>
                  <option value="sans-serif">Sans-serif</option>
                </select>
              </label>
              <label class="block text-xs text-theme-peach-3">
                Title size
                <select bind:value={titleFontSize} class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-2 py-2 text-sm text-theme-peach-1">
                  <option value="1rem">Small</option>
                  <option value="1.25rem">Medium</option>
                  <option value="1.5rem">Large</option>
                  <option value="2rem">XL</option>
                </select>
              </label>
            </div>

            <label class="block text-xs text-theme-peach-3">
              Body
              <textarea bind:value={bodyPlain} rows="10" class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-sm text-theme-peach-1"></textarea>
            </label>

            <div class="flex flex-wrap gap-2">
              <button type="button" class="border border-theme-peach-2 px-3 py-2 text-xs text-theme-peach-1" onclick={insertPageBreak}>Insert page break</button>
              <label class="border border-theme-red-2/40 px-3 py-2 text-xs text-theme-peach-1 cursor-pointer">
                Upload title art
                <input type="file" accept="image/*" class="hidden" onchange={uploadTitleArt} />
              </label>
            </div>

            <div class="flex flex-wrap gap-2">
              <button type="button" class="border border-theme-peach-2 bg-theme-peach-2 px-4 py-2 text-xs text-theme-pink-5" onclick={() => void savePiece()} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button type="button" class="border border-theme-red-2/40 px-4 py-2 text-xs text-theme-peach-1" onclick={() => void publishSelected()}>Publish</button>
              <button type="button" class="border border-theme-red-2/40 px-4 py-2 text-xs text-theme-peach-1" onclick={() => void toggleVisibility()}>Hide / unhide</button>
            </div>

            <div class="border border-theme-red-2/30 p-3">
              <p class="text-[0.625rem] font-heading uppercase tracking-[0.18em] text-theme-peach-3">Piece-level edit access</p>
              <div class="mt-2 flex gap-2">
                <input bind:value={shareUserId} placeholder="User ID" class="flex-1 border border-theme-red-2/40 bg-theme-pink-3 px-2 py-2 text-xs text-theme-peach-1" />
                <button type="button" class="border border-theme-red-2/40 px-3 py-2 text-xs text-theme-peach-1" onclick={() => void grantEditAccess()}>Grant edit</button>
              </div>
            </div>

            {#if history.length > 0}
              <div class="border border-theme-red-2/30 p-3">
                <p class="text-[0.625rem] font-heading uppercase tracking-[0.18em] text-theme-peach-3">Recent history</p>
                <ul class="mt-2 space-y-1 text-xs text-theme-peach-3">
                  {#each history as event}
                    <li>{event.createdAt} · {event.action}</li>
                  {/each}
                </ul>
              </div>
            {/if}
          {:else}
            <p class="text-sm text-theme-peach-3">Select a piece from the left or create a new draft from the quick composer.</p>
          {/if}

          {#if statusMessage}
            <p class="text-xs text-theme-peach-2" role="status">{statusMessage}</p>
          {/if}
          {#if errorMessage}
            <p class="text-xs text-theme-red-2" role="alert">{errorMessage}</p>
          {/if}
        </div>
      </div>
    </section>
  </div>
{/if}
