<script lang="ts">
  import type { Room } from "livekit-client";
  import type { CallTileLayout } from "$lib/call/grid/types";
  import GridCanvas from "./GridCanvas.svelte";

  type Props = {
    room: Room;
    activeSpeakerIdentity: string | null;
    audioLevels: Record<string, number>;
    localDisplayName: string;
    layoutEditMode: boolean;
    tileLayout: CallTileLayout | null;
    layoutResetToken?: number;
    onLayoutChange: (layout: CallTileLayout) => void;
  };

  const {
    room,
    activeSpeakerIdentity,
    audioLevels,
    localDisplayName,
    layoutEditMode,
    tileLayout,
    layoutResetToken = 0,
    onLayoutChange,
  }: Props = $props();
</script>

<GridCanvas
  {room}
  {activeSpeakerIdentity}
  {audioLevels}
  {localDisplayName}
  editMode={layoutEditMode}
  {tileLayout}
  {layoutResetToken}
  {onLayoutChange}
/>
