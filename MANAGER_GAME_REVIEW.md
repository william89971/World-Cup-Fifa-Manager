# Manager Game — Overhaul Review

Final state of the repo after the manager-game overhaul.

## What shipped

### Screens
- **Home** (`src/screens/HomeScreen.ts`) — exactly four buttons: Tournament, Manager Mode, Training, Settings. No standalone Play Match, no WASD prompts.
- **Country Selection** — kept legacy (TournamentUi.renderCountrySelection) but routed via Home → Tournament/Manager Mode.
- **Manager Hub** (`src/screens/manager/ManagerHub.ts`) — central dashboard with country hero, next-match card, squad condition/morale bars, tactical summary, news strip, 9-tile quick-actions grid.
- **Squad** (`SquadScreen.ts`) — tabs (All/XI/Bench), sort by role/OVR/condition/morale/form, filter by role band, captain badge, condition warnings.
- **Player Profile** (`PlayerProfile.ts`) — 13-trait radar, 13-bar attribute panel, condition/morale/form bars, recent ratings sparkline, notes textarea.
- **Tactics** (`TacticsScreen.ts`) — 5 formations (4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2), 6 styles, 5-step mentality, 8 sliders (pressing, lineHeight, tempo, width, directness, risk, buildUp, tackling), live tactical summary.
- **Formation Pitch** (`FormationPitchScreen.ts`) — SVG top-down pitch, click-to-swap starters, bench drawer for replacements.
- **Lineup** (`LineupScreen.ts`) — three columns (XI / Bench / opponent expected XI), captain dropdown.
- **Match Preview** (`MatchPreviewScreen.ts`) — comparison bars (attack/midfield/defense/keeper/overall), key players, fatigue warnings, assistant recommendation, Watch Match + Simulate + Lineup + Tactics + Scout buttons.
- **In-Match Panel** (`InMatchPanel.ts`) — slide-in side panel with Tactics / Subs / Stats tabs; pauses match while open.
- **Match Viewer** (Hud overlay) — enriched DOM overlay on top of the existing Three.js viewer: scoreboard, clock, stage, speed controls (1×/2×/4×), stat rail (possession + 10 counters), commentary feed, controls bar.
- **Post-Match Report** (`PostMatchScreen.ts`) — final score header, comparison bars, MotM card, scorers per team, ratings tables, continue.
- **Training** (`TrainingScreen.ts`) — 7 focus tiles (Fitness / Passing / Shooting / Defense / Tactics / Set Pieces / Recovery) + 3 intensities + history.
- **Scouting** (`ScoutingScreen.ts`) — opponent header, danger players, weak spots, suggested approach + tactics, probable XI.
- **Inbox** (`InboxScreen.ts`) — list + detail layout, read/unread, mark-all-read, generators for match/training/scout/tournament news.
- **Fixtures** (`FixturesScreen.ts`) — filterable (all / mine / group / knockouts) and status toggle.
- **Standings** (`StandingsScreen.ts`) — all 12 groups with qualification highlights (top 2 green, third amber, last red) plus best-third table.
- **Bracket** (`BracketScreen.ts`) — Round of 32 → Final columns, user-team highlighted, champion banner.
- **Settings** (TournamentUi.renderSettings) — match length, graphics, sound, camera, mobile opacity, crowd toggle, difficulty (easy/normal/hard), simulation detail, default match speed, debug mode toggle, reset save / reset settings.
- **Halftime overlay** — appears at 50% elapsed with three team-talk options (encourage / calm / press); applies morale or tactic effects.

### Engine extensions
- **MatchEventBus** (`MatchEventBus.ts`) — per-match pub/sub for `MatchEvent`s.
- **MatchStatsSystem** (`MatchStatsSystem.ts`) — running possession %, shots / SoT / passes / pass accuracy / tackles / fouls / corners / offsides / yellows / reds.
- **CommentarySystem** (`CommentarySystem.ts`) — 40+ original templates + filler lines every ~12s.
- **SubstitutionSystem** (`SubstitutionSystem.ts`) — validates + applies subs, calls `TeamAISystem.notifyPlayerSwap` to clear stale brain state.
- **TeamAISystem extensions** (append-only): `setTacticsFor`, `getTacticsFor`, `getTacticMultiplier`, `getMentalityMultiplier`, `notifyPlayerSwap`. Original 1468-LOC class untouched otherwise.
- **MatchSystem extensions**: `attachEventBus`, `getCurrentMinute`, `setSpeed`, `getSpeed`, halftime event emission at 50% elapsed, goal/corner/offside/full/kickoff events.
- **TackleSystem extensions**: `attachEventBus`, foul + yellow + red card emission with two-yellows-equals-red logic.
- **Squad expansion 11 → 18**: `benchGen.ts` produces 7 bench profiles per team (1 GK / 2 DEF / 2 MID / 2 ATT) deterministically. `Team.ts` instantiates bench Player rigs off-pitch.

### Save / data model
- `TournamentPlayerProfile` adds `condition`, `morale`, `form`, `recentRatings`, `isCaptain`, `notes`, `injuredDays` (all optional, defaulted).
- `TournamentSaveData` adds `version` (=2), `lineups`, `tactics`, `news`, `trainingHistory`, `matchHistory`.
- `TournamentState` adds `getManagerSnapshot`, `setTactics`, `setLineup`, `pushNews`, `markNewsRead`, `markAllNewsRead`, `pushTraining`, `pushMatchReport`, `getSquad`.
- `storage.ts` adds `migrateSave(raw)` (v1 → v2 default-fill) and `AUTOSAVE_EVENT` CustomEvent dispatched on every save.
- `AutosaveBadge.ts` shows a "Saved" toast on autosave.

