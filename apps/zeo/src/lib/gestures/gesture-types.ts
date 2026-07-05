export type HandLandmark = {
  x: number;
  y: number;
  z: number;
};

/** Phone-style poses: shaka (🤙) and OK sign (👌). */
export type DetectedGesture = "shaka" | "ok_sign" | "none";

export type GestureAction = "toggle_mic";

export type VideoTrackingFrame = {
  handLandmarks: HandLandmark[] | null;
  gesture: DetectedGesture;
  holdProgress: number;
};

/** @deprecated Use VideoTrackingFrame */
export type HandGestureFrame = VideoTrackingFrame;
