<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  type WaitingGuest = {
    identity: string;
    displayName: string;
    requestedAt: string;
  };

  type Props = {
    pending: WaitingGuest[];
    loading?: boolean;
    onAdmit: (identity: string) => void;
    onDeny: (identity: string) => void;
  };

  const { pending, loading = false, onAdmit, onDeny }: Props = $props();
</script>

<section class="rounded-xl border border-border bg-card/60 px-6 py-5 space-y-4">
  <div>
    <h2 class="text-lg font-semibold text-foreground">Waiting room</h2>
    <p class="text-sm text-muted-foreground">Admit participants before they can join the call.</p>
  </div>

  {#if loading}
    <p class="text-sm text-muted-foreground">Loading…</p>
  {:else if pending.length === 0}
    <p class="text-sm text-muted-foreground">No one is waiting.</p>
  {:else}
    <ul class="space-y-2">
      {#each pending as guest (guest.identity)}
        <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
          <div>
            <p class="text-sm font-medium text-foreground">{guest.displayName}</p>
            <p class="text-xs text-muted-foreground">Requested {new Date(guest.requestedAt).toLocaleTimeString()}</p>
          </div>
          <div class="flex gap-2">
            <Button size="sm" onclick={() => onAdmit(guest.identity)}>Admit</Button>
            <Button size="sm" variant="secondary" onclick={() => onDeny(guest.identity)}>Deny</Button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>
