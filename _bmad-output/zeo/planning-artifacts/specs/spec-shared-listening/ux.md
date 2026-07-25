# UX — Games and Apps + Shared Listening

## Shell

- Control bar control: **Games and Apps** (replace Game mode copy/aria).
- Panel: bottom-left, existing mutual exclusion with chat / devices / grid settings.
- Tabs (segmented control or shared Tabs): **Apps** · **Games** · **Scoreboard**.
- Visible to all authenticated participants; host-only actions remain gated inside Games (and host force-end on Apps if shown).

## Apps tab

- Catalog list/cards. MVP single card: **Shared Listening**.
- States: `Connect YouTube` → `Start` → `Open` / `End` when active.
- Active session: expand or navigate in-panel to **Queue / Library / Search** (tile keeps transport chrome).

## Games tab

- Former Setup content: Charades start/config/in-round host controls.
- No behavioral redesign required beyond relocation.

## Scoreboard tab

- Existing room scores list; empty state unchanged.
- No listening rows.

## Listening tile

- Stage kind `listening`: artwork, title, channel/artist, scrubber, play/pause, prev/next (DJ only for transport).
- Listeners: local volume / listen-mute only.
- Error flash on fail-before-skip.
- Not a camera card; bot never shown as a face tile.

## Layout

- Listening does not switch to game layout.
- With screen share: share stays dominant; listening tile in rail/sidebar as with other secondary tiles.
- With game layout: listening tile still renderable (MVP allow both); avoid covering phase banner critically — prefer rail/compact.

## Copy

- Avoid “official YouTube” / “YouTube Music Premium Connect.”
- Prefer “Shared Listening” + “Connect YouTube account.”
