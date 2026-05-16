# Match Engine — Manager-Mode Extensions

The original Three.js + Rapier match engine is preserved. The overhaul adds an event bus, stats system, commentary, substitutions, in-match tactics, speed control, and cards, layered on top of the existing systems via append-only extensions.

## New systems

| System | File | Responsibility |
|---|---|---|
| `MatchEventBus` | `src/systems/MatchEventBus.ts` | Per-match pub/sub for `MatchEvent`s |
| `MatchStatsSystem` | `src/systems/MatchStatsSystem.ts` | Running `MatchStats` per team, ring buffer of events |
| `CommentarySystem` | `src/systems/CommentarySystem.ts` | Templated text from events + filler lines every ~12s |
| `SubstitutionSystem` | `src/systems/SubstitutionSystem.ts` | Validate + apply mid-match swaps |

## Event taxonomy

`MatchEvent.type ∈ { kickoff, goal, shot, save, foul, card, sub, corner, offside, half, full, tactic }`.

Each event includes `minute`, `team` (`'blue' | 'red' | 'neutral'`), and optionally `playerId`, `detail`, `cardType`.

## Tactics → AI mapping

`ManagerTactics.sliders` produce 0.7..1.3 multipliers via `TeamAISystem.getTacticMultiplier(team, key)`. Mentality maps to 0.8..1.2 via `getMentalityMultiplier(team)`. The existing decision functions in `TeamAISystem` consume these alongside their trait math; the formation + style choices continue to drive role assignments.

| Slider | Engine effect (intended) |
|---|---|
| pressing | Press radius / chase aggressiveness |
| lineHeight | Defensive depth band |
| tempo | Pass cooldown / forward run frequency |
| width | Lane spread of wingers / fullbacks |
| directness | Long-ball vs short-pass preference |
| risk | Pass success threshold / shot threshold |
| buildUp | Goalkeeper / center-back distribution speed |
| tackling | Tackle attempt rate |

(Today's implementation feeds these through `getTacticMultiplier`; the multipliers are read by the existing decision functions and proportionally scale their input weights. The decision math itself was not rewritten.)

## Halftime + full-time

- `MatchSystem.update` fires `half` at 50% elapsed (once) and `full` at 100%.
- `Game` listens via the bus: halftime opens an overlay with three team-talk options; full-time triggers post-match aftermath + `PostMatchScreen`.

## Substitutions

- `SubstitutionSystem.requestSub(teamColor, outId, inId, minute)` validates max 5 subs per team, ensures the outgoing player is on the field and the incoming is on the bench.
- Swap places `incoming.homePosition` at `outgoing.homePosition`, moves outgoing off-pitch via `outgoing.reset(new Vector3(-1000, ...))`.
- `TeamAISystem.notifyPlayerSwap(outId, inId)` clears the outgoing player's brain / cooldown / state Maps so the incoming player initialises clean.

## Speed control

- `MatchSystem.setSpeed(1 | 2 | 4)` multiplies the clock + AI delta.
- Physics still steps at fixed `1/60`s; `Game.stepPhysics` caps substeps at 4 per frame (`PHYSICS.maxSubSteps`) so 4× speed cannot destabilise Rapier.

## Cards

- `TackleSystem` on a missed tackle: prob `0.18 + (aggression - discipline) * 0.25` emits a `foul` event; prob `0.18 + bonus` of that emits a `card.yellow`; a second yellow on the same player emits `card.red`.
- Red cards do not yet remove the player from the field (engine doesn't yet support a true 10v11 mode); the event is recorded in stats and commentary.

## Pass / pass-accuracy estimation

The engine doesn't emit individual pass events; `MatchStatsSystem.update` synthesises pass counts as one pass per 1.5s of team possession, and `passAccuracy` is derived from possession share. A future enhancement would surface true pass attempts from `PossessionSystem` transitions.
