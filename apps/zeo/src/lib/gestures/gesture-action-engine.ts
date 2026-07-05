import { classifyGesture } from "./gesture-classifier";
import type { DetectedGesture, GestureAction, HandLandmark } from "./gesture-types";

const HOLD_MS = 1000;
const COOLDOWN_MS = 3000;

type EngineOptions = {
  onAction: (action: GestureAction, gesture: DetectedGesture) => void;
};

export type GestureEngineUpdate = {
  gesture: DetectedGesture;
  holdProgress: number;
};

export function createGestureActionEngine(options: EngineOptions) {
  let holdGesture: DetectedGesture = "none";
  let holdStartedAt = 0;
  let cooldownUntil = 0;

  function resetHold() {
    holdGesture = "none";
    holdStartedAt = 0;
  }

  function actionForGesture(gesture: DetectedGesture): GestureAction | null {
    if (gesture === "shaka" || gesture === "ok_sign") return "toggle_mic";
    return null;
  }

  function update(landmarks: HandLandmark[] | null, nowMs: number): GestureEngineUpdate {
    const gesture = landmarks ? classifyGesture(landmarks) : "none";

    if (nowMs < cooldownUntil || gesture === "none") {
      resetHold();
      return { gesture, holdProgress: 0 };
    }

    if (gesture !== holdGesture) {
      holdGesture = gesture;
      holdStartedAt = nowMs;
    }

    const holdProgress = Math.min(1, (nowMs - holdStartedAt) / HOLD_MS);
    if (holdProgress < 1) {
      return { gesture, holdProgress };
    }

    const action = actionForGesture(gesture);
    if (!action) {
      resetHold();
      return { gesture: "none", holdProgress: 0 };
    }

    options.onAction(action, gesture);
    cooldownUntil = nowMs + COOLDOWN_MS;
    resetHold();
    return { gesture: "none", holdProgress: 0 };
  }

  return { update, resetHold };
}
