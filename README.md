# Global Retro Cup — Manager

A browser-based **football manager simulation**. You manage a national team through a 48-team retro tournament: set tactics, train your squad, scout opponents, then watch matches play out in 3D with autonomous AI on both sides. The user is the manager — there is no WASD player control in the manager flow. Built with Vite, TypeScript, Three.js, and Rapier physics.

> Unofficial, original code and assets. Nothing in this project uses FIFA, World Cup, Football Manager, EA Sports, Sports Interactive, or any federation / club / kit branding. Country names are plain text only; all flags are inline SVG primitives generated in code.

---

## Quick start

```bash
git clone https://github.com/william89971/World-Cup-Fifa-Manager.git
cd World-Cup-Fifa-Manager
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Vite hot-reloads on every save — edit anything under `src/` and the page refreshes itself in milliseconds.

For an installable PWA build:
```bash
npm run build
npm run preview
```

Tournament integrity check:
```bash
npm run validate:tournament
```

---

## What's in the box

| Feature | Status |
|---|---|
| **Main menu**: Tournament / Manager Mode / Training / Settings (4 buttons only) | Working |
| **48-team tournament** with 12 groups + best-third qualifiers + knockout bracket | Working |
| **11v11 AI vs AI matches**, fully autonomous (no direct player control) | Working |
| **Country selection** with 48 nations, distinct kits, inline SVG flags | Working |
| **Manager Hub** — dashboard with next match, squad condition, news, quick actions | Working |
| **Squad** screen — tabs (All / XI / Bench), sort, filter, captain | Working |
| **Player Profile** — 13-trait radar + bars, recent-rating sparkline, notes | Working |
| **Tactics** — 5 formations, 6 styles, 5-step mentality, 8 sliders, live summary | Working |
| **Formation Pitch view** — SVG top-down pitch, click-to-swap, bench drawer | Working |
| **Lineup** — XI + bench + captain + opponent expected XI | Working |
| **Match Preview** — team comparison bars, key players, fatigue warnings, recommendation | Working |
| **Scouting / Opponent Report** — danger players, weak spots, suggested tactics | Working |
| **Training** — 7 focus types × 3 intensities, history, news on milestones | Working |
| **Inbox / News** — match summaries, training milestones, scout reports | Working |
| **In-match management** — pause, 1×/2×/4× speed, tactic changes, subs, halftime team-talk | Working |
| **Enriched match viewer** — stat rail, commentary feed, controls overlay on the 3D pitch | Working |
| **Post-Match Report** — comparison bars, MotM, scorers, ratings table | Working |
| **18-player squads** (11 starters + 7 bench), substitutions up to 5 per match | Working |
| **Fatigue / morale / form** persistence across matches | Working |
| **Save/load** with versioned schema, autosave badge | Working |
| **Mobile-installable PWA**, touch-friendly buttons, responsive layout | Working |

---

## Manager-mode flow

1. **Home** — four buttons: Tournament / Manager Mode / Training / Settings.
2. **Country Selection** — 48 nations. Pick one and land in the Manager Hub.
3. **Manager Hub** — your dashboard. Next-match card, squad summary, news, 9-tile quick actions.
4. From the hub: **Squad** (open Player Profile), **Tactics** (formation + 8 sliders + mentality), **Lineup** (XI + bench + captain), **Pitch view** (SVG swap), **Training**, **Scouting**, **Fixtures / Standings / Bracket**, **Inbox**, **Settings**.
5. **Continue** → Lineup → **Match Preview** → **Watch Match** (or Simulate).
6. **Watch Match** — 3D pitch + DOM overlay. Pause with Space, switch speed with `1` / `2` / `4`. Click TACTICS or SUBS to slide in the in-match panel (apply tactics, swap players, view full stats).
7. At halftime — pick a team-talk option (encourage / calm / press).
8. Full time — **Post-Match Report**: comparison bars, scorers, ratings, MotM, condition/morale updates. Continue → Manager Hub for the next match.

Keyboard:
- `Space` — pause / resume the match
- `1` / `2` / `4` — match speed
- `Esc` — close the in-match panel
- `F3` — debug overlay
7. **Champion screen** when the bracket resolves.

---

## How players think

Each of the 22 players on the pitch carries its own `AIPlayerBrain` (`src/systems/AIPlayerBrain.ts`):

- **13 traits** generated from country rating + role + personality archetype + style modifiers + per-player jitter: `aggression, discipline, creativity, teamwork, shooting, passing, dribbling, defending, speed, stamina, positioning, riskTaking, composure`
- **9 personality archetypes**: Playmaker, Striker, Defender, Ball Winner, Dribbler, Speedster, Captain, Wildcard, Goalkeeper
- **Per-player decision cadence** — high-composure players tick faster; cautious ones move less often
- **6 team styles** layer on top — `possession`, `counterAttack`, `highPress`, `defensive`, `balanced`, `directAttack` — each shifts trait weights and decision scores
- **Anti-clumping** separation + a **presser cap** (only the closest 1–2 defenders press the carrier; the rest hold shape)
- **Trait-weighted scoring** decides every on-ball choice (shoot vs pass vs through-ball vs dribble) and every off-ball choice (press vs cover vs mark vs hold vs retreat)

Two strikers with different trait values play differently: a high-`composure` striker shoots calmly under pressure; a low-`composure` one panics into a poor touch. Disciplined defenders hold their line; a `Wildcard` winger gambles on risky runs.

---

## Tech stack

- **Three.js** — 3D rendering, scene graph, perspective camera, sprite labels
- **Rapier3D-compat** — Rust-backed physics engine compiled to WASM (ball physics, collisions)
- **Vite 6 + TypeScript 5** — dev server with HMR, type-checked build
- **vite-plugin-pwa** — installable PWA with offline support
- No game framework — everything is hand-rolled TypeScript classes against the Three.js API

---

## Project structure

```
src/
├── main.ts                 # bootstrap
├── styles.css              # all UI CSS
├── game/
│   ├── Game.ts             # main loop, state machine, system wiring
│   ├── GameState.ts        # screen + liveMatch + tactics state
│   ├── constants.ts        # pitch dimensions, player physics, AI tuning
│   ├── scene.ts            # Three.js scene + pitch construction
│   ├── camera.ts           # initial broadcast camera
│   ├── lighting.ts         # directional + ambient lights
│   ├── stadium.ts          # crowd block placeholders
│   ├── playerTypes.ts      # PlayerRole, TraitKey, PersonalityArchetype, etc.
│   └── soundHooks.ts       # placeholder kick/whistle hooks
├── entities/
│   ├── Player.ts           # player rig, name label, traits, visuals
│   ├── Team.ts             # createTeam(color, tournamentTeam, { formation, teamStyle, lineupOverride })
│   ├── Ball.ts             # ball rigidbody + mesh
│   └── Goal.ts             # goal frame + net
├── systems/
│   ├── TeamAISystem.ts     # per-team AI driver (managerMode flag included)
│   ├── AIPlayerBrain.ts    # per-player brain with traits/jitter/state
│   ├── PossessionSystem.ts # ball ownership state machine
│   ├── PossessionIndicatorSystem.ts  # disabled in manager mode
│   ├── PlayerControlSystem.ts        # disabled in manager mode
│   ├── PlayerSelectionSystem.ts      # "focus" player for HUD; ignored by AI in manager mode
│   ├── CameraSystem.ts     # broadcast or follow mode
│   ├── FormationSystem.ts  # 3 formations × 11 roles
│   ├── RoleZones.ts        # position bands per role
│   ├── PassTargetHintSystem.ts
│   ├── TackleSystem.ts
│   ├── OffsideSystem.ts
│   ├── MatchSystem.ts      # clock, restarts, scoring
│   ├── KeeperBlockSystem.ts
│   ├── ShotFeedbackSystem.ts
│   ├── MinimapSystem.ts
│   └── PassingTargetSystem.ts
├── tournament/
│   ├── TournamentState.ts  # groups, fixtures, knockouts, save data
│   ├── teams.ts            # 48 country teams + name pools + rating + style picker
│   ├── bracket.ts          # knockout bracket builder
│   ├── simulation.ts       # deterministic xG-based match sim
│   ├── storage.ts          # localStorage save/load + settings
│   └── validation.ts       # tournament invariants for tests
├── ui/
│   ├── Hud.ts              # match HUD (manager-mode stripped: score + clock + possession + events)
│   └── TournamentUi.ts     # home, country select, group stage, match preview, tactics, squad, bracket, settings
├── controls/               # keyboard / touch / combined — dormant in manager mode
├── physics/
│   └── physicsWorld.ts     # Rapier world setup
└── dev/
    └── validateTournament.ts
