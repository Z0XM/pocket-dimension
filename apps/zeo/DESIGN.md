---
name: zeo
description: Self-hosted group video calls for Pocket Dimension. shadcn-svelte on SvelteKit + Tailwind; this DESIGN.md specifies the brand-layer delta only.
colors:
  background: '#0a0a0c'
  foreground: '#f5f5f0'
  card: '#141418'
  card-foreground: '#f5f5f0'
  primary: '#f5f5f0'
  primary-foreground: '#0a0a0c'
  secondary: '#1c1c22'
  secondary-foreground: '#f5f5f0'
  muted: '#1c1c22'
  muted-foreground: '#a1a1aa'
  accent: '#8b5cf6'
  accent-foreground: '#f5f5f0'
  destructive: '#ef4444'
  border: '#2e2e36'
  input: '#141418'
  ring: '#f5f5f0'
typography:
  sans:
    fontFamily: 'Inter Variable'
  mono:
    fontFamily: 'Fira Mono'
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  xl: 18px
spacing:
  page: 24px
  card: 24px
components:
  card:
    background: '{colors.card}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
  room-code:
    fontFamily: '{typography.mono.fontFamily}'
status: final
updated: 2026-06-28
---

## Brand & Style

zeo is a focused video-call surface inside Pocket Dimension. The visual language is dark, calm, and utilitarian: high-contrast monochrome chrome with a single violet accent for links and live states. The product should feel like a reliable studio tool, not a social feed.

zeo inherits shadcn-svelte defaults for component structure and interaction patterns. This document specifies only the brand-layer deltas — dark palette, typography, card treatment, and room-code presentation.

## Colors

- **Background (`#0a0a0c`)** — primary app canvas.
- **Foreground (`#f5f5f0`)** — primary text and primary button fill.
- **Accent Violet (`#8b5cf6`)** — links, active room emphasis, and focus highlights.
- **Destructive Red (`#ef4444`)** — errors, full-room states, and destructive actions.
- **Card / Secondary surfaces** — slightly lifted panels on the dark canvas for forms, lobby preview, and admin settings.

Avoid bright gradients, decorative color blocks, and per-screen palette drift. Use shadcn semantic tokens (`background`, `foreground`, `card`, `muted`, `border`, `primary`, `accent`, `destructive`) everywhere.

## Typography

- **Sans:** Inter Variable for all UI copy, headings, and buttons.
- **Mono:** Fira Mono for product label (`Pocket Dimension`), room codes, and technical metadata.

Headings use semibold weight with tight tracking. Body copy stays at `text-sm`/`text-base`. Room codes are always monospace and visually grouped in a bordered panel.

## Layout & Spacing

- Page max width: `max-w-5xl`.
- Standard page padding: `px-4 py-10 sm:px-6 lg:px-8`.
- Cards use `rounded-xl`, `border-border`, and `bg-card/60`.
- Vertical rhythm between sections: `space-y-6`.

Single-column layouts for auth, home, lobby, and admin. In-call UI uses full viewport height with overlay banners only when connection state requires it.

## Elevation & Depth

Use subtle borders and low-opacity fills instead of heavy shadows. Cards may use `shadow-sm` at most. In-call video tiles rely on participant color accents, not box shadows.

## Shapes

- Inputs and buttons: `rounded-md`.
- Cards and panels: `rounded-xl`.
- Badges: `rounded-full`.
- Preview video: `rounded-lg`.

## Components

Use shadcn-svelte components consistently:

- **Button** — primary actions (`Create room`, `Join call`), secondary actions (`Go to room`), outline/ghost for navigation (`Back`) and device toggles.
- **Card** — all home, lobby, and admin form sections.
- **Checkbox** — room options (waiting room, public room, schedule).
- **Badge** — room visibility (`Public` / `Private`) and live status (`Live` / `Open`).
- **Input / Label** — all form fields.
- **Separator** — divide major home-page sections.

Custom call components (`PreCallLobby`, `ControlBar`, `VideoGrid`) should reuse the same tokens and button variants rather than bespoke styles.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use shadcn Card/Button/Checkbox/Badge across pages | Mix raw HTML buttons with one-off Tailwind styles |
| Show room codes in monospace panels | Hide codes behind random opaque strings |
| Keep lobby preview inside a bordered card | Use floating unlabeled preview boxes |
| Provide explicit Back navigation before joining | Force browser back for lobby exit |
| Mark public rooms clearly on home and in lobby | Make visibility implicit |
