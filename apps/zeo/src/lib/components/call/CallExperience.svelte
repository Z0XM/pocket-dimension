<script lang="ts">
  import { browser } from "$app/environment";
  import { onDestroy, onMount } from "svelte";
  import XIcon from "@lucide/svelte/icons/x";
  import {
    RoomEvent,
    Track,
    VideoQuality,
    type ConnectionQuality,
    type LocalTrackPublication,
    type Room,
    supportsAudioOutputSelection,
  } from "livekit-client";
  import type { CallPhase, PermissionState } from "$lib/livekit/types";
  import { startMediaPreview, stopMediaPreview, syncPreviewTracks, restartMediaPreview, type MediaPreviewResult } from "$lib/livekit/media-preview";
  import { CAMERA_IN_USE_MESSAGE, deviceErrorMessage, isDeviceInUseError } from "$lib/livekit/media-errors";
  import { buildMediaConstraints, listMediaDevices, type MediaDeviceLists } from "$lib/livekit/devices";
  import { qualityLabel, type QualityLabel } from "$lib/livekit/connection-quality";
  import { readConnectionRttMs } from "$lib/livekit/connection-stats";
  import {
    createCallRoom,
    attachMicGateProcessor,
    ensureRoomAudio,
    primeBrowserAudioGesture,
    setRoomSpeakerMuted,
    wasParticipantRemoved,
    wasRoomDeleted,
    type ConnectionPhase,
  } from "$lib/livekit/room-client";
  import { disableLocalMicrophone, enableLocalMicrophoneWithGate } from "$lib/livekit/local-mic";
  import { attachAllRemoteAudioTracks } from "$lib/livekit/remote-audio";
  import {
    applyAllTileListenVolumes,
    clampTileVolume,
    DEFAULT_TILE_VOLUME,
    isTileListenMuted,
    tileVolumeForKey,
  } from "$lib/livekit/tile-listen-mute";
  import { createMicGateProcessor, type MicGateProcessor } from "$lib/livekit/mic-gate-processor";
  import { applyLocalAudioExportQuality, applyLocalVideoExportQuality } from "$lib/livekit/apply-media-quality";
  import {
    DEFAULT_AUDIO_QUALITY,
    DEFAULT_VIDEO_QUALITY,
    isAudioQualityOption,
    isVideoQualityOption,
    videoPresetForOption,
    type AudioQualityOption,
    type VideoQualityOption,
  } from "$lib/livekit/media-quality";
  import { collectTileStats, type TileMediaStats } from "$lib/livekit/tile-stats";
  import {
    disableLocalScreenCapture,
    disableLocalScreenAudioShare,
    enableLocalScreenShare,
    findScreenCaptureParticipant,
    isScreenCaptureActive,
    isScreenShareActive,
    isScreenShareAudioActive,
    isScreenShareAudioAvailable,
    screenShareFailureMessage,
    screenShareAudioHint,
    setLocalScreenShareAudioEnabled,
    setLocalScreenShareVideoEnabled,
    stopShareIfNoMedia,
    watchHeldScreenCaptureEnded,
  } from "$lib/livekit/screen-share";
  import { captureStageToBlob, compressSnapshotForChat, downloadSnapshotBlob } from "$lib/snapshot";
  import PreCallLobby from "$lib/components/call/PreCallLobby.svelte";
  import CallStage from "$lib/components/call/CallStage.svelte";
  import ControlBar from "$lib/components/call/ControlBar.svelte";
  import ConnectionBanner from "$lib/components/call/ConnectionBanner.svelte";
  import ChatPanel from "$lib/components/call/ChatPanel.svelte";
  import WaitingRoomView from "$lib/components/call/WaitingRoomView.svelte";
  import HostWaitingPanel from "$lib/components/call/HostWaitingPanel.svelte";
  import GamePanel from "$lib/components/call/GamePanel.svelte";
  import GamePhaseBanner from "$lib/components/call/GamePhaseBanner.svelte";
  import ConnectionQualityBadge from "$lib/components/call/ConnectionQualityBadge.svelte";
  import DevicePicker from "$lib/components/call/DevicePicker.svelte";
  import MediaQualitySettings from "$lib/components/call/MediaQualitySettings.svelte";
  import MicPreviewControls from "$lib/components/call/MicPreviewControls.svelte";
  import TileColorPicker from "$lib/components/call/TileColorPicker.svelte";
  import HandGestureTracker from "$lib/components/call/HandGestureTracker.svelte";
  import GestureSettings from "$lib/components/call/GestureSettings.svelte";
  import type { DetectedGesture, GestureAction, VideoTrackingFrame } from "$lib/gestures/gesture-types";
  import { disposeHandLandmarker } from "$lib/gestures/hand-tracker";
  import { isAutoLayoutPreset, type AutoLayoutPreset } from "$lib/call/auto-layout";
  import { createGameStateStore } from "$lib/call/game-state";
  import { createListeningStateStore } from "$lib/call/listening-state";
  import type { StageLayoutMode } from "$lib/stage-grid";
  import type { GameSnapshot } from "$lib/server/game/types";
  import type { ListeningSnapshot } from "$lib/server/listening/types";
  import { Separator } from "$lib/components/ui/separator";
  import { SettingToggle } from "$lib/components/ui/setting-toggle";
  import { PARTICIPANT_COLORS, resolveParticipantColor, type ParticipantColor } from "$lib/participant-colors";
  import {
    clearActiveCallSession,
    readActiveCallSession,
    readStored,
    readStoredFlag,
    readStoredFloat,
    readStoredInt,
    readStoredTileVolumes,
    STORAGE_KEYS,
    writeActiveCallSession,
    writeStored,
    writeStoredFlag,
    writeStoredFloat,
    writeStoredInt,
    writeStoredTileVolumes,
  } from "$lib/browser-storage";
  import { buildStageTiles, buildCallParticipantList, pruneTileKeys } from "$lib/call/stage-tiles";

  type Props = {
    slug: string;
    roomTitle: string;
    hostName: string;
    maxParticipants: number;
    isHost: boolean;
    user: { id: string; email: string; username: string | null };
    hostUserId: string;
    initialParticipantCount: number;
    initialIsFull: boolean;
    initialIsEnded: boolean;
    initialWaitingRoomEnabled?: boolean;
    initialIsPublic?: boolean;
    initialIsLocked?: boolean;
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
    hostUserId,
    initialParticipantCount,
    initialIsFull,
    initialIsEnded,
    initialWaitingRoomEnabled = false,
    initialIsPublic = false,
    initialIsLocked = false,
    initialIsStale = false,
    initialIsScheduledForFuture = false,
    initialScheduledStartLabel = null,
    initialIsJoinable = true,
    chatEnabled = true,
    onPhaseChange,
  }: Props = $props();

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
  let roomIsLocked = $state(initialIsLocked);
  let isStale = $state(initialIsStale);
  let updatingVisibility = $state(false);
  let updatingRoomLock = $state(false);
  let errorMessage = $state<string | null>(null);
  let disconnectMessage = $state<string | null>(null);
  let joining = $state(false);
  let ending = $state(false);

  let micEnabled = $state(true);
  let speakerEnabled = $state(true);
  let camEnabled = $state(true);
  let permissionState = $state<PermissionState>("prompt");
  let cameraInUse = $state(false);
  let micDeviceError = $state<string | null>(null);
  let previewStream = $state<MediaStream | null>(null);
  let previewReady = $state(false);
  let mediaDevices = $state<MediaDeviceLists>({ audioInputs: [], audioOutputs: [], videoInputs: [] });
  let audioDeviceId = $state("");
  let audioOutputDeviceId = $state("");
  let videoDeviceId = $state("");
  let micTestActive = $state(false);
  let showInCallDevices = $state(false);
  let showGridSettings = $state(false);
  let showGamePanel = $state(false);
  let gameBusy = $state(false);
  let listeningBusy = $state(false);
  let gameSnapshot = $state<GameSnapshot | null>(null);
  let listeningSnapshot = $state<ListeningSnapshot | null>(null);
  let youtubeLinked = $state(false);
  let layoutModeBeforeGame = $state<StageLayoutMode | null>(null);
  const gameState = createGameStateStore();
  const listeningState = createListeningStateStore();
  let stageLayoutMode = $state<StageLayoutMode>("grid");
  let autoLayoutPreset = $state<AutoLayoutPreset>("dynamic");
  let galleryDensity = $state(5);
  let sidebarSplitRatio = $state(0.72);
  let hideNonVideoTiles = $state(false);
  let pinnedTileKey = $state<string | null>(null);
  let micGateProcessor = $state<MicGateProcessor | null>(null);
  let inCallMicTestStream = $state<MediaStream | null>(null);
  let inCallMicTestSyncGen = 0;
  let inCallMicPreviewControls = $state<MicPreviewControls | null>(null);

  function readInitialTileColor(): ParticipantColor {
    const stored = readStored(STORAGE_KEYS.tileColor);
    if (stored) {
      const resolved = resolveParticipantColor(stored);
      if (resolved) return resolved;
    }
    return PARTICIPANT_COLORS[0];
  }

  let tileColor = $state<ParticipantColor>(PARTICIPANT_COLORS[0]);
  let hideParticipantVideos = $state(false);
  let disableSpeakingGlows = $state(false);
  let gesturesEnabled = $state(false);
  let gestureOverlayVisible = $state(false);
  let trackingFrame = $state<VideoTrackingFrame>({
    handLandmarks: null,
    gesture: "none",
    holdProgress: 0,
  });
  let networkHintDismissed = $state(false);
  let audioPlaybackBlocked = $state(false);
  let storedRejoinSession = $state<ReturnType<typeof readActiveCallSession>>(null);

  const inCallPhase = $derived(phase === "in_call" || phase === "reconnecting");
  const gameActive = $derived(gameSnapshot?.session?.status === "active");
  const listeningActive = $derived(Boolean(listeningSnapshot?.session && !listeningSnapshot.session.endedAt));
  const listeningIsDj = $derived(listeningSnapshot?.session?.djUserId === user.id || isHost);
  const showGameModeButton = $derived(true);
  const gestureCameraAvailable = $derived(camEnabled && permissionState === "granted" && !cameraInUse);
  const micMonitorStream = $derived(inCallPhase ? inCallMicTestStream : previewStream);
  const micDisplayEnabled = $derived(micEnabled && !(inCallPhase && micTestActive));

  function setTileColor(color: ParticipantColor) {
    tileColor = color;
    writeStored(STORAGE_KEYS.tileColor, color);
  }

  function setHideParticipantVideos(value: boolean) {
    hideParticipantVideos = value;
    writeStoredFlag(STORAGE_KEYS.hideParticipantVideos, value);
  }

  function setDisableSpeakingGlows(value: boolean) {
    disableSpeakingGlows = value;
    writeStoredFlag(STORAGE_KEYS.disableSpeakingGlows, value);
  }

  function setGesturesEnabled(value: boolean) {
    gesturesEnabled = value;
    writeStoredFlag(STORAGE_KEYS.gesturesEnabled, value);
  }

  function setGestureOverlayVisible(value: boolean) {
    gestureOverlayVisible = value;
    writeStoredFlag(STORAGE_KEYS.gestureOverlayVisible, value);
  }

  function handleTrackingFrameUpdate(frame: VideoTrackingFrame) {
    trackingFrame = frame;
  }

  const videoTrackingActive = $derived(gesturesEnabled || gestureOverlayVisible);

  async function handleGestureAction(action: GestureAction, _gesture: DetectedGesture) {
    if (action !== "toggle_mic") return;

    const wasOn = micEnabled;
    await toggleMic();
    showToast(wasOn ? "Gesture: microphone muted" : "Gesture: microphone unmuted");
  }

  function readInitialStageLayoutMode(): StageLayoutMode {
    const stored = readStored(STORAGE_KEYS.stageLayoutMode);
    return stored === "auto" ? "auto" : "grid";
  }

  function readInitialAutoLayoutPreset(): AutoLayoutPreset {
    const stored = readStored(STORAGE_KEYS.autoLayoutPreset);
    return isAutoLayoutPreset(stored) ? stored : "dynamic";
  }

  function setStageLayoutMode(mode: StageLayoutMode) {
    if (gameActive) return;
    stageLayoutMode = mode;
    writeStored(STORAGE_KEYS.stageLayoutMode, mode);
  }

  function closeGamePanel() {
    showGamePanel = false;
  }

  function toggleGamePanel() {
    if (showGamePanel) {
      closeGamePanel();
      return;
    }
    chatOpen = false;
    closeInCallDevicesPanel();
    closeGridSettingsPanel();
    showGamePanel = true;
  }

  function handleGameSnapshot(next: GameSnapshot | null) {
    gameSnapshot = next;
  }

  function handleListeningSnapshot(next: ListeningSnapshot | null) {
    listeningSnapshot = next;
  }

  async function refreshYouTubeLink() {
    try {
      const response = await fetch("/api/me/youtube-link");
      if (!response.ok) return;
      const body = (await response.json()) as { linked?: boolean };
      youtubeLinked = Boolean(body.linked);
    } catch {
      // ignore
    }
  }

  async function listeningTransport(path: "play" | "pause" | "skip" | "previous", body?: Record<string, unknown>) {
    listeningBusy = true;
    try {
      const response = await fetch(`/api/rooms/${slug}/listening/${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) return;
      const next = (await response.json()) as ListeningSnapshot;
      listeningSnapshot = next.session && !next.session.endedAt ? next : null;
    } finally {
      listeningBusy = false;
    }
  }

  async function listeningSeek(positionMs: number) {
    listeningBusy = true;
    try {
      const response = await fetch(`/api/rooms/${slug}/listening/seek`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionMs }),
      });
      if (!response.ok) return;
      const next = (await response.json()) as ListeningSnapshot;
      listeningSnapshot = next.session && !next.session.endedAt ? next : null;
    } finally {
      listeningBusy = false;
    }
  }

  function setAutoLayoutPreset(preset: AutoLayoutPreset) {
    autoLayoutPreset = preset;
    writeStored(STORAGE_KEYS.autoLayoutPreset, preset);
  }

  function setHideNonVideoTiles(value: boolean) {
    hideNonVideoTiles = value;
    writeStoredFlag(STORAGE_KEYS.hideNonVideoTiles, value);
  }

  function setGalleryDensity(value: number) {
    galleryDensity = value;
    writeStoredInt(STORAGE_KEYS.galleryDensity, value);
  }

  function setSidebarSplitRatio(value: number) {
    sidebarSplitRatio = value;
    writeStoredFloat(STORAGE_KEYS.sidebarSplitRatio, value);
  }

  function togglePinTile(key: string) {
    pinnedTileKey = pinnedTileKey === key ? null : key;
  }

  function toggleSelfView() {
    if (!livekitRoom) return;
    const key = livekitRoom.localParticipant.identity;
    if (minimizedTileKeys.includes(key)) {
      restoreTile(key);
    } else {
      minimizeTile(key);
    }
  }

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
  let chatSyncToken = $state(0);
  let localConnectionQuality = $state<QualityLabel>("unknown");
  let localPingMs = $state<number | null>(null);

  let livekitRoom = $state<Room | null>(null);
  let activeSpeakerIdentity = $state<string | null>(null);
  let audioLevels = $state<Record<string, number>>({});
  let connectionGen = $state(0);
  let mediaRevision = $state(0);
  const localGestureVideoTrack = $derived.by(() => {
    mediaRevision;
    camEnabled;
    previewStream;
    livekitRoom;
    inCallPhase;
    gestureCameraAvailable;

    if (!gestureCameraAvailable) return null;

    if (livekitRoom && inCallPhase) {
      const publication = livekitRoom.localParticipant.getTrackPublication(Track.Source.Camera);
      const track = publication?.track?.mediaStreamTrack;
      if (track?.readyState === "live") return track;
    }

    return previewStream?.getVideoTracks().find((track) => track.readyState === "live") ?? null;
  });
  let localDisplayName = $state("");
  let callSession: ReturnType<typeof createCallRoom> | null = null;
  let stageEl = $state<HTMLElement | null>(null);
  let controlBarEl = $state<HTMLElement | null>(null);
  let controlBarReservePx = $state(0);
  let minimizedTileKeys = $state<string[]>([]);
  let hiddenVideoTileKeys = $state<string[]>([]);
  let tileVolumes = $state<Record<string, number>>(readStoredTileVolumes());
  let tileVolumeBeforeMute = $state<Record<string, number>>({});
  let fullscreenTileKey = $state<string | null>(null);
  let showTileStats = $state(readStoredFlag(STORAGE_KEYS.showTileStats, true));
  let tileStats = $state<Record<string, TileMediaStats>>({});
  let videoQuality = $state<VideoQualityOption>(
    isVideoQualityOption(readStored(STORAGE_KEYS.videoQuality))
      ? (readStored(STORAGE_KEYS.videoQuality) as VideoQualityOption)
      : DEFAULT_VIDEO_QUALITY
  );
  let audioQuality = $state<AudioQualityOption>(
    isAudioQualityOption(readStored(STORAGE_KEYS.audioQuality))
      ? (readStored(STORAGE_KEYS.audioQuality) as AudioQualityOption)
      : DEFAULT_AUDIO_QUALITY
  );
  let tileStatsPollTimer: ReturnType<typeof setInterval> | undefined;
  let intentionalScreenShareStop = false;
  let intentionalScreenAudioShareStop = false;
  let snapshotting = $state(false);
  let snapshotFlash = $state(false);
  let toastMessage = $state<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let screenShareListenerCleanup: (() => void) | undefined;
  let screenAudioShareEndedCleanup: (() => void) | undefined;

  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  let pingPollTimer: ReturnType<typeof setInterval> | undefined;

  const userDisplayName = $derived(user.username ?? user.email ?? null);
  const canJoinLobby = $derived(!isEnded && isJoinable && !isFull && previewReady && phase === "lobby");
  const showAudioOutputSelection = $derived(browser ? supportsAudioOutputSelection() && mediaDevices.audioOutputs.length > 0 : false);
  const screenSharing = $derived.by(() => {
    mediaRevision;
    return livekitRoom ? isScreenCaptureActive(livekitRoom.localParticipant) : false;
  });

  const stageTiles = $derived.by(() => {
    mediaRevision;
    return livekitRoom
      ? buildStageTiles(livekitRoom, {
          listeningActive,
          listeningBotIdentity: listeningSnapshot?.session?.botIdentity ?? null,
        })
      : [];
  });

  const selfViewHidden = $derived(livekitRoom ? minimizedTileKeys.includes(livekitRoom.localParticipant.identity) : false);

  const callParticipants = $derived.by(() => {
    mediaRevision;
    if (!livekitRoom) return [];
    return buildCallParticipantList(livekitRoom, { localDisplayName, hostUserId });
  });

  const minimizedTiles = $derived(stageTiles.filter((tile) => minimizedTileKeys.includes(tile.key)));

  $effect(() => {
    const validKeys = new Set(stageTiles.map((tile) => tile.key));
    minimizedTileKeys = pruneTileKeys(minimizedTileKeys, validKeys);
    hiddenVideoTileKeys = pruneTileKeys(hiddenVideoTileKeys, validKeys);
    if (fullscreenTileKey && !validKeys.has(fullscreenTileKey)) {
      fullscreenTileKey = null;
    }
    if (pinnedTileKey && !validKeys.has(pinnedTileKey)) {
      pinnedTileKey = null;
    }
  });

  function resetStageTileState() {
    minimizedTileKeys = [];
    hiddenVideoTileKeys = [];
    fullscreenTileKey = null;
    pinnedTileKey = null;
    tileStats = {};
  }

  function persistTileVolumes(next: Record<string, number>) {
    tileVolumes = next;
    writeStoredTileVolumes(next);
  }

  function setTileListenVolume(key: string, volume: number) {
    const nextVolume = clampTileVolume(volume);
    const next = { ...tileVolumes, [key]: nextVolume };
    if (nextVolume > 0) {
      const { [key]: _removed, ...rest } = tileVolumeBeforeMute;
      tileVolumeBeforeMute = rest;
    }
    persistTileVolumes(next);
    applyRoomSpeakerState();
  }

  function minimizeTile(key: string) {
    if (!minimizedTileKeys.includes(key)) {
      minimizedTileKeys = [...minimizedTileKeys, key];
    }
    if (fullscreenTileKey === key) {
      fullscreenTileKey = null;
    }
  }

  function restoreTile(key: string) {
    minimizedTileKeys = minimizedTileKeys.filter((entry) => entry !== key);
  }

  function toggleTileHideVideo(key: string) {
    hiddenVideoTileKeys = hiddenVideoTileKeys.includes(key) ? hiddenVideoTileKeys.filter((entry) => entry !== key) : [...hiddenVideoTileKeys, key];
  }

  function toggleTileListenMute(key: string) {
    if (isTileListenMuted(tileVolumes, key)) {
      const restored = tileVolumeBeforeMute[key] ?? DEFAULT_TILE_VOLUME;
      setTileListenVolume(key, restored > 0 ? restored : DEFAULT_TILE_VOLUME);
      return;
    }

    const current = tileVolumeForKey(tileVolumes, key);
    tileVolumeBeforeMute = { ...tileVolumeBeforeMute, [key]: current > 0 ? current : DEFAULT_TILE_VOLUME };
    setTileListenVolume(key, 0);
  }

  function toggleTileFullscreen(key: string) {
    fullscreenTileKey = fullscreenTileKey === key ? null : key;
  }

  $effect(() => {
    const el = controlBarEl;
    if (!el) {
      controlBarReservePx = 0;
      return;
    }

    const sync = () => {
      controlBarReservePx = el.offsetHeight;
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
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
    if (payload.isLocked !== undefined) roomIsLocked = payload.isLocked;
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

  function applyPreviewResult(result: MediaPreviewResult) {
    previewStream = result.stream;
    permissionState = result.permission;
    cameraInUse = result.cameraInUse;
  }

  async function setupPreview() {
    const result = await startMediaPreview({
      audio: true,
      video: true,
      audioDeviceId: audioDeviceId || undefined,
      videoDeviceId: videoDeviceId || undefined,
    });
    applyPreviewResult(result);
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

  function stopInCallMicTestStream() {
    stopMediaPreview(inCallMicTestStream);
    inCallMicTestStream = null;
  }

  async function createInCallMicTestStream() {
    const constraints = await buildMediaConstraints({
      audio: true,
      video: false,
      audioDeviceId: audioDeviceId || undefined,
    });
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  async function startInCallMicTest() {
    if (!livekitRoom || !micEnabled) return;

    inCallMicTestSyncGen += 1;
    const gen = inCallMicTestSyncGen;

    setRoomSpeakerMuted(livekitRoom, true);
    await disableLocalMicrophone(livekitRoom);
    if (gen !== inCallMicTestSyncGen) return;

    try {
      const stream = await createInCallMicTestStream();
      if (gen !== inCallMicTestSyncGen) {
        stopMediaPreview(stream);
        return;
      }

      stopInCallMicTestStream();
      inCallMicTestStream = stream;
    } catch {
      if (gen !== inCallMicTestSyncGen) return;
      micTestActive = false;
      applyRoomSpeakerState();
      if (micEnabled) {
        await enableLocalMicrophone();
      }
    }
  }

  async function stopInCallMicTest() {
    inCallMicTestSyncGen += 1;
    stopInCallMicTestStream();

    if (!livekitRoom) return;

    applyRoomSpeakerState();
    if (micEnabled) {
      await enableLocalMicrophone();
    }
  }

  function closeInCallDevicesPanel() {
    if (micTestActive) {
      micTestActive = false;
    }
    showInCallDevices = false;
  }

  function closeGridSettingsPanel() {
    showGridSettings = false;
  }

  function toggleGridSettingsPanel() {
    if (gameActive) return;
    if (showGridSettings) {
      closeGridSettingsPanel();
      return;
    }
    closeInCallDevicesPanel();
    closeGamePanel();
    showGridSettings = true;
  }

  function openInCallDevicesPanel() {
    closeGridSettingsPanel();
    closeGamePanel();
    showInCallDevices = true;
  }

  async function handleInCallAudioOutputDeviceChange(deviceId: string) {
    await changeAudioOutputDevice(deviceId);
    await inCallMicPreviewControls?.applyAudioOutputDevice(deviceId);
  }

  $effect(() => {
    if (!inCallPhase) {
      stopInCallMicTestStream();
      return;
    }

    if (micTestActive && !inCallMicTestStream) {
      void startInCallMicTest();
    } else if (!micTestActive && inCallMicTestStream) {
      void stopInCallMicTest();
    }
  });

  async function changeAudioDevice(deviceId: string) {
    audioDeviceId = deviceId;
    if (phase === "lobby" || phase === "waiting_admission") {
      const result = await restartMediaPreview(previewStream, {
        audio: micEnabled,
        video: camEnabled,
        audioDeviceId: deviceId,
        videoDeviceId: videoDeviceId || undefined,
      });
      applyPreviewResult(result);
    } else if (livekitRoom) {
      if (!micTestActive && micEnabled) {
        try {
          await livekitRoom.switchActiveDevice("audioinput", deviceId);
        } catch {
          // Switching input can fail while the mic track is unpublished.
        }
      }
      if (micTestActive) {
        stopInCallMicTestStream();
        try {
          inCallMicTestStream = await createInCallMicTestStream();
        } catch {
          micTestActive = false;
        }
      }
    }
  }

  function applyRoomSpeakerState(room: Room | null = livekitRoom) {
    if (!room || room.state !== "connected") return;
    applyAllTileListenVolumes(room, {
      speakersEnabled: speakerEnabled,
      tileVolumes,
    });
  }

  function subscribedVideoQualityFor(option: VideoQualityOption) {
    switch (option) {
      case "360p":
        return VideoQuality.LOW;
      case "480p":
        return VideoQuality.MEDIUM;
      default:
        return VideoQuality.HIGH;
    }
  }

  function applySubscribedVideoQuality(room: Room | null = livekitRoom, option: VideoQualityOption = videoQuality) {
    if (!room) return;
    const quality = subscribedVideoQualityFor(option);
    const preset = videoPresetForOption(option);
    const dimensions = { width: preset.width, height: preset.height };
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.videoTrackPublications.values()) {
        try {
          publication.setVideoQuality(quality);
          publication.setVideoDimensions(dimensions);
        } catch {
          // Best-effort — adaptiveStream may already manage layers.
        }
      }
    }
  }

  async function applyVideoQualityPreference(nextVideo: VideoQualityOption) {
    const room = livekitRoom;
    if (!room || room.state !== "connected") return;

    try {
      // Republish camera/screen with the selected capture + encode caps (export quality).
      await applyLocalVideoExportQuality(room, nextVideo, audioQuality, {
        videoDeviceId: videoDeviceId || undefined,
      });
      applySubscribedVideoQuality(room, nextVideo);
    } catch {
      showToast("Could not apply video quality");
    }

    bumpMediaRevision();
    void refreshTileStats(room);
  }

  async function applyAudioQualityPreference(nextAudio: AudioQualityOption) {
    const room = livekitRoom;
    if (!room || room.state !== "connected") return;

    try {
      // Republish mic/screen-audio with the selected bitrate cap (export quality).
      await applyLocalAudioExportQuality(room, videoQuality, nextAudio, {
        attachMicGate: async () => {
          if (!micGateProcessor) return;
          await attachMicGateProcessor(room, micGateProcessor);
        },
      });
      await ensureRoomAudio(room, "audio_quality_change");
      applyRoomSpeakerState(room);
    } catch {
      try {
        await room.localParticipant.setMicrophoneEnabled(true, micCaptureOptions());
        if (micGateProcessor) {
          await attachMicGateProcessor(room, micGateProcessor);
        }
        await ensureRoomAudio(room, "audio_quality_recover");
        applyRoomSpeakerState(room);
      } catch {
        // fall through
      }
      showToast("Could not apply audio quality — try toggling your mic");
    }

    bumpMediaRevision();
    void refreshTileStats(room);
  }

  function setVideoQualityPreference(value: VideoQualityOption) {
    videoQuality = value;
    writeStored(STORAGE_KEYS.videoQuality, value);
    void applyVideoQualityPreference(value);
  }

  function setAudioQualityPreference(value: AudioQualityOption) {
    audioQuality = value;
    writeStored(STORAGE_KEYS.audioQuality, value);
    void applyAudioQualityPreference(value);
  }

  function setShowTileStats(value: boolean) {
    showTileStats = value;
    writeStoredFlag(STORAGE_KEYS.showTileStats, value);
    if (!value) {
      tileStats = {};
      stopTileStatsPoll();
    } else if (livekitRoom) {
      startTileStatsPoll(livekitRoom);
    }
  }

  function micCaptureOptions() {
    return {
      deviceId: audioDeviceId || undefined,
    };
  }

  async function enableLocalMicrophone() {
    if (!livekitRoom) return;

    try {
      await ensureRoomAudio(livekitRoom, "enable_local_mic");
      // Always rebuild the gate on unmute so WebAudio/capture is reconnected cleanly.
      const attached = await enableLocalMicrophoneWithGate(livekitRoom, {
        deviceId: audioDeviceId || undefined,
        createProcessor: createFreshMicGateProcessor,
        onGateFallback: () => {
          showToast("Noise gate unavailable — using direct microphone input");
        },
      });
      micGateProcessor = attached ?? createFreshMicGateProcessor();
      micDeviceError = null;
    } catch (error) {
      micDeviceError = deviceErrorMessage(error, "microphone");
      micEnabled = false;
      showToast(micDeviceError);
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
      applyPreviewResult(result);
    } else if (livekitRoom) {
      if (camEnabled) {
        try {
          await livekitRoom.switchActiveDevice("videoinput", deviceId);
          cameraInUse = false;
        } catch (error) {
          if (isDeviceInUseError(error)) {
            cameraInUse = true;
            camEnabled = false;
            showToast(CAMERA_IN_USE_MESSAGE);
          } else {
            showToast(deviceErrorMessage(error, "camera"));
          }
        }
      }
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

  async function refreshTileStats(room: Room | null = livekitRoom) {
    if (!showTileStats || !room || room.state !== "connected") {
      tileStats = {};
      return;
    }

    const tiles = buildStageTiles(room, {
      listeningActive,
      listeningBotIdentity: listeningSnapshot?.session?.botIdentity ?? null,
    }).map((tile) => ({
      key: tile.key,
      kind: tile.kind,
      identity: tile.participant.identity,
    }));
    tileStats = await collectTileStats(room, tiles);
  }

  function startTileStatsPoll(room: Room | null = livekitRoom) {
    stopTileStatsPoll();
    if (!showTileStats || !room) return;
    void refreshTileStats(room);
    tileStatsPollTimer = setInterval(() => {
      void refreshTileStats(room);
    }, 2000);
  }

  function stopTileStatsPoll() {
    if (tileStatsPollTimer) {
      clearInterval(tileStatsPollTimer);
      tileStatsPollTimer = undefined;
    }
  }

  async function teardownCall(disconnectLiveKit: boolean) {
    stopPingPoll();
    stopTileStatsPoll();
    audioPlaybackBlocked = false;
    screenShareListenerCleanup?.();
    screenShareListenerCleanup = undefined;
    screenAudioShareEndedCleanup?.();
    screenAudioShareEndedCleanup = undefined;
    if (disconnectLiveKit && callSession) {
      await callSession.disconnect();
    }
    callSession = null;
    livekitRoom = null;
    audioLevels = {};
    resetStageTileState();
    stopMediaPreview(previewStream);
    previewStream = null;
  }

  function attachScreenShareListener(room: Room, gen: number) {
    screenShareListenerCleanup?.();

    const onLocalTrackUnpublished = (publication: LocalTrackPublication) => {
      if (gen !== connectionGen) return;
      bumpMediaRevision();
      if (publication.source === Track.Source.ScreenShare) {
        if (intentionalScreenShareStop) {
          intentionalScreenShareStop = false;
          return;
        }
        showToast("Your screen share was stopped");
        return;
      }

      if (publication.source === Track.Source.ScreenShareAudio) {
        if (intentionalScreenAudioShareStop || intentionalScreenShareStop) {
          intentionalScreenAudioShareStop = false;
          return;
        }
        showToast("Your tab audio share was stopped");
      }
    };

    room.on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
    screenShareListenerCleanup = () => {
      room.off(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
    };
  }

  function attachScreenAudioShareEndedListener(room: Room, gen: number) {
    screenAudioShareEndedCleanup?.();
    screenAudioShareEndedCleanup = watchHeldScreenCaptureEnded(room.localParticipant, () => {
      if (gen !== connectionGen) return;
      if (intentionalScreenAudioShareStop) {
        intentionalScreenAudioShareStop = false;
        return;
      }

      void (async () => {
        await disableLocalScreenAudioShare(room.localParticipant);
        bumpMediaRevision();
        showToast("Your tab audio share was stopped");
      })();
    });
  }

  function bindConnectionHandlers(gen: number) {
    return {
      onPhaseChange: (connectionPhase: ConnectionPhase) => {
        if (gen !== connectionGen) return;
        if (connectionPhase === "connecting") setPhase("connecting");
        else if (connectionPhase === "connected") setPhase("in_call");
        else if (connectionPhase === "reconnecting") setPhase("reconnecting");
        else if (connectionPhase === "disconnected" && phase !== "ended") {
          micTestActive = false;
          setPhase("disconnected");
        }
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
        applySubscribedVideoQuality(livekitRoom, videoQuality);
        if (showTileStats) {
          void refreshTileStats(livekitRoom);
        }
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
      onAudioPlaybackStatusChanged: (canPlayback: boolean) => {
        if (gen !== connectionGen) return;
        audioPlaybackBlocked = !canPlayback;
      },
    };
  }

  async function requestToken() {
    const res = await fetch(`/api/rooms/${slug}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload.message ?? "Could not join room");
    }

    localDisplayName = payload.displayName ?? userDisplayName ?? user.email;

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

    callSession = createCallRoom(bindConnectionHandlers(gen), { videoQuality, audioQuality });
    livekitRoom = callSession.room;

    await callSession.connect(payload.wsUrl, payload.token, {
      micEnabled: micEnabled && permissionState !== "denied",
      camEnabled: camEnabled && permissionState === "granted" && !cameraInUse,
      iceServers: payload.iceServers,
      audioDeviceId: audioDeviceId || undefined,
      videoDeviceId: videoDeviceId || undefined,
      audioOutputDeviceId: audioOutputDeviceId || undefined,
      micGateProcessor: micGateProcessor ?? undefined,
    });

    attachScreenShareListener(callSession.room, gen);
    localConnectionQuality = qualityLabel(callSession.room.localParticipant.connectionQuality);
    applyRoomSpeakerState(callSession.room);
    applySubscribedVideoQuality(callSession.room, videoQuality);
    audioPlaybackBlocked = !callSession.room.canPlaybackAudio;
    startPingPoll();
    startTileStatsPoll(callSession.room);
    networkHintDismissed = false;
    writeActiveCallSession({
      slug,
      displayName: localDisplayName,
      joinedAt: new Date().toISOString(),
    });
    if (permissionState === "granted") await loadMediaDevices();
    stopHostWaitingPoll();
    setPhase("in_call");
    await refreshRoomMeta();
  }

  async function pollWaitingAdmission() {
    const identity = waitingIdentity ?? user.id;
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
      showToast(`Could not ${action} participant`);
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

  async function updateRoomLock(nextIsLocked: boolean) {
    if (!isHost || nextIsLocked === roomIsLocked) return;

    updatingRoomLock = true;
    errorMessage = null;

    try {
      const res = await fetch(`/api/rooms/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLocked: nextIsLocked }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        errorMessage = payload.message ?? "Could not update room lock";
        return;
      }
      roomIsLocked = payload.isLocked;
      showToast(nextIsLocked ? "Room locked — new joins blocked" : "Room unlocked");
    } catch {
      errorMessage = "Could not update room lock";
    } finally {
      updatingRoomLock = false;
    }
  }

  async function muteParticipant(identity: string, track: "microphone" | "camera") {
    const res = await fetch(`/api/rooms/${slug}/mute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity, track }),
    });
    if (!res.ok) {
      showToast(`Could not mute ${track === "microphone" ? "microphone" : "camera"}`);
      return;
    }
    showToast(track === "microphone" ? "Participant muted" : "Participant camera stopped");
  }

  async function removeParticipant(identity: string) {
    if (!confirm("Remove this participant from the call?")) return;

    const res = await fetch(`/api/rooms/${slug}/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity }),
    });
    if (!res.ok) {
      showToast("Could not remove participant");
      return;
    }
    showToast("Participant removed");
  }

  async function postSnapshotToChat(dataUrl: string) {
    const payload: Record<string, string> = { body: dataUrl, kind: "snapshot" };

    const res = await fetch(`/api/rooms/${slug}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return false;
    }

    chatSyncToken += 1;
    return true;
  }

  async function retryMicrophone() {
    micDeviceError = null;
    micEnabled = true;
    await loadMediaDevices();
    const nextDeviceId = mediaDevices.audioInputs[0]?.deviceId;
    if (nextDeviceId) {
      await changeAudioDevice(nextDeviceId);
    }
    if (livekitRoom && inCallPhase) {
      await enableLocalMicrophone();
    } else if (phase === "lobby" || phase === "waiting_admission") {
      syncPreviewTracks(previewStream, { audio: true, video: camEnabled });
    }
  }

  async function retryCamera() {
    cameraInUse = false;
    camEnabled = true;
    await loadMediaDevices();
    const nextDeviceId = mediaDevices.videoInputs[0]?.deviceId;
    if (nextDeviceId) {
      await changeVideoDevice(nextDeviceId);
    }
    if (livekitRoom && inCallPhase) {
      await enableLocalCamera();
    }
  }

  async function rejoinStoredCall() {
    const session = storedRejoinSession;
    if (!session || session.slug !== slug) return;

    storedRejoinSession = null;
    await joinCall();
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
    primeBrowserAudioGesture(previewStream);

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
    clearActiveCallSession();
    storedRejoinSession = null;
    if (micTestActive) {
      micTestActive = false;
    }
    showInCallDevices = false;
    showGridSettings = false;
    closeGamePanel();
    gameState.disconnect();
    listeningState.disconnect();
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
    if (speakerEnabled && livekitRoom) {
      void ensureRoomAudio(livekitRoom, "toggle_speaker");
    }
  }

  async function enableCallAudio() {
    if (!livekitRoom) return;

    attachAllRemoteAudioTracks(livekitRoom);
    const started = await ensureRoomAudio(livekitRoom, "enable_call_audio");
    audioPlaybackBlocked = !started;
    if (started) {
      applyRoomSpeakerState(livekitRoom);
    }
  }

  async function toggleMic() {
    if (inCallPhase && micTestActive) {
      micTestActive = false;
      return;
    }

    micEnabled = !micEnabled;

    if (!micEnabled) {
      micTestActive = false;
      if (phase === "lobby" || phase === "waiting_admission") {
        syncPreviewTracks(previewStream, { audio: false, video: camEnabled });
      } else if (livekitRoom) {
        await disableLocalMicrophone(livekitRoom);
      }
      return;
    }

    micDeviceError = null;

    if (livekitRoom && inCallPhase) {
      if (!audioDeviceId) {
        audioDeviceId = mediaDevices.audioInputs[0]?.deviceId ?? "";
      }
      await enableLocalMicrophone();
      return;
    }

    const nextDeviceId = audioDeviceId || mediaDevices.audioInputs[0]?.deviceId;
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

  async function enableLocalCamera() {
    if (!livekitRoom) return true;

    try {
      await livekitRoom.localParticipant.setCameraEnabled(true, {
        deviceId: videoDeviceId || undefined,
        resolution: videoPresetForOption(videoQuality).resolution,
      });
      cameraInUse = false;
      return true;
    } catch (error) {
      if (isDeviceInUseError(error)) {
        cameraInUse = true;
        camEnabled = false;
        showToast(CAMERA_IN_USE_MESSAGE);
        return false;
      }
      showToast(deviceErrorMessage(error, "camera"));
      camEnabled = false;
      return false;
    }
  }

  async function toggleCam() {
    camEnabled = !camEnabled;

    if (!camEnabled) {
      cameraInUse = false;
      if (phase === "lobby" || phase === "waiting_admission") {
        syncPreviewTracks(previewStream, { audio: micEnabled, video: false });
      } else if (livekitRoom) {
        await livekitRoom.localParticipant.setCameraEnabled(false);
        bumpMediaRevision();
      }
      return;
    }

    const nextDeviceId = videoDeviceId || mediaDevices.videoInputs[0]?.deviceId;
    if (nextDeviceId) {
      await changeVideoDevice(nextDeviceId);
      if (livekitRoom && phase !== "lobby" && phase !== "waiting_admission") {
        const enabled = await enableLocalCamera();
        if (enabled) bumpMediaRevision();
      }
      return;
    }

    if (phase === "lobby" || phase === "waiting_admission") {
      const result = await restartMediaPreview(previewStream, {
        audio: micEnabled,
        video: true,
        audioDeviceId: audioDeviceId || undefined,
        videoDeviceId: videoDeviceId || undefined,
      });
      applyPreviewResult(result);
      if (cameraInUse) {
        showToast(CAMERA_IN_USE_MESSAGE);
      }
    } else if (livekitRoom) {
      const enabled = await enableLocalCamera();
      if (enabled) bumpMediaRevision();
    }
  }

  async function stopOtherScreenCapture() {
    if (!livekitRoom) return true;

    const otherSharer = findScreenCaptureParticipant(livekitRoom, livekitRoom.localParticipant.identity);
    if (!otherSharer) return true;

    const res = await fetch(`/api/rooms/${slug}/screen-share/stop-active`, { method: "POST" });
    if (!res.ok) {
      showToast("Could not take over screen share");
      return false;
    }

    return true;
  }

  async function toggleScreenShare() {
    if (!livekitRoom) return;
    const local = livekitRoom.localParticipant;

    if (isScreenCaptureActive(local)) {
      intentionalScreenShareStop = true;
      intentionalScreenAudioShareStop = true;
      screenAudioShareEndedCleanup?.();
      screenAudioShareEndedCleanup = undefined;
      await disableLocalScreenCapture(local);
      bumpMediaRevision();
      return;
    }

    if (!(await stopOtherScreenCapture())) return;

    try {
      const result = await enableLocalScreenShare(local);
      if (!isScreenShareActive(local) && isScreenShareAudioActive(local)) {
        attachScreenAudioShareEndedListener(livekitRoom, connectionGen);
      }
      bumpMediaRevision();
      const hint = screenShareAudioHint(result);
      if (hint) {
        showToast(hint);
      }
    } catch (error) {
      const message = screenShareFailureMessage(error);
      if (!(error instanceof DOMException && error.name === "NotAllowedError")) {
        showToast(message);
      }
    }
  }

  async function toggleLocalShareVideo() {
    if (!livekitRoom) return;
    const local = livekitRoom.localParticipant;
    const nextEnabled = !isScreenShareActive(local);

    try {
      if (!nextEnabled) {
        intentionalScreenShareStop = true;
      }
      await setLocalScreenShareVideoEnabled(local, nextEnabled);
      if (!isScreenShareActive(local) && isScreenShareAudioActive(local)) {
        attachScreenAudioShareEndedListener(livekitRoom, connectionGen);
      }
      await stopShareIfNoMedia(local);
      bumpMediaRevision();
    } catch (error) {
      showToast(screenShareFailureMessage(error));
    }
  }

  async function toggleLocalShareAudio() {
    if (!livekitRoom) return;
    const local = livekitRoom.localParticipant;
    const nextEnabled = !isScreenShareAudioActive(local);

    if (nextEnabled && !isScreenShareAudioAvailable(local) && !isScreenShareAudioActive(local)) {
      showToast("Share audio was not granted in the browser picker — stop and share again with audio enabled");
      return;
    }

    try {
      if (!nextEnabled) {
        intentionalScreenAudioShareStop = true;
      }
      await setLocalScreenShareAudioEnabled(local, nextEnabled);
      await stopShareIfNoMedia(local);
      bumpMediaRevision();
    } catch (error) {
      showToast(screenShareFailureMessage(error));
    }
  }

  async function takeSnapshot() {
    if (!stageEl || snapshotting) return;
    snapshotting = true;
    snapshotFlash = true;

    try {
      const blob = await captureStageToBlob(stageEl);
      downloadSnapshotBlob(blob, slug);

      if (chatEnabled) {
        const dataUrl = await compressSnapshotForChat(blob);
        const shared = await postSnapshotToChat(dataUrl);
        showToast(shared ? "Snapshot shared in chat" : "Snapshot saved locally but could not share in chat");
      } else {
        showToast("Snapshot saved");
      }
    } catch {
      showToast("Could not capture snapshot");
    } finally {
      snapshotting = false;
      setTimeout(() => {
        snapshotFlash = false;
      }, 200);
    }
  }

  $effect(() => {
    if (!browser) return;
    const unsubscribe = gameState.snapshot.subscribe((value) => {
      gameSnapshot = value;
    });
    return unsubscribe;
  });

  $effect(() => {
    if (!browser) return;
    const unsubscribe = listeningState.snapshot.subscribe((value) => {
      listeningSnapshot = value;
    });
    return unsubscribe;
  });

  $effect(() => {
    if (!browser) return;
    if (inCallPhase) {
      gameState.connect(slug);
      listeningState.connect(slug);
      void refreshYouTubeLink();
      return () => {
        gameState.disconnect();
        listeningState.disconnect();
      };
    }
    gameState.disconnect();
    listeningState.disconnect();
    gameSnapshot = null;
    listeningSnapshot = null;
    closeGamePanel();
  });

  $effect(() => {
    if (gameActive && !gameSnapshot?.round && inCallPhase) {
      showGamePanel = true;
    }
  });

  $effect(() => {
    if (gameActive) {
      closeGridSettingsPanel();
      if (layoutModeBeforeGame === null && stageLayoutMode !== "game") {
        layoutModeBeforeGame = stageLayoutMode;
      }
      stageLayoutMode = "game";
      return;
    }

    if (layoutModeBeforeGame !== null) {
      stageLayoutMode = layoutModeBeforeGame;
      layoutModeBeforeGame = null;
    }
  });

  $effect(() => {
    if (!inCallPhase || networkHintDismissed || localConnectionQuality !== "poor") return;
    if (camEnabled) {
      showToast("Poor connection — try turning off your camera or moving closer to Wi‑Fi");
    } else {
      showToast("Poor connection — audio-only may work better on this network");
    }
    networkHintDismissed = true;
  });

  onMount(() => {
    if (!browser) return;
    tileColor = readInitialTileColor();
    hideParticipantVideos = readStoredFlag(STORAGE_KEYS.hideParticipantVideos);
    hideNonVideoTiles = readStoredFlag(STORAGE_KEYS.hideNonVideoTiles);
    disableSpeakingGlows = readStoredFlag(STORAGE_KEYS.disableSpeakingGlows);
    gesturesEnabled = readStoredFlag(STORAGE_KEYS.gesturesEnabled);
    gestureOverlayVisible = readStoredFlag(STORAGE_KEYS.gestureOverlayVisible);
    stageLayoutMode = readInitialStageLayoutMode();
    autoLayoutPreset = readInitialAutoLayoutPreset();
    galleryDensity = readStoredInt(STORAGE_KEYS.galleryDensity, 5, 1, 10);
    sidebarSplitRatio = readStoredFloat(STORAGE_KEYS.sidebarSplitRatio, 0.72, 0.55, 0.85);
    storedRejoinSession = readActiveCallSession();
    onPhaseChange?.(phase);
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
    gameState.disconnect();
    listeningState.disconnect();
    teardownCall(true);
    disposeHandLandmarker();
  });
</script>

<HandGestureTracker
  videoTrack={localGestureVideoTrack}
  active={(phase === "lobby" || inCallPhase) && videoTrackingActive}
  {gesturesEnabled}
  overlayVisible={gestureOverlayVisible}
  onFrameUpdate={handleTrackingFrameUpdate}
  onGestureAction={handleGestureAction}
/>

{#if phase === "in_call" || phase === "connecting" || phase === "reconnecting" || (phase === "disconnected" && !isEnded)}
  <div class="call-shell fixed inset-0 z-50 flex flex-col bg-background">
    <ConnectionBanner {phase} {disconnectMessage} onRejoin={phase === "disconnected" && !isEnded ? rejoinCall : undefined} />

    {#if inCallPhase && audioPlaybackBlocked}
      <div class="absolute inset-x-0 top-0 z-20 border-b border-participant-orange/40 bg-card/95 px-4 py-2 text-center safe-top" role="alert">
        <p class="text-sm text-foreground">Call audio is blocked by your browser.</p>
        <button type="button" class="mt-1 text-sm font-medium text-participant-orange underline-offset-2 hover:underline" onclick={enableCallAudio}>
          Enable audio
        </button>
      </div>
    {/if}

    {#if toastMessage}
      <div
        class="pointer-events-none fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-lg border border-border bg-card/95 px-4 py-2 text-sm text-foreground shadow-lg backdrop-blur-sm safe-top safe-x"
        role="status"
      >
        {toastMessage}
      </div>
    {/if}

    {#if snapshotFlash}
      <div class="pointer-events-none fixed inset-0 z-[55] bg-white/25" aria-hidden="true"></div>
    {/if}

    {#if livekitRoom && (phase === "in_call" || phase === "reconnecting") && localConnectionQuality === "poor" && !networkHintDismissed}
      <div
        class="pointer-events-none fixed left-1/2 top-16 z-[60] w-[min(calc(100%-2rem),28rem)] -translate-x-1/2 rounded-lg border border-amber-500/40 bg-card/95 px-4 py-3 text-sm text-foreground shadow-lg backdrop-blur-sm safe-x"
      >
        <p class="font-medium">Network quality is poor</p>
        <p class="mt-1 text-xs text-muted-foreground">
          {camEnabled ? "Try turning off your camera or switching to a stronger connection." : "Stay on audio-only or move closer to your router."}
        </p>
      </div>
    {/if}

    {#if livekitRoom && (phase === "in_call" || phase === "reconnecting")}
      {#if chatEnabled}
        <ChatPanel
          {slug}
          localIdentity={livekitRoom.localParticipant.identity}
          open={chatOpen}
          syncToken={chatSyncToken}
          {isHost}
          participants={callParticipants}
          bottomOffset={controlBarReservePx}
          onMuteParticipant={isHost ? muteParticipant : undefined}
          onRemoveParticipant={isHost ? removeParticipant : undefined}
          onClose={() => (chatOpen = false)}
        />
      {/if}

      <GamePanel
        open={showGamePanel}
        bottomInset={controlBarReservePx}
        {isHost}
        userId={user.id}
        {slug}
        snapshot={gameSnapshot}
        {listeningSnapshot}
        {youtubeLinked}
        busy={gameBusy}
        {listeningBusy}
        onClose={closeGamePanel}
        onSnapshot={handleGameSnapshot}
        onListeningSnapshot={handleListeningSnapshot}
        onBusyChange={(value) => (gameBusy = value)}
        onListeningBusyChange={(value) => (listeningBusy = value)}
      />

      <GamePhaseBanner snapshot={gameSnapshot} />

      <div class="relative min-h-0 flex-1">
        {#if showInCallDevices}
          <div
            class="absolute inset-x-0 top-0 z-40 max-h-[min(88dvh,100%)] overflow-y-auto rounded-b-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-sm safe-top safe-x sm:inset-x-auto sm:left-4 sm:top-4 sm:max-h-none sm:w-full sm:max-w-md sm:rounded-xl"
          >
            <div class="mb-3 flex items-center justify-between">
              <p class="text-sm font-medium text-foreground">Settings</p>
              <button
                type="button"
                class="action-btn-ghost-destructive size-11 sm:size-7"
                aria-label="Close settings"
                onclick={closeInCallDevicesPanel}
              >
                <XIcon class="size-4" aria-hidden="true" />
              </button>
            </div>
            <div class="space-y-3">
              {#if cameraInUse}
                <div class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <p>{CAMERA_IN_USE_MESSAGE}</p>
                  <button type="button" class="mt-2 underline" onclick={retryCamera}>Retry camera</button>
                </div>
              {/if}
              {#if micDeviceError}
                <div class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <p>{micDeviceError}</p>
                  <button type="button" class="mt-2 underline" onclick={retryMicrophone}>Retry microphone</button>
                </div>
              {/if}
              <DevicePicker
                layout="stack"
                devices={mediaDevices}
                {audioDeviceId}
                {audioOutputDeviceId}
                {videoDeviceId}
                showAudioOutput={showAudioOutputSelection}
                micEnabled={micDisplayEnabled}
                {speakerEnabled}
                {camEnabled}
                onToggleMic={toggleMic}
                onToggleSpeaker={toggleSpeaker}
                onToggleCam={toggleCam}
                onAudioDeviceChange={changeAudioDevice}
                onAudioOutputDeviceChange={handleInCallAudioOutputDeviceChange}
                onVideoDeviceChange={changeVideoDevice}
              />
              <MicPreviewControls
                bind:this={inCallMicPreviewControls}
                layout="stack"
                helpContext="incall"
                bind:micTestActive
                previewStream={micMonitorStream}
                {micEnabled}
                {speakerEnabled}
                {audioOutputDeviceId}
                {micGateProcessor}
                permissionGranted={permissionState === "granted"}
              />
              <TileColorPicker compact value={tileColor} onChange={setTileColor} />
              <GestureSettings
                {gesturesEnabled}
                overlayVisible={gestureOverlayVisible}
                cameraAvailable={gestureCameraAvailable}
                onGesturesEnabledChange={setGesturesEnabled}
                onOverlayVisibleChange={setGestureOverlayVisible}
              />
              <MediaQualitySettings
                {videoQuality}
                {audioQuality}
                onVideoQualityChange={setVideoQualityPreference}
                onAudioQualityChange={setAudioQualityPreference}
              />
              <div class="rounded-lg border border-border px-3">
                <SettingToggle
                  id="hide-participant-videos"
                  label="Hide participant videos"
                  tooltip="Show colored initials instead of camera feeds for everyone in the grid."
                  checked={hideParticipantVideos}
                  onCheckedChange={setHideParticipantVideos}
                />
                <Separator />
                <SettingToggle
                  id="disable-speaking-glows"
                  label="Hide speaking glows"
                  tooltip="Turn off the outer glow when someone speaks. The colored outline still appears."
                  checked={disableSpeakingGlows}
                  onCheckedChange={setDisableSpeakingGlows}
                />
                <Separator />
                <SettingToggle
                  id="show-tile-stats"
                  label="Show tile stats"
                  tooltip="Ping, video/audio quality, and fps on every tile."
                  checked={showTileStats}
                  onCheckedChange={setShowTileStats}
                />
                {#if isHost}
                  <Separator />
                  <SettingToggle
                    id="room-lock"
                    label="Lock room"
                    tooltip="Block new participants from joining while the room stays active."
                    checked={roomIsLocked}
                    disabled={updatingRoomLock}
                    onCheckedChange={updateRoomLock}
                  />
                {/if}
              </div>
            </div>
          </div>
        {/if}

        <CallStage
          room={livekitRoom}
          {slug}
          {activeSpeakerIdentity}
          {audioLevels}
          {localDisplayName}
          {mediaRevision}
          localMicEnabled={micDisplayEnabled}
          localTileColor={tileColor}
          {hideParticipantVideos}
          {hideNonVideoTiles}
          {disableSpeakingGlows}
          layoutMode={stageLayoutMode}
          {autoLayoutPreset}
          {galleryDensity}
          {sidebarSplitRatio}
          {pinnedTileKey}
          bottomInset={controlBarReservePx}
          {minimizedTileKeys}
          {hiddenVideoTileKeys}
          {tileVolumes}
          speakersEnabled={speakerEnabled}
          {showTileStats}
          {tileStats}
          {fullscreenTileKey}
          {selfViewHidden}
          onMinimizeTile={minimizeTile}
          onToggleHideVideo={toggleTileHideVideo}
          onToggleTileListenMute={toggleTileListenMute}
          onTileVolumeChange={setTileListenVolume}
          onToggleTileFullscreen={toggleTileFullscreen}
          onTogglePinTile={togglePinTile}
          onToggleLocalShareVideo={toggleLocalShareVideo}
          onToggleLocalShareAudio={toggleLocalShareAudio}
          {showGridSettings}
          {showInCallDevices}
          layoutLocked={gameActive}
          gameTeams={gameSnapshot?.teams ?? []}
          {listeningSnapshot}
          {listeningIsDj}
          {listeningBusy}
          onListeningPlay={() => void listeningTransport("play")}
          onListeningPause={() => void listeningTransport("pause")}
          onListeningSkip={() => void listeningTransport("skip")}
          onListeningPrevious={() => void listeningTransport("previous")}
          onListeningSeek={(positionMs) => void listeningSeek(positionMs)}
          onLayoutModeChange={setStageLayoutMode}
          onAutoLayoutPresetChange={setAutoLayoutPreset}
          onHideNonVideoTilesChange={setHideNonVideoTiles}
          onGalleryDensityChange={setGalleryDensity}
          onSidebarSplitRatioChange={setSidebarSplitRatio}
          onHideSelfView={toggleSelfView}
          onCloseGridSettings={closeGridSettingsPanel}
          bind:stageRef={stageEl}
          trackingOverlayVisible={gestureOverlayVisible}
          handLandmarks={trackingFrame.handLandmarks}
          handGesture={trackingFrame.gesture}
          handGestureHoldProgress={trackingFrame.holdProgress}
        />
      </div>
      <div class="pointer-events-none fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-4 z-[21] safe-x">
        <ConnectionQualityBadge label={localConnectionQuality} pingMs={localPingMs} />
      </div>
      <ControlBar
        bind:barRef={controlBarEl}
        {isHost}
        micEnabled={micDisplayEnabled}
        micTesting={inCallPhase && micTestActive}
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
        onToggleDevices={() => (showInCallDevices ? closeInCallDevicesPanel() : openInCallDevicesPanel())}
        devicesOpen={showInCallDevices}
        onToggleGridSettings={gameActive ? undefined : toggleGridSettingsPanel}
        gridSettingsOpen={showGridSettings}
        onToggleGameMode={showGameModeButton ? toggleGamePanel : undefined}
        gamePanelOpen={showGamePanel}
        {showGameModeButton}
        {gameActive}
        onLeave={leaveCall}
        onEndRoom={isHost ? endRoom : undefined}
        {ending}
        {minimizedTiles}
        localIdentity={livekitRoom.localParticipant.identity}
        {localDisplayName}
        localTileColor={tileColor}
        onRestoreTile={restoreTile}
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

  {#if storedRejoinSession?.slug === slug && phase === "lobby" && !isEnded}
    <div class="mb-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
      <p class="text-sm font-medium text-foreground">You were in this call before the page reloaded.</p>
      <p class="mt-1 text-xs text-muted-foreground">
        Rejoin as {storedRejoinSession.displayName ?? userDisplayName ?? "you"}?
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground" onclick={rejoinStoredCall}>
          Rejoin call
        </button>
        <button
          type="button"
          class="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground"
          onclick={() => {
            storedRejoinSession = null;
            clearActiveCallSession();
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  {/if}

  <PreCallLobby
    {slug}
    {roomTitle}
    {hostName}
    {participantCount}
    {maxParticipants}
    {isHost}
    isPublic={roomIsPublic}
    {waitingRoomEnabled}
    {isStale}
    {userDisplayName}
    {micEnabled}
    {speakerEnabled}
    {camEnabled}
    {permissionState}
    {cameraInUse}
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
    {tileColor}
    onTileColorChange={setTileColor}
    {updatingVisibility}
    onToggleMic={toggleMic}
    onToggleSpeaker={toggleSpeaker}
    onToggleCam={toggleCam}
    onAudioDeviceChange={changeAudioDevice}
    onAudioOutputDeviceChange={changeAudioOutputDevice}
    onVideoDeviceChange={changeVideoDevice}
    onPublicChange={isHost ? updateRoomVisibility : undefined}
    onJoin={joinCall}
    trackingOverlayVisible={gestureOverlayVisible}
    handLandmarks={trackingFrame.handLandmarks}
    handGesture={trackingFrame.gesture}
    handGestureHoldProgress={trackingFrame.holdProgress}
  />

  <div class="mt-4">
    <GestureSettings
      {gesturesEnabled}
      overlayVisible={gestureOverlayVisible}
      cameraAvailable={gestureCameraAvailable}
      onGesturesEnabledChange={setGesturesEnabled}
      onOverlayVisibleChange={setGestureOverlayVisible}
    />
  </div>

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
