<script lang="ts">
  import type { BodyDocument, TextMark } from "$lib/document";
  import { documentToEditorHtml, editorHtmlToDocument } from "$lib/document";

  interface Props {
    bodyDocument: BodyDocument;
    onchange?: (document: BodyDocument) => void;
  }

  let { bodyDocument, onchange }: Props = $props();

  let editorEl = $state<HTMLDivElement | null>(null);
  let selectionColor = $state("#f7f4ee");
  let selectionBackground = $state("#5c2b3a");
  let selectionFontFamily = $state("var(--font-content)");
  let selectionFontSize = $state("1rem");

  function syncFromDocument(next: BodyDocument) {
    if (!editorEl) return;
    const html = documentToEditorHtml(next);
    if (editorEl.innerHTML !== html) {
      editorEl.innerHTML = html;
    }
  }

  $effect(() => {
    syncFromDocument(bodyDocument);
  });

  function emitChange() {
    if (!editorEl) return;
    const next = editorHtmlToDocument(editorEl.innerHTML);
    onchange?.(next);
  }

  function applyMark(mark: Partial<TextMark>) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !editorEl) return;

    const range = selection.getRangeAt(0);
    if (!editorEl.contains(range.commonAncestorContainer)) return;

    const span = window.document.createElement("span");
    if (mark.color) span.style.color = mark.color;
    if (mark.backgroundColor) span.style.backgroundColor = mark.backgroundColor;
    if (mark.fontFamily) span.style.fontFamily = mark.fontFamily;
    if (mark.fontSize) span.style.fontSize = mark.fontSize;

    try {
      range.surroundContents(span);
    } catch {
      const extracted = range.extractContents();
      span.appendChild(extracted);
      range.insertNode(span);
    }

    selection.removeAllRanges();
    emitChange();
  }

  function applySelectionStyles() {
    applyMark({
      color: selectionColor,
      backgroundColor: selectionBackground || undefined,
      fontFamily: selectionFontFamily,
      fontSize: selectionFontSize,
    });
  }

  function insertPageBreak() {
    if (!editorEl) return;
    editorEl.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const hr = window.document.createElement("hr");
    hr.dataset.pageBreak = "true";
    range.insertNode(hr);
    emitChange();
  }
</script>

<div class="space-y-2">
  <div class="flex flex-wrap items-center gap-2 border border-theme-red-2/30 p-2">
    <label class="flex items-center gap-1 text-[0.625rem] text-theme-peach-3">
      Color
      <input type="color" bind:value={selectionColor} class="h-7 w-10 border border-theme-red-2/40 bg-theme-pink-3" />
    </label>
    <label class="flex items-center gap-1 text-[0.625rem] text-theme-peach-3">
      Highlight
      <input type="color" bind:value={selectionBackground} class="h-7 w-10 border border-theme-red-2/40 bg-theme-pink-3" />
    </label>
    <select bind:value={selectionFontFamily} class="border border-theme-red-2/40 bg-theme-pink-3 px-2 py-1 text-xs text-theme-peach-1">
      <option value="var(--font-content)">Content</option>
      <option value="var(--font-heading)">Heading</option>
      <option value="serif">Serif</option>
      <option value="sans-serif">Sans-serif</option>
    </select>
    <select bind:value={selectionFontSize} class="border border-theme-red-2/40 bg-theme-pink-3 px-2 py-1 text-xs text-theme-peach-1">
      <option value="0.875rem">Small</option>
      <option value="1rem">Regular</option>
      <option value="1.25rem">Medium</option>
      <option value="1.5rem">Large</option>
      <option value="2rem">XL</option>
    </select>
    <button type="button" class="border border-theme-peach-2 px-2 py-1 text-xs text-theme-peach-1" onclick={applySelectionStyles}>
      Apply to selection
    </button>
    <button type="button" class="border border-theme-red-2/40 px-2 py-1 text-xs text-theme-peach-1" onclick={insertPageBreak}>
      Page break
    </button>
  </div>

  <div
    bind:this={editorEl}
    contenteditable="true"
    class="min-h-48 border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-sm text-theme-peach-1 outline-none [&_hr]:my-4 [&_hr]:border-theme-peach-2"
    oninput={emitChange}
    role="textbox"
    aria-multiline="true"
  ></div>
</div>
