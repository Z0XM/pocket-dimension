<script lang="ts">
  import { Check } from "@lucide/svelte";
  import type { SmartTagApplyMode, SmartTaggingPreview } from "$lib/server/finance";

  export type SmartTagToggle = {
    merchant: string;
    fromTagIds: string[] | null;
    enabled: boolean;
  };

  type Props = {
    open: boolean;
    preview: SmartTaggingPreview | null;
    applying: boolean;
    mode: SmartTagApplyMode;
    toggles: SmartTagToggle[];
    onModeChange: (mode: SmartTagApplyMode) => void;
    onToggle: (key: string, enabled: boolean) => void;
    onApplySelected: () => void;
    onThisOnly: () => void;
    onCancel: () => void;
  };

  const { open, preview, applying, mode, toggles, onModeChange, onToggle, onApplySelected, onThisOnly, onCancel }: Props = $props();

  function toggleKey(merchant: string, fromTagIds: string[] | null) {
    return `${merchant}::${fromTagIds?.join(",") ?? "none"}`;
  }

  function isEnabled(merchant: string, fromTagIds: string[] | null): boolean {
    return toggles.find((toggle) => toggleKey(toggle.merchant, toggle.fromTagIds) === toggleKey(merchant, fromTagIds))?.enabled ?? true;
  }

  const selectedCount = $derived(toggles.filter((toggle) => toggle.enabled).length);
</script>

