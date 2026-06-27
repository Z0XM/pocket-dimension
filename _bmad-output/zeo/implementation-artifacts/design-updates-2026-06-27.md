# Design updates (2026-06-27)

User-directed branding changes applied during Epic 2:

## Icon

- App icon: multi-tile video grid on black squircle (`static/icon.svg`, `src/lib/assets/icon.svg`)
- Matches attached reference: green, purple, yellow, red, blue, orange tiles with black gutters

## Theme

- **Dark-first** UI: background `#0a0a0c`, surfaces `#141418` / `#1c1c22`
- **Primary actions:** off-white `#f5f5f0` (buttons, focus rings, primary text on dark)
- **Participant tiles:** distinct colors per user via `src/lib/participant-colors.ts` — same six hues as the icon

## UX doc delta

Prior DESIGN.md used mint green (`#6ee7b7`) as primary. Implementation now uses off-white primary + multi-color participant palette. Update DESIGN.md when UX pass resumes.
