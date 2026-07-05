<script lang="ts">
  import { onDestroy } from "svelte";
  import { classifyGesture } from "$lib/gestures/gesture-classifier";
  import { createGestureActionEngine } from "$lib/gestures/gesture-action-engine";
  import { detectHandLandmarks } from "$lib/gestures/hand-tracker";
  import type { DetectedGesture, GestureAction, VideoTrackingFrame } from "$lib/gestures/gesture-types";

  type Props = {
    videoTrack: MediaStreamTrack | null;
    active?: boolean;
    gesturesEnabled?: boolean;
    overlayVisible?: boolean;
    onFrameUpdate?: (frame: VideoTrackingFrame) => void;
    onGestureAction?: (action: GestureAction, gesture: DetectedGesture) => void;
  };

  let { videoTrack, active = true, gesturesEnabled = false, overlayVisible = false, onFrameUpdate, onGestureAction }: Props = $props();

  let videoEl = $state<HTMLVideoElement | null>(null);

  const shouldRun = $derived(active && Boolean(videoTrack) && (gesturesEnabled || overlayVisible));

  const actionEngine = createGestureActionEngine({
    onAction: (action, gesture) => onGestureAction?.(action, gesture),
  });

  let rafId = 0;
  let lastFrameAt = 0;
  let stream: MediaStream | null = null;

  const FRAME_INTERVAL_MS = 80;
  const emptyFrame = (): VideoTrackingFrame => ({
    handLandmarks: null,
    gesture: "none",
    holdProgress: 0,
  });

  function publishFrame(frame: VideoTrackingFrame) {
    onFrameUpdate?.(frame);
  }

  function clearLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    lastFrameAt = 0;
    actionEngine.resetHold();
    publishFrame(emptyFrame());
  }

  function attachTrack(track: MediaStreamTrack | null) {
    if (!videoEl) return;

    if (stream) {
      videoEl.srcObject = null;
      stream = null;
    }

    if (!track || track.readyState === "ended") {
      clearLoop();
      return;
    }

    stream = new MediaStream([track]);
    videoEl.srcObject = stream;
    void videoEl.play().catch(() => {
      // Autoplay on a muted hidden video is usually allowed; ignore failures.
    });
  }

  async function processFrame(now: number) {
    if (!shouldRun || !videoEl || videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    if (now - lastFrameAt < FRAME_INTERVAL_MS) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    lastFrameAt = now;

    try {
      const handLandmarks = await detectHandLandmarks(videoEl, now);
      let gesture = handLandmarks ? classifyGesture(handLandmarks) : "none";
      let holdProgress = 0;

      if (gesturesEnabled) {
        const result = actionEngine.update(handLandmarks, now);
        gesture = result.gesture;
        holdProgress = result.holdProgress;
      } else {
        actionEngine.resetHold();
      }

      publishFrame({ handLandmarks, gesture, holdProgress });
    } catch {
      publishFrame(emptyFrame());
    }

    rafId = requestAnimationFrame(tick);
  }

  function tick(now: number) {
    void processFrame(now);
  }

  function startLoop() {
    clearLoop();
    if (!shouldRun) return;
    rafId = requestAnimationFrame(tick);
  }

  $effect(() => {
    attachTrack(videoTrack);
    if (shouldRun) {
      startLoop();
    } else {
      clearLoop();
    }

    return () => {
      clearLoop();
    };
  });

  onDestroy(() => {
    clearLoop();
    if (videoEl) {
      videoEl.srcObject = null;
    }
  });
</script>

<video bind:this={videoEl} class="hidden" playsinline muted aria-hidden="true"></video>
