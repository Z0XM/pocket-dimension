<script lang="ts">
import "../app.css";
import { Toaster } from "$components/ui/sonner/index.js";
import favicon from "$lib/assets/favicon.svg";
import Background from "$components/background.svelte";
import Overlay from "$components/overlay.svelte";

const { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>
<Background enableFilter={true}/>
<Toaster />
<Overlay />
{@render children()}
