<script lang="ts">
  import MonitorIcon from "@lucide/svelte/icons/monitor";
  import SmartphoneIcon from "@lucide/svelte/icons/smartphone";
  import Volume2Icon from "@lucide/svelte/icons/volume-2";
  import VolumeXIcon from "@lucide/svelte/icons/volume-x";
  import XIcon from "@lucide/svelte/icons/x";
  import type { CatalogDevice } from "$lib/catalog-queue";
  import type { CatalogQueueClient } from "$lib/catalog-queue-client.svelte";

  let { queue }: { queue: CatalogQueueClient } = $props();

  const online = $derived(queue.devices.filter((d) => d.online));
  const offline = $derived(queue.devices.filter((d) => !d.online));
  const audible = $derived(online.filter((d) => d.outputEnabled).length);

  function isMobile(d: CatalogDevice) {
    return /iOS|Android/.test(d.label);
  }

  function formatSeen(iso: string) {
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
    } catch {
      return iso;
    }
  }
</script>

{#snippet deviceRow(d: CatalogDevice)}
  {@const isMe = d.deviceId === queue.deviceId}
  <li class="space-y-1.5 px-3 py-2">
    <div class="flex items-center gap-2">
      <span class={d.online ? "text-signal" : "text-muted-foreground"}>
        {#if isMobile(d)}<SmartphoneIcon class="size-4" />{:else}<MonitorIcon class="size-4" />{/if}
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-[13px]">
          {d.label}
          {#if isMe}<span class="ml-1 rounded border border-signal/40 px-1 font-mono text-[9px] text-signal uppercase">This device</span>{/if}
        </p>
        <p class="font-mono text-[10px] text-muted-foreground">
          {#if d.online}
            <span class="text-signal">● online</span> · {d.outputEnabled ? "audio on" : "remote only"}
          {:else}
            last seen {formatSeen(d.lastSeenAt)}
          {/if}
        </p>
      </div>
      {#if d.online}
        <button
          type="button"
          class={`inline-flex h-7 items-center gap-1 rounded border px-2 font-mono text-[10px] ${
            d.outputEnabled ? "border-signal/50 bg-signal/10 text-signal" : "border-border text-muted-foreground hover:text-signal"
          }`}
          aria-pressed={d.outputEnabled}
          title={d.outputEnabled ? "Mute this device (remote only)" : "Play audio on this device"}
          onclick={() => void queue.updateDevice(d.deviceId, { outputEnabled: !d.outputEnabled })}
        >
          {#if d.outputEnabled}<Volume2Icon class="size-3.5" /> On{:else}<VolumeXIcon class="size-3.5" /> Off{/if}
        </button>
      {:else}
        <button
          type="button"
          class="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:text-destructive"
          aria-label={`Forget ${d.label}`}
          title="Forget device"
          onclick={() => void queue.forgetDevice(d.deviceId)}
        >
          <XIcon class="size-3.5" />
        </button>
      {/if}
    </div>
    {#if d.online && d.outputEnabled}
      <label class="flex items-center gap-2 pl-6 font-mono text-[10px] text-muted-foreground">
        Vol
        <input
          class="zap-seek h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-[var(--signal)]"
          type="range"
          min="0"
          max="100"
          step="1"
          value={d.volume}
          aria-label={`Volume for ${d.label}`}
          onchange={(e) => void queue.updateDevice(d.deviceId, { volume: Number((e.currentTarget as HTMLInputElement).value) })}
        />
        <span class="w-7 text-right tabular-nums">{d.volume}</span>
      </label>
    {/if}
  </li>
{/snippet}

<div class="flex min-h-0 flex-1 flex-col">
  <p class="shrink-0 border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
    Audio plays on every online device with output on ({audible}). Turn this device off to use it as a remote.
  </p>
  <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
    <ul class="divide-y divide-border/50">
      {#each online as d (d.deviceId)}
        {@render deviceRow(d)}
      {/each}
    </ul>
    {#if offline.length}
      <p class="border-t border-border/60 px-3 pt-2.5 pb-1 font-mono text-[9px] tracking-[0.18em] text-muted-foreground uppercase">Recently seen</p>
      <ul class="divide-y divide-border/50 opacity-80">
        {#each offline as d (d.deviceId)}
          {@render deviceRow(d)}
        {/each}
      </ul>
    {/if}
    {#if queue.error}
      <p class="px-3 py-2 font-mono text-[10px] text-destructive">{queue.error}</p>
    {/if}
  </div>
</div>
