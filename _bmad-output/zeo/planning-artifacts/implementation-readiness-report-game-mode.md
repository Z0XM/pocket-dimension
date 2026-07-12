# zeo Game Mode — Implementation Readiness Report

**Date:** 2026-07-12  
**Status:** PASS WITH MINOR FIXES (Phase 4)  
**Reviewer:** BMad implementation readiness workflow  
**Scope:** Game Mode + Charades MVP + guest removal (Epics 9–15)

---

## 1. Documents reviewed

| Artifact | Path | Status |
|----------|------|--------|
| Game Mode PRD | `prds/prd-zeo-game-mode-2026-07-12/prd.md` | Final |
| PRD Addendum | `prds/prd-zeo-game-mode-2026-07-12/addendum.md` | Complete |
| PRD Decision Log | `prds/prd-zeo-game-mode-2026-07-12/.decision-log.md` | Complete |
| UX Design | `ux-designs/ux-zeo-game-mode-2026-07-12/DESIGN.md` | Final |
| UX Experience | `ux-designs/ux-zeo-game-mode-2026-07-12/EXPERIENCE.md` | Final |
| Architecture | `architecture-game-mode.md` | Final |
| Epics & Stories | `epics-game-mode.md` | Complete |
| Planning decisions | `game-mode-charades-decisions.md` | Complete |
| Base (brownfield) | `architecture.md`, `epics.md`, shipped `apps/zeo` | Reference |

---

## 2. Alignment summary

### PRD ↔ Architecture

| Area | Aligned? | Notes |
|------|----------|-------|
| SSE + HTTP POST sync | Yes | FR-GM-9, NFR-GM-1 |
| PostgreSQL game schema | Yes | All core tables defined |
| Accept/Reject concurrency | Yes | `FOR UPDATE` pattern documented |
| Guest removal | Yes | Touchpoints enumerated |
| In-memory SSE bus | Yes | Single VPS assumption stated |
| Charades phase machine | **Minor gap** | See §3.1 — `act` vs `verdict` |
| Shuffle timing | **Minor gap** | See §3.2 — lobby vs `ready_check` |
| Mime rotation in config | Yes | `game_sessions.config` |
| Room scores persistence | Yes | `room_scores` table |

### PRD ↔ UX

| Area | Aligned? | Notes |
|------|----------|-------|
| Game panel bottom-left | Yes | Matches grid settings pattern |
| Game view team layouts | Yes | 2/3/4 team rules consistent |
| Floating suggestion tile | Yes | Client-side visibility |
| Mime word on own tile | Yes | `MimeWordOverlay` |
| Host confirm modals | Yes | Force/restart/end |
| Auth gate (no guest) | Yes | UJ-GM-3 |
| Accept/Reject during act | Yes | UX shows buttons in `act` phase |
| Mobile game button promote | Yes | NFR-GM-6 |
| Scoreboard tab | Yes | Not persistent overlay |

### PRD ↔ Epics

| FR group | Stories | Coverage |
|----------|---------|----------|
| FR-G0-1 … FR-G0-4 | 9.1–9.4 | Full |
| FR-GM-1 … FR-GM-7 | 10.6–10.7, 11.4 | Full |
| FR-GM-8 (optional game tile) | — | **Deferred** (platform hook; Charades N/A) |
| FR-GM-9 | 10.3, 10.5 | Full |
| FR-GM-10 … FR-GM-17 | 11.1–11.5 | Full |
| FR-GM-18 … FR-GM-22 | 12.1–12.3, 15.1–15.2 | Full |
| FR-GM-23 … FR-GM-25 | — | **Explicitly out of scope** (Charades) |
| FR-GM-26 … FR-GM-27 | 13.1 | Partial — docked tiles deferred |
| FR-CH-1 … FR-CH-20 | 14.x, 11.1, 9.x | Full |
| NFR-GM-1 … NFR-GM-8 | Cross-cutting in stories | See §3.4 |

**Coverage:** 47 of 50 Phase 4 FRs mapped to stories or explicit deferral. 3 items need clarification (§3).

### Architecture ↔ Epics

| Area | Aligned? | Notes |
|------|----------|-------|
| Module layout `lib/server/game/` | Yes | Stories reference same paths |
| API route tree | Yes | All endpoints have owning stories |
| Client `game-state.ts`, `game-layout.ts` | Yes | Stories 10.5, 11.4 |
| Build order G0→G1→G2→… | Yes | Sprint order matches architecture §15 |
| Integration tests (verdict race) | Yes | Story 14.6 AC |

