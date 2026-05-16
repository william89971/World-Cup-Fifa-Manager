# Manager Game — Pre-Overhaul Audit

Frozen snapshot of the repo state immediately before the manager-game overhaul began. This is a historical record so future readers can see what was inherited.

## Stack

- Vite 6.3.5 + TypeScript 5.8.3
- Three.js 0.184 (3D rendering) + Rapier 0.19 (WASM physics)
- vite-plugin-pwa 1.3.0 (auto-update SW, offline fallback, install manifest)
- localStorage persistence (`codex-futbol.world-5s-cup.save`, `.settings`)
- Scripts: `dev`, `build` (`tsc && vite build`), `preview`, `validate:tournament`

## Top-level layout

```
src/
├── main.ts             # 38 LOC — bootstrap
├── styles.css          # 980 LOC — vanilla CSS, dark-navy + green palette
├── controls/           # WASD/touch input (dormant in manager mode)
├── dev/                # tournament validator helper
├── entities/           # Player (466), Team, Ball, Goal
├── game/               # Game.ts (831), GameState, constants, scene, etc.
├── physics/            # Rapier wrapper
├── systems/            # 18 ECS-style systems (TeamAISystem is 1468 LOC)
├── tournament/         # TournamentState (391), teams (738), bracket, simulation, storage
└── ui/                 # TournamentUi (833), Hud (111)
```

## Working systems (reused, not rebuilt)

- **Match engine** — `MatchSystem.ts` (296). Tick-based clock + goal/restart detection. Already AI-vs-AI capable.
- **AI brain** — `AIPlayerBrain.ts` (164). 14-state machine per player. 13 traits + 9 personality archetypes.
- **Team AI driver** — `TeamAISystem.ts` (1468). Trait-driven decisions. 6 team styles with deep AI influence.
- **Formation system** — 4-3-3 / 4-4-2 / 3-5-2 with lane + depth positioning.
- **Tournament** — 12 groups × 4 teams = 48; round-robin + best-third + Round of 32 / R16 / QF / SF / Final. xG-based seeded simulation with penalty fallback.
- **Validation** — `npm run validate:tournament` checks fixtures, standings, save invariants.
- **Save/load** — localStorage JSON with normalized settings; PWA configured (manifest, icons, offline.html).

## Manager-mode 11v11 build (commit b35d8ed) — what shipped

- Home screen with `New Tournament / Continue / Settings`
- Country selection (48 nations with inline SVG flags)
- Group stage with standings + best-third panel + fixture list
- Match preview (opponent profile + view squad + set tactics)
- Squad screen (player cards with 13 trait bars, no formation visual)
- Tactics screen (formation buttons + 6 styles + auto-picked text XI)
- Knockout bracket (round-by-round layout)
- Match complete + Champion screens
- Settings (match length, graphics, sound, camera, mobile opacity, reset)
- In-match HUD: scoreboard, clock, possession label, message ticker, F3 debug
- Manager-mode flags on `PlayerControlSystem` + `TeamAISystem` (default `true`) — WASD code dormant but still wired

## Missing for the overhaul (this work's target)

| Screen / system | Status |
|---|---|
| 4-button main menu (Tournament/Manager/Training/Settings) | Missing (currently 3 buttons) |
| Manager Hub dashboard | Missing |
| Inbox / News | Missing |
| Player Profile (deep dive) | Missing |
| Tactics sliders (8 dimensions) + 4-2-3-1 / 5-3-2 formations | Missing |
| Formation Pitch View (visual swap) | Missing |
| Lineup screen (XI + bench + captain) | Missing |
| Fixtures screen (separate, filterable) | Missing |
| Standings (enhanced highlights) | Partial |
| Bracket (click-into-match) | Partial |
| Match Preview (comparison bars, key players, recommendation) | Partial |
| Scouting / Opponent Report | Missing |
| Training (focus + intensity + history) | Missing |
| Match Viewer (stats strip, commentary, in-match panel) | Partial — basic HUD only |
| In-match management (subs, mid-match tactic, mentality, speed control) | Missing |
| Halftime + full-time overlays | Missing |
| Post-Match Report (ratings, MotM, deltas) | Missing — only score card |
| Save migration (v1 → v2 for new fields) | Missing |
| Autosave indicator | Missing |
| 18-player rosters (subs needed) | Missing — currently 11 |
| Fatigue / morale / form persistence | Missing |
| Commentary text generator | Missing |
| Per-team stats (shots, SoT, passes, tackles, fouls, corners, offsides) | Missing |
| Yellow/red card scaffold | Missing |
| Reusable UI primitive library | Missing — all inline HTML strings |
| CSS design tokens in `:root` | Missing — hex literals scattered |
| Per-screen modules under `src/screens/` | Missing — all in `TournamentUi.ts` |
| ScreenRouter abstraction | Missing — imperative `state.screen = X` |

## Known tech debt

- `src/systems/TeamAISystem.ts` — **1468 LOC**. Split candidate; deferred to post-overhaul.
- `src/ui/TournamentUi.ts` — 833 LOC of inline HTML strings. Incremental extraction into `src/screens/`.
- `src/systems/PlayerControlSystem.ts` — 851 LOC, all dormant in manager mode. Stays dormant; not removed (legacy direct-control path intact).
- `src/systems/PlayerSelectionSystem 2.ts` — 568 LOC stale duplicate. **Deleted** during this overhaul.
- Hex color literals scattered across `styles.css` instead of CSS variables.
- No reusable component library (`Button`, `Card`, `Bar`, `Pitch`, `Table`, etc.).
- `Hud.ts` doesn't surface stats — only score, clock, possession label.

## Architecture risks for the overhaul

1. `TeamAISystem` rewrite would be high-risk; this overhaul will **append-only** add `setTacticsFor` and `applySubstitution`.
2. `TournamentUi.ts` atomic rewrite would break working screens; incremental ScreenRouter migration is used instead.
3. Three.js + Rapier interplay on mid-match substitutions: must `removeRigidBody` + `addRigidBody` and reset brain state Maps.
4. 4× speed must cap physics substeps at 4/frame to keep Rapier stable.
5. Save schema bump requires `migrateSave(raw)` to avoid blowing away existing saves.
6. Squad 11 → 18 expansion is done via deterministic `benchGen.ts` generator (per-team seed) to keep `teams.ts` diff small.

## Recommended implementation sequence

See plan file at `/Users/williammenjivar/.claude/plans/you-are-working-inside-golden-aurora.md`. Five waves: foundation → manager loop → match engine + viewer → post-match/training/scouting/inbox → save migration + docs + QA.
