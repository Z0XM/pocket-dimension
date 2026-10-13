<script lang="ts">
  import BusyStatus from "$lib/components/BusyStatus.svelte";
</script>

<!-- Redirect-only route; load() always redirects. -->
<section class="space-y-3" aria-busy="true">
  <BusyStatus label="Redirecting…" detail="Opening catalogue…" />
</section>
