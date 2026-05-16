# QA Checklist — Manager Game

Run before merging or publishing.

## Build / type checks

- [ ] `npm install` (if `node_modules/` is stale)
- [ ] `npm run build` — passes `tsc && vite build` with zero errors
- [ ] `npm run validate:tournament` — passes
- [ ] `npm run dev` — opens at `http://localhost:5173`

## Manual smoke test (24 steps)

1. Home shows exactly **4 buttons**: Tournament / Manager Mode / Training / Settings (no Play Match, no WASD prompts).
2. Settings opens and persists changes after reload.
3. Training is selectable from Home (with a save it goes to ManagerHub; without it goes to country select).
4. Tournament with no save → country selection.
5. Country select → Manager Hub renders with hero, next-match card, news, quick-action grid.
6. Tournament with save → Manager Hub directly.
7. Squad opens; sort by OVR, filter MID, captain toggle persists after navigating away.
8. Player profile opens with radar + 13 bars + ratings sparkline; notes textarea saves.
9. Tactics: change formation to 4-2-3-1, change mentality, move 3 sliders → save → re-open shows persisted values.
10. Pitch view: click two dots → swap → save → Lineup reflects the swap.
11. Lineup: change captain via dropdown → confirm → MatchPreview shows comparison bars + key players.
12. MatchPreview → Watch Match starts the 3D viewer with the DOM overlay (scoreboard top, stat rail right, commentary bottom, controls).
13. In-match controls: pause works (button + Space key), 2×/4× speed responds, sub a player (out leaves field, in joins), tactic change reflected in commentary.
14. Goals trigger commentary line; corner/offside trigger commentary; tackle foul emits foul stat (+ rare yellow).
15. Halftime overlay appears at ~50% elapsed with three team-talk options that close it and resume.
16. Full-time → PostMatchScreen with comparison bars, scorers, ratings, MotM card.
17. PostMatchScreen → Continue → ManagerHub shows updated condition/morale/form.
18. Run a Training session → trait deltas applied, training history records, inbox gets a milestone-style entry.
19. Scouting opens for next opponent; "Apply suggested tactics" updates tactics and returns to hub.
20. Inbox shows post-match summary + training news; click an item → mark-read; mark-all-read works.
21. Standings render with qualification highlights; Fixtures filter (mine/group/knockouts) works; Bracket shows knockout columns.
22. Reload page → save migrates cleanly, all state restored, autosave badge fires on next change.
23. Resize to 480px wide → all screens readable, no overlap, in-match panel slides from bottom.
24. Console — no fatal errors during a full 3-min match.

## Regression

- [ ] Existing 11v11 simulation behaviour unchanged when no `ManagerTactics` overrides are set.
- [ ] `npm run validate:tournament` still passes.
- [ ] Existing v1 localStorage saves migrate without data loss.
