<script lang="ts">
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import WaveBars from "$lib/components/WaveBars.svelte";
  import icon from "$lib/assets/icon.svg";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const pending = $derived(data.access === "pending");

  async function signOut() {
    await authClient.signOut();
    await goto("/");
  }
</script>

<svelte:head>
  <title>{pending ? "Access pending" : "Access blocked"} · Zap</title>
</svelte:head>

<main class="zap-wave-field zap-grid relative min-h-screen overflow-hidden">
  <div class="relative z-10 mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
    <img src={icon} alt="" class="mb-4 size-14 rounded-xl" width="56" height="56" />
    <p class="font-mono text-xs tracking-[0.35em] text-signal/80 uppercase">Zap</p>
    <h1 class="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
      {pending ? "Access pending" : "Access blocked"}
    </h1>
    <div class="mt-6 opacity-50"><WaveBars /></div>
    <p class="mt-6 text-muted-foreground">
      {#if pending}
        Zap is invite-only right now. A Zap admin needs to allow your account
        <span class="font-mono text-foreground">{data.user?.username ?? data.user?.email}</span> before you can use it.
      {:else}
        A Zap admin has blocked your account
        <span class="font-mono text-foreground">{data.user?.username ?? data.user?.email}</span> from using Zap. Your other Pocket Dimension apps are not
        affected.
      {/if}
    </p>
    <p class="mt-2 font-mono text-[11px] text-muted-foreground">Contact a Zap admin if you think this is a mistake.</p>
    <div class="mt-8">
      <button type="button" class="rounded border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary" onclick={signOut}>
        Sign out
      </button>
    </div>
  </div>
</main>
