---
title: zeo UX Experience
status: final
created: 2026-06-27
updated: 2026-06-27
sources:
  - /workspace/_bmad-output/zeo/planning-artifacts/prds/prd-zeo-2026-06-27/prd.md
  - /workspace/_bmad-output/zeo/planning-artifacts/ux-designs/ux-zeo-2026-06-27/DESIGN.md
---

# Foundation

- **Product focus:** small-group self-hosted video calls with screen sharing
- **Form factor:** web first (desktop primary); responsive tablet; mobile browser best-effort
- **Visual identity:** `DESIGN.md`
- **Core surfaces:** home, pre-call lobby, active call, error/capacity, auth (shared routes)

# Information Architecture

## Public / unauthenticated
- `/login`, `/sign-up`, `/forgot-password`, `/verify-email`, `/check-email` (optional for guests)
- `/health`
- `/room/[slug]` — join flow for guests (display name) or redirect to lobby if authenticated

## Authenticated
- `/` — Home: create room (contributor/admin only), join by link, recent rooms
- `/room/[slug]` — Pre-call lobby → active call (same route, state-driven)
- `/room/[slug]/ended` — Post-call summary (optional MVP: redirect home with toast)

## Phase 2 additions
- `/admin` — Operator dashboard

# Voice and Tone

- Direct and reassuring: "Camera is off", not "Video track unpublished".
- Errors explain what to do: "All rooms are in use. Try again in a few minutes."
- Avoid jargon: say "Share screen", not "Publish display track".
- Confirm destructive actions: "End room for everyone?"

# Component Patterns

## Home — create or join
- **Contributor/admin:** Primary CTA **New room** + join link field
- **User role:** Join link field only; no create CTA (or disabled with tooltip: "Only contributors can create rooms")
- **Unauthenticated visitor on home:** Prompt to join via link or sign in
- Show capacity indicator: "1 of 2 rooms in use" (when API exposes count)

## Pre-call lobby
- **Guest path:** Display name field (required) before device preview
- **Authenticated path:** Name from profile; optional edit display name for this call
- Live preview of camera (or placeholder if off).
- Mic/camera toggle before join.
- Room title and host name when joining existing room.
- Participant count: "3 of 6 joined".
- **Join call** disabled until user acknowledges permission state (either granted or explicitly joining without device).

## Active call — grid
- Layout rules:
  - 1 participant: centered large tile
  - 2: side by side
  - 3–4: 2×2 with empty cell or balanced split
  - 5–6: 2×3 or 3×2
- Dominant speaker ring per `DESIGN.md` active speaker rule.

## Active call — screen share
- Shared screen fills main stage.
- Sharer's camera moves to filmstrip unless hidden.
- Banner: "{Name} is sharing their screen".

## Control bar
| Control | Behavior |
|---------|----------|
| Mic | Toggle mute; icon reflects state; keyboard shortcut `M` |
| Camera | Toggle video; keyboard `V` |
| Share | Start/stop screen share; disabled if another sharer unless takeover flow |
| People | Slide-over list: name, mute/video icons, host remove action |
| Leave | Disconnect self only |
| End room (host) | Confirm modal → disconnect all |

## Participants panel (host)
- List with remove action per row (confirm for remove).

# State Patterns

## Room states (UI mapping)
| State | UI |
|-------|-----|
| waiting | Lobby only; host sees "Waiting for others" |
| active | Full call UI |
| ended | Redirect + "This room has ended" |

## Connection states (client)
- `idle` → `connecting` → `connected` → `reconnecting` → `disconnected`
- Show non-blocking banner on `reconnecting`.
- Full-screen error on unrecoverable disconnect with **Rejoin** if room still active.

## Media states
- mic: on / muted / permission denied
- camera: on / off / permission denied
- screen: none / sharing self / viewing other

# Interaction Primitives

- **Keyboard:** `M` mute, `V` video, `Space` push-to-talk optional Phase 2, `Esc` close panels.
- **Focus trap** in confirm modals only.
- **Copy link** button in lobby and in-call people panel.

# Accessibility Floor

- All control bar buttons have `aria-label` and `aria-pressed` where toggle.
- Participant tiles expose name as accessible label.
- Color is not sole indicator for mute (icon required).
- Focus visible rings on interactive elements (`{colors.primary}` outline).
- Live region announces "You are muted" / "Screen sharing started".

# Key Flows

## Flow 1 — Priya creates and hosts (climax: first teammate appears)
1. Priya lands on home authenticated.
2. Taps **New room**, names it "Design sync".
3. Enters lobby; allows camera/mic; copies link.
4. Taps **Join call** — grid shows her tile alone.
5. **Climax:** Marco's tile animates in; active speaker ring follows Marco when he speaks.
6. Priya shares screen; layout switches to dominant share.
7. Priya **End room for all** → confirm → everyone to home.

## Flow 2 — Marco joins as a guest (climax: admitted as 6th)
1. Marco opens Priya's link without logging in.
2. Enters display name "Marco".
3. Lobby shows "5 of 6 joined".
4. Joins successfully as sixth participant with Guest badge.
5. **Climax:** grid shows six tiles including Marco as guest.

## Flow 3 — Permission denied recovery
1. User denies camera in browser.
2. Lobby shows inline help with browser-specific hint.
3. User can join audio-only; tile shows initials avatar.

# Responsive & Platform

- **Desktop (≥1024px):** full grid + side people panel optional.
- **Tablet (768–1023px):** grid + bottom control bar; people panel as sheet.
- **Mobile (<768px):** single dominant speaker swipe or 2×2 max; screen share full bleed; control bar compact icons.

# Inspiration & Anti-patterns

**Inspire:** Linear clarity, Around.co minimal dark calls, FaceTime simplicity for pre-call.

**Avoid:** Zoom's cluttered toolbars, mandatory account walls before showing room name, auto-join without preview, infinite gallery scroll for 6 people.
