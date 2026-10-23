<script lang="ts">
  import { goto } from "$app/navigation";
  import Disc3Icon from "@lucide/svelte/icons/disc-3";
  import HeadphonesIcon from "@lucide/svelte/icons/headphones";
  import ListVideoIcon from "@lucide/svelte/icons/list-video";
  import DiscordConnectionPanel from "$lib/components/connections/DiscordConnectionPanel.svelte";
  import SpotifyConnectionPanel from "$lib/components/connections/SpotifyConnectionPanel.svelte";
  import YouTubeConnectionPanel from "$lib/components/connections/YouTubeConnectionPanel.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const tabs = [
    { id: "discord" as const, label: "Discord", icon: HeadphonesIcon },
    { id: "spotify" as const, label: "Spotify", icon: Disc3Icon },
    { id: "youtube" as const, label: "YouTube", icon: ListVideoIcon },
  ];

  const tab = $derived(data.tab);

  function setTab(next: "discord" | "spotify" | "youtube") {
    if (next === tab) return;
    void goto(`/connections?tab=${next}`, { replaceState: true, keepFocus: true, noScroll: true });
  }
</script>

<section class="zap-page">
  <PageHeader title="Connections">
    {#snippet meta()}
      Discord · Spotify · YouTube
    {/snippet}
    <div class="flex flex-wrap gap-1 font-mono text-[11px]" role="tablist" aria-label="Connection providers">
      {#each tabs as t (t.id)}
        {@const Icon = t.icon}
        <button
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          class={`zap-nav-link inline-flex items-center gap-1.5 ${tab === t.id ? "zap-nav-link-active" : ""}`}
          onclick={() => setTab(t.id)}
        >
          <Icon class="size-3.5" aria-hidden="true" />
          {t.label}
        </button>
      {/each}
    </div>
  </PageHeader>

  <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain" role="tabpanel">
    {#if tab === "discord"}
      <DiscordConnectionPanel
        configured={data.discord.configured}
        inviteUrl={data.discord.inviteUrl}
        live={data.discord.live}
        activity={data.discord.activity}
      />
    {:else if tab === "spotify"}
      <SpotifyConnectionPanel />
    {:else}
      <YouTubeConnectionPanel
        oauthConfigured={data.youtube.oauthConfigured}
        linked={data.youtube.linked}
        linkedAt={data.youtube.linkedAt}
        activity={data.youtube.activity}
        connectHref={data.youtube.connectHref}
      />
    {/if}
  </div>
</section>
