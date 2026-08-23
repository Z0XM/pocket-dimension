# Component Inventory — zeo

Vendor `src/lib/components/ui/**` omitted. Custom call UI lives in `src/lib/components/call/`.

## Orchestration

- `CallExperience.svelte` — lobby → connect → in-call
- `UserMenu.svelte`

## Stage / tiles

- `CallStage`, `VideoGrid`, `GridTile`, `ParticipantTile`
- `ScreenShareTile`, `ScreenShareVideo`
- `StageGridArea`, `GridSettingsPanel`, `MinimizedStageTile`

## Controls

- `ControlBar`, `DevicePicker`, `MediaQualitySettings`, `InCallSettingsPanel`
- `TileActionBar`, `TileVolumeSlider`, `TileStatsOverlay`, `TileColorPicker`
- `MicPreviewControls`, `AudioLevelIndicator`

## Rooms / social

- `PreCallLobby`, `WaitingRoomView`, `HostWaitingPanel`
- `ChatPanel`
- `ConnectionBanner`, `ConnectionQualityBadge`

## Games / listening / gestures

- `GamePanel`, `GamePhaseBanner`
- `ListeningTile`
- `HandGestureTracker`, `HandGestureVideoOverlay`, `GestureSettings`
- `DevFloatingCard`
