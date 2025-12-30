<script lang="ts">
import "../app.css";
import { ModeWatcher } from "mode-watcher";
import { Toaster } from "$components/ui/sonner/index.js";
import favicon from "$lib/assets/favicon.svg";

const { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<ModeWatcher />
<Toaster />
{@render children()}