public/                     # static assets (favicon, icons, offline page)
scripts/                    # node validateTournament helper
```

---

## Configuration knobs worth knowing

All gameplay tuning is centralised in `src/game/constants.ts`. The most impactful values:

| Constant | Effect |
|---|---|
| `PITCH.length` / `PITCH.width` | Pitch dimensions (default 150 × 95) |
| `PLAYER.height` / `PLAYER.radius` | Physics body size; visual is scaled separately in `Player.ts` |
| `PLAYER_VISUAL_SCALE` (in `Player.ts`) | Uniform scale of the rendered rig (default 1.6×) |
| `AI.shootDistance` / `AI.passUnderPressureDistance` | When AI choose shoot vs pass |
| `AI.separationRadius` / `AI.separationStrength` | Anti-clumping strength |
| `TRAIT_INFLUENCE.randomness` | How wildly creative/risky players deviate from optimal play |
| `MATCH.durationSeconds` | Default match length (180s; settings screen overrides) |

For broadcast-camera framing, see the constants at the top of `src/systems/CameraSystem.ts` (`BROADCAST_HEIGHT`, `BROADCAST_BACK`, drift factors).

---

## Roadmap (Phase C)

Out of scope for the initial manager-mode build but lined up for follow-up:

- In-match tactical controls (pause and change formation/style mid-match)
- Substitutions UI at halftime or pause
- Camera mode toggle (broadcast / tactical top-down / replay)
- Hover-tooltips on the 3D pitch showing player name + top traits
- Match speed slider (1× / 2× / 4×)
- Higher-fidelity player meshes (jersey numbers, two-tone kits, faces)
- Stadium dressing (crowd density, scoreboard model, fictional hoardings)
- Replay system with bookmarked highlights
- Manager messages in the event feed when tactics change

---

## Browser controls

In manager mode, almost all input is intentionally inert — the game plays itself. The only spectator keys:

| Key | Action |
|---|---|
| `P` | Pause / resume match |
| `T` | Restart match (back to kickoff) |
| `F3` | Toggle debug overlay (FPS, possession, ball speed, AI state counts) |

---

## License & disclaimer

See LICENSE in the repository root. This project is an original, unofficial fan creation. All country names are plain English text and all flag visuals are simple SVG primitives generated in `src/tournament/teams.ts`. It does not use, reference, or endorse FIFA, the FIFA World Cup, any national federation, any official competition, any club, any real player, or any official kit. The repository name is the author's choice and does not imply any affiliation with or endorsement by FIFA or any of its licensees.

If you intend to publish, monetise, or distribute a derived work that uses real names, flags, kits, or branding, you are responsible for clearing the rights yourself.