### UX ↔ Epics

| Area | Aligned? | Notes |
|------|----------|-------|
| Component list | Yes | All UX surfaces have stories |
| Phase banner copy | Yes | Story 11.5 |
| 409 toast copy | Yes | Story 14.7 |
| Floating tile mobile sheet | Yes | Story 13.2 |
| IA closure checklist | Yes | EXPERIENCE.md § end — all surfaces covered |

---

## 3. Gaps and recommendations

### 3.1 Medium — `act` vs `verdict` phase (resolve in Story 14.6)

| Source | Says |
|--------|------|
| PRD FR-CH-12 | Accept/Reject **during act phase** |
| UX EXPERIENCE | Buttons visible during `act` |
| Architecture / addendum | Separate `verdict` phase; POST requires `phase = 'verdict'` |
| Story 14.6 | Ambiguous bracketed note |

**Recommendation (pick one before Epic 14):**

- **Option A (preferred):** Allow `POST /verdict` when `phase IN ('act', 'verdict')`; on first accept from `act`, transition to `ready_check` directly (collapse `verdict` as optional UI-only label).
- **Option B:** Auto-transition `act → verdict` immediately on `start-act`; banner switches to "was the guess right?"

Update `architecture-game-mode.md` §6.2 and Story 14.6 AC to match. **Does not block Epic 9–13.**

### 3.2 Medium — Shuffle in game lobby vs `ready_check` only

| Source | Says |
|--------|------|
| PRD FR-GM-11 | Shuffle in **lobby** and between rounds |
| UX + Story 11.2 | Shuffle in **`ready_check` only** |
| Decision log D-GM-17 | Lobby + between rounds |

**Recommendation:**

- Add AC to **Story 10.4** or **11.2**: shuffle allowed when `session` has no active round OR `phase === ready_check` (covers pre-round-1 and between rounds).
- Rename UI phase internally: "game lobby" = after `POST /game`, before round 1 starts (optional brief `setup` sub-state or first `ready_check`).

**Does not block Epic 9.**

### 3.3 Low — Story 11.2 FR reference typo

Story 11.2 AC cites **FR-GM-8** (optional game tile); should cite **FR-GM-11** (shuffle). Fix in `epics-game-mode.md` when convenient.

### 3.4 Low — NFR spot coverage

| NFR | Story coverage | Gap |
|-----|----------------|-----|
| NFR-GM-1 latency ≤500ms | 10.3 SSE | No perf test story — add manual checklist to Story 14.6 DoD |
| NFR-GM-3 reconnect | 10.5 backoff | OK |
| NFR-GM-4 chat ephemerality | Deferred | OK — no `game_chat_messages` in MVP |
| NFR-GM-5 a11y | Spread across UI stories | OK |

### 3.5 Low — Screen share during game mode

Not specified in PRD/UX/Architecture.

**Recommendation:** Disable screen share button while `game_active` (tooltip: "End game to share screen"). Add one AC to Story 10.7. Prevents layout conflict with game view.

### 3.6 Low — Centered game tile platform hook (FR-GM-8)

No story implements optional centered tile. Acceptable for Charades MVP; add stub comment in `VideoGrid.svelte` during Story 10.7 or defer to second game.

### 3.7 Low — Docked tiles (FR-GM-27)

Floating tiles only in Epic 13. Docked tiles deferred — documented in epics out-of-scope.

### 3.8 Low — AGENTS.md / README guest references

Covered by Story 9.4. Original `prd-zeo-2026-06-27` still says guest join — supersession table in Game Mode PRD is sufficient; optional README note.

### 3.9 Deferred (Phase 4.1 — not blocking)

| Item | PRD/Arch ref |
|------|--------------|
| Host disconnect mid-game | OQ-1, OT-1 |
| Late joiner overlay | OQ-2 |
| Phase timers | Out of scope |
| `game_chat_messages` | OT-3 |
| Server-filtered suggestion payloads | Out of scope |

---

## 4. Risk register (Phase 4)

