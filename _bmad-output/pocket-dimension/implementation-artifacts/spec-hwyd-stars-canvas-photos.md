---
title: 'HWYD Your Stars — canvas size, hide people, photos, layering'
type: 'feature'
created: '2026-09-28'
status: 'done'
baseline_commit: '4de2c7fb07827bc3c644ac3314670fb2879c6eb6'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Your Stars (PeopleWall) only has card-density control; users cannot resize the board, hide people for a session, attach photos to polaroids, or keep names readable when cards overlap. Downloads also omit any client photos.

**Approach:** Extend the client-only PeopleWall UX: wall width/height controls, session-scoped hide list with rearrange, click-to-upload + crop/pan photos (OSS cropper), PNG download that includes those photos, and z-index layering so overlapping cards do not cover name strips.

## Boundaries & Constraints

**Always:**
- All of this state is client-only for the current browser session (no backend persistence for hide list or photos).
- Hidden people are removed from the wall; remaining people re-run placement (same rearrange algorithm as density changes).
- Uploaded photos appear on the polaroid face and in the downloaded PNG.
- User can replace a photo later and crop/pan within the visible face area.
- Prefer an established open-source crop/pan library over custom image-edit code.
- Keep existing density (card size) control and download button; compose new controls into the same panel chrome.
- Preserve the paper/polaroid visual language of the current wall.

**Ask First:**
- Adding a new npm dependency outside a lightweight cropper (e.g. cropperjs / equivalent).
- Persisting hide/photos beyond the browser session (localStorage or server).

**Never:**
- Upload photos or hide state to the server / DB / object storage.
- Rewrite DrawingsCanvas or other recap sections.
- Remove the existing Size (density) control.
- Invent a bespoke crop UI when a maintained OSS library covers upload + crop/pan.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Resize wall | User changes width and/or height within min–max | Wall CSS size updates; cards reflow via placement using new rem→% mapping | Clamp to viable range |
| Hide person | Toggle hide on a listed person | Person leaves wall; remaining rearrange | Unhide restores them and rearranges |
| Upload photo | Click face/tile → pick image → crop/pan → confirm | Face shows cropped image for that person | Reject non-image; cancel leaves prior state |
| Replace photo | Open cropper again on a card that already has a photo | New crop replaces old object URL | Revoke old blob URL |
| Download w/ photos | Download with ≥1 uploaded photo | PNG includes photos (not just initials) | If image decode fails, fall back to initial |
| Name overlap | Card A overlaps name strip of card B | B gets higher z-index than A so name stays readable | Deterministic layering pass after place |

</frozen-after-approval>

## Code Map

- `apps/howwasyourday/src/lib/legacy-recap/PeopleWall.svelte` — wall UI, density, placement, canvas PNG download (primary change surface)
- `apps/howwasyourday/src/lib/legacy-recap/UserDashboard.svelte` — mounts `<PeopleWall items={people} …>` (likely unchanged)
- `apps/howwasyourday/package.json` — add cropper dependency if needed

## Tasks & Acceptance

**Execution:**
- [x] `PeopleWall.svelte` — add wall width/height controls (viable clamps); drive wall style and placement rem→% from those sizes -- user-requested canvas resize
- [x] `PeopleWall.svelte` — people list UI with hide/unhide; filter items before placement; keep hide set in sessionStorage keyed by exportName/slug -- session-only hide
- [x] `PeopleWall.svelte` (+ small helper/modal as needed) — click face → file pick → OSS cropper (crop/pan/replace); store per-label object URLs in component state -- client photos
- [x] `PeopleWall.svelte` `download()` — draw uploaded images into face rects (await decode) -- downloads include photos
- [x] `PeopleWall.svelte` placement — after positions chosen, assign z-index so a card whose name strip is overlapped by another sits above that overlapping card -- names stay readable
- [x] `package.json` — add chosen OSS crop library -- no bespoke cropper

