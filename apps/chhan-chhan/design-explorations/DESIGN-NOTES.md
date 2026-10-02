# Chhan Chhan · design notes

## Locked direction
**Marker paper** (`sketch-paper-variations.html`) is the chosen look & feel for the app redesign.

Includes:
- Rough rectangular highlighter strips on balance (+ in/out amounts)
- Compact `in → this month → out = net` hand-drawn boxes with arrows
- Category pills with small line icons
- Taped sticky notes (paper + tape + dog-ear)
- Math-notebook charts (pencil axes, plotted marks)
- Paper white `#fffefd`, hand + UI type, dry-erase pastels · no card chrome

## Conversion status
**Converted in-app (this pass):** paper tokens, forge chrome remap, Virgil + Google hand fonts, `data-fonts` / `data-paper` / `data-theme` via localStorage (`chhan-appearance`), Control **Customise** panel (fonts, paper, light/dark/system theme), dashboards (balance highlighter, flow boxes, pills, taped stickies, notebook charts), transactions / control / auth / shared chrome restyle. Preferences are browser-local only (no DB).

**Defaults:** Gaegu + dots · blue · theme light.

## User customisation (Control Center)
**Customise** under `/app/control` lets users pick:

### Fonts (keep all)
Hand options:
- Virgil
- Architects Daughter
- Gaegu
- Indie Flower
- Kalam

Mixes:
- Virgil + Kalam
- Architects + Gaegu
- Indie Flower + Kalam

### Paper texture (keep all)
- plain
- rough (soft tooth)
- lines · blue / lines · gray
- grid · blue / grid · gray
- dots · blue / dots · gray

Preferences persist per browser (`localStorage`) until auth-backed prefs exist.

## Parked for elsewhere
- **Sketch icon bubbles** (rough ink circle frames around doodles): empty states, category pickers, studio labels, or transaction accents — not the dashboard summary row.
- **Thought-chain / colored-dot timeline**: for **transactions** (green = in, red = out).
