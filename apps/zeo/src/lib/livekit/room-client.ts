import { DisconnectReason, Room, RoomEvent, type ConnectionQuality, type LocalParticipant, type RemoteParticipant } from "livekit-client";

export type ConnectionPhase = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

export type CallRoomHandlers = {
  onPhaseChange: (phase: ConnectionPhase) => void;
  onActiveSpeaker: (identity: string | null) => void;
  onParticipantsChange: () => void;
  onDisconnect: (reason?: DisconnectReason) => void;
  onConnectionQuality?: (quality: ConnectionQuality, identity: string) => void;
};

export function createCallRoom(handlers: CallRoomHandlers) {
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  room.on(RoomEvent.Reconnecting, () => handlers.onPhaseChange("reconnecting"));
  room.on(RoomEvent.Reconnected, () => handlers.onPhaseChange("connected"));
  room.on(RoomEvent.Disconnected, (reason) => {
    handlers.onPhaseChange("disconnected");
    handlers.onDisconnect(reason);
  });
  room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
    handlers.onActiveSpeaker(speakers[0]?.identity ?? null);
  });
  room.on(RoomEvent.ParticipantConnected, () => handlers.onParticipantsChange());
  room.on(RoomEvent.ParticipantDisconnected, () => handlers.onParticipantsChange());
  room.on(RoomEvent.TrackSubscribed, () => handlers.onParticipantsChange());
  room.on(RoomEvent.TrackUnsubscribed, () => handlers.onParticipantsChange());
  room.on(RoomEvent.LocalTrackPublished, () => handlers.onParticipantsChange());
  room.on(RoomEvent.LocalTrackUnpublished, () => handlers.onParticipantsChange());
  room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
    handlers.onConnectionQuality?.(quality, participant.identity);
  });

  async function connect(
    wsUrl: string,
    token: string,
    options: {
      micEnabled: boolean;
      camEnabled: boolean;
      iceServers?: RTCIceServer[];
      audioDeviceId?: string;
      videoDeviceId?: string;
    }
  ) {
    handlers.onPhaseChange("connecting");
    await room.connect(wsUrl, token, options.iceServers?.length ? { rtcConfig: { iceServers: options.iceServers } } : undefined);
    await room.localParticipant.setMicrophoneEnabled(options.micEnabled, {
      deviceId: options.audioDeviceId,
    });
    await room.localParticipant.setCameraEnabled(options.camEnabled, {
      deviceId: options.videoDeviceId,
    });
    handlers.onPhaseChange("connected");
    handlers.onParticipantsChange();
  }

  async function disconnect() {
    if (room.state !== "disconnected") {
      await room.disconnect();
    }
  }

  return { room, connect, disconnect };
}

export function listRoomParticipants(room: Room): Array<LocalParticipant | RemoteParticipant> {
  return [room.localParticipant, ...room.remoteParticipants.values()];
}

export function isCameraEnabled(participant: LocalParticipant | RemoteParticipant) {
  return participant.isCameraEnabled;
}

export function isMicrophoneEnabled(participant: LocalParticipant | RemoteParticipant) {
  return participant.isMicrophoneEnabled;
}

export function wasRoomDeleted(reason?: DisconnectReason) {
  return reason === DisconnectReason.ROOM_DELETED;
}

export function wasParticipantRemoved(reason?: DisconnectReason) {
  return reason === DisconnectReason.PARTICIPANT_REMOVED;
}