**Acceptance Criteria:**
- Given the stars panel, when width/height sliders change within range, then the wall resizes and cards rearrange without leaving the page.
- Given a people list, when the user hides someone, then that polaroid disappears and others rearrange; unhide brings them back; hide state persists for the browser tab session via sessionStorage (survives refresh, clears when the tab/session ends).
- Given a polaroid, when the user uploads and crops a photo, then the face shows it; replace works; download PNG contains the photo.
- Given two overlapping polaroids where one covers the other's name area, when the wall renders, then the named card is layered above so its name remains visible.

## Spec Change Log

- 2026-09-28 acceptance-auditor: AC hide wording said “refresh clears” which contradicts Design Notes (`sessionStorage`). Amended AC to match sessionStorage lifetime. Avoids known-bad: agents flipping hide to ephemeral `$state` only. KEEP: sessionStorage key `hwyd-stars-hidden:{exportName}`.

## Design Notes

**Wall size:** Today height is `clamp(24rem, 42vw, 36rem)` and placement assumes ~48×28 rem for rem→%. Expose Width/Height controls (e.g. rem or % of default) with clamps such as width ~70–100% of container and height ~20–42 rem; recompute `REM_X`/`REM_Y` from the active wall rem size whenever size or density changes.

**Hide storage:** `sessionStorage` key like `hwyd-stars-hidden:{exportName}` holding string[] labels. In-memory `$state` mirrors it for reactivity.

**Photos:** Map `label → { url, crop? }` in `$state` only (not sessionStorage — blob URLs die on refresh anyway). On replace/destroy, `URL.revokeObjectURL`.

**Layering:** Treat the bottom ~22% of each card as the name strip. If card A's box intersects B's name strip, set `zIndex(B) > zIndex(A)`. Resolve cycles with a stable sort (e.g. by index then label).

**Cropper:** Prefer `cropperjs` (or a thin Svelte wrapper around it) with aspect matching the face rectangle; confirm applies `getCroppedCanvas()` → object URL.

## Verification

**Commands:**
- `cd apps/howwasyourday && bun run check` -- expected: no new type/svelte errors in PeopleWall / crop helper

**Manual checks:**
- On `/recap/2025/[slug]` with people data: resize wall, hide/unhide, upload+crop+replace, download PNG shows photos, overlapping names remain readable via z-index

## Suggested Review Order

**Wall size + placement**

- Measured rem width drives rem→% so resize keeps collision math honest
  [`PeopleWall.svelte:69`](../../../apps/howwasyourday/src/lib/legacy-recap/PeopleWall.svelte#L69)

- Width/height clamps wired into wall `style`
  [`PeopleWall.svelte:656`](../../../apps/howwasyourday/src/lib/legacy-recap/PeopleWall.svelte#L656)

**Session hide list**

- Persist hide set in sessionStorage; placement uses filtered visible items
  [`PeopleWall.svelte:97`](../../../apps/howwasyourday/src/lib/legacy-recap/PeopleWall.svelte#L97)

**Photos + cropper**

- Face click → file pick → cropperjs modal with face aspect
  [`PeopleWall.svelte:329`](../../../apps/howwasyourday/src/lib/legacy-recap/PeopleWall.svelte#L329)

- OSS cropper confirm → object URL
  [`PhotoCropModal.svelte:3`](../../../apps/howwasyourday/src/lib/legacy-recap/PhotoCropModal.svelte#L3)

**Download + layering**

- PNG download draws uploaded photos cover-fit into face rects
  [`PeopleWall.svelte:391`](../../../apps/howwasyourday/src/lib/legacy-recap/PeopleWall.svelte#L391)

- Name-strip overlap → higher z; cycles broken via stable sort
  [`PeopleWall.svelte:207`](../../../apps/howwasyourday/src/lib/legacy-recap/PeopleWall.svelte#L207)

**Deps**

- cropperjs 1.6.2 (+ types)
  [`package.json:50`](../../../apps/howwasyourday/package.json#L50)