| Risk | Likelihood | Impact | Mitigation in plan |
|------|------------|--------|-------------------|
| SSE proxy buffering (Caddy) | Medium | High | Disable buffering for `/game/events`; document in deploy runbook |
| SvelteKit adapter streaming | Low | High | Confirm Node/Bun adapter supports `ReadableStream` SSE |
| Concurrent verdict double-score | Low | Critical | Story 14.6 integration test |
| Client-side suggestion leak | Low | Low | Accepted per PRD; stream watchers could cheat |
| Guest removal breaks waiting room flows | Medium | Medium | Story 9.3 + manual QA authenticated waiting room |
| 6-tile game layout CPU | Medium | Medium | 200ms transition only; no extra animations (UX) |
| Screen share + game view conflict | Medium | Medium | Recommend disable (§3.5) |

---

## 5. Traceability matrix (FR → Epic)

| FR | Epic.Story |
|----|------------|
| FR-G0-* | 9.1–9.4 |
| FR-GM-1,2 | 10.6 |
| FR-GM-3,4 | 15.4 |
| FR-GM-5,6 | 10.4, 15.3 |
| FR-GM-7,9 | 10.7, 10.3–10.5 |
| FR-GM-8 | Deferred |
| FR-GM-10–17 | 11.1–11.5 |
| FR-GM-18–22 | 12.1–12.3, 15.1–15.2 |
| FR-GM-23–25 | Out of scope |
| FR-GM-26 | 13.1 |
| FR-GM-27 | Deferred |
| FR-CH-* | 14.1–14.8, 11.1, 15.x |

---

## 6. Readiness verdict

| Gate | Result |
|------|--------|
| PRD complete for Phase 4 MVP | **Pass** |
| UX sufficient for Epics 10–15 | **Pass** |
| Architecture decisions documented | **Pass** |
| Epics trace to FRs (with documented deferrals) | **Pass** |
| Cross-artifact conflicts | **2 minor** (§3.1, §3.2) — resolve before Epic 14 |
| Brownfield base (video calling) shipped | **Pass** |
| Guest removal plan clear | **Pass** |
| Test strategy for critical paths | **Pass** (verdict race) |
| **Overall Phase 4 readiness** | **PASS WITH MINOR FIXES** |

### Blocking vs non-blocking

| Severity | Count | Blocks sprint start? |
|----------|-------|----------------------|
| Critical | 0 | — |
| Medium | 2 | No — fix before Epic 14 |
| Low | 6 | No |

**Epic 9 (guest removal) may start immediately.**

---

## 7. Pre-implementation checklist

Resolve before **Epic 14** (not before Epic 9):

- [ ] Decide `act`/`verdict` phase model (§3.1 Option A or B); update architecture + Story 14.6
- [ ] Extend shuffle guard to pre-round-1 lobby (§3.2)
- [ ] Fix Story 11.2 FR-GM-8 → FR-GM-11 typo
- [ ] Add screen-share-disabled-during-game AC to Story 10.7 (§3.5)

Optional before deploy:

- [ ] Caddy SSE buffering config for `/api/rooms/*/game/events`
- [ ] Manual 4-client Charades test script in Epic 15 DoD
- [ ] Update root README guest join wording

---

## 8. Recommended next BMad steps

1. **`bmad-sprint-planning`** — Generate sprint status from Epics 9–15 (34 stories).
2. **`bmad-create-story`** — Prepare **Story 9.1** (auth-only token mint).
3. **`bmad-dev-story`** — Implement Epic 9.

Suggested first sprint scope: **Epic 9 complete** + **Epic 10.1–10.5** (schema + SSE backbone).

---

## 9. Phase 4 definition of done (release)

- [ ] Guest cannot join zeo without login
- [ ] Host can start Charades with 4–6 authenticated players
- [ ] Full round loop: suggest → vote → pass on → act → accept/reject → ready → swap
- [ ] Team columns layout; floating suggestion tile (proposing team only)
- [ ] Room scoreboard persists across games in same room
- [ ] Host force-next / restart / end game work per scoring rules
- [ ] Concurrent accept produces single score (automated test)
- [ ] SSE reconnect restores game state within 2s
- [ ] Mobile game panel and promoted Game Mode button work

---

## 10. Summary

Planning artifacts for zeo Game Mode are **aligned and implementation-ready** with two medium clarifications to lock before Charades gameplay stories (Epic 14). No critical gaps block starting **Epic 9 — guest removal** or **Epic 10 — game shell infrastructure**.

The planning package (PRD + UX + Architecture + 34 stories) is sufficient for autonomous story-by-story delivery through BMad dev workflow.
