<script lang="ts">
  import type { SmartCategorizationPreview } from "$lib/server/finance";

  export type SmartCategoryToggle = {
    merchant: string;
    fromCategoryId: string | null;
    enabled: boolean;
  };

  type Props = {
    open: boolean;
    preview: SmartCategorizationPreview | null;
    applying: boolean;
    toggles: SmartCategoryToggle[];
    onToggle: (key: string, enabled: boolean) => void;
    onApplySelected: () => void;
    onThisOnly: () => void;
    onCancel: () => void;
  };

  const { open, preview, applying, toggles, onToggle, onApplySelected, onThisOnly, onCancel }: Props = $props();

  function toggleKey(merchant: string, categoryId: string | null) {
    return `${merchant}::${categoryId ?? "null"}`;
  }

  function isEnabled(merchant: string, categoryId: string | null): boolean {
    return toggles.find((toggle) => toggleKey(toggle.merchant, toggle.fromCategoryId) === toggleKey(merchant, categoryId))?.enabled ?? true;
  }

  const selectedCount = $derived(toggles.filter((toggle) => toggle.enabled).length);
</script>

{#if open && preview}
  <div class="smart-cat-backdrop" role="presentation" onclick={onCancel}></div>
  <div class="smart-cat-dialog" role="dialog" aria-modal="true" aria-label="Smart categorization">
    <header class="smart-cat-head">
      <div>
        <h2>Smart categorization</h2>
        <p class="dim">
          Set <strong>{preview.newCategoryName}</strong> for <strong>{preview.merchant}</strong>
        </p>
      </div>
      <button type="button" class="smart-cat-close" aria-label="Close" disabled={applying} onclick={onCancel}>×</button>
    </header>

    <div class="smart-cat-body">
      {#if preview.exact}
        <section class="smart-cat-section">
          <h3>Exact matches</h3>
          <p class="section-note dim">Merchant name matches <strong>{preview.exact.merchant}</strong></p>
          <ul class="smart-cat-list">
            {#each preview.exact.categories as category (toggleKey(preview.exact.merchant, category.categoryId))}
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={isEnabled(preview.exact.merchant, category.categoryId)}
                    disabled={applying}
                    onchange={(e) => onToggle(toggleKey(preview.exact!.merchant, category.categoryId), e.currentTarget.checked)}
                  />
                  <span class="smart-cat-copy">
                    <strong>{category.categoryName}</strong>
                    <span class="dim">{category.count} transaction{category.count === 1 ? "" : "s"}</span>
                  </span>
                </label>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if preview.fuzzy.length}
        <section class="smart-cat-section">
          <h3>Similar merchants</h3>
          <p class="section-note dim">Rough matches that may belong to the same merchant</p>
          {#each preview.fuzzy as group (group.merchant)}
            <div class="smart-cat-group">
              <p class="group-name">{group.merchant}</p>
              <ul class="smart-cat-list">
                {#each group.categories as category (toggleKey(group.merchant, category.categoryId))}
                  <li>
                    <label>
                      <input
                        type="checkbox"
                        checked={isEnabled(group.merchant, category.categoryId)}
                        disabled={applying}
                        onchange={(e) => onToggle(toggleKey(group.merchant, category.categoryId), e.currentTarget.checked)}
                      />
                      <span class="smart-cat-copy">
                        <strong>{category.categoryName}</strong>
                        <span class="dim">{category.count} transaction{category.count === 1 ? "" : "s"}</span>
                      </span>
                    </label>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </section>
      {/if}
    </div>

    <footer class="smart-cat-actions">
      <button type="button" class="btn-secondary" disabled={applying} onclick={onCancel}>Cancel</button>
      <button type="button" class="btn-secondary" disabled={applying} onclick={onThisOnly}>This transaction only</button>
      <button type="button" class="btn-primary" disabled={applying || selectedCount === 0} onclick={onApplySelected}>
        {applying ? "Applying…" : `Apply selected (${selectedCount})`}
      </button>
    </footer>
  </div>
{/if}

<style>
  .smart-cat-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(0, 0, 0, 0.45);
  }

  .smart-cat-dialog {
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

  .smart-cat-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.9rem 1rem;
    border-bottom: 2px solid var(--chrome-line);
  }

  .smart-cat-head h2 {
    margin: 0 0 0.25rem;
    font-family: "Archivo Black", sans-serif;
    font-size: 0.82rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--hi-cyan);
  }

  .smart-cat-head p {
    margin: 0;
    font-size: 0.74rem;
    line-height: 1.4;
  }

  .smart-cat-close {
    background: none;
    border: none;
    color: var(--muted);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    padding: 0;
  }

  .smart-cat-body {
    overflow: auto;
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .smart-cat-section h3 {
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

  .smart-cat-group + .smart-cat-group {
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

  .smart-cat-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .smart-cat-list label {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    cursor: pointer;
  }

  .smart-cat-list input {
    margin-top: 0.15rem;
    accent-color: var(--hi-purple);
  }

  .smart-cat-copy {
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
  }

  .smart-cat-copy strong {
    font-size: 0.74rem;
  }

  .smart-cat-copy span {
    font-size: 0.68rem;
  }

  .smart-cat-actions {
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
