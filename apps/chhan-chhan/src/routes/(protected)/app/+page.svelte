<script lang="ts">
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import { onMount } from "svelte";

  const { data } = $props();
</script>

<main class="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 bg-background px-4 py-6 text-foreground sm:px-8"></main>
