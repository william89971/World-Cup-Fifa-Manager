# Codex Futbol Tuning

Core tuning values live in `src/game/constants.ts`. Settings stored in localStorage can override match length from the Settings screen.

## Settings

- `graphicsQuality`: `low`, `medium`, or `high`. Low caps device pixel ratio at 1 and disables shadows/stadium crowd placeholders; medium caps DPR around 1.5; high caps DPR at 2 with stronger shadows.
- `cameraSensitivity`: Follow camera smoothing multiplier, clamped between 0.55x and 1.6x.
- `soundEnabled`: Placeholder gate for future audio hooks.
- `mobileControlsOpacity`: Touch control opacity, clamped between 45% and 100%.

## Player

- `PLAYER_MAX_SPEED`: Normal controlled-player movement speed.
- `PLAYER_SPRINT_SPEED`: Sprint movement speed. Currently tuned to matter without making sprint mandatory.
- `PLAYER_ACCELERATION`: How quickly the controlled player reaches target speed. Suggested range: `24-44`.
- `PLAYER_DECELERATION`: How quickly the controlled player slows after releasing movement. Suggested range: `18-34`.
- `PLAYER_TURN_SPEED`: Controlled-player turn speed in degrees per second. Higher values turn faster; lower values turn more heavily.
- `PLAYER.speed`, `PLAYER.sprintSpeed`, `PLAYER.acceleration`, and `PLAYER.deceleration`: Compatibility aliases fed from the named constants above.
- `PLAYER.aiSpeed`: Normal AI steering speed.
- `PLAYER.aiPressureSpeed`: AI speed while closing down the ball.
- `PLAYER.maxStamina`: Maximum sprint stamina.
- `PLAYER.staminaDrainPerSecond`: Stamina cost while sprinting.
- `PLAYER.staminaRegenPerSecond`: Stamina restored while not sprinting.
- `PLAYER.minimumSprintStamina`: Minimum stamina required to sprint.
- `PLAYER.boundsPadding`: Keeps players inside the pitch.
- Smart switching is enabled with `Tab` / mobile Switch. It prefers a teammate who can reach the ball while avoiding goalkeepers unless they are clearly closest. The controlled player uses character-relative movement: W/joystick up moves along the player's forward vector, S moves backward, and A/D or joystick left/right rotates yaw over time instead of strafing.

## Team And Formation

- `TEAM.playerCount`: Eleven players per side.
- `TEAM.roles`: Goalkeeper, four defenders, three midfielders, two wide attackers, and one striker.
- `FORMATION_TUNING`: Shared formation depth/width references for 11v11 home positions.
- `FormationSystem`: Selects 4-3-3, 4-4-2, or 3-5-2 from team style, opponent strength, and fixture stage.
- `ROLE_ZONES`: Role movement bands from own goal to opponent goal. Keepers stay near the penalty area, defenders hold deeper bands, midfielders work central bands, wings attack wider advanced bands, and the striker stays highest.

## Field And Goals

- `PITCH_LENGTH` / `PITCH_WIDTH`: Main field scale. Current live match scale is `150 x 95`.
- `GOAL_WIDTH` / `GOAL_HEIGHT`: Visual and scoring mouth size. Current goals are `18 x 6.1`.
- `PENALTY_AREA_SIZE`: Keeper area and pitch marking dimensions.
- `PITCH.length` / `PITCH.width` and `GOAL.width` / `GOAL.height` are aliases fed by those explicit constants.

To make matches roomier, increase pitch length/width and then retune camera offset, pass power, AI support spacing, and sprint speed together. To make scoring easier, increase goal width before increasing shot power.

## Ball

- `BALL.linearDamping`: Main control for how long the ball rolls.
- `BALL.angularDamping`: Spin decay.
- `BALL.friction`: Contact friction against the pitch.
- `BALL.restitution`: Bounce amount.
- `BALL.density`: Mass behavior through Rapier collider density.
- `BALL.maxSpeed`: Horizontal velocity cap applied after physics impulses. This keeps shots and deflections stable without teleporting the ball.

Suggested ranges:

- Damping: `1.6-2.5`
- Friction: `1.4-2.2`
- Restitution: `0.15-0.35`
- Max speed: `20-28`

## Gameplay

