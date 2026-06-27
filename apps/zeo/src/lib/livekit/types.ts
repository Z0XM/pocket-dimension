export type CallPhase = "lobby" | "waiting_admission" | "connecting" | "in_call" | "reconnecting" | "disconnected" | "ended";

export type PermissionState = "prompt" | "granted" | "denied" | "unavailable";

export function initialsForName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function gridClassForCount(count: number) {
  if (count <= 1) return "mx-auto grid max-w-3xl grid-cols-1";
  if (count === 2) return "grid grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid grid-cols-2 grid-rows-2";
  return "grid grid-cols-2 grid-rows-3 sm:grid-cols-3 sm:grid-rows-2";
}
