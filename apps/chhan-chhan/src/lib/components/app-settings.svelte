<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { authClient } from "$lib/auth-client";
  import CircleHelp from "@lucide/svelte/icons/circle-help";
  import LogOut from "@lucide/svelte/icons/log-out";
  import Settings from "@lucide/svelte/icons/settings";
  import ThemeToggle from "$lib/components/theme-toggle.svelte";

  const onControl = $derived(page.url.pathname.startsWith("/app/control"));
  const onGuide = $derived(page.url.pathname.startsWith("/app/guide"));

  let confirmOpen = $state(false);
  let signingOut = $state(false);

  function openConfirm() {
    confirmOpen = true;
  }

  function closeConfirm() {
    if (signingOut) return;
    confirmOpen = false;
  }

  async function confirmSignOut() {
    if (signingOut) return;
    signingOut = true;
    try {
      await authClient.signOut();
      await goto("/login");
    } finally {
      signingOut = false;
      confirmOpen = false;
    }
  }

  $effect(() => {
    if (!confirmOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeConfirm();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });
</script>

<div class="settings">
  <ThemeToggle />
  {#if onGuide}
    <span class="settings-icon is-current" aria-current="page" title="User guide">
      <CircleHelp size={17} strokeWidth={2.1} aria-hidden="true" />
      <span class="sr-only">User guide</span>
    </span>
  {:else}
    <a class="settings-icon" href="/app/guide" title="User guide" aria-label="User guide">
      <CircleHelp size={17} strokeWidth={2.1} aria-hidden="true" />
    </a>
  {/if}
  {#if onControl}
    <span class="settings-icon is-current" aria-current="page" title="Control Center">
      <Settings size={17} strokeWidth={2.1} aria-hidden="true" />
      <span class="sr-only">Control Center</span>
    </span>
  {:else}
    <a class="settings-icon" href="/app/control" title="Control Center" aria-label="Control Center">
      <Settings size={17} strokeWidth={2.1} aria-hidden="true" />
    </a>
  {/if}
  <button type="button" class="settings-icon" title="Log out" aria-label="Log out" onclick={openConfirm}>
    <LogOut size={17} strokeWidth={2.1} aria-hidden="true" />
  </button>
</div>

{#if confirmOpen}
  <div class="logout-backdrop" role="presentation" onclick={closeConfirm}>
    <div
      class="logout-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-title"
      tabindex="-1"
      onclick={(event) => event.stopPropagation()}
    >
      <h2 id="logout-title">Log out?</h2>
      <p>You’ll need to sign in again to manage this account.</p>
      <div class="logout-actions">
        <button type="button" class="ghost" onclick={closeConfirm} disabled={signingOut}>Cancel</button>
        <button type="button" class="danger" onclick={confirmSignOut} disabled={signingOut}>
          {signingOut ? "Logging out…" : "Log out"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .logout-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    padding: 1.25rem;
    background: color-mix(in srgb, var(--ink) 28%, transparent);
  }

  .logout-dialog {
    width: min(100%, 22rem);
    padding: 1.25rem 1.35rem 1.15rem;
    background: var(--surface-raised);
    border: 1.5px solid var(--chrome-line, rgba(27, 27, 31, 0.22));
    border-radius: 4px 14px 6px 12px / 12px 4px 14px 6px;
    box-shadow: 3px 4px 0 rgba(27, 27, 31, 0.08);
    color: var(--ink, #1b1b1f);
  }

  .logout-dialog h2 {
    margin: 0;
    font-family: var(--hand);
    font-size: 1.55rem;
    font-weight: 400;
    line-height: 1.1;
  }

  .logout-dialog p {
    margin: 0.55rem 0 1.15rem;
    font-family: var(--ui);
    font-size: 0.92rem;
    color: var(--ink-muted, #5b5b5b);
  }

  .logout-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.55rem;
  }

  .logout-actions button {
    appearance: none;
    font-family: var(--hand);
    font-size: 1rem;
    padding: 0.4rem 0.85rem;
    border-radius: 255px 12px 225px 10px / 12px 225px 10px 255px;
    cursor: pointer;
  }

  .logout-actions button:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .logout-actions .ghost {
    background: transparent;
    border: 1.5px solid var(--chrome-line, rgba(27, 27, 31, 0.22));
    color: var(--ink, #1b1b1f);
  }

  .logout-actions .ghost:hover:not(:disabled) {
    border-color: var(--brand);
    color: var(--brand);
  }

  .logout-actions .danger {
    background: color-mix(in srgb, var(--pink) 45%, var(--mix-wash));
    border: 1.5px solid color-mix(in srgb, var(--neg, #c45b6a) 70%, transparent);
    color: var(--neg, #c45b6a);
  }

  .logout-actions .danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--pink) 65%, var(--mix-wash));
  }
</style>
