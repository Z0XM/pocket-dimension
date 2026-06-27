<script lang="ts">
  import { browser } from "$app/environment";
  import { onDestroy, onMount } from "svelte";
  import { RoomEvent, Track, type LocalTrackPublication, type Room } from "livekit-client";
  import type { CallPhase, PermissionState } from "$lib/livekit/types";
  import { startMediaPreview, stopMediaPreview, syncPreviewTracks } from "$lib/livekit/media-preview";
  import { createCallRoom, wasParticipantRemoved, wasRoomDeleted, type ConnectionPhase } from "$lib/livekit/room-client";
  import { findScreenShareParticipant, isScreenShareActive } from "$lib/livekit/screen-share";
  import { captureCallSnapshot } from "$lib/snapshot";
  import PreCallLobby from "$lib/components/call/PreCallLobby.svelte";
  import CallStage from "$lib/components/call/CallStage.svelte";
  import ControlBar from "$lib/components/call/ControlBar.svelte";
  import ConnectionBanner from "$lib/components/call/ConnectionBanner.svelte";

  type Props = {
    slug: string;
    roomTitle: string;
    hostName: string;
    maxParticipants: number;
    isHost: boolean;
    user: { id: string; email: string; username: string | null } | null;
    initialParticipantCount: number;
    initialIsFull: boolean;
    initialIsEnded: boolean;
    onPhaseChange?: (phase: CallPhase) => void;
  };

  const { slug, roomTitle, hostName, maxParticipants, isHost, user, initialParticipantCount, initialIsFull, initialIsEnded, onPhaseChange }: Props =
    $props();

  const guestStorageKey = `zeo-guest:${slug}`;

  let phase = $state<CallPhase>(initialIsEnded ? "ended" : "lobby");

  function setPhase(next: CallPhase) {
    phase = next;
    onPhaseChange?.(next);
  }

  let participantCount = $state(initialParticipantCount);
  let isFull = $state(initialIsFull);
  let isEnded = $state(initialIsEnded);
  let guestName = $state("");
  let errorMessage = $state<string | null>(null);
  let disconnectMessage = $state<string | null>(null);
  let joining = $state(false);
  let ending = $state(false);

  let micEnabled = $state(true);
  let camEnabled = $state(true);
  let permissionState = $state<PermissionState>("prompt");
  let previewStream = $state<MediaStream | null>(null);
  let previewReady = $state(false);

  let livekitRoom = $state<Room | null>(null);
  let activeSpeakerIdentity = $state<string | null>(null);
  let connectionGen = $state(0);
  let mediaRevision = $state(0);
  let localDisplayName = $state("");
  let callSession: ReturnType<typeof createCallRoom> | null = null;
  let stageEl = $state<HTMLElement | null>(null);
  let intentionalScreenShareStop = false;
  let snapshotting = $state(false);
  let snapshotFlash = $state(false);
  let toastMessage = $state<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let screenShareListenerCleanup: (() => void) | undefined;

  let refreshTimer: ReturnType<typeof setInterval> | undefined;

  const userDisplayName = $derived(user?.username ?? user?.email ?? null);
  const isGuest = $derived(!user);
  const canJoinLobby = $derived(!isEnded && !isFull && (user !== null || guestName.trim().length > 0) && previewReady && phase === "lobby");
  const screenSharing = $derived.by(() => {
    mediaRevision;
    return livekitRoom ? isScreenShareActive(livekitRoom.localParticipant) : false;
  });

  function showToast(message: string) {
    toastMessage = message;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastMessage = null;
    }, 3500);
  }

  function bumpMediaRevision() {
    mediaRevision += 1;
  }

  async function refreshRoomMeta() {
    const res = await fetch(`/api/rooms/${slug}`);
    if (!res.ok) return;
    const payload = await res.json();
    participantCount = payload.participantCount;
    isFull = payload.isFull;
    isEnded = payload.isEnded;
    if (payload.isEnded && phase !== "ended") {
      setPhase("ended");
      await teardownCall(false);
    }
  }

  async function setupPreview() {
    const result = await startMediaPreview({ audio: true, video: true });
    permissionState = result.permission;
    previewStream = result.stream;
    previewReady = true;

    if (result.permission === "denied") {
      micEnabled = false;
      camEnabled = false;
    }
  }

  async function teardownCall(disconnectLiveKit: boolean) {
    screenShareListenerCleanup?.();
    screenShareListenerCleanup = undefined;
    if (disconnectLiveKit && callSession) {
      await callSession.disconnect();
    }
    callSession = null;
    livekitRoom = null;
    stopMediaPreview(previewStream);
    previewStream = null;
  }

  function attachScreenShareListener(room: Room, gen: number) {
    screenShareListenerCleanup?.();

    const onLocalTrackUnpublished = (publication: LocalTrackPublication) => {
      if (gen !== connectionGen) return;
      bumpMediaRevision();
      if (publication.source !== Track.Source.ScreenShare) return;
      if (intentionalScreenShareStop) {
        intentionalScreenShareStop = false;
        return;
      }
      showToast("Your screen share was stopped");
    };

    room.on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
    screenShareListenerCleanup = () => {
      room.off(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
    };
  }

  function bindConnectionHandlers(gen: number) {
    return {
      onPhaseChange: (connectionPhase: ConnectionPhase) => {
        if (gen !== connectionGen) return;
        if (connectionPhase === "connecting") setPhase("connecting");
        else if (connectionPhase === "connected") setPhase("in_call");
        else if (connectionPhase === "reconnecting") setPhase("reconnecting");
        else if (connectionPhase === "disconnected" && phase !== "ended") setPhase("disconnected");
      },
      onActiveSpeaker: (identity: string | null) => {
        if (gen !== connectionGen) return;
        activeSpeakerIdentity = identity;
      },
      onParticipantsChange: () => {
        if (gen !== connectionGen) return;
        bumpMediaRevision();
        livekitRoom = callSession?.room ?? null;
      },
      onDisconnect: (reason?: import("livekit-client").DisconnectReason) => {
        if (gen !== connectionGen) return;
        if (wasRoomDeleted(reason) || isEnded) {
          setPhase("ended");
          disconnectMessage = "This room has ended";
          return;
        }
        if (wasParticipantRemoved(reason)) {
          disconnectMessage = "You were removed from this call";
          setPhase("disconnected");
          return;
        }
        disconnectMessage = "Connection lost";
        setPhase("disconnected");
      },
    };
  }

  async function requestToken() {
    const body: Record<string, string> = {};
    if (isGuest) {
      body.guestName = guestName.trim();
      const stored = sessionStorage.getItem(guestStorageKey);
      if (stored) body.guestIdentity = stored;
    }

    const res = await fetch(`/api/rooms/${slug}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload.message ?? "Could not join room");
    }

    if (payload.identity?.startsWith("guest_")) {
      sessionStorage.setItem(guestStorageKey, payload.identity);
    }

    localDisplayName = payload.displayName ?? guestName.trim();

    return payload as { token: string; wsUrl: string; iceServers?: RTCIceServer[] };
  }

  async function joinCall() {
    errorMessage = null;
    joining = true;

    try {
      stopMediaPreview(previewStream);
      previewStream = null;

      const { token, wsUrl, iceServers } = await requestToken();
      connectionGen += 1;
      const gen = connectionGen;

      callSession = createCallRoom(bindConnectionHandlers(gen));
      livekitRoom = callSession.room;

      await callSession.connect(wsUrl, token, {
        micEnabled: micEnabled && permissionState !== "denied",
        camEnabled: camEnabled && permissionState === "granted",
        iceServers,
      });

      attachScreenShareListener(callSession.room, gen);
      setPhase("in_call");
      await refreshRoomMeta();
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Could not join room";
      await setupPreview();
    } finally {
      joining = false;
    }
  }

  async function leaveCall() {
    connectionGen += 1;
    await teardownCall(true);
    setPhase("lobby");
    await setupPreview();
    await refreshRoomMeta();
  }

  async function rejoinCall() {
    disconnectMessage = null;
    setPhase("lobby");
    await setupPreview();
  }

  async function endRoom() {
    if (!confirm("End this room for everyone?")) return;
    ending = true;
    try {
      const res = await fetch(`/api/rooms/${slug}/end`, { method: "POST" });
      if (!res.ok) {
        errorMessage = "Could not end room";
        return;
      }
      isEnded = true;
      setPhase("ended");
      await teardownCall(true);
    } finally {
      ending = false;
    }
  }

  function toggleMic() {
    micEnabled = !micEnabled;
    if (phase === "lobby") {
      syncPreviewTracks(previewStream, { audio: micEnabled, video: camEnabled });
    } else if (livekitRoom) {
      livekitRoom.localParticipant.setMicrophoneEnabled(micEnabled);
    }
  }

  function toggleCam() {
    camEnabled = !camEnabled;
    if (phase === "lobby") {
      syncPreviewTracks(previewStream, { audio: micEnabled, video: camEnabled });
    } else if (livekitRoom) {
      livekitRoom.localParticipant.setCameraEnabled(camEnabled);
    }
  }

  async function toggleScreenShare() {
    if (!livekitRoom) return;
    const local = livekitRoom.localParticipant;

    if (isScreenShareActive(local)) {
      intentionalScreenShareStop = true;
      await local.setScreenShareEnabled(false);
      bumpMediaRevision();
      return;
    }

    const otherSharer = findScreenShareParticipant(livekitRoom, local.identity);
    if (otherSharer) {
      const res = await fetch(`/api/rooms/${slug}/screen-share/stop-active`, { method: "POST" });
      if (!res.ok) {
        showToast("Could not take over screen share");
        return;
      }
    }

    try {
      await local.setScreenShareEnabled(true);
      bumpMediaRevision();
    } catch {
      showToast("Could not start screen share");
    }
  }

  async function takeSnapshot() {
    if (!stageEl || snapshotting) return;
    snapshotting = true;
    snapshotFlash = true;

    try {
      await captureCallSnapshot({ slug, stageRoot: stageEl });
      showToast("Snapshot saved");
    } catch {
      showToast("Could not capture snapshot");
    } finally {
      snapshotting = false;
      setTimeout(() => {
        snapshotFlash = false;
      }, 200);
    }
  }

  onMount(() => {
    if (!browser) return;
    onPhaseChange?.(phase);
    setupPreview();
    refreshTimer = setInterval(refreshRoomMeta, 5000);
    refreshRoomMeta();
  });

  onDestroy(() => {
    if (refreshTimer) clearInterval(refreshTimer);
    if (toastTimer) clearTimeout(toastTimer);
    teardownCall(true);
  });
</script>

{#if phase === "in_call" || phase === "connecting" || phase === "reconnecting" || (phase === "disconnected" && !isEnded)}
  <div class="fixed inset-0 z-50 flex flex-col bg-background">
    <ConnectionBanner {phase} {disconnectMessage} onRejoin={phase === "disconnected" && !isEnded ? rejoinCall : undefined} />

    {#if toastMessage}
      <div
        class="pointer-events-none fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-lg border border-border bg-card/95 px-4 py-2 text-sm text-foreground shadow-lg backdrop-blur-sm"
        role="status"
      >
        {toastMessage}
      </div>
    {/if}

    {#if snapshotFlash}
      <div class="pointer-events-none fixed inset-0 z-[55] bg-white/25" aria-hidden="true"></div>
    {/if}

    {#if livekitRoom && (phase === "in_call" || phase === "reconnecting")}
      <div class="relative min-h-0 flex-1">
        <CallStage room={livekitRoom} {activeSpeakerIdentity} {localDisplayName} {mediaRevision} bind:stageRef={stageEl} />
      </div>
      <ControlBar
        {isHost}
        {micEnabled}
        {camEnabled}
        {screenSharing}
        {snapshotting}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onToggleScreenShare={toggleScreenShare}
        onSnapshot={takeSnapshot}
        onLeave={leaveCall}
        onEndRoom={isHost ? endRoom : undefined}
        {ending}
      />
    {:else if phase === "connecting"}
      <div class="flex flex-1 items-center justify-center text-muted-foreground">Connecting…</div>
    {/if}
  </div>
{:else if phase === "ended" || isEnded}
  <ConnectionBanner phase="ended" />
{:else if isFull}
  <div class="rounded-xl border border-border bg-card/60 px-6 py-6">
    <p class="text-sm text-destructive">Room is full ({maxParticipants} of {maxParticipants} joined)</p>
  </div>
{:else}
  {#if errorMessage}
    <div class="auth-error mb-4">{errorMessage}</div>
  {/if}

  <PreCallLobby
    {roomTitle}
    {hostName}
    {participantCount}
    {maxParticipants}
    {isGuest}
    {guestName}
    {userDisplayName}
    {micEnabled}
    {camEnabled}
    {permissionState}
    {previewStream}
    {joining}
    canJoin={canJoinLobby}
    onGuestNameChange={(v) => (guestName = v)}
    onToggleMic={toggleMic}
    onToggleCam={toggleCam}
    onJoin={joinCall}
  />

  {#if isHost}
    <p class="mt-4 text-xs text-muted-foreground">Host controls appear after you join the call.</p>
  {/if}
{/if}
