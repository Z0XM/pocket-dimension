import type { DetectedGesture, HandLandmark } from "./gesture-types";

function distance(a: HandLandmark, b: HandLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function handScale(landmarks: HandLandmark[]) {
  return distance(landmarks[0], landmarks[9]);
}

function isFingerExtended(landmarks: HandLandmark[], tip: number, pip: number, wrist: number) {
  return distance(landmarks[tip], landmarks[wrist]) > distance(landmarks[pip], landmarks[wrist]) * 1.12;
}

function isThumbExtended(landmarks: HandLandmark[]) {
  const tipToMcp = distance(landmarks[4], landmarks[2]);
  const ipToMcp = distance(landmarks[3], landmarks[2]);
  const tipAwayFromPalm = distance(landmarks[4], landmarks[9]);
  return tipToMcp > ipToMcp * 1.2 && tipAwayFromPalm > 0.09;
}

function isOkSign(landmarks: HandLandmark[]) {
  const scale = handScale(landmarks);
  const pinchDist = distance(landmarks[4], landmarks[8]);
  if (pinchDist > scale * 0.28) return false;

  const middle = isFingerExtended(landmarks, 12, 10, 0);
  const ring = isFingerExtended(landmarks, 16, 14, 0);
  const pinky = isFingerExtended(landmarks, 20, 18, 0);
  return middle && ring && pinky;
}

function isShaka(landmarks: HandLandmark[]) {
  const scale = handScale(landmarks);
  const thumbIndexDist = distance(landmarks[4], landmarks[8]);
  if (thumbIndexDist < scale * 0.35) return false;

  const thumb = isThumbExtended(landmarks);
  const pinky = isFingerExtended(landmarks, 20, 18, 0);
  const index = isFingerExtended(landmarks, 8, 6, 0);
  const middle = isFingerExtended(landmarks, 12, 10, 0);
  const ring = isFingerExtended(landmarks, 16, 14, 0);
  return thumb && pinky && !index && !middle && !ring;
}

export function classifyGesture(landmarks: HandLandmark[]): DetectedGesture {
  if (landmarks.length < 21) return "none";
  if (isOkSign(landmarks)) return "ok_sign";
  if (isShaka(landmarks)) return "shaka";
  return "none";
}

export function gestureLabel(gesture: DetectedGesture): string {
  switch (gesture) {
    case "shaka":
      return "Shaka";
    case "ok_sign":
      return "OK sign";
    default:
      return "No gesture";
  }
}

export function gestureActionHint(gesture: DetectedGesture): string | null {
  switch (gesture) {
    case "shaka":
    case "ok_sign":
      return "Hold to toggle mic";
    default:
      return null;
  }
}
