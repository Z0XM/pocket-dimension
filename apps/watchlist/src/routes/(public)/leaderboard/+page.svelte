<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import type { LeaderboardData } from "$lib/server/leaderboard";
  import LeaderboardContent from "./leaderboard-content.svelte";

  const { data } = $props();
  const leaderboard = $derived(data.leaderboard as LeaderboardData | null);
</script>

{#if leaderboard}
  <LeaderboardContent {leaderboard} />
{:else}
  <div class="h-screen overflow-y-scroll pb-28">
    <div class="max-w-3xl mx-auto px-4 py-8">
      <Card.Root>
        <Card.Content class="px-4 py-8 text-center text-muted-foreground">
          Unable to load leaderboard data. Make sure the database is running and try again.
        </Card.Content>
      </Card.Root>
    </div>
  </div>
{/if}
