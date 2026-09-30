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

  async function switchAccount(accountId: string) {
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
</script>

{#if accounts.length > 0}
  <div class="account-switcher">
    <div class="select-wrap">
      {#if accounts.find((a) => a.id === activeAccountId)?.colorHex}
        <span class="swatch" style="background: {accounts.find((a) => a.id === activeAccountId)?.colorHex}" aria-hidden="true"></span>
      {/if}
      <select
        aria-label="Active account"
        disabled={switching || accounts.length < 2}
        value={activeAccountId}
        onchange={(event) => switchAccount((event.currentTarget as HTMLSelectElement).value)}
      >
        {#each accounts as account (account.id)}
          <option value={account.id}>{account.name}</option>
        {/each}
      </select>
    </div>
    {#if errorMessage}
      <p class="err">{errorMessage}</p>
    {/if}
  </div>
{/if}

<style>
  .account-switcher {
    min-width: 10rem;
  }

  .select-wrap {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border: 1px solid color-mix(in srgb, var(--chrome-line) 70%, transparent);
    flex-shrink: 0;
  }

  select {
    background: var(--surface2);
    border: 2px solid var(--chrome-line);
    color: var(--main-text);
    padding: 0.35rem 0.5rem;
    font-family: inherit;
    font-size: 0.78rem;
    max-width: 12rem;
  }

  select:disabled {
    opacity: 0.85;
  }

  .err {
    margin: 0.25rem 0 0;
    font-size: 0.68rem;
    color: #ff6b6b;
  }
</style>
