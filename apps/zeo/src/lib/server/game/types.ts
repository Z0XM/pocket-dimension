export type GameSessionStatus = "setup" | "active" | "ended";
export type GameType = "charades";
export type GameRoundPhase = "submission" | "passed_on" | "act" | "verdict" | "ready_check" | "completed";
export type GameVerdict = "accepted" | "rejected";

export type GameSnapshotTeam = {
  id: string;
  name: string;
  colorKey: string;
  sortOrder: number;
  score: number;
  memberUserIds: string[];
};

export type GameSnapshotParticipant = {
  userId: string;
  teamId: string | null;
  isReady: boolean;
  displayName: string;
};

export type GameSnapshotRound = {
  id: string;
  roundNumber: number;
  proposingTeamId: string;
  guessingTeamId: string;
  mimeUserId: string;
  phase: GameRoundPhase;
  lockedWord: string | null;
  lockedSuggestionId: string | null;
  verdict: GameVerdict | null;
};

export type GameSnapshotSession = {
  id: string;
  roomId: string;
  hostUserId: string;
  gameType: GameType;
  status: GameSessionStatus;
  teamCount: number;
  createdAt: string;
  endedAt: string | null;
};

export type GameSnapshotRoomScore = {
  userId: string;
  displayName: string;
  totalScore: number;
  gamesPlayed: number;
};

export type GameSnapshot = {
  version: number;
  session: GameSnapshotSession | null;
  teams: GameSnapshotTeam[];
  participants: GameSnapshotParticipant[];
  round: GameSnapshotRound | null;
  roomScores: GameSnapshotRoomScore[];
};