### UI primitives
- `Button`, `Card`, `Bar` (+ `comparisonBar`), `Pill` (+ `formPill`), `Tabs`, `Table`, `Modal`, `Pitch` (SVG), `Flag`, `TopBar`, `NextMatchCard`, color helpers.
- Design tokens in `src/styles/tokens.css` (colors, spacing, radius, elevation, typography, motion).

## Buttons wired (Phase 25 audit)

Console.log lines emit on every major manager action: `[menu]` for the home buttons, `[hub]` for hub navigation, `[training]` for training-session triggers, `[sub]` for sub validation, `[match]` for engine events (indirectly via MatchEventBus listeners).

## Engine improvements

- **Tactics affect engine**: `TeamAISystem.getTacticMultiplier(team, key)` returns 0.7..1.3 multipliers for pressing/lineHeight/tempo/width/etc., applied alongside the existing trait/personality math. Mentality scales via `getMentalityMultiplier` (0.8..1.2).
- **Mid-match swaps**: `SubstitutionSystem.requestSub` swaps Player references in `Team.players` and `Team.bench`, calls `TeamAISystem.notifyPlayerSwap(outId, inId)` to drop stale brain state, places incoming player at the outgoing slot's home position. Outgoing moves off-pitch.
- **Speed control**: `MatchSystem.setSpeed(1|2|4)` multiplies the clock and AI delta. Physics still steps at fixed 1/60 with substeps capped at 4/frame.
- **Cards**: TackleSystem emits foul events with probability `f(aggression - discipline)` on misses, and yellow → red on second yellow.

## Known limitations / placeholders

- **PlayerControlSystem** (WASD direct control, 851 LOC) is left in place but dormant (`managerMode = true`). Not wired to any visible UI in the manager flow.
- **Set-piece routines**: training "setPieces" focus boosts top-3 shooters, but the engine doesn't have set-piece-specific AI behaviour yet.
- **Injuries**: `injuredDays` field exists on `TournamentPlayerProfile` but isn't decremented anywhere yet (no day-tick loop). Always 0 today.
- **Real player-of-match stat attribution**: goals are spread round-robin to attackers in `buildMatchReportFromEngine` because the engine doesn't attribute scorer ids per goal yet.
- **Mobile in-match panel**: slides from the bottom on small screens (CSS-only); full tested on Chrome Mobile emulation only.
- **Settings — sim-detail / difficulty fields**: persisted and surfaced in UI, but the engine doesn't yet bias opponent ratings by difficulty. Sim-detail toggle is a no-op for now (the engine always plays out fully when "Watch match" is chosen).
- **TeamAISystem split (1468 LOC)** intentionally deferred — overhaul stuck to append-only extensions to avoid risk.

## Manual test results

- `npm run build` — passes (tsc + vite, 89 modules transformed)
- `npm run validate:tournament` — passes
- Dev server — see QA_CHECKLIST.md for the 24-step manual smoke test.

## Files changed (summary)

- Modified: `index.html`, `src/main.ts`, `src/game/Game.ts`, `src/game/GameState.ts`, `src/game/playerTypes.ts`, `src/systems/FormationSystem.ts`, `src/systems/MatchSystem.ts`, `src/systems/TeamAISystem.ts` (append-only), `src/systems/TackleSystem.ts`, `src/entities/Team.ts`, `src/tournament/teams.ts`, `src/tournament/TournamentState.ts`, `src/tournament/storage.ts`, `src/ui/TournamentUi.ts`, `src/ui/Hud.ts`, `src/controls/KeyboardInput.ts`.
- Created (38 new files): `src/styles/tokens.css`, `src/components/{Button,Card,Bar,Pill,Tabs,Table,Modal,Flag,Pitch,TopBar,NextMatchCard,colors}.ts`, `src/app/ScreenRouter.ts`, `src/save/AutosaveBadge.ts`, `src/screens/HomeScreen.ts`, `src/screens/manager/{ManagerHub,SquadScreen,PlayerProfile,TacticsScreen,FormationPitchScreen,LineupScreen,InMatchPanel,PostMatchScreen,TrainingScreen,ScoutingScreen,InboxScreen,FixturesScreen,StandingsScreen,BracketScreen,MatchPreviewScreen}.ts`, `src/manager/types.ts`, `src/manager/postmatch/applyAftermath.ts`, `src/manager/training/runTraining.ts`, `src/manager/scouting/recommend.ts`, `src/manager/inbox/generators.ts`, `src/systems/{MatchEventBus,MatchStatsSystem,CommentarySystem,SubstitutionSystem}.ts`, `src/tournament/benchGen.ts`, plus the docs listed in this file.
- Deleted: `src/systems/PlayerSelectionSystem 2.ts` (stale duplicate).

## Next best prompt

> Wire opponent AI to consume per-opponent saved `ManagerTactics` like the user team does, give each NPC team plausible default `ManagerTactics` derived from `teamStyle`, then split `TeamAISystem.ts` into role-specific submodules (`OffBallAI`, `OnBallAI`, `KeeperAI`).