- `GAMEPLAY.possessionDistance`: Distance required to shoot, pass, or nudge the ball.
- `GAMEPLAY.possessionHysteresisDistance`: Extra distance that lets the current owner keep possession briefly instead of flickering.
- `GAMEPLAY.possessionCooldown`: Compatibility value fed by the possession lock duration.
- `GAMEPLAY.possessionLockMs`: Lock duration after a player gains the ball. Nearby opponents cannot steal by proximity during possession.
- `GAMEPLAY.ballClaimRange`: Loose-ball claim distance for outfield players.
- `GAMEPLAY.looseBallReclaimDelayMs`: Delay before anyone can reclaim the ball after tackles, shots, passes, or heavy touches.
- `GAMEPLAY.tackleRange`: Maximum tackle distance.
- `GAMEPLAY.tackleCooldownMs`: Per-player tackle cooldown.
- `GAMEPLAY.tackleSuccessChance`: Base tackle success probability before distance, facing, speed, and role bonuses.
- `GAMEPLAY.strongCollisionLooseBallThreshold`: Ball speed threshold used for heavy-touch possession loss.
- `GAMEPLAY.contestedDistance`: Distance where nearby opponents can make possession contested.
- `GAMEPLAY.controlledTouchDistance`: Practical distance for controlled dribble touches.
- `GAMEPLAY.dribbleIdealDistance`: Target distance for keeping the ball just ahead of the player.
- `GAMEPLAY.dribbleNudgePower`: Base small impulse for touches.
- `GAMEPLAY.dribblePullPower`: Pull impulse toward the ideal dribble point.
- `GAMEPLAY.dribbleSprintMultiplier`: Makes sprint touches heavier.
- `GAMEPLAY.dribbleCooldown`: Delay between dribble nudges.
- `GAMEPLAY.shotPower` / `GAMEPLAY.maxShotPower`: Base and full-charge shot impulse.
- `GAMEPLAY.shotChargeRate`: How quickly the Space shot meter fills.
- `GAMEPLAY.quickShotCharge`: Minimum charge used by a quick shot tap.
- `GAMEPLAY.shotLift` / `GAMEPLAY.maxShotLift`: Chip height added to shots.
- `GAMEPLAY.shotInaccuracy`: Movement-based shot spread.
- `GAMEPLAY.pressureInaccuracy`: Defender-pressure shot spread.
- `GAMEPLAY.maxShotSpeed`: Shot velocity cap.
- `GAMEPLAY.minPassPower`: Minimum emergency pass impulse.
- `GAMEPLAY.passPower` / `GAMEPLAY.maxPassPower`: Driven assisted pass impulse range. Current values favor firm ground passes.
- `GAMEPLAY.maxPassSpeed`: Pass velocity cap.
- `GAMEPLAY.passLift`: Small vertical pass lift. Keep this low so passes do not float.
- `GAMEPLAY.passLeadSeconds`: How far pass assist leads a moving teammate.
- `GAMEPLAY.calledPassMinPower` / `GAMEPLAY.calledPassMaxPower`: Dedicated stronger range for `Q` call-for-pass balls into the striker.
- `GAMEPLAY.calledPassMaxSpeed`: Velocity cap for called passes.
- `GAMEPLAY.markedDistance`: Radius used to penalize marked pass targets.
- Shots currently travel straight along the controlled player's facing direction. To aim, turn the player before shooting.
- `E` passes to the nearest viable teammate, with lane, marking, facing, and role as tie-breakers.
- `R` plays a through pass into space ahead of a teammate.
- `Q` / mobile Call asks an AI teammate to pass if a teammate can reach the ball and the lane is open.
- `Tab` / mobile Switch smart-switches to the best user-team player near the ball.

Suggested feel ranges:

- Dribble ideal distance: `0.75-1.2`
- Dribble nudge power: `0.35-0.8`
- Pass power: `18-42`
- Called pass power: `22-48`
- Shot power: `18-45`
- Shot lift: `0.2-4.5`
- Possession cooldown: `0.2-0.45`
- Ball claim range: `1.3-2.0`
- Tackle range: `1.6-2.4`
- Tackle success chance: `0.45-0.75`

## Readability

- `READABILITY.hardShotPower`: Shot power threshold for camera shake, trail, and impact flash.
- `READABILITY.hardShotSpeed`: Ball speed threshold used for hard-shot feedback.
- `READABILITY.shotShakeIntensity` / `shotShakeDuration`: Subtle screen shake on strong shots.
- `READABILITY.shotTrailDuration`: How long the hard-shot ball trail fades.
- `READABILITY.keeperBlockDistance`: Distance from keeper used to infer save/block feedback.
- `READABILITY.passHintHeight` / `passHintOpacity`: In-world pass target hint line/marker readability.
- `READABILITY.possessorIndicatorHeight`: Height of the small overhead possession triangle.
- `MINIMAP.width` / `height` / `updateInterval`: Minimap size and refresh rate.

Suggested readability ranges:

- Hard-shot power: `24-36`
- Shot shake intensity: `0.2-0.6`
- Trail duration: `0.25-0.6`
- Keeper block distance: `2.5-4.5`
- Minimap update interval: `0.06-0.12`

## Goalkeepers

- `KEEPER.claimRange`: Larger loose-ball claim range for goalkeepers.
- `KEEPER.clearPower`: Keeper clearance impulse.
- `KEEPER.clearMaxSpeed`: Keeper clearance velocity cap.
- `KEEPER.trackSpeed`: Keeper lateral/area movement speed.
- `KEEPER.areaPadding`: Keeps keepers inside their penalty area.
- `KEEPER.colliderHalfExtents`: Rapier kinematic blocker body size.

Suggested keeper ranges:

