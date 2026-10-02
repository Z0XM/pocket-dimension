<script lang="ts">
  import { invalidateAll } from "$app/navigation";

  type AccountOption = {
    id: string;
    name: string;
    currencyCode: string;
    colorHex?: string | null;
    bankImporterId?: string | null;
  };

  type Props = {
    accounts: AccountOption[];
    activeAccountId: string;
  };

  const { accounts, activeAccountId }: Props = $props();

  let switching = $state(false);
  let errorMessage = $state<string | null>(null);
  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();

  const activeAccount = $derived(accounts.find((account) => account.id === activeAccountId) ?? accounts[0]);
  const canSwitch = $derived(accounts.length > 1 && !switching);

  function markerStyle(colorHex?: string | null) {
    if (!colorHex) return undefined;
    return `background: color-mix(in srgb, ${colorHex} 72%, transparent)`;
  }

  async function switchAccount(accountId: string) {
    open = false;
    if (accountId === activeAccountId || switching) return;
    switching = true;
    errorMessage = null;
    try {
      const response = await fetch("/api/accounts/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "Could not switch account");
      }
      await invalidateAll();
    } catch (cause) {
      errorMessage = cause instanceof Error ? cause.message : "Could not switch account";
    } finally {
      switching = false;
    }
  }

  function toggleOpen() {
    if (!canSwitch) return;
    open = !open;
  }

  $effect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (root && target && !root.contains(target)) {
        open = false;
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") open = false;
    }

    const timeout = window.setTimeout(() => {
      window.addEventListener("pointerdown", handlePointerDown);
      window.addEventListener("keydown", handleKeyDown);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  });
</script>

{#if accounts.length > 0}
  <div class="account-switcher" class:open class:disabled={!canSwitch} bind:this={root}>
    <button
      type="button"
      class="account-trigger"
      aria-label="Active account"
      aria-expanded={open}
      aria-haspopup="listbox"
      disabled={!canSwitch}
      onclick={toggleOpen}
    >
      <span class="account-value mark" style={markerStyle(activeAccount?.colorHex)}>{activeAccount?.name ?? "Account"}</span>
      {#if canSwitch}
        <span class="account-caret" aria-hidden="true">▾</span>
      {/if}
    </button>

    {#if open}
      <ul class="account-menu" role="listbox" aria-label="Accounts">
        {#each accounts as account (account.id)}
          {@const selected = account.id === activeAccountId}
          <li>
            <button
              type="button"
              role="option"
              class="account-option"
              class:selected
              aria-selected={selected}
              onclick={() => switchAccount(account.id)}
            >
              <span class="mark" style={markerStyle(account.colorHex)}>{account.name}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if errorMessage}
      <p class="err">{errorMessage}</p>
    {/if}
  </div>
{/if}

<style>
  .account-switcher {
    position: relative;
    min-width: 7.5rem;
  }

  .account-trigger {
    appearance: none;
    width: 100%;
    display: flex;
    align-items: baseline;
    justify-content: flex-start;
    gap: 0.4rem;
    background: transparent;
    border: none;
    border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 32%, transparent);
    border-radius: 0;
    color: var(--ink);
    font-family: var(--hand);
    font-size: 0.95rem;
    letter-spacing: 0.01em;
    padding: 0.05rem 0.1rem 0.28rem;
    cursor: pointer;
    text-align: left;
  }

  .account-trigger:hover:not(:disabled),
  .account-switcher.open .account-trigger {
    border-bottom-color: var(--brand);
  }

  .account-trigger:disabled {
    cursor: default;
    opacity: 0.95;
  }

  .mark {
    display: inline-block;
    padding: 0.05rem 0.2rem;
    border-radius: 2px 8px 3px 7px / 7px 2px 8px 2px;
    transform: rotate(-0.6deg);
    line-height: 1.15;
  }

  .account-value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-caret {
    flex: none;
    margin-left: auto;
    color: var(--ink-muted);
    font-size: 0.85rem;
    line-height: 1;
  }

  .account-menu {
    list-style: none;
    margin: 0.2rem 0 0;
    padding: 0.35rem 0.25rem;
    position: absolute;
    left: 0;
    min-width: 100%;
    z-index: 40;
    background: var(--surface-raised);
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 2px 6px 3px 2px;
    box-shadow:
      2px 2px 0 0 var(--shadow-paper),
      2px 2px 0 1.5px color-mix(in srgb, var(--ink) 16%, transparent);
    max-height: 14rem;
    overflow: auto;
  }

  .account-option {
    appearance: none;
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    border: none;
    background: transparent;
    color: var(--ink);
    font-family: var(--hand);
    font-size: 1.02rem;
    padding: 0.28rem 0.45rem;
    cursor: pointer;
    text-align: left;
  }

  .account-option:hover {
    background: color-mix(in srgb, var(--yellow) 35%, transparent);
  }

  .err {
    margin: 0.25rem 0 0;
    font-family: var(--ui);
    font-size: 0.82rem;
    color: var(--neg);
  }
</style>
