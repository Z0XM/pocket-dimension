import { FilesetResolver } from "@mediapipe/tasks-vision";

const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

type VisionFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

let filesetPromise: Promise<VisionFileset> | null = null;

export function getVisionFileset() {
  if (!filesetPromise) {
    filesetPromise = FilesetResolver.forVisionTasks(WASM_CDN).catch((error) => {
      filesetPromise = null;
      throw error;
    });
  }
  return filesetPromise;
}

export function resetVisionFileset() {
  filesetPromise = null;
}
