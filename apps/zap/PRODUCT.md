# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Friends and digital hangouts, plus personal listening across multiple devices. Primary job: find music in a shared catalogue, tag/organize it, and play into a personal or shared session queue.

## Product Purpose

Zap is catalogue-in, sessions-out: browse and tag a shared music catalogue, build playlists, start or join listening sessions (including optional Discord voice), and control playback across devices. Success means people can find tracks fast, enqueue them without friction, and keep the hangout or personal queue flowing.

## Positioning

Shared catalogue + personal/session queue with multi-device join and optional Discord sink — not a general music streaming service or a Discord-only bot.

## Operating Context

Authenticated web app (SvelteKit). Core loops: Catalogue (search, filter, tag, play/enqueue), Playlists, Sessions (start/resume/join), History, floating personal queue dock. Admin tools for tags/users/songs. Auth via shared Pocket Dimension auth-service.

## Capabilities and Constraints

- Features and APIs must not break; UI, UX, and layout may change freely.
- Preserve: catalogue browse/filter/tag, play & enqueue into personal queue, playlists, sessions, join flows, Discord sink, auth, queue dock behavior, existing routes and server contracts.
- Atmosphere theme options (aurora, prism, thermal, ion, moonlit) remain available during redesign sampling.
- Redesign sample surface: Catalogue page (and its surrounding shell).

## Brand Commitments

- Product name: **Zap**
- Binding visual brief from redesign request: dark theme; minimalist / vibrant; prioritize visibility and a feel that makes people want to use the app; layout may change.
- Accessibility: no elevated product requirement beyond reasonable defaults — prioritize expressive, high-impact design ("full power").

## Evidence on Hand

- Live app routes under `apps/zap/src/routes`
- Incumbent UI: glassmorphic dark shell, Space Grotesk + JetBrains Mono, cyan signal tokens (being replaced)
- Landing copy: "Catalogue in, sessions out — queue tracks, join devices, optional Discord voice."

## Product Principles

1. Catalogue findability and enqueue speed beat decorative chrome.
2. Multi-device / hangout continuity is core — queue and session state stay obvious.
3. APIs and feature contracts stay stable while the visual world can be replaced.
4. Dark, high-contrast, vibrant signal — the UI should feel electric and usable, not timid.
