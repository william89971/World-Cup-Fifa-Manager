# Codex Futbol Roadmap

## Done

- Vite + TypeScript browser app without React.
- Three.js pitch, goals, simple stadium, placeholder players, and third-person camera.
- Rapier dynamic ball with damping, friction, and impulse-based passing/shooting.
- 11v11 user match with country-colored teams, fictional player names, manual player switching, goalkeeper plus 10 outfield roles, stamina, shot charge, pass assist, call-for-pass, tackles, score, timer, restarts, and debug overlay.
- World 5s Cup tournament wrapper with 48 country teams, 12 groups, best-third qualification, knockout progression, CPU simulation, champion screen, and localStorage save/load.
- HTML/CSS overlay UI for home, country selection, standings, match preview, bracket, settings, match complete, and champion screens.
- Stabilized app state separation so live match state, tournament state, save data, and current screen state are easier to reason about.
- Lightweight tournament validation command for group/bracket/progression regressions.
- Real touch controls for phone play, responsive match/tournament UI improvements, expanded settings, and installable PWA output.
- Inline SVG national flag layouts for all 48 teams, replacing generated placeholder flag blocks.
- Larger 150x95 pitch with one goalkeeper plus 10 outfield players, clearer 18x6.1 goals, simple net placeholders, and keeper blocker bodies.
- Locked possession and tackle rules so proximity/body contact does not automatically steal the ball.
- Procedural low-poly footballer visuals with heads, torsos, legs, feet, contact shadows, simple running leg swing, controlled-player marker, and possessor indicator.
- Player personality and trait model with nine archetypes, 13 trait values, and team tactical styles.
- Formation selection for 4-3-3, 4-4-2, and 3-5-2, plus basic throw-in, corner, goal-kick, kickoff, and offside restarts.
- Match readability pass with subtle possession indicators, team-colored ball glow, pass target hints, hard-shot trail/flash feedback, smart Tab switching, restart overlays, and a minimap.
- Per-player AI brain model with independent state, intent, target, cooldown, stamina, confidence, and trait-weighted decisions.
- Compact debug HUD, stronger mostly-grounded passing, and dynamic role-lane AI targets that reduce zone-centering.

## Near-Term

- Add browser smoke-test automation for the menu-to-match flow.
- Tighten match pacing and physical feel through repeated playtest tuning.
- Tune per-player AI brain scores for pressing, support runs, marking, retreating, and passing after match playtests.
- Continue tuning pass speed, first touch, and receiving behavior after playtesting stronger driven passes.
- Improve player-to-ball contact and add simple player collision avoidance for crowded 22-player phases.
- Tune keeper behavior, tackle difficulty, and loose-ball timing through playtesting.
- Add clearer in-world role-zone guides so boundaries are easier to understand without F3.
- Improve bracket layout readability on small screens.
- Audit PWA install behavior on iOS Safari and Android Chrome after deployment.

## Later

- Gamepad controls.
- Richer tactical player indicators and player-selection previews.
- Smarter AI marking, goalkeeper reactions, fouls/cards, substitutions, and stamina strategy.
- Lightweight procedural audio.
- Deeper bundle/performance work for Rapier loading.
