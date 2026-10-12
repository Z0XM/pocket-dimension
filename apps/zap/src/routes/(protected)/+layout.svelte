<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import StartSessionButton from "$lib/components/StartSessionButton.svelte";
  import WaveBars from "$lib/components/WaveBars.svelte";
  import type { LayoutData } from "../$types";
  import { goto } from "$app/navigation";

  let { data, children }: { data: LayoutData; children: import("svelte").Snippet } = $props();

  async function signOut() {
    await authClient.signOut();
    await goto("/");
  }
</script>

<div class="zap-wave-field zap-grid min-h-screen">
  <header class="border-b border-border/60 bg-background/70 backdrop-blur">
    <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
      <a href="/" class="flex items-center gap-3">
        <span class="text-xl font-semibold tracking-tight text-foreground">Zap</span>
        <WaveBars />
      </a>
      <div class="flex flex-wrap items-center justify-end gap-2 font-mono text-xs text-muted-foreground sm:gap-3">
        <a href="/library" class="hover:text-signal">Library</a>
        <a href="/library?tab=upload" class="hover:text-signal">Add</a>
        <a href="/join" class="hover:text-signal">Join</a>
        <StartSessionButton
          label="Session"
          class="rounded border border-signal/40 bg-signal/10 px-2 py-1 text-[11px] text-signal hover:bg-signal/20 disabled:opacity-40"
        />
        <span class="hidden sm:inline">{data.user?.username ?? data.user?.email}</span>
        <button type="button" class="rounded border border-border px-2 py-1 hover:bg-secondary" onclick={signOut}> Sign out </button>
      </div>
    </div>
  </header>
  <main class="mx-auto max-w-5xl px-6 py-8">
    {@render children()}
  </main>
</div>
