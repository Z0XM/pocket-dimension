import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { getVisionFileset } from "./vision-runtime";
import type { HandLandmark } from "./gesture-types";

const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let landmarkerPromise: Promise<HandLandmarker> | null = null;

async function createLandmarker() {
  const vision = await getVisionFileset();

  try {
    return await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
    });
  } catch {
    return HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
    });
  }
}

export async function getHandLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker().catch((error) => {
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}

export function disposeHandLandmarker() {
  if (!landmarkerPromise) return;
  void landmarkerPromise.then((landmarker) => landmarker.close());
  landmarkerPromise = null;
}

function toLandmarks(result: HandLandmarkerResult): HandLandmark[] | null {
  const hand = result.landmarks[0];
  if (!hand?.length) return null;
  return hand.map((point) => ({ x: point.x, y: point.y, z: point.z }));
}

export async function detectHandLandmarks(video: HTMLVideoElement, timestampMs: number) {
  const landmarker = await getHandLandmarker();
  const result = landmarker.detectForVideo(video, timestampMs);
  return toLandmarks(result);
}
