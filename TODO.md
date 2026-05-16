# Global Retro Cup Manager — TODO

## Recently shipped (manager-game overhaul)

- 4-button home menu (Tournament / Manager Mode / Training / Settings).
- Manager Hub, Squad, Player Profile (radar), Tactics (5 formations + 8 sliders + mentality), Formation Pitch view, Lineup, Match Preview, Scouting, Training, Inbox, Post-Match report, Fixtures / Standings / Bracket as dedicated screens.
- Enriched in-match overlay (stat rail, commentary, controls) on top of the existing Three.js viewer.
- In-match management: pause, speed (1×/2×/4×), tactic changes, substitutions, halftime team-talk.
- Engine extensions: MatchEventBus, MatchStatsSystem, CommentarySystem, SubstitutionSystem; TeamAISystem `setTacticsFor`, `notifyPlayerSwap`; TackleSystem foul + card events.
- 18-player squads (11 starters + 7 bench) generated deterministically per team.
- Save schema v2 with migration; AUTOSAVE_EVENT + AutosaveBadge.
- Settings expanded (difficulty, sim detail, default match speed, debug mode).

## Open

- Wire opponent AI to consume per-opponent saved `ManagerTactics` like the user team does.
- Apply difficulty setting to opponent rating bias (easy = -5 OVR, hard = +5 OVR) inside `simulateMatch`.
- Implement `simDetail = 'instant'` properly (skip the 3D renderer for non-user matches; today both are full).
- Decrement `injuredDays` once per match-day to give the injury field meaning.
- Attribute goals to actual on-pitch scorers (engine doesn't yet expose `lastTouchPlayerId` on goal events).
- Red card sending-off (today the event fires but the player stays on the field).
- Set-piece-specific AI behaviour (training boost exists but engine ignores).
- Browser smoke tests for the 24-step QA checklist (Playwright or similar).
- Split `TeamAISystem.ts` (1468 LOC) into `OffBallAI`, `OnBallAI`, `KeeperAI` modules — deferred to avoid touching the engine mid-overhaul.
- Mobile in-match panel polish (tested on Chrome Mobile emulation only).
- True pass attempt / pass accuracy tracking (today it's estimated from possession share).
- Multi-season career mode, transfers, scouting market — explicitly out of scope.
- Reduce the large Rapier production chunk (build warning: rapier-*.js ~2.2 MB).

## Pre-existing (kept from old TODO)

- Test PWA install prompts on deployed iOS Safari and Android Chrome.
- Improve physical player-to-ball contact and player collision avoidance.
- Profile and optimize 22-player matches on older phones.
- Playtest and tune AI brain score weights so roles feel distinct without making players ignore obvious danger.
- Playtest stronger driven passes and tune receiving/first-touch behavior.
- Add goal backstop colliders and richer goal-mouth rebound behavior.
- Add clearer visible role-zone guides during live play.
- Tune smart player switching, call-for-pass behavior, AI reaction timing, and 11v11 camera distance.
- Tune tackle success, loose-ball reclaim delay, keeper clear power, and larger-field AI spacing.
- Add better goalkeeper dive/reaction behavior.
- Improve restart placement and give restart possession to the correct nearby player more consistently.
- Add richer off-ball player indicators.
- Make bracket layout more compact on phone-sized screens.
- Add procedural audio or optional generated sound assets.