- Claim range: `2.0-3.0`
- Clear power: `8-14`
- Track speed: `5.5-8.5`

## AI

- `TRAIT_INFLUENCE`: Global caps for how much traits affect decision, movement, accuracy, stamina, spacing, and randomness.
- `AIPlayerBrain`: Persistent per-player AI mind stored in `src/systems/AIPlayerBrain.ts`. Each AI player tracks state, intent, target, target player/teammate, reaction time, decision cooldown, confidence, stamina, and last decision time.
- AI states: `HoldShape`, `PressBall`, `SupportPass`, `MakeRun`, `MarkOpponent`, `CoverSpace`, `ReceivePass`, `Dribble`, `Pass`, `Shoot`, `Retreat`, `Recover`, `KeeperDefend`, and `KeeperChaseBall`.
- Decision timing is staggered per player. Composed, well-positioned, disciplined players react faster; lower-discipline/high-risk players show more randomness.
- Player traits range from `0..1`: aggression, discipline, creativity, teamwork, shooting, passing, dribbling, defending, speed, stamina, positioning, riskTaking, and composure.
- Personality archetypes seed traits: Playmaker, Striker, Defender, Ball Winner, Dribbler, Speedster, Captain, Wildcard, and Goalkeeper.
- Team styles modify traits and decision scores: possession, counterAttack, highPress, defensive, balanced, and directAttack.
- `AI.pressureDistance`: Reference range for pressure decisions.
- `AI.supportLaneSpacing`: Wide support spacing.
- `AI.supportForwardOffset`: Forward support run distance.
- `AI.defensiveGoalOffset`: Defensive depth reference.
- `AI.homeReturnSpeed`: Recovery movement speed.
- `AI.arriveRadius`: Distance at which AI stops steering to a target.
- `AI.ballActionCooldown`: Minimum delay between AI ball actions.
- `AI.tapPower`, `AI.passPower`, `AI.shotPower`, `AI.shotLift`: AI impulse values.
- `AI.maxBallSpeed`: Cap for AI dribble/tap impulses.
- `AI.separationRadius`: Minimum spacing target between teammates.
- `AI.separationStrength`: How strongly support/defense targets move away from crowded areas.
- `AI.pressureReleaseDistance`: Reserved pressure tuning for backing off a press.
- `AI.laneCoverDistance`: Width used by the second defender covering passing lanes.
- `AI.passUnderPressureDistance`: Distance where an AI ball carrier looks to pass.
- `AI.shootDistance`: Distance from goal where AI considers shooting.
- F3 debug shows AI state counts plus per-player brain lines. With F3 on, each AI player also gets a small in-world mind label with role, state, intent, top trait, and cooldown.
- The HUD debug panel is intentionally compact. Detailed per-player AI information should stay in-world or in code logs, not in the main HUD panel.

Suggested AI ranges:

- Pressure distance: `18-32`
- Separation radius: `4.5-7`
- Support forward offset: `16-28`
- Ball action cooldown: `0.8-1.4`

## Restarts And Offside

- `OFFSIDE.enabled`: Enables the simple offside detector for forward passes in the attacking half.
- `OFFSIDE.minForwardPassDistance`: Minimum forward pass distance before offside can be called.
- `OFFSIDE.attackingHalfProgress`: Progress from own goal to opponent goal required for the receiver to be considered in the attacking half.
- `RESTARTS.throwInDelay`, `cornerDelay`, `goalKickDelay`, and `offsideDelay`: Short presentation pauses before play resumes.
- `RESTARTS.sidelineInset` and `cornerInset`: Keep restart ball placement inside field boundaries.

## Camera

- The live match currently uses a third-person camera behind the selected user-team player.
- `CAMERA_FOLLOW_SMOOTHING`: Camera position smoothing as it follows behind the player.
- `CAMERA_ROTATION_SMOOTHING`: Camera rotation/target smoothing as player yaw changes.
- `CAMERA.offset`: Follow camera height and distance behind the player.
- `CAMERA.lookAhead`: How far ahead and above the player the camera aims.
- `CAMERA.followLerp`: Compatibility alias fed from `CAMERA_FOLLOW_SMOOTHING`.
- `CAMERA.lookLerp`: Compatibility alias fed from `CAMERA_ROTATION_SMOOTHING`.
- `CAMERA.switchPositionLerp`: Softer camera position smoothing right after player switches.
- `CAMERA.switchLookLerp`: Softer look-target smoothing right after player switches.
- `CAMERA.ballLookWeight`: How much the camera target biases toward the ball.

Suggested camera ranges:

- Follow/look lerp: `5-12`
- Switch lerp: `3-7`
- Ball look weight: `0.2-0.45`

## Match

- `MATCH.goalFreezeSeconds`: Brief pause after a goal before kickoff reset.
- `MATCH.goalCountdownSeconds`: Kickoff countdown after goals and match start.
- `MATCH.durationSeconds`: Default match length before settings override.
- `MATCH.outOfBoundsPadding`: Distance beyond the pitch before ball reset.
