<script lang="ts">
  import type { TileMediaStats } from "$lib/livekit/tile-stats";

  type Props = {
    stats?: TileMediaStats | null;
    class?: string;
  };

  const { stats = null, class: className = "" }: Props = $props();

  const ping = $derived(stats?.pingMs != null && stats.pingMs > 0 ? `${stats.pingMs} ms` : "—");
  const video = $derived(stats?.videoQuality ?? "—");
  const audio = $derived(stats?.audioKbps != null ? `${stats.audioKbps} kbps` : "—");
  const fps = $derived(stats?.fps != null ? `${stats.fps} fps` : "—");
</script>

<div
  class="pointer-events-none absolute left-2 top-2 z-[3] rounded-sm bg-black/45 px-1.5 py-1 font-mono text-[10px] leading-tight text-white/85 {className}"
  aria-hidden="true"
>
  <div>{ping}</div>
  <div>{video} · {fps}</div>
  <div>{audio}</div>
</div>
