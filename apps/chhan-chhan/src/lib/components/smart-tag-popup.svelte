<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
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
        <p class="lead">
          Add <strong>{preview.newTagName}</strong> to <strong>{preview.merchant}</strong>
        </p>
      </div>
      <button type="button" class="smart-tag-close" aria-label="Close" disabled={applying} onclick={onCancel}>×</button>
    </header>

    <div class="smart-tag-body">
      <section class="smart-tag-section">
        <h3>Tag mode</h3>
        <div class="tag-mode-options">
          <button type="button" class="tag-mode-btn" class:active={mode === "append"} disabled={applying} onclick={() => onModeChange("append")}>
            <span class="mark" aria-hidden="true">
              {#if mode === "append"}<Check size={11} strokeWidth={2.5} />{/if}
            </span>
            <span class="tag-mode-copy">
              <strong>Keep existing tags</strong>
              <span>Add {preview.newTagName} alongside current tags</span>
            </span>
          </button>
          <button type="button" class="tag-mode-btn" class:active={mode === "replace"} disabled={applying} onclick={() => onModeChange("replace")}>
            <span class="mark" aria-hidden="true">
              {#if mode === "replace"}<Check size={11} strokeWidth={2.5} />{/if}
            </span>
            <span class="tag-mode-copy">
              <strong>Replace old tags</strong>
              <span>Remove current tags and set to {preview.newTagName}</span>
            </span>
          </button>
        </div>
      </section>

      {#if preview.exact}
        <section class="smart-tag-section">
          <h3>Exact matches</h3>
          <p class="section-note">Merchant name matches <strong>{preview.exact.merchant}</strong></p>
          <ul class="smart-tag-list">
            {#each preview.exact.profiles as profile (toggleKey(preview.exact.merchant, profile.tagIds.length ? profile.tagIds : null))}
              {@const enabled = isEnabled(preview.exact.merchant, profile.tagIds.length ? profile.tagIds : null)}
              <li>
                <button
                  type="button"
                  class="smart-tag-option"
                  class:selected={enabled}
                  disabled={applying}
                  onclick={() => onToggle(toggleKey(preview.exact!.merchant, profile.tagIds.length ? profile.tagIds : null), !enabled)}
                >
                  <span class="mark" aria-hidden="true">
                    {#if enabled}<Check size={11} strokeWidth={2.5} />{/if}
                  </span>
                  <span class="smart-tag-copy">
                    <strong>{profile.label}</strong>
                    <span>{profile.count} transaction{profile.count === 1 ? "" : "s"}</span>
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
          <p class="section-note">Rough matches that may belong to the same merchant</p>
          {#each preview.fuzzy as group (group.merchant)}
            <div class="smart-tag-group">
              <p class="group-name">{group.merchant}</p>
              <ul class="smart-tag-list">
                {#each group.profiles as profile (toggleKey(group.merchant, profile.tagIds.length ? profile.tagIds : null))}
                  {@const enabled = isEnabled(group.merchant, profile.tagIds.length ? profile.tagIds : null)}
                  <li>
                    <button
                      type="button"
                      class="smart-tag-option"
                      class:selected={enabled}
                      disabled={applying}
                      onclick={() => onToggle(toggleKey(group.merchant, profile.tagIds.length ? profile.tagIds : null), !enabled)}
                    >
                      <span class="mark" aria-hidden="true">
                        {#if enabled}<Check size={11} strokeWidth={2.5} />{/if}
                      </span>
                      <span class="smart-tag-copy">
                        <strong>{profile.label}</strong>
                        <span>{profile.count} transaction{profile.count === 1 ? "" : "s"}</span>
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
      <button type="button" class="btn-ghost" disabled={applying} onclick={onCancel}>Cancel</button>
      <button type="button" class="btn-ghost" disabled={applying} onclick={onThisOnly}>This transaction only</button>
      <button type="button" class="btn-ink" disabled={applying || selectedCount === 0} onclick={onApplySelected}>
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
    background: color-mix(in srgb, var(--ink) 28%, transparent);
  }

  .smart-tag-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 41;
    transform: translate(-50%, -50%) rotate(0.3deg);
    width: min(34rem, calc(100vw - 2rem));
    max-height: min(80vh, 42rem);
    display: flex;
    flex-direction: column;
    background:
      linear-gradient(transparent 0, transparent calc(100% - 1px), color-mix(in srgb, var(--ink) 8%, transparent) calc(100% - 1px)) 0 0.2rem / 100%
        1.25rem,
      color-mix(in srgb, var(--yellow) 18%, var(--surface-raised));
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 3px 14px 4px 12px / 12px 3px 14px 4px;
    box-shadow:
      3px 3px 0 0 var(--shadow-paper),
      3px 3px 0 1.5px color-mix(in srgb, var(--ink) 16%, transparent);
    font-family: var(--hand);
    color: var(--ink);
  }

  .smart-tag-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.85rem 1rem 0.7rem;
    border-bottom: 1.5px dashed color-mix(in srgb, var(--ink) 18%, transparent);
  }

  .smart-tag-head h2 {
    margin: 0 0 0.2rem;
    font-family: var(--hand);
    font-size: 1.15rem;
    letter-spacing: 0.01em;
    text-transform: none;
    font-weight: 400;
    color: var(--ink);
  }

  .lead {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.35;
    color: var(--ink-muted);
  }

  .lead strong {
    color: var(--ink);
    font-weight: 400;
    background: color-mix(in srgb, var(--yellow) 55%, transparent);
    padding: 0.02rem 0.15rem;
  }

  .smart-tag-close {
    background: transparent;
    border: 1.5px dashed color-mix(in srgb, var(--ink) 28%, transparent);
    color: var(--ink-muted);
    font-family: var(--hand);
    font-size: 1.15rem;
    line-height: 1;
    cursor: pointer;
    width: 1.55rem;
    height: 1.55rem;
    border-radius: 3px 8px 4px 7px / 7px 3px 8px 4px;
    padding: 0;
  }

  .smart-tag-close:hover:not(:disabled) {
    color: var(--brand);
    border-color: var(--brand);
  }

  .smart-tag-body {
    overflow: auto;
    padding: 0.8rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .smart-tag-section h3 {
    margin: 0 0 0.25rem;
    font-family: var(--hand);
    font-size: 1rem;
    letter-spacing: 0.01em;
    text-transform: none;
    font-weight: 400;
    color: var(--ink-muted);
  }

  .section-note {
    margin: 0 0 0.55rem;
    font-size: 0.9rem;
    line-height: 1.35;
    color: var(--ink-muted);
  }

  .section-note strong {
    color: var(--ink);
    font-weight: 400;
  }

  .tag-mode-options {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .tag-mode-btn,
  .smart-tag-option {
    appearance: none;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    width: 100%;
    padding: 0.35rem 0.4rem;
    border: none;
    background: transparent;
    color: var(--ink);
    font-family: var(--hand);
    text-align: left;
    cursor: pointer;
    border-radius: 2px 8px 3px 6px / 6px 2px 8px 3px;
  }

  .tag-mode-btn:hover:not(:disabled),
  .smart-tag-option:hover:not(:disabled) {
    background: color-mix(in srgb, var(--yellow) 28%, transparent);
  }

  .tag-mode-btn.active,
  .smart-tag-option.selected {
    background: color-mix(in srgb, var(--yellow) 48%, transparent);
  }

  .tag-mode-btn:disabled,
  .smart-tag-option:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.05rem;
    height: 1.05rem;
    margin-top: 0.1rem;
    border: 1.5px solid color-mix(in srgb, var(--ink) 32%, transparent);
    background: var(--surface-raised);
    border-radius: 2px 6px 3px 5px / 5px 2px 6px 2px;
    flex-shrink: 0;
    color: var(--ink);
  }

  .tag-mode-btn.active .mark,
  .smart-tag-option.selected .mark {
    background: color-mix(in srgb, var(--yellow) 72%, transparent);
    border-color: transparent;
  }

  .tag-mode-copy,
  .smart-tag-copy {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
    min-width: 0;
  }

  .tag-mode-copy strong,
  .smart-tag-copy strong {
    font-size: 1rem;
    font-weight: 400;
  }

  .tag-mode-copy span,
  .smart-tag-copy span {
    font-size: 0.85rem;
    color: var(--ink-muted);
  }

  .smart-tag-group + .smart-tag-group {
    margin-top: 0.7rem;
    padding-top: 0.7rem;
    border-top: 1.5px dashed color-mix(in srgb, var(--ink) 14%, transparent);
  }

  .group-name {
    margin: 0 0 0.4rem;
    font-size: 0.95rem;
    color: var(--ink);
  }

  .smart-tag-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .smart-tag-actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.45rem;
    padding: 0.75rem 1rem 0.85rem;
    border-top: 1.5px dashed color-mix(in srgb, var(--ink) 18%, transparent);
  }

  .btn-ghost,
  .btn-ink {
    appearance: none;
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    font-family: var(--hand);
    font-size: 0.95rem;
    letter-spacing: 0.01em;
    text-transform: none;
    padding: 0.35rem 0.7rem;
    cursor: pointer;
    border-radius: 2px 8px 3px 7px / 7px 2px 8px 3px;
  }

  .btn-ghost {
    background: transparent;
    color: var(--ink);
  }

  .btn-ghost:hover:not(:disabled) {
    background: color-mix(in srgb, var(--ink) 6%, transparent);
  }

  .btn-ink {
    background: color-mix(in srgb, var(--yellow) 72%, transparent);
    border-color: transparent;
    color: var(--ink);
    transform: rotate(-0.4deg);
  }

  .btn-ink:hover:not(:disabled) {
    background: color-mix(in srgb, var(--yellow) 88%, transparent);
  }

  .btn-ghost:disabled,
  .btn-ink:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  @media (max-width: 480px) {
    .smart-tag-close {
      width: 2.5rem;
      height: 2.5rem;
    }

    .smart-tag-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .btn-ghost,
    .btn-ink {
      width: 100%;
      min-height: 2.5rem;
      justify-content: center;
      text-align: center;
    }
  }
</style>