{#if open && preview}
  <div class="smart-tag-backdrop" role="presentation" onclick={onCancel}></div>
  <div class="smart-tag-dialog" role="dialog" aria-modal="true" aria-label="Smart tagging">
    <header class="smart-tag-head">
      <div>
        <h2>Smart tagging</h2>
        <p class="dim">
          Add <strong>{preview.newTagName}</strong> to <strong>{preview.merchant}</strong>
        </p>
      </div>
      <button type="button" class="smart-tag-close" aria-label="Close" disabled={applying} onclick={onCancel}> × </button>
    </header>

    <div class="smart-tag-body">
      <section class="smart-tag-section">
        <h3>Tag mode</h3>
        <div class="tag-mode-options">
          <button type="button" class="tag-mode-btn" class:active={mode === "append"} disabled={applying} onclick={() => onModeChange("append")}>
            <span class="tag-mark" aria-hidden="true">
              {#if mode === "append"}<Check size={11} strokeWidth={2.5} />{/if}
            </span>
            <span class="tag-mode-copy">
              <strong>Keep existing tags</strong>
              <span class="dim">Add {preview.newTagName} alongside current tags</span>
            </span>
          </button>
          <button type="button" class="tag-mode-btn" class:active={mode === "replace"} disabled={applying} onclick={() => onModeChange("replace")}>
            <span class="tag-mark" aria-hidden="true">
              {#if mode === "replace"}<Check size={11} strokeWidth={2.5} />{/if}
            </span>
            <span class="tag-mode-copy">
              <strong>Replace old tags</strong>
              <span class="dim">Remove current tags and set to {preview.newTagName}</span>
            </span>
          </button>
        </div>
      </section>

      {#if preview.exact}
        <section class="smart-tag-section">
          <h3>Exact matches</h3>
          <p class="section-note dim">Merchant name matches <strong>{preview.exact.merchant}</strong></p>
          <ul class="smart-tag-list">
            {#each preview.exact.profiles as profile (toggleKey(preview.exact.merchant, profile.tagIds.length ? profile.tagIds : null))}
              <li>
                <button
                  type="button"
                  class="smart-tag-option"
                  class:selected={isEnabled(preview.exact.merchant, profile.tagIds.length ? profile.tagIds : null)}
                  disabled={applying}
                  onclick={() =>
                    onToggle(
                      toggleKey(preview.exact!.merchant, profile.tagIds.length ? profile.tagIds : null),
                      !isEnabled(preview.exact!.merchant, profile.tagIds.length ? profile.tagIds : null)
                    )}
                >
                  <span class="tag-mark" aria-hidden="true">
                    {#if isEnabled(preview.exact.merchant, profile.tagIds.length ? profile.tagIds : null)}
                      <Check size={11} strokeWidth={2.5} />
                    {/if}
                  </span>
                  <span class="smart-tag-copy">
                    <strong>{profile.label}</strong>
                    <span class="dim">{profile.count} transaction{profile.count === 1 ? "" : "s"}</span>
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if preview.fuzzy.length}
        <section class="smart-tag-section">
          <h3>Similar merchants</h3>
          <p class="section-note dim">Rough matches that may belong to the same merchant</p>
          {#each preview.fuzzy as group (group.merchant)}
            <div class="smart-tag-group">
              <p class="group-name">{group.merchant}</p>
              <ul class="smart-tag-list">
                {#each group.profiles as profile (toggleKey(group.merchant, profile.tagIds.length ? profile.tagIds : null))}
                  <li>
                    <button
                      type="button"
                      class="smart-tag-option"
                      class:selected={isEnabled(group.merchant, profile.tagIds.length ? profile.tagIds : null)}
                      disabled={applying}
                      onclick={() =>
                        onToggle(
                          toggleKey(group.merchant, profile.tagIds.length ? profile.tagIds : null),
                          !isEnabled(group.merchant, profile.tagIds.length ? profile.tagIds : null)
                        )}
                    >
                      <span class="tag-mark" aria-hidden="true">
                        {#if isEnabled(group.merchant, profile.tagIds.length ? profile.tagIds : null)}
                          <Check size={11} strokeWidth={2.5} />
                        {/if}
                      </span>
                      <span class="smart-tag-copy">
                        <strong>{profile.label}</strong>
                        <span class="dim">{profile.count} transaction{profile.count === 1 ? "" : "s"}</span>
                      </span>
                    </button>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </section>
      {/if}
    </div>

    <footer class="smart-tag-actions">
      <button type="button" class="btn-secondary" disabled={applying} onclick={onCancel}>Cancel</button>
      <button type="button" class="btn-secondary" disabled={applying} onclick={onThisOnly}>This transaction only</button>
      <button type="button" class="btn-primary" disabled={applying || selectedCount === 0} onclick={onApplySelected}>
        {applying ? "Applying…" : `Apply selected (${selectedCount})`}
      </button>
    </footer>
  </div>
{/if}

<style>
  .smart-tag-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(0, 0, 0, 0.45);
  }

  .smart-tag-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 41;
    transform: translate(-50%, -50%);
    width: min(34rem, calc(100vw - 2rem));
    max-height: min(80vh, 42rem);
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 2px solid var(--chrome-line);
    box-shadow: 8px 8px 0 rgba(234, 242, 240, 0.12);
  }

  .smart-tag-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.9rem 1rem;
    border-bottom: 2px solid var(--chrome-line);
  }

  .smart-tag-head h2 {
    margin: 0 0 0.25rem;
    font-family: "Archivo Black", sans-serif;
    font-size: 0.82rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--hi-cyan);
  }

  .smart-tag-head p {
    margin: 0;
    font-size: 0.74rem;
    line-height: 1.4;
  }

  .smart-tag-close {
    background: none;
    border: none;
    color: var(--muted);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    padding: 0;
  }

  .smart-tag-body {
    overflow: auto;
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .smart-tag-section h3 {
    margin: 0 0 0.35rem;
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--hi-purple);
  }

  .section-note {
    margin: 0 0 0.55rem;
    font-size: 0.72rem;
    line-height: 1.35;
  }

  .tag-mode-options {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .tag-mode-btn,
  .smart-tag-option {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    width: 100%;
    padding: 0.45rem 0.35rem;
    border: none;
    background: transparent;
    color: var(--main-text);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .tag-mode-btn:hover,
  .tag-mode-btn.active,
  .smart-tag-option:hover,
  .smart-tag-option.selected {
    background: color-mix(in srgb, var(--hi-purple) 10%, transparent);
  }

  .tag-mode-btn:disabled,
  .smart-tag-option:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .tag-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 0.95rem;
    height: 0.95rem;
    margin-top: 0.05rem;
    border: 2px solid var(--chrome-line);
    background: var(--surface2);
    box-shadow: 1px 1px 0 rgba(234, 242, 240, 0.08);
    flex-shrink: 0;
    color: var(--background);
  }

  .tag-mode-btn.active .tag-mark,
  .smart-tag-option.selected .tag-mark {
    background: var(--hi-purple);
    border-color: var(--hi-purple);
  }

  .tag-mode-copy,
  .smart-tag-copy {
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
    min-width: 0;
  }

  .tag-mode-copy strong,
  .smart-tag-copy strong {
    font-size: 0.74rem;
  }

  .tag-mode-copy span,
  .smart-tag-copy span {
    font-size: 0.68rem;
  }

  .smart-tag-group + .smart-tag-group {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--chrome-line);
  }

  .group-name {
    margin: 0 0 0.45rem;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    color: var(--main-text);
  }

  .smart-tag-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .smart-tag-actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.45rem;
    padding: 0.85rem 1rem;
    border-top: 2px solid var(--chrome-line);
  }

  .btn-secondary,
  .btn-primary {
    border: 2px solid var(--chrome-line);
    font-family: inherit;
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.45rem 0.7rem;
    cursor: pointer;
  }

  .btn-secondary {
    background: var(--surface2);
    color: var(--main-text);
  }

  .btn-primary {
    background: var(--hi-purple);
    color: var(--background);
    border-color: var(--hi-purple);
  }

  .btn-secondary:disabled,
  .btn-primary:disabled {
    opacity: 0.55;
    cursor: wait;
  }
</style>
