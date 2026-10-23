<script lang="ts">
  import Disc3Icon from "@lucide/svelte/icons/disc-3";
</script>

<div class="space-y-6">
  <div class="space-y-3 border border-border/70 bg-card p-4">
    <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Details</h2>
    <p class="flex items-center gap-2 text-sm text-muted-foreground">
      <Disc3Icon class="size-4 shrink-0" aria-hidden="true" />
      Spotify OAuth is not wired in Zap yet. This panel is a placeholder for connect status and activity.
    </p>
  </div>

  <div class="space-y-3">
    <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Activity</h2>
    <p class="font-mono text-[11px] text-muted-foreground">No Spotify activity.</p>
  </div>
</div>
