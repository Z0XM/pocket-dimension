<script lang="ts">
  import { buildDevAccountsUrl, buildDevSignInUrl, type DevModePublicAccount } from "@pocket-dimension/auth/dev-mode";

  type Props = {
    authBaseUrl: string;
    currentUsername?: string | null;
  };

  let { authBaseUrl, currentUsername = null }: Props = $props();

  let open = $state(false);
  let accounts = $state<DevModePublicAccount[]>([]);
  let defaultAccount = $state<string | null>(null);
  let loadError = $state<string | null>(null);
  let loading = $state(false);

  async function loadAccounts() {
    loading = true;
    loadError = null;
    try {
      const res = await fetch(buildDevAccountsUrl(authBaseUrl), { credentials: "include" });
      if (!res.ok) {
        loadError = `Failed to load accounts (${res.status})`;
        return;
      }
      const data = (await res.json()) as {
        enabled?: boolean;
        defaultAccount?: string;
        accounts?: DevModePublicAccount[];
      };
      accounts = data.accounts ?? [];
      defaultAccount = data.defaultAccount ?? null;
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Failed to load accounts";
    } finally {
      loading = false;
    }
  }

  async function toggle() {
    open = !open;
    if (open && accounts.length === 0 && !loadError) {
      await loadAccounts();
    }
  }

  function switchTo(username: string) {
    const redirect = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    window.location.href = buildDevSignInUrl(authBaseUrl, { account: username, redirect });
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") open = false;
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="dev-mode-root">
  <button type="button" class="dev-mode-notch" onclick={toggle} aria-expanded={open} aria-haspopup="dialog">
    <span class="dev-mode-dot" aria-hidden="true"></span>
    <span class="dev-mode-label">Dev Mode</span>
    {#if currentUsername}
      <span class="dev-mode-user">{currentUsername}</span>
    {/if}
  </button>

  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="dev-mode-backdrop" onclick={() => (open = false)}></div>
    <div class="dev-mode-modal" role="dialog" aria-modal="true" aria-label="Switch Dev Mode account">
      <header class="dev-mode-modal-header">
        <h2>Switch account</h2>
        <button type="button" class="dev-mode-close" onclick={() => (open = false)} aria-label="Close">×</button>
      </header>
      <p class="dev-mode-hint">Local Dev Mode only. Selecting an account reloads with that session.</p>
      {#if loading}
        <p class="dev-mode-status">Loading…</p>
      {:else if loadError}
        <p class="dev-mode-status error">{loadError}</p>
      {:else}
        <ul class="dev-mode-list">
          {#each accounts as account (account.username)}
            <li>
              <button
                type="button"
                class="dev-mode-account"
                class:active={account.username === currentUsername}
                onclick={() => switchTo(account.username)}
              >
                <span class="name">{account.label}</span>
                {#if account.email}
                  <span class="email">{account.email}</span>
                {/if}
                {#if account.username === defaultAccount}
                  <span class="badge">default</span>
                {/if}
                {#if account.username === currentUsername}
                  <span class="badge current">current</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

<style>
  .dev-mode-root {
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    z-index: 99999;
    pointer-events: none;
  }

  .dev-mode-notch {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.35rem;
    padding: 0.35rem 0.85rem 0.4rem;
    border: none;
    border-radius: 999px;
    background: #111;
    color: #f5f5f5;
    font:
      600 0.7rem/1.2 ui-sans-serif,
      system-ui,
      sans-serif;
    letter-spacing: 0.02em;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    max-width: min(92vw, 20rem);
  }

  .dev-mode-notch:hover {
    background: #1c1c1c;
  }

  .dev-mode-dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: #3ecf8e;
    flex-shrink: 0;
  }

  .dev-mode-label {
    opacity: 0.85;
    text-transform: uppercase;
    font-size: 0.62rem;
  }

  .dev-mode-user {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 8rem;
  }

  .dev-mode-backdrop {
    pointer-events: auto;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
  }

  .dev-mode-modal {
    pointer-events: auto;
    position: fixed;
    top: 2.75rem;
    left: 50%;
    transform: translateX(-50%);
    width: min(92vw, 22rem);
    background: #111;
    color: #f5f5f5;
    border-radius: 1rem;
    padding: 0.85rem 0.9rem 1rem;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
    font:
      400 0.85rem/1.35 ui-sans-serif,
      system-ui,
      sans-serif;
  }

  .dev-mode-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
  }

  .dev-mode-modal-header h2 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 650;
  }

  .dev-mode-close {
    border: none;
    background: transparent;
    color: #aaa;
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.15rem 0.35rem;
  }

  .dev-mode-hint {
    margin: 0 0 0.75rem;
    color: #9a9a9a;
    font-size: 0.75rem;
  }

  .dev-mode-status {
    margin: 0;
    color: #bbb;
  }

  .dev-mode-status.error {
    color: #f07178;
  }

  .dev-mode-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .dev-mode-account {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    column-gap: 0.5rem;
    row-gap: 0.1rem;
    text-align: left;
    border: 1px solid #2a2a2a;
    border-radius: 0.65rem;
    background: #1a1a1a;
    color: inherit;
    padding: 0.55rem 0.65rem;
    cursor: pointer;
  }

  .dev-mode-account:hover {
    border-color: #3ecf8e66;
  }

  .dev-mode-account.active {
    border-color: #3ecf8e;
    background: #14201a;
  }

  .dev-mode-account .name {
    font-weight: 600;
    grid-column: 1;
    grid-row: 1;
  }

  .dev-mode-account .email {
    grid-column: 1;
    grid-row: 2;
    color: #8e8e8e;
    font-size: 0.72rem;
  }

  .dev-mode-account .badge {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #3ecf8e;
    border: 1px solid #3ecf8e55;
    border-radius: 999px;
    padding: 0.15rem 0.4rem;
  }

  .dev-mode-account .badge.current {
    color: #f5f5f5;
    border-color: #555;
  }
</style>
