import { describe, expect, it } from "bun:test";
import { appendPending, clearPending, createPendingPcm, releaseWarmFrames, takeFrame } from "./pcm-buffer";

const FRAME_BYTES = 3840;

describe("track-switch memory hygiene", () => {
  it("keeps pending PCM bounded across many song-sized chunk streams", () => {
    const pending = createPendingPcm();
    // Simulate ~3 minutes of audio as many uneven ffmpeg readout chunks.
    const chunksPerSong = 500;
    const songs = 5;
    let frames = 0;

    for (let song = 0; song < songs; song++) {
      for (let i = 0; i < chunksPerSong; i++) {
        // Uneven chunk sizes like real pipe reads.
        const size = 1024 + ((i * 97) % 4096);
        appendPending(pending, new Uint8Array(size).fill(song & 0xff));
        while (true) {
          const frame = takeFrame(pending, FRAME_BYTES);
          if (!frame) break;
          frames += 1;
        }
        // After draining complete frames, unread remainder must stay < one frame.
        expect(pending.bytes.byteLength - pending.offset).toBeLessThan(FRAME_BYTES);
        // Compaction keeps the backing store to about one residual chunk.
        expect(pending.bytes.byteLength).toBeLessThan(FRAME_BYTES + 8192);
      }
      clearPending(pending);
    }

    expect(frames).toBeGreaterThan(chunksPerSong);
    expect(pending.bytes.byteLength).toBe(0);
  });

  it("releases warm frame lists when advancing tracks", () => {
    const sessions: Uint8Array[][] = [];
    for (let i = 0; i < 8; i++) {
      const frames = Array.from({ length: 125 }, () => new Uint8Array(FRAME_BYTES));
      sessions.push(frames);
      // Previous track warm buffers must be emptied on advance.
      if (i > 0) releaseWarmFrames(sessions[i - 1]!);
    }
    for (let i = 0; i < sessions.length - 1; i++) {
      expect(sessions[i]!.length).toBe(0);
    }
    expect(sessions.at(-1)!.length).toBe(125);
    releaseWarmFrames(sessions.at(-1)!);
    expect(sessions.at(-1)!.length).toBe(0);
  });

  it("kills a pipe-filling producer so it cannot retain buffers after stop", async () => {
    // Mimics an orphaned ffmpeg: writes forever into a pipe nobody drains after cancel.
    const proc = Bun.spawn(["bash", "-c", "while true; do dd if=/dev/zero bs=65536 count=1 2>/dev/null; done"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const reader = proc.stdout.getReader();
    // Read a little so the process is definitely alive and producing.
    const first = await reader.read();
    expect(first.done).toBe(false);
    await reader.cancel().catch(() => undefined);
    try {
      proc.kill();
    } catch {
      // already exited
    }
    const code = await Promise.race([proc.exited, Bun.sleep(2000).then(() => "timeout")]);
    expect(code).not.toBe("timeout");
  });
});
