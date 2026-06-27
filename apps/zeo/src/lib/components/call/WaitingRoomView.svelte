<script lang="ts">
  type Props = {
    hostName: string;
    onLeaveWaiting: () => void;
  };

  const { hostName, onLeaveWaiting }: Props = $props();
</script>

<section class="rounded-xl border border-border bg-card/60 px-6 py-8 text-center space-y-4">
  <div class="mx-auto size-10 animate-pulse rounded-full border-2 border-primary border-t-transparent" aria-hidden="true"></div>
  <div class="space-y-2">
    <h2 class="text-lg font-semibold text-foreground">Waiting for admission</h2>
    <p class="text-sm text-muted-foreground">
      {hostName} has enabled the waiting room. You'll join when the host admits you.
    </p>
  </div>
  <button
    type="button"
    class="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
    onclick={onLeaveWaiting}
  >
    Leave waiting room
  </button>
</section>
