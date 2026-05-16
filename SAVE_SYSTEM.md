# Save / Load

Single-slot localStorage save at key `codex-futbol.world-5s-cup.save`. Settings live at `codex-futbol.world-5s-cup.settings`.

## Schema

```ts
TournamentSaveData {
  version: number                          // SAVE_VERSION = 2 (current)
  selectedTeamId: string                   // user team id
  groups: Group[]
  fixtures: Fixture[]
  championTeamId?: string
  userEliminated: boolean
  teamProfiles?: TournamentTeamProfileSave[]   // per-team profile (style, formation prefs, players, bench)
  lineups?: Record<teamId, LineupDraft>        // captain + XI + bench ids per team
  tactics?: Record<teamId, ManagerTactics>     // formation + style + mentality + 8 sliders
  news?: NewsItem[]                            // inbox feed (most recent first, cap 80)
  trainingHistory?: TrainingSession[]          // recent sessions (cap 32)
  matchHistory?: MatchReport[]                 // recent match reports (cap 32)
}
```

Per-player profile (`TournamentPlayerProfile`) adds the optional manager fields: `condition` (0-100), `morale` (0-100), `form` (-5..+5), `recentRatings: number[]`, `isCaptain`, `notes`, `injuredDays`. Missing values are default-filled by `ensureManagerDefaults` on load.

## Migration

`storage.ts::migrateSave(raw)`:
1. Reads `raw.version` (defaults to 1).
2. Returns a `TournamentSaveData` with all v2 fields defaulted (`lineups: {}`, `tactics: {}`, `news: []`, etc.).
3. `TournamentState.constructor` (via `normalizeProfiles`) then fills per-player condition/morale/form and derives bench from `TOURNAMENT_TEAMS` if the saved profile predates the bench expansion.
4. On JSON parse / structural failure, `loadTournament` returns `undefined` and logs a warning — the HomeScreen falls back to "no save" UI.

## Autosave

`saveTournament` dispatches a `CustomEvent('manager:autosave')`. `AutosaveBadge` (mounted by `Game.constructor`) shows a "Saved" toast for 1.6s when the event fires. Save is triggered by every manager-mode mutation (setTactics, setLineup, setCaptain, run training, after match aftermath, etc.).

## Reset

Settings panel: `Reset tournament save` clears the save key and routes back to Home. `Reset settings` restores `DEFAULT_SETTINGS`.

## Cap policy

- News: cap 80 (oldest dropped).
- Training history: cap 32.
- Match history: cap 32.
