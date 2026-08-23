# Architecture — zeo-music-worker

**Type:** backend / worker  
**Path:** `apps/zeo-music-worker`  
**Port:** 3010 (internal)

## Executive Summary

Shared-listening audio bot: `yt-dlp` → `ffmpeg` → PCM → `@livekit/rtc-node`. Triggered by zeo; authenticates with `MUSIC_WORKER_SECRET`.

## Technology Stack

Bun, `@livekit/rtc-node`, yt-dlp, ffmpeg, Deno (image).

## Architecture Pattern

`Bun.serve` job API. Fetches bot token from zeo, publishes one bot identity `listening-bot:{roomId}`, posts playback events back.

## API Design

[api-contracts-zeo-music-worker.md](./api-contracts-zeo-music-worker.md).

## Deployment

`apps/zeo-music-worker/Dockerfile` and README. No public domain in production.

## Testing

None.
