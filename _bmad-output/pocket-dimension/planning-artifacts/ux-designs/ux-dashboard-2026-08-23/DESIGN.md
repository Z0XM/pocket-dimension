---
name: dashboard
description: Read-only BMAD Showcase — dark, minimal, typographic. shadcn brand-layer only.
status: final
created: 2026-08-23
updated: 2026-08-23
sources:
  - ../../prds/prd-dashboard-2026-08-23/prd.md
  - ../../prds/prd-dashboard-2026-08-23/addendum.md
colors:
  background: "#0A0A0A"
  surface: "#111111"
  foreground: "#F5F5F5"
  muted: "#A3A3A3"
  border: "#262626"
  accent: "#8B5CF6"
  accent-foreground: "#FAFAFA"
  destructive: "#F87171"
typography:
  body:
    fontFamily: "Fira Code"
    fontSize: 14px
    fontWeight: "400"
    lineHeight: "1.6"
  label:
    fontFamily: "Fira Code"
    fontSize: 12px
    fontWeight: "500"
    lineHeight: "1.4"
  display:
    fontFamily: "Fira Code"
    fontSize: 20px
    fontWeight: "500"
    lineHeight: "1.3"
rounded:
  sm: 4px
  md: 6px
  lg: 8px
spacing:
  gutter: 16px
  rail: 280px
  reader-max: 48rem
components:
  catalog-row-active:
    background: "{colors.surface}"
    border-left: "{colors.accent}"
  search-hit-active:
    background: "{colors.surface}"
    accent: "{colors.accent}"
  unresolved-link:
    color: "{colors.destructive}"
---

# DESIGN.md — dashboard

Hex values instantiate Ubuntu’s locked families (near-black page, violet accent). Nudge hex without changing the families.

## Brand & Style

**dashboard** is a quiet document room. The BMAD Artifact is the product. Chrome exists to get Ubuntu into a document and out of the way.

Inherits shadcn/ui defaults. This file specifies only the brand-layer delta: dark page, one violet accent, Fira Code everywhere, slightly tight corners. Do not invent a second component language.

## Colors

- **`{colors.background}`** — page. A shade of black, not a blue-black or purple wash.
- **`{colors.surface}`** — Catalog rail, Search panel, raised chrome. One step lighter than page.
- **`{colors.foreground}`** — Reader body and primary labels.
- **`{colors.muted}`** — paths, Artifact Kind labels, timestamps, secondary meta.
- **`{colors.border}`** — hairline separators only. No heavy frames.
- **`{colors.accent}`** — the only brand color. Active Catalog row, focus ring, Search caret, in-text match underline. Not fills on large surfaces. Not decorative bars.
- **`{colors.accent-foreground}`** — text on the rare accent fill (e.g. a compact badge).
- **`{colors.destructive}`** — unresolved links and parse errors only.

All unlisted shadcn tokens map onto this set (`primary` = `{colors.accent}`, `background` = `{colors.background}`).

Avoid: neon violet, gradients, colored backgrounds behind Reader content, more than one accent family.

## Typography

**Fira Code** for chrome and Reader. One family. Roles:

- `{typography.body}` — Reader markdown and Search snippets
- `{typography.label}` — Artifact Kind, tree name, status
- `{typography.display}` — Artifact title in the Reader header

No second display face. No serif “literary” moment (that belongs to rhymes, not this tool).

## Layout & Spacing

Desktop-first. Left rail is section nav + Tree switcher (~{spacing.rail}); main column is the active surface. On Docs, a secondary Artifact list may sit inside the main column or a slim inner rail.

- Page padding `{spacing.gutter}`.
- Reader (Docs / Epic / Story / Feature source) is the widest, brightest-contrast region.
- Search is a command overlay, same type ramp as lists — not a card grid.
- Do not copy SIS War Room grain, backdrop-blur chrome, or a second display face.

No dedicated mobile layout (PRD). Below ~1024px the rail may stack above the Reader; do not design a phone product.

## Elevation & Depth

Almost none. Separation is tonal (`{colors.background}` vs `{colors.surface}`) and a `{colors.border}` hairline. No glass, no drop shadows as hierarchy. shadcn popover/dialog shadow is acceptable for Search.

## Shapes

`{rounded.sm}` inputs and rows, `{rounded.md}` buttons and Search panel, `{rounded.lg}` dialogs. No pills except a tiny status chip if a Story has status.

## Components

Use shadcn as-is unless listed:

- **Catalog row (active)** — `{colors.surface}` fill, `{colors.accent}` left hairline. Not a filled violet block.
- **Search hit (active)** — same discipline as Catalog row. Snippet in `{typography.body}`; match span uses `{colors.accent}` underline or color, not a highlight wash across the row.
- **Reader markdown** — headings keep rank; tables and lists use `{colors.border}`; inline code stays in Fira Code (already the body face).
- **Unresolved link** — `{colors.destructive}`; still looks like a link.
- **Empty / error** — `{typography.display}` one short line + `{typography.body}` one short reason. No illustrations.

Button, Input, ScrollArea, Separator, Badge, Command/Dialog inherit shadcn structure with the color tokens above.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Keep chrome quieter than Reader text | Paint the Reader on a tinted or carded background |
| Use `{colors.accent}` for selection and focus only | Use accent as a page or sidebar fill |
| Set everything in Fira Code | Add a second font “for headings” |
| Inherit shadcn anatomy | Restyle every primitive into a custom kit |
| One-column Reader, max `{spacing.reader-max}` | Card grids of documents as the primary read |
