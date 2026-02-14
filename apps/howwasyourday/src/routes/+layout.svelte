<script lang="ts">
import "../app.css";
import { onMount } from "svelte";

const { children } = $props();

// Set timezone offset cookie so the server can compute dates in the client's timezone
onMount(() => {
  const offset = new Date().getTimezoneOffset();
  document.cookie = `tz_offset=${offset};path=/;max-age=${7 * 86400};SameSite=Lax`;
});
</script>

{@render children()}
