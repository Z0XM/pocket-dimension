<script lang="ts">
  import { Separator } from "$lib/components/ui/separator";
  import { SettingToggle } from "$lib/components/ui/setting-toggle";

  type Props = {
    gesturesEnabled?: boolean;
    overlayVisible?: boolean;
    cameraAvailable?: boolean;
    /** Skip outer frame/title when nested in another section. */
    embedded?: boolean;
    onGesturesEnabledChange?: (enabled: boolean) => void;
    onOverlayVisibleChange?: (visible: boolean) => void;
  };

  let {
    gesturesEnabled = false,
    overlayVisible = false,
    cameraAvailable = true,
    embedded = false,
    onGesturesEnabledChange,
    onOverlayVisibleChange,
  }: Props = $props();
</script>

<div class={embedded ? "" : "rounded-lg border border-border px-3"}>
  {#if !embedded}
    <p class="px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Hand gestures</p>
  {/if}
  <SettingToggle
    id="gestures-enabled"
    label="Enable hand gestures"
    tooltip="Hold a shaka 🤙 or OK sign 👌 to toggle your microphone."
    checked={gesturesEnabled}
    disabled={!cameraAvailable}
    onCheckedChange={onGesturesEnabledChange}
  />
  <Separator />
  <SettingToggle
    id="gestures-overlay"
    label="Show hand tracking"
    tooltip="Draw hand landmark dots and skeleton lines on your camera video."
    checked={overlayVisible}
    disabled={!cameraAvailable}
    onCheckedChange={onOverlayVisibleChange}
  />
  {#if !cameraAvailable}
    <p class="px-2 pb-2 text-xs text-muted-foreground">Turn on your camera to use hand gestures.</p>
  {:else}
    <p class="px-2 pb-2 text-xs text-muted-foreground">🤙 Shaka or 👌 OK sign → toggle mic. Hold for about a second. No camera gestures.</p>
  {/if}
</div>
