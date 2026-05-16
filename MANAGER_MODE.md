# Manager Mode — Flow

```
HomeScreen
  ├─ Tournament   ─┐
  ├─ Manager Mode ─┼──▶ (save?) ─▶ ManagerHub
  │                │       └─▶ (no save) ─▶ CountrySelection ─▶ ManagerHub
  ├─ Training      └──────▶ ManagerHub (training tab) — same fallback path
  └─ Settings ─▶ Settings

ManagerHub
  ├─ Squad ─▶ PlayerProfile (back to Squad)
  ├─ Tactics ─▶ FormationPitchScreen (back to Tactics)
  ├─ Lineup
  ├─ Pitch view (FormationPitchScreen)
  ├─ Training (TrainingScreen)
  ├─ Scouting (ScoutingScreen) ─▶ Apply suggested tactics
  ├─ Fixtures / Standings / Bracket
  ├─ Inbox
  ├─ Settings (legacy TournamentUi.renderSettings)
  └─ Continue ─▶ Lineup ─▶ MatchPreview ─▶ Watch Match
                                          └─▶ Simulate

Match (Three.js viewer + DOM overlay)
  ├─ Pause (Space)
  ├─ Speed 1×/2×/4× (1/2/4 keys)
  ├─ TACTICS button ─▶ InMatchPanel (apply tactics, sub players, view stats)
  ├─ Halftime overlay (team talk: encourage / calm / press)
  └─ Full time ─▶ PostMatchScreen
                     ├─ Continue ─▶ ManagerHub
                     ├─ Squad
                     └─ Standings
```

## Match-cycle persistence

After every match completes:
1. `Game.handleMatchComplete` builds a `MatchReport` from `MatchStatsSystem`.
2. `applyMatchAftermath(state, report)` decrements condition, shifts morale/form, generates news.
3. `tournament.recordUserFixture` + `tournament.simulateUntilUserMatchOrComplete` advance the tournament.
4. `saveTournament(tournament)` fires the `AUTOSAVE_EVENT`, the badge flashes.
5. `PostMatchScreen` renders with the new report.

## Key actions

| Action | Handler |
|---|---|
| Save tactics | `Game.handleSaveTactics` |
| Save lineup | `Game.handleSaveLineup` |
| Confirm lineup | `Game.handleConfirmLineup` (routes to MatchPreview) |
| Watch match | `Game.handleWatchMatch` → `startPlayableFixture(fixture)` |
| Simulate next | `Game.handleSimulateNextMatch` |
| Run training | `Game.handleRunTraining` (also pushes news) |
| Apply scout tactics | `Game.handleApplyScoutTactics` |
| Set captain | `Game.handleSetCaptain` |
| Save notes | `Game.handleSavePlayerNotes` |
| Mark news read | `Game.handleMarkNewsRead` / `handleMarkAllNewsRead` |
| In-match tactic change | `Game.handleInMatchTacticChange` |
| In-match substitution | `Game.handleInMatchSub` |
| Halftime team talk | `Game.applyTeamTalk` |
