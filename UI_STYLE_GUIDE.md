# Manager UI — Style Guide

Original retro-modern football manager UI. No FIFA / EA / SI / FM logos, fonts, layouts, sounds, or copyrighted art. Inspired by the category, not the specific products.

## Design tokens

All tokens live in `src/styles/tokens.css` under `:root`. Use `var(--token)`; never hard-code hex.

### Color
- Backgrounds: `--bg-0` (deep), `--bg-1`, `--bg-2`
- Surfaces (glass): `--surface`, `--surface-hi`, `--surface-low`
- Accent: `--accent` (#2d7dff deep blue), `--accent-hi`, `--accent-2` (#e63950 red trim)
- Status: `--success` (#3fdc7c), `--warn` (#f0bf3a), `--danger` (#e6573b), `--info`
- Bar tones: `--bar-low`, `--bar-mid`, `--bar-high` (consumed by `ratingBarClass`)
- Text: `--text`, `--text-dim`, `--text-muted`, `--text-on-accent`
- Borders: `--border`, `--border-hi`

### Spacing
`--sp-1` 4 / `--sp-2` 8 / `--sp-3` 12 / `--sp-4` 16 / `--sp-5` 24 / `--sp-6` 32 / `--sp-7` 48.

### Radius / Elevation
`--r-sm` 6 / `--r-md` 10 / `--r-lg` 16 / `--r-pill` 999. Elevations `--elev-1/2/3`.

### Typography
System sans stack (`--ff-sans`). Sizes `--fs-xs..hero`. Mono `--ff-mono`.

### Motion
`--dur-fast` 120ms / `--dur-med` 220ms / `--ease` cubic-bezier.

## Primitives

Located in `src/components/`. All return HTML strings to fit the existing `innerHTML` rendering pattern.

| Primitive | Signature | Use |
|---|---|---|
| `button({label, variant?, size?, dataAction?, dataAttrs?, block?, disabled?})` | string | Single button |
| `card({title?, body, footer?, accent?})` | string | Glass panel |
| `bar({value, max?, label?, showValue?, colorClass?})` / `comparisonBar(a, b, label)` | string | Progress + comparison |
| `pill({label, tone?})` / `formPill('W'|'D'|'L')` | string | Badge |
| `tabs({items, activeId, dataAction})` | string | Tab strip |
| `table({columns, rows, emptyLabel?})` | string | Sortable table |
| `modal({title, body, actions, dismissible?})` / `mountModal(props, onAction)` | string / fn | Modal dialog |
| `pitch({dots, opponentDots?, dataAction?})` | string | SVG top-down pitch |
| `flag(team, size?)` | string | Inline SVG flag (from team data) |
| `topBar({eyebrow, title, subtitle?, actions?, backDataAction?})` | string | Screen header |
| `nextMatchCard({snapshot, detailed?, showActions?})` | string | Reusable next-match card |

Always escape user-derived text with `escapeHtml()` (from `components/colors`).

## Layout patterns

- Root wrapper: `<div class="mgr-screen"><div class="mgr-container">…</div></div>`
- Section: `<section class="mgr-card">…</section>`
- Grid: `<div class="mgr-grid">…</div>` (auto-fit, 220px min)
- Stack: `mgr-col`; row: `mgr-row`
- Spacer: `<span class="mgr-spacer"></span>`

## Match overlay layout

The in-match HUD uses `.mgr-match-overlay` (grid: scoreboard top, pitch+stats middle, commentary+controls bottom). Collapses to single column at ≤720px (mobile-first). The in-match panel slides in from the right on desktop, from the bottom on mobile.

## Do / Don't

✅ Do
- Use tokens for every color / spacing.
- Reuse primitives instead of inline HTML.
- Cap button height at 44px+ for touch.
- Add `data-action` attributes for event delegation.

❌ Don't
- Don't import third-party fonts or logos.
- Don't copy FIFA / EA / SI / FM visual language directly.
- Don't reach into other screens — share through `ScreenRouter.show(screen, props)` and TournamentState helpers.
