<script lang="ts">
  import { browser } from "$app/environment";
  import { onDestroy, onMount } from "svelte";
  import { RoomEvent, Track, type ConnectionQuality, type LocalTrackPublication, type Room, supportsAudioOutputSelection } from "livekit-client";
  import type { CallPhase, PermissionState } from "$lib/livekit/types";
  import { startMediaPreview, stopMediaPreview, syncPreviewTracks, restartMediaPreview } from "$lib/livekit/media-preview";
  import { listMediaDevices, type MediaDeviceLists } from "$lib/livekit/devices";
  import { qualityLabel, type QualityLabel } from "$lib/livekit/connection-quality";
  import { readConnectionRttMs } from "$lib/livekit/connection-stats";
  import {
    createCallRoom,
    attachMicGateProcessor,
    setRoomSpeakerMuted,
    wasParticipantRemoved,
    wasRoomDeleted,
    type ConnectionPhase,
  } from "$lib/livekit/room-client";
  import { createMicGateProcessor, type MicGateProcessor } from "$lib/livekit/mic-gate-processor";
  import { findScreenShareParticipant, isScreenShareActive } from "$lib/livekit/screen-share";
  import { captureCallSnapshot } from "$lib/snapshot";
  import PreCallLobby from "$lib/components/call/PreCallLobby.svelte";
  import CallStage from "$lib/components/call/CallStage.svelte";
  import ControlBar from "$lib/components/call/ControlBar.svelte";
  import ConnectionBanner from "$lib/components/call/ConnectionBanner.svelte";
  import ChatPanel from "$lib/components/call/ChatPanel.svelte";
  import WaitingRoomView from "$lib/components/call/WaitingRoomView.svelte";
  import HostWaitingPanel from "$lib/components/call/HostWaitingPanel.svelte";
  import ConnectionQualityBadge from "$lib/components/call/ConnectionQualityBadge.svelte";
  import DevicePicker from "$lib/components/call/DevicePicker.svelte";
  import { readStored, STORAGE_KEYS, writeStored } from "$lib/browser-storage";

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
    initialWaitingRoomEnabled?: boolean;
    initialIsPublic?: boolean;
    initialIsStale?: boolean;
    initialIsScheduledForFuture?: boolean;
    initialScheduledStartLabel?: string | null;
    initialIsJoinable?: boolean;
    chatEnabled?: boolean;
    onPhaseChange?: (phase: CallPhase) => void;
  };

  const {
    slug,
    roomTitle,
    hostName,
    maxParticipants,
    isHost,
    user,
    initialParticipantCount,
    initialIsFull,
    initialIsEnded,
    initialWaitingRoomEnabled = false,
    initialIsPublic = false,
    initialIsStale = false,
    initialIsScheduledForFuture = false,
    initialScheduledStartLabel = null,
    initialIsJoinable = true,
    chatEnabled = true,
    onPhaseChange,
  }: Props = $props();

  const guestStorageKey = `zeo-guest:${slug}`;

  let phase = $state<CallPhase>(initialIsEnded ? "ended" : "lobby");

  function setPhase(next: CallPhase) {
    phase = next;
    onPhaseChange?.(next);
  }

  let participantCount = $state(initialParticipantCount);
  let isFull = $state(initialIsFull);
  let isEnded = $state(initialIsEnded);
  let isScheduledForFuture = $state(initialIsScheduledForFuture);
  let scheduledStartLabel = $state<string | null>(initialScheduledStartLabel);
  let isJoinable = $state(initialIsJoinable);
  let roomIsPublic = $state(initialIsPublic);
  let isStale = $state(initialIsStale);
  let updatingVisibility = $state(false);
  let guestName = $state("");
  let errorMessage = $state<string | null>(null);
  let disconnectMessage = $state<string | null>(null);
  let joining = $state(false);
  let ending = $state(false);

  let micEnabled = $state(true);
  let speakerEnabled = $state(true);
  let camEnabled = $state(true);
  let permissionState = $state<PermissionState>("prompt");
  let previewStream = $state<MediaStream | null>(null);
  let previewReady = $state(false);
  let mediaDevices = $state<MediaDeviceLists>({ audioInputs: [], audioOutputs: [], videoInputs: [] });
  let audioDeviceId = $state("");
  let audioOutputDeviceId = $state("");
  let videoDeviceId = $state("");
  let micTestActive = $state(false);
  let showInCallDevices = $state(false);
  let micGateProcessor = $state<MicGateProcessor | null>(null);

  function readStoredPercent(key: string, fallback: number) {
    const stored = readStored(key);
    if (!stored) return fallback;
    const parsed = Number.parseInt(stored, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(100, Math.max(0, parsed));
  }

  function createFreshMicGateProcessor() {
    return createMicGateProcessor({
      volume: readStoredPercent(STORAGE_KEYS.micOutputVolume, 75) / 100,
      cutoff: readStoredPercent(STORAGE_KEYS.micInputCutoff, 5) / 100,
    });
  }

  async function releasePreviewForJoin() {
    micTestActive = false;
    stopMediaPreview(previewStream);
    previewStream = null;
    micGateProcessor = createFreshMicGateProcessor();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  let waitingRoomEnabled = $state(initialWaitingRoomEnabled);
  let waitingIdentity = $state<string | null>(null);
  let pendingWaiting = $state<Array<{ identity: string; displayName: string; requestedAt: string }>>([]);
  let waitingHostLoading = $state(false);
  let waitingPollTimer: ReturnType<typeof setInterval> | undefined;
  let hostWaitingTimer: ReturnType<typeof setInterval> | undefined;

  let chatOpen = $state(false);
  let localConnectionQuality = $state<QualityLabel>("unknown");
  let localPingMs = $state<number | null>(null);

  let livekitRoom = $state<Room | null>(null);
  let activeSpeakerIdentity = $state<string | null>(null);
  let audioLevels = $state<Record<string, number>>({});
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
  let pingPollTimer: ReturnType<typeof setInterval> | undefined;

  const userDisplayName = $derived(user?.username ?? user?.email ?? null);
  const isGuest = $derived(!user);
  const canJoinLobby = $derived(
    !isEnded && isJoinable && !isFull && (user !== null || guestName.trim().length > 0) && previewReady && phase === "lobby"
  );
  const showAudioOutputSelection = $derived(browser ? supportsAudioOutputSelection() && mediaDevices.audioOutputs.length > 0 : false);
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
    waitingRoomEnabled = payload.waitingRoomEnabled ?? waitingRoomEnabled;
    isScheduledForFuture = payload.isScheduledForFuture ?? isScheduledForFuture;
    scheduledStartLabel = payload.scheduledStartLabel ?? scheduledStartLabel;
    isJoinable = payload.isJoinable ?? isJoinable;
    if (payload.isPublic !== undefined) roomIsPublic = payload.isPublic;
    if (payload.status === "stale") isStale = true;
    if (payload.status === "active") isStale = false;
    if (payload.isEnded && phase !== "ended") {
      setPhase("ended");
      await teardownCall(false);
    }
  }

  async function loadMediaDevices() {
    mediaDevices = await listMediaDevices();
    if (micEnabled && audioDeviceId && !mediaDevices.audioInputs.some((device) => device.deviceId === audioDeviceId)) {
      audioDeviceId = mediaDevices.audioInputs[0]?.deviceId ?? "";
    }
    if (camEnabled && videoDeviceId && !mediaDevices.videoInputs.some((device) => device.deviceId === videoDeviceId)) {
      videoDeviceId = mediaDevices.videoInputs[0]?.deviceId ?? "";
    }
    if (micEnabled && !audioDeviceId && mediaDevices.audioInputs[0]) {
      audioDeviceId = mediaDevices.audioInputs[0].deviceId;
    }
    if (camEnabled && !videoDeviceId && mediaDevices.videoInputs[0]) {
      videoDeviceId = mediaDevices.videoInputs[0].deviceId;
    }
    if (showAudioOutputSelection) {
      const storedOutput = readStored(STORAGE_KEYS.audioOutputDeviceId);
      if (audioOutputDeviceId && !mediaDevices.audioOutputs.some((device) => device.deviceId === audioOutputDeviceId)) {
        audioOutputDeviceId = mediaDevices.audioOutputs[0]?.deviceId ?? "";
      }
      if (!audioOutputDeviceId) {
        audioOutputDeviceId =
          storedOutput && mediaDevices.audioOutputs.some((device) => device.deviceId === storedOutput)
            ? storedOutput
            : (mediaDevices.audioOutputs[0]?.deviceId ?? "");
      }
    }
  }

  async function setupPreview() {
    const result = await startMediaPreview({
      audio: true,
      video: true,
      audioDeviceId: audioDeviceId || undefined,
      videoDeviceId: videoDeviceId || undefined,
    });
    permissionState = result.permission;
    previewStream = result.stream;
    previewReady = true;

    if (result.permission === "granted") {
      await loadMediaDevices();
    }

    if (result.permission === "denied") {
      micEnabled = false;
      camEnabled = false;
      audioDeviceId = "";
      videoDeviceId = "";
    }
  }

  async function changeAudioDevice(deviceId: string) {
    audioDeviceId = deviceId;
    if (phase === "lobby" || phase === "waiting_admission") {
      const result = await restartMediaPreview(previewStream, {
        audio: micEnabled,
        video: camEnabled,
        audioDeviceId: deviceId,
        videoDeviceId: videoDeviceId || undefined,
      });
      previewStream = result.stream;
      permissionState = result.permission;
    } else if (livekitRoom) {
      await livekitRoom.switchActiveDevice("audioinput", deviceId);
    }
  }

  function applyRoomSpeakerState(room: Room | null = livekitRoom) {
    if (!room || room.state !== "connected") return;
    setRoomSpeakerMuted(room, !speakerEnabled);
  }

  function micCaptureOptions() {
    return {
      deviceId: audioDeviceId || undefined,
    };
  }

  async function enableLocalMicrophone() {
    if (!livekitRoom) return;

    await livekitRoom.localParticipant.setMicrophoneEnabled(true, micCaptureOptions());

    if (!micGateProcessor) return;

    try {
      await attachMicGateProcessor(livekitRoom, micGateProcessor);
    } catch {
      showToast("Noise gate unavailable — using direct microphone input");
    }
  }

  async function changeAudioOutputDevice(deviceId: string) {
    audioOutputDeviceId = deviceId;
    writeStored(STORAGE_KEYS.audioOutputDeviceId, deviceId);

    if (livekitRoom) {
      try {
        await livekitRoom.switchActiveDevice("audiooutput", deviceId || "default");
      } catch {
        // Output routing is unsupported or the device is unavailable.
      }
    }
  }

  async function changeVideoDevice(deviceId: string) {
    videoDeviceId = deviceId;
    if (phase === "lobby" || phase === "waiting_admission") {
      const result = await restartMediaPreview(previewStream, {
        audio: micEnabled,
        video: camEnabled,
        audioDeviceId: audioDeviceId || undefined,
        videoDeviceId: deviceId,
      });
      previewStream = result.stream;
      permissionState = result.permission;
    } else if (livekitRoom) {
      await livekitRoom.switchActiveDevice("videoinput", deviceId);
    }
  }

  async function refreshConnectionStats(room: Room | null = livekitRoom) {
    if (!room || room.state !== "connected") {
      localPingMs = null;
      return;
    }

    localPingMs = await readConnectionRttMs(room);
  }

  function startPingPoll() {
    stopPingPoll();
    void refreshConnectionStats();
    pingPollTimer = setInterval(() => {
      void refreshConnectionStats();
    }, 2000);
  }

  function stopPingPoll() {
    if (pingPollTimer) {
      clearInterval(pingPollTimer);
      pingPollTimer = undefined;
    }
    localPingMs = null;
  }

  async function teardownCall(disconnectLiveKit: boolean) {
    stopPingPoll();
    screenShareListenerCleanup?.();
    screenShareListenerCleanup = undefined;
    if (disconnectLiveKit && callSession) {
      await callSession.disconnect();
    }
    callSession = null;
    livekitRoom = null;
    audioLevels = {};
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
      onAudioLevelsChange: (levels: Record<string, number>) => {
        if (gen !== connectionGen) return;
        audioLevels = levels;
      },
      onParticipantsChange: () => {
        if (gen !== connectionGen) return;
        bumpMediaRevision();
        livekitRoom = callSession?.room ?? null;
        applyRoomSpeakerState(livekitRoom);
      },
      onConnectionQuality: (quality: ConnectionQuality, identity: string) => {
        if (gen !== connectionGen) return;
        if (identity === livekitRoom?.localParticipant.identity) {
          localConnectionQuality = qualityLabel(quality);
          void refreshConnectionStats(livekitRoom);
        }
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
      onMicGateFallback: () => {
        if (gen !== connectionGen) return;
        showToast("Noise gate unavailable — using direct microphone input");
      },
    };
  }

  async function requestToken() {
    const body: Record<string, string> = {};
    if (isGuest) {
      body.guestName = guestName.trim();
      writeStored(STORAGE_KEYS.guestDisplayName, guestName);
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

    if (payload.status === "waiting") {
      waitingIdentity = payload.identity ?? waitingIdentity;
      return payload as { status: "waiting"; identity: string; displayName: string };
    }

    return payload as {
      status: "ready";
      token: string;
      wsUrl: string;
      iceServers?: RTCIceServer[];
      identity?: string;
      displayName?: string;
    };
  }

  async function connectWithToken(payload: { token: string; wsUrl: string; iceServers?: RTCIceServer[] }) {
    connectionGen += 1;
    const gen = connectionGen;

    callSession = createCallRoom(bindConnectionHandlers(gen));
    livekitRoom = callSession.room;

    await callSession.connect(payload.wsUrl, payload.token, {
      micEnabled: micEnabled && permissionState !== "denied",
      camEnabled: camEnabled && permissionState === "granted",
      iceServers: payload.iceServers,
      audioDeviceId: audioDeviceId || undefined,
      videoDeviceId: videoDeviceId || undefined,
      audioOutputDeviceId: audioOutputDeviceId || undefined,
      micGateProcessor: micGateProcessor ?? undefined,
    });

    attachScreenShareListener(callSession.room, gen);
    localConnectionQuality = qualityLabel(callSession.room.localParticipant.connectionQuality);
    applyRoomSpeakerState(callSession.room);
    startPingPoll();
    if (permissionState === "granted") await loadMediaDevices();
    stopHostWaitingPoll();
    setPhase("in_call");
    await refreshRoomMeta();
  }

  async function pollWaitingAdmission() {
    const identity = waitingIdentity ?? user?.id ?? sessionStorage.getItem(guestStorageKey);
    if (!identity) return;

    const res = await fetch(`/api/rooms/${slug}/waiting?identity=${encodeURIComponent(identity)}`);
    if (!res.ok) return;
    const payload = await res.json();

    if (payload.status === "admitted") {
      stopWaitingPoll();
      joining = true;
      try {
        await releasePreviewForJoin();
        const tokenPayload = await requestToken();
        if (tokenPayload.status === "ready") {
          await connectWithToken(tokenPayload);
        }
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : "Could not join room";
        setPhase("lobby");
        await setupPreview();
      } finally {
        joining = false;
      }
    } else if (payload.status === "denied") {
      stopWaitingPoll();
      errorMessage = "The host declined your request to join";
      setPhase("lobby");
    }
  }

  function stopWaitingPoll() {
    if (waitingPollTimer) clearInterval(waitingPollTimer);
    waitingPollTimer = undefined;
  }

  function startWaitingPoll() {
    stopWaitingPoll();
    waitingPollTimer = setInterval(pollWaitingAdmission, 2500);
    pollWaitingAdmission();
  }

  async function refreshHostWaitingList() {
    if (!isHost || !waitingRoomEnabled) return;
    waitingHostLoading = true;
    try {
      const res = await fetch(`/api/rooms/${slug}/waiting`);
      if (!res.ok) return;
      const payload = await res.json();
      pendingWaiting = payload.pending ?? [];
    } finally {
      waitingHostLoading = false;
    }
  }

  async function resolveWaitingAction(identity: string, action: "admit" | "deny") {
    const res = await fetch(`/api/rooms/${slug}/waiting?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity }),
    });
    if (!res.ok) {
      showToast(`Could not ${action} guest`);
      return;
    }
    await refreshHostWaitingList();
  }

  function startHostWaitingPoll() {
    if (hostWaitingTimer) clearInterval(hostWaitingTimer);
    if (isHost && waitingRoomEnabled) {
      refreshHostWaitingList();
      hostWaitingTimer = setInterval(refreshHostWaitingList, 3000);
    }
  }

  function stopHostWaitingPoll() {
    if (hostWaitingTimer) clearInterval(hostWaitingTimer);
    hostWaitingTimer = undefined;
  }

  async function updateRoomVisibility(nextIsPublic: boolean) {
    if (!isHost || nextIsPublic === roomIsPublic) return;

    updatingVisibility = true;
    errorMessage = null;

    try {
      const res = await fetch(`/api/rooms/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: nextIsPublic }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        errorMessage = payload.message ?? "Could not update room visibility";
        return;
      }
      roomIsPublic = payload.isPublic;
    } catch {
      errorMessage = "Could not update room visibility";
    } finally {
      updatingVisibility = false;
    }
  }

  async function joinCall() {
    errorMessage = null;
    joining = true;

    try {
      const tokenPayload = await requestToken();

      if (tokenPayload.status === "waiting") {
        waitingIdentity = tokenPayload.identity;
        setPhase("waiting_admission");
        startWaitingPoll();
        return;
      }

      await releasePreviewForJoin();
      await connectWithToken(tokenPayload);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Could not join room";
      await setupPreview();
    } finally {
      joining = false;
    }
  }

  function leaveWaitingRoom() {
    stopWaitingPoll();
    waitingIdentity = null;
    setPhase("lobby");
  }

  async function leaveCall() {
    connectionGen += 1;
    chatOpen = false;
    showInCallDevices = false;
    stopHostWaitingPoll();
    await teardownCall(true);
    micGateProcessor = createFreshMicGateProcessor();
    setPhase("lobby");
    await setupPreview();
    await refreshRoomMeta();
    startHostWaitingPoll();
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

  function toggleSpeaker() {
    speakerEnabled = !speakerEnabled;
    applyRoomSpeakerState();
  }

  async function toggleMic() {
    micEnabled = !micEnabled;

    if (!micEnabled) {
      audioDeviceId = "";
      micTestActive = false;
      if (phase === "lobby" || phase === "waiting_admission") {
        syncPreviewTracks(previewStream, { audio: false, video: camEnabled });
      } else if (livekitRoom) {
        await livekitRoom.localParticipant.setMicrophoneEnabled(false);
      }
      return;
    }

    const nextDeviceId = mediaDevices.audioInputs[0]?.deviceId;
    if (nextDeviceId) {
      await changeAudioDevice(nextDeviceId);
      if (livekitRoom && phase !== "lobby" && phase !== "waiting_admission") {
        await enableLocalMicrophone();
      }
      return;
    }

    if (phase === "lobby" || phase === "waiting_admission") {
      syncPreviewTracks(previewStream, { audio: true, video: camEnabled });
    } else if (livekitRoom) {
      await enableLocalMicrophone();
    }
  }

  async function toggleCam() {
    camEnabled = !camEnabled;

    if (!camEnabled) {
      videoDeviceId = "";
      if (phase === "lobby" || phase === "waiting_admission") {
        syncPreviewTracks(previewStream, { audio: micEnabled, video: false });
      } else if (livekitRoom) {
        await livekitRoom.localParticipant.setCameraEnabled(false);
      }
      return;
    }

    const nextDeviceId = mediaDevices.videoInputs[0]?.deviceId;
    if (nextDeviceId) {
      await changeVideoDevice(nextDeviceId);
      if (livekitRoom && phase !== "lobby" && phase !== "waiting_admission") {
        await livekitRoom.localParticipant.setCameraEnabled(true);
      }
      return;
    }

    if (phase === "lobby" || phase === "waiting_admission") {
      syncPreviewTracks(previewStream, { audio: micEnabled, video: true });
    } else if (livekitRoom) {
      await livekitRoom.localParticipant.setCameraEnabled(true);
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
    if (!user) {
      const storedGuestName = readStored(STORAGE_KEYS.guestDisplayName);
      if (storedGuestName) {
        guestName = storedGuestName;
      }
    }
    setupPreview();
    micGateProcessor = createFreshMicGateProcessor();
    refreshTimer = setInterval(refreshRoomMeta, 5000);
    refreshRoomMeta();
    startHostWaitingPoll();
  });

  onDestroy(() => {
    if (refreshTimer) clearInterval(refreshTimer);
    if (toastTimer) clearTimeout(toastTimer);
    stopWaitingPoll();
    stopHostWaitingPoll();
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
      <div class="absolute left-4 top-4 z-20">
        <ConnectionQualityBadge label={localConnectionQuality} pingMs={localPingMs} />
      </div>

      {#if chatEnabled}
        <ChatPanel
          {slug}
          localIdentity={livekitRoom.localParticipant.identity}
          guestIdentity={isGuest ? livekitRoom.localParticipant.identity : null}
          open={chatOpen}
          onClose={() => (chatOpen = false)}
        />
      {/if}

      {#if showInCallDevices}
        <div class="absolute left-4 top-14 z-20 w-full max-w-md rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-sm">
          <div class="mb-3 flex items-center justify-between">
            <p class="text-sm font-medium text-foreground">Devices</p>
            <button type="button" class="text-xs text-muted-foreground hover:text-foreground" onclick={() => (showInCallDevices = false)}>
              Close
            </button>
          </div>
          <DevicePicker
            devices={mediaDevices}
            {audioDeviceId}
            {audioOutputDeviceId}
            {videoDeviceId}
            showAudioOutput={showAudioOutputSelection}
            {micEnabled}
            {speakerEnabled}
            {camEnabled}
            onToggleMic={toggleMic}
            onToggleSpeaker={toggleSpeaker}
            onToggleCam={toggleCam}
            onAudioDeviceChange={changeAudioDevice}
            onAudioOutputDeviceChange={changeAudioOutputDevice}
            onVideoDeviceChange={changeVideoDevice}
          />
        </div>
      {/if}

      <div class="relative min-h-0 flex-1">
        <CallStage room={livekitRoom} {activeSpeakerIdentity} {audioLevels} {localDisplayName} {mediaRevision} bind:stageRef={stageEl} />
      </div>
      <ControlBar
        {isHost}
        {micEnabled}
        {speakerEnabled}
        {camEnabled}
        {screenSharing}
        {snapshotting}
        {chatOpen}
        onToggleMic={toggleMic}
        onToggleSpeaker={toggleSpeaker}
        onToggleCam={toggleCam}
        onToggleScreenShare={toggleScreenShare}
        onSnapshot={takeSnapshot}
        onToggleChat={chatEnabled ? () => (chatOpen = !chatOpen) : undefined}
        onToggleDevices={() => (showInCallDevices = !showInCallDevices)}
        devicesOpen={showInCallDevices}
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
{:else if phase === "waiting_admission"}
  <WaitingRoomView {hostName} onLeaveWaiting={leaveWaitingRoom} />
{:else if isScheduledForFuture && scheduledStartLabel}
  <div class="rounded-xl border border-border bg-card/60 px-6 py-6 space-y-2">
    <h2 class="text-lg font-semibold text-foreground">Room not open yet</h2>
    <p class="text-sm text-muted-foreground">This call opens at {scheduledStartLabel}.</p>
    <p class="text-xs text-muted-foreground">Share this link now — participants can join when the room opens.</p>
  </div>
{:else if isFull}
  <div class="rounded-xl border border-border bg-card/60 px-6 py-6">
    <p class="text-sm text-destructive">Room is full ({maxParticipants} of {maxParticipants} joined)</p>
  </div>
{:else}
  {#if errorMessage}
    <div class="auth-error mb-4">{errorMessage}</div>
  {/if}

  <PreCallLobby
    {slug}
    {roomTitle}
    {hostName}
    {participantCount}
    {maxParticipants}
    {isGuest}
    {isHost}
    isPublic={roomIsPublic}
    {waitingRoomEnabled}
    {isStale}
    {guestName}
    {userDisplayName}
    {micEnabled}
    {speakerEnabled}
    {camEnabled}
    {permissionState}
    {previewStream}
    devices={mediaDevices}
    {audioDeviceId}
    {audioOutputDeviceId}
    {videoDeviceId}
    showAudioOutput={showAudioOutputSelection}
    {joining}
    canJoin={canJoinLobby}
    bind:micTestActive
    {micGateProcessor}
    {updatingVisibility}
    onGuestNameChange={(v) => {
      guestName = v;
      writeStored(STORAGE_KEYS.guestDisplayName, v);
    }}
    onToggleMic={toggleMic}
    onToggleSpeaker={toggleSpeaker}
    onToggleCam={toggleCam}
    onAudioDeviceChange={changeAudioDevice}
    onAudioOutputDeviceChange={changeAudioOutputDevice}
    onVideoDeviceChange={changeVideoDevice}
    onPublicChange={isHost ? updateRoomVisibility : undefined}
    onJoin={joinCall}
  />

  {#if isHost && waitingRoomEnabled}
    <div class="mt-4">
      <HostWaitingPanel
        pending={pendingWaiting}
        loading={waitingHostLoading}
        onAdmit={(identity) => resolveWaitingAction(identity, "admit")}
        onDeny={(identity) => resolveWaitingAction(identity, "deny")}
      />
    </div>
  {/if}
{/if}
