# Architecture — markitdown

**Type:** web  
**Path:** `apps/markitdown`  
**Port:** 3009

## Executive Summary

Standalone upload UI that shells out to Python `markitdown[all]` for file→Markdown. No auth, no DB.

## Technology Stack

SvelteKit 2, Bun spawn, Python 3.12, Microsoft markitdown, ffmpeg, exiftool, `@pocket-dimension/utils`.

## Architecture Pattern

`POST /api/convert` writes a temp file, runs `python/convert.py`, deletes the temp dir, returns markdown.

## API Design

See [api-contracts-markitdown.md](./api-contracts-markitdown.md).

## Component Overview

Single page UI (drag-drop, preview, copy, download). Vendor button only.

## Deployment

Railpack only (no Dockerfile). Apt: ffmpeg, libimage-exiftool-perl. `BODY_SIZE_LIMIT=52428800`.

## Testing

None.
