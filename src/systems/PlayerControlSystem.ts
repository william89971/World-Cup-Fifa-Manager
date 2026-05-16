import { Vector2, Vector3 } from 'three';
import type { GameInput } from '../controls/GameInput';
import { Ball } from '../entities/Ball';
import { Player } from '../entities/Player';
import type { Team } from '../entities/Team';
import {
  BALL,
  GAMEPLAY,
  PITCH,
  PLAYER,
  PLAYER_ACCELERATION,
  PLAYER_DECELERATION,
  PLAYER_MAX_SPEED,
  PLAYER_SPRINT_SPEED,
  PLAYER_TURN_SPEED,
} from '../game/constants';
import { soundHooks } from '../game/soundHooks';
import { getOffsideViolation } from './OffsideSystem';
import { PassingTargetSystem, type PassTargetInfo } from './PassingTargetSystem';
import { PossessionSystem } from './PossessionSystem';
import { clampPositionToRoleZone } from './RoleZones';
import type { ShotEvent } from './ShotFeedbackSystem';

export class PlayerControlSystem {
  private readonly inputMovement = new Vector2();
  private readonly inputDebug = new Vector2();
  private readonly movement = new Vector3();
  private readonly desiredVelocity = new Vector3();
  private readonly displacement = new Vector3();
  private readonly playerPosition = new Vector3();
  private readonly ballPosition = new Vector3();
  private readonly targetPosition = new Vector3();
  private readonly leadTarget = new Vector3();
  private readonly toTarget = new Vector3();
  private readonly passStart = new Vector3();
  private readonly passEnd = new Vector3();
  private readonly passSegment = new Vector3();
  private readonly lanePosition = new Vector3();
  private readonly closestPoint = new Vector3();
  private readonly shotDirection = new Vector3();
  private readonly debugMovementDirection = new Vector3();
  private readonly staminaByPlayer = new Map<string, number>();
  private readonly velocityByPlayer = new Map<string, Vector3>();
  private readonly yawByPlayer = new Map<string, number>();
  private readonly passingTargets: PassingTargetSystem;
  private selectedPassTarget?: Player;
  private selectedPassTargetInfo?: PassTargetInfo;
  private selectedThroughPassTargetInfo?: PassTargetInfo;
  private selectedPassTargetScore = 0;
  private callForPassMessage = '';
  private callForPassTimer = 0;
  private dribbleCooldown = 0;
  private shotCharge = 0;
  private currentSpeed = 0;
  private targetFacingAngle = 0;
  private currentFacingAngle = 0;
  private isTurning = false;
  private turnInput = 0;
  private throttleInput = 0;
  // Manager mode flag. Defaults to true — the game is a Football-Manager-style
  // simulation; no player is directly controllable. Flip to false to re-enable
  // direct play (e.g. for debugging or a future training mode).
  public managerMode = true;

  constructor(
    private readonly input: GameInput,
    private readonly getControlledPlayer: () => Player,
    private readonly team: Team,
    private readonly opponentTeam: Team,
    private readonly ball: Ball,
    private readonly possession: PossessionSystem,
    private readonly onOffside: (
      position: Vector3,
      message: string,
      restartTeamColor: 'blue' | 'red',
    ) => void = () => {},
    private readonly onShot: (event: ShotEvent) => void = () => {},
  ) {
    this.passingTargets = new PassingTargetSystem(team, opponentTeam);
  }

  update(delta: number): void {
    // Manager mode: user does not control any player. Both teams are AI-driven via
    // TeamAISystem. Bail out before reading input or moving anyone so a keystroke can
    // never accidentally jerk a player on the pitch.
    void delta;
    if (this.managerMode) {
      return;
    }

    const player = this.getControlledPlayer();
    const stamina = this.getStamina(player);
    const velocity = this.getVelocity(player);
    this.input.getMovement(this.inputMovement);
    this.inputDebug.copy(this.inputMovement);

    // Character-relative controller:
    // A/D rotate yaw over time, and W/S accelerate along the player's current
    // forward vector. There is no strafe vector, so D cannot slide the player
    // sideways; W+D naturally produces a curved run.
    this.turnInput = clamp(this.inputMovement.x, -1, 1);
    this.throttleInput = clamp(-this.inputMovement.y, -1, 1);
    const hasMoveThrottle = Math.abs(this.throttleInput) > 0.05;
    const hasTurnInput = Math.abs(this.turnInput) > 0.05;

    const playerYaw =
      this.getPlayerYaw(player) + degreesToRadians(PLAYER_TURN_SPEED) * this.turnInput * delta;
    this.yawByPlayer.set(player.id, playerYaw);
    player.setYaw(playerYaw);
    player.facing.y = 0;
    player.facing.normalize();

    const sprinting =
      this.throttleInput > 0.05 &&
      this.input.isSprintDown() &&
      stamina > PLAYER.minimumSprintStamina;
    const staminaT = Math.max(0, Math.min(1, stamina / PLAYER.maxStamina));
    const sprintT = sprinting ? 0.5 + staminaT * 0.5 : 0;
    const traitSpeedMultiplier = 0.86 + player.traits.speed * 0.28;
    const targetSpeed =
      (PLAYER_MAX_SPEED + (PLAYER_SPRINT_SPEED - PLAYER_MAX_SPEED) * sprintT) *
      traitSpeedMultiplier;

    if (hasMoveThrottle) {
      const backwardMultiplier = this.throttleInput < 0 ? 0.42 : 1;
      this.movement.copy(player.facing).multiplyScalar(Math.sign(this.throttleInput));
      this.debugMovementDirection.copy(this.movement);
      this.desiredVelocity
        .copy(this.movement)
        .multiplyScalar(targetSpeed * Math.abs(this.throttleInput) * backwardMultiplier);
    } else {
      this.desiredVelocity.set(0, 0, 0);
      this.debugMovementDirection.set(0, 0, 0);
    }

    const smoothing = hasMoveThrottle ? PLAYER_ACCELERATION : PLAYER_DECELERATION;
    const velocityLerp = 1 - Math.exp(-smoothing * delta);
    velocity.lerp(this.desiredVelocity, velocityLerp);

    if (velocity.lengthSq() < 0.0004) {
      velocity.set(0, 0, 0);
    }

    this.currentSpeed = velocity.length();
    this.displacement.copy(velocity).multiplyScalar(delta);
    if (this.displacement.lengthSq() > 0) {
      player.move(this.displacement);
      clampPositionToRoleZone(player.group.position, this.team, player.role);
    }

    this.isTurning = hasTurnInput;
    this.targetFacingAngle = radiansToDegrees(playerYaw);
    this.currentFacingAngle = radiansToDegrees(player.getFacingAngle());
    player.setMovementState(this.getMovementState(sprinting));

    this.updateStamina(player, sprinting, delta);

    if (this.hasPossession()) {
      this.selectedPassTargetInfo = this.passingTargets.selectNormalTarget(player);
      this.selectedThroughPassTargetInfo = this.passingTargets.selectThroughTarget(player);
      this.selectedPassTarget = this.selectedPassTargetInfo?.player;
      this.selectedPassTargetScore = this.selectedPassTargetInfo?.score ?? 0;
    } else {
      this.selectedPassTargetInfo = undefined;
      this.selectedThroughPassTargetInfo = undefined;
      this.selectedPassTarget = undefined;
      this.selectedPassTargetScore = 0;
    }

    if (this.input.isShootDown()) {
      this.shotCharge = Math.min(1, this.shotCharge + GAMEPLAY.shotChargeRate * delta);
    }

    if (this.input.wasShootReleased()) {
      this.shoot(player);
      this.shotCharge = 0;
    }

    if (this.input.wasPassPressed()) {
      this.pass(player);
    }

    if (this.input.wasThroughPassPressed()) {
      this.throughPass(player);
    }

    if (this.input.wasCallForPassPressed()) {
      this.callForPass(player);
    }

    this.nudgeBallWhileDribbling(player, velocity, sprinting);
    this.dribbleCooldown = Math.max(0, this.dribbleCooldown - delta);
    this.callForPassTimer = Math.max(0, this.callForPassTimer - delta);
  }

  getControlledStamina(): number {
    return this.getStamina(this.getControlledPlayer());
  }

  getShotCharge(): number {
    return this.shotCharge;
  }

  getSelectedPassTargetDebug(): string {
    if (!this.selectedPassTargetInfo) {
      return 'none';
    }

    return `#${this.selectedPassTargetInfo.player.number} ${this.selectedPassTargetInfo.player.role} (${this.selectedPassTargetInfo.score.toFixed(1)})`;
  }

  getSelectedThroughPassTargetDebug(): string {
    if (!this.selectedThroughPassTargetInfo) {
      return 'none';
    }

    return `#${this.selectedThroughPassTargetInfo.player.number} ${this.selectedThroughPassTargetInfo.player.role} (${this.selectedThroughPassTargetInfo.score.toFixed(1)})`;
  }

  getSelectedPassTargetPosition(target = new Vector3()): Vector3 | undefined {
    if (!this.selectedPassTargetInfo) {
      return undefined;
    }

    return target.copy(this.selectedPassTargetInfo.targetPosition);
  }

  getCallForPassMessage(): string {
    return this.callForPassTimer > 0 ? this.callForPassMessage : '';
  }

  getMovementDebugLines(): string[] {
    return [
      `Input dir: ${this.inputDebug.x.toFixed(2)}, ${this.inputDebug.y.toFixed(2)}`,
      `Turn/throttle: ${this.turnInput.toFixed(2)}, ${this.throttleInput.toFixed(2)}`,
      `Move dir: ${this.debugMovementDirection.x.toFixed(2)}, ${this.debugMovementDirection.z.toFixed(2)}`,
      `Move speed: ${this.currentSpeed.toFixed(2)}`,
      `Target facing: ${this.targetFacingAngle.toFixed(0)}deg`,
      `Current facing: ${this.currentFacingAngle.toFixed(0)}deg`,
      `Turn speed: ${PLAYER_TURN_SPEED.toFixed(0)} deg/s`,
      `Move state: ${this.getControlledPlayer().movementState}`,
      `Traits: ${this.getControlledPlayer().personality} | ${this.getControlledPlayer().getTopTraitsLabel()}`,
    ];
  }

  hasPossession(): boolean {
    return this.possession.isPlayerInPossession(this.getControlledPlayer());
  }

  private shoot(player: Player): void {
    if (!this.canUseBall(player, GAMEPLAY.possessionDistance + 0.45)) {
      return;
    }

    const charge = Math.max(GAMEPLAY.quickShotCharge, this.shotCharge);
    const shootingBoost = 0.88 + player.traits.shooting * 0.28;
    const power =
      (GAMEPLAY.shotPower +
        (GAMEPLAY.maxShotPower - GAMEPLAY.shotPower) * Math.pow(charge, 1.12)) *
      shootingBoost;
    const lift =
      charge < 0.24
        ? GAMEPLAY.shotLift * 0.35
        : GAMEPLAY.shotLift + (GAMEPLAY.maxShotLift - GAMEPLAY.shotLift) * charge;

    // Shots are intentionally straight: the player shoots down their current
    // facing vector, so the keeper only stops it by physically getting in line.
    this.shotDirection.copy(player.facing);
    this.ball.getPosition(this.ballPosition);

    this.ball.applyImpulseCapped(
      this.shotDirection,
      power,
      lift,
      GAMEPLAY.maxShotSpeed,
    );
    this.onShot({ power, charge, position: this.ballPosition.clone() });
    this.possession.forceLoose('shot released', 180);
    soundHooks.onKick();
  }

  private pass(player: Player): void {
    if (!this.canUseBall(player, GAMEPLAY.possessionDistance + 0.3)) {
      return;
    }

    const targetInfo =
      this.selectedPassTargetInfo ?? this.passingTargets.selectNormalTarget(player);

    if (!targetInfo) {
      this.ball.applyImpulseCapped(
        player.facing,
        GAMEPLAY.passPower,
        GAMEPLAY.passLift * 0.35,
        GAMEPLAY.maxPassSpeed * 0.82,
      );
      this.possession.forceLoose('clear pass', 160);
      soundHooks.onPass();
      this.setCallForPassMessage('Driven pass');
      return;
    }

    const target = targetInfo.player;
    this.leadTarget.copy(targetInfo.targetPosition);
    this.ball.getPosition(this.ballPosition);
    this.ballPosition.y = 0;
    const laneScore = this.getPassingLaneScore(this.ballPosition, this.leadTarget);
    const direction = this.leadTarget.sub(this.ballPosition);
    direction.y = 0;
    const distance = Math.min(55, Math.max(6, direction.length()));
    const offside = getOffsideViolation(
      this.team,
      this.opponentTeam,
      player,
      target,
      this.ballPosition,
    );
    if (offside) {
      this.onOffside(offside.restartPosition, offside.reason, this.opponentTeam.color);
      this.setCallForPassMessage('Offside');
      return;
    }
    const distanceT = (distance - 6) / 49;
    const pressureBoost = laneScore < -1 ? Math.min(1.18, 1.04 + Math.abs(laneScore) * 0.025) : 1;
    const power =
      (GAMEPLAY.passPower +
        (GAMEPLAY.maxPassPower - GAMEPLAY.passPower) * Math.pow(distanceT, 0.85)) *
      (0.98 + player.traits.passing * 0.18 + player.traits.teamwork * 0.06) *
      pressureBoost;
    this.ball.applyImpulseCapped(
      direction,
      power,
      GAMEPLAY.passLift,
      GAMEPLAY.maxPassSpeed,
    );
    this.possession.forceLoose('pass released', 180);
    soundHooks.onPass();
    this.setCallForPassMessage(`Pass to #${target.number}`);
  }

  private throughPass(player: Player): void {
    if (!this.canUseBall(player, GAMEPLAY.possessionDistance + 0.3)) {
      return;
    }

    const targetInfo =
      this.selectedThroughPassTargetInfo ??
      this.passingTargets.selectThroughTarget(player) ??
      this.passingTargets.selectNormalTarget(player);

    if (!targetInfo) {
      this.ball.applyImpulseCapped(
        player.facing,
        GAMEPLAY.maxPassPower,
        GAMEPLAY.passLift * 0.55,
        GAMEPLAY.maxPassSpeed,
      );
      this.possession.forceLoose('through clearance', 180);
      soundHooks.onPass();
      this.setCallForPassMessage('Through ball');
      return;
    }

    const target = targetInfo.player;
    this.leadTarget.copy(targetInfo.targetPosition);
    this.ball.getPosition(this.ballPosition);
    this.ballPosition.y = 0;
    const laneScore = this.getPassingLaneScore(this.ballPosition, this.leadTarget);
    const direction = this.leadTarget.sub(this.ballPosition);
    direction.y = 0;
    const distance = Math.min(68, Math.max(9, direction.length()));
    const offside = getOffsideViolation(
      this.team,
      this.opponentTeam,
      player,
      target,
      this.ballPosition,
    );
    if (offside) {
      this.onOffside(offside.restartPosition, offside.reason, this.opponentTeam.color);
      this.setCallForPassMessage('Offside');
      return;
    }
    const distanceT = (distance - 9) / 59;
    const laneBoost = laneScore < -1 ? Math.min(1.2, 1.05 + Math.abs(laneScore) * 0.028) : 1;
    const power =
      (GAMEPLAY.maxPassPower * 0.9 +
        (GAMEPLAY.calledPassMaxPower - GAMEPLAY.maxPassPower * 0.9) * Math.pow(distanceT, 0.82)) *
      (0.98 + player.traits.passing * 0.18 + player.traits.creativity * 0.08) *
      laneBoost;
    this.ball.applyImpulseCapped(
      direction,
      power,
      GAMEPLAY.passLift * 0.65,
      GAMEPLAY.calledPassMaxSpeed,
    );
    this.possession.forceLoose('through pass released', 220);
    soundHooks.onPass();
    this.setCallForPassMessage(`Through to #${target.number}`);
  }

  private callForPass(player: Player): void {
    if (this.possession.isPlayerInPossession(player)) {
      this.setCallForPassMessage('You have the ball');
      return;
    }

    const state = this.possession.getState();
    if (state.team && state.team !== this.team) {
      this.setCallForPassMessage('No pass available');
      return;
    }

    const passer = this.findBestCallForPassSource(player);
    if (!passer) {
      this.setCallForPassMessage('No pass available');
      return;
    }

    player.getPosition(this.leadTarget);
    this.leadTarget
      .addScaledVector(player.facing, PLAYER.sprintSpeed * GAMEPLAY.passLeadSeconds * 0.85)
      .addScaledVector(this.team.attackingDirection, 2.8);
    clampPositionToRoleZone(this.leadTarget, this.team, player.role);

    passer.getPosition(this.playerPosition);
    this.playerPosition.y = 0;
    const laneScore = this.getPassingLaneScore(this.playerPosition, this.leadTarget);
    if (laneScore < -3.25) {
      this.setCallForPassMessage('Passing lane blocked');
      return;
    }

    this.ball.getPosition(this.ballPosition);
    this.ballPosition.y = 0;
    const direction = this.leadTarget.sub(this.ballPosition);
    direction.y = 0;
    const distance = Math.min(68, Math.max(8, direction.length()));
    const offside = getOffsideViolation(
      this.team,
      this.opponentTeam,
      passer,
      player,
      this.ballPosition,
    );
    if (offside) {
      this.onOffside(offside.restartPosition, offside.reason, this.opponentTeam.color);
      this.setCallForPassMessage('Offside');
      return;
    }
    const distanceT = (distance - 8) / 60;
    const laneBoost = laneScore < -1 ? Math.min(1.18, 1.05 + Math.abs(laneScore) * 0.025) : 1;
    const power =
      (GAMEPLAY.calledPassMinPower +
        (GAMEPLAY.calledPassMaxPower - GAMEPLAY.calledPassMinPower) * Math.pow(distanceT, 0.82)) *
      (1 + passer.traits.passing * 0.18 + passer.traits.teamwork * 0.1) *
      laneBoost;
    this.ball.applyImpulseCapped(
      direction,
      power,
      GAMEPLAY.passLift * 0.65,
      GAMEPLAY.calledPassMaxSpeed,
    );
    this.possession.forceLoose('called pass', 520);
    soundHooks.onPass();
    this.setCallForPassMessage(`${passer.displayName} played you in`);
  }

  private nudgeBallWhileDribbling(
    player: Player,
    velocity: Vector3,
    sprinting: boolean,
  ): void {
    if (this.dribbleCooldown > 0 || !this.possession.isPlayerInPossession(player)) {
      return;
    }

    player.getPosition(this.playerPosition);
    this.playerPosition.y = 0;
    this.ball.getPosition(this.ballPosition);
    this.ballPosition.y = 0;

    const direction = this.movement.copy(player.facing);
    this.targetPosition
      .copy(this.playerPosition)
      .addScaledVector(direction, GAMEPLAY.dribbleIdealDistance);

    const toIdeal = this.targetPosition.sub(this.ballPosition);
    toIdeal.y = 0;
    const distance = toIdeal.length();

    if (distance < 0.08) {
      return;
    }

    const sprintMultiplier = sprinting ? GAMEPLAY.dribbleSprintMultiplier : 1;
    const impulse =
      (GAMEPLAY.dribblePullPower +
        Math.min(1.25, distance) * GAMEPLAY.dribbleNudgePower) *
      sprintMultiplier;
    const dribbleMaxSpeed = Math.min(BALL.maxSpeed, sprinting ? 13.5 : 10.5);
    this.ball.applyImpulseCapped(toIdeal, impulse, 0, dribbleMaxSpeed);
    this.dribbleCooldown = GAMEPLAY.dribbleCooldown;
  }

  private findBestPassTarget(player: Player): Player | undefined {
    let bestTarget: Player | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;
    player.getPosition(this.playerPosition);
    this.playerPosition.y = 0;

    for (const teammate of this.team.players) {
      if (teammate === player || teammate.role === 'goalkeeper') {
        continue;
      }

      this.computeLeadTarget(teammate, this.targetPosition);
      this.toTarget.copy(this.targetPosition).sub(this.playerPosition);
      this.toTarget.y = 0;
      const distance = this.toTarget.length();

      if (distance < 2.75 || distance > 46) {
        continue;
      }

      const direction = this.toTarget.normalize();
      const forwardScore = direction.dot(player.facing) * 2.4;
      const teamProgressScore = direction.dot(this.team.attackingDirection) * 1.4;
      const progressScore =
        (teammate.group.position.z - player.group.position.z) *
        this.team.attackingDirection.z *
        0.16;
      const laneScore = this.getPassingLaneScore(
        this.playerPosition,
        this.targetPosition,
      );
      const markingPenalty = this.getMarkingPenalty(teammate);
      const spacingScore = this.getSpacingScore(teammate);
      const distanceScore = -Math.abs(distance - 14) * 0.07;
      const score =
        forwardScore +
        teamProgressScore +
        progressScore +
        laneScore +
        spacingScore +
        distanceScore -
        markingPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = teammate;
      }
    }

    this.selectedPassTargetScore = Number.isFinite(bestScore) ? bestScore : 0;
    return bestTarget;
  }

  private findNearestPassTarget(player: Player): Player | undefined {
    let nearestTarget: Player | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    player.getPosition(this.playerPosition);
    this.playerPosition.y = 0;

    for (const teammate of this.team.players) {
      if (teammate === player || teammate.role === 'goalkeeper') {
        continue;
      }

      teammate.getPosition(this.targetPosition);
      this.targetPosition.y = 0;
      const distance = this.playerPosition.distanceTo(this.targetPosition);

      if (distance < 2.5 || distance > 62 || distance >= nearestDistance) {
        continue;
      }

      nearestDistance = distance;
      nearestTarget = teammate;
    }

    this.selectedPassTargetScore = Number.isFinite(nearestDistance) ? nearestDistance : 0;
    return nearestTarget;
  }

  private getPassingLaneScore(start: Vector3, end: Vector3): number {
    this.passStart.copy(start);
    this.passEnd.copy(end);
    this.passSegment.copy(this.passEnd).sub(this.passStart);
    const lengthSquared = this.passSegment.lengthSq();

    if (lengthSquared === 0) {
      return -4;
    }

    let penalty = 0;
    for (const opponent of this.opponentTeam.players) {
      opponent.getPosition(this.lanePosition);
      this.lanePosition.y = 0;
      const projection = Math.max(
        0,
        Math.min(
          1,
          this.closestPoint.copy(this.lanePosition).sub(this.passStart).dot(this.passSegment) /
            lengthSquared,
        ),
      );
      this.closestPoint
        .copy(this.passStart)
        .addScaledVector(this.passSegment, projection);
      const distance = this.closestPoint.distanceTo(this.lanePosition);

      if (distance < 2.4) {
        penalty += 2.4 - distance;
      }
    }

    return -penalty * 1.05;
  }

  private getMarkingPenalty(teammate: Player): number {
    teammate.getPosition(this.targetPosition);
    this.targetPosition.y = 0;
    let closestOpponentDistance = Number.POSITIVE_INFINITY;

    for (const opponent of this.opponentTeam.players) {
      opponent.getPosition(this.lanePosition);
      this.lanePosition.y = 0;
      const distance = this.lanePosition.distanceTo(this.targetPosition);
      closestOpponentDistance = Math.min(closestOpponentDistance, distance);
    }

    if (closestOpponentDistance >= GAMEPLAY.markedDistance) {
      return 0;
    }

    return (GAMEPLAY.markedDistance - closestOpponentDistance) * 0.75;
  }

  private getSpacingScore(teammate: Player): number {
    teammate.getPosition(this.targetPosition);
    this.targetPosition.y = 0;
    let score = 0;

    for (const other of this.team.players) {
      if (other === teammate) {
        continue;
      }

      other.getPosition(this.lanePosition);
      this.lanePosition.y = 0;
      const distance = this.lanePosition.distanceTo(this.targetPosition);
      if (distance < 2.8) {
        score -= (2.8 - distance) * 0.45;
      }
    }

    return score;
  }

  private computeLeadTarget(teammate: Player, target: Vector3): Vector3 {
    teammate.getPosition(target);
    target.y = 0;
    target
      .addScaledVector(teammate.facing, PLAYER.aiSpeed * GAMEPLAY.passLeadSeconds)
      .addScaledVector(this.team.attackingDirection, 2.2 * GAMEPLAY.passLeadSeconds);
    this.clampTargetToPitch(target);
    clampPositionToRoleZone(target, this.team, teammate.role);
    return target;
  }

  private computeThroughTarget(teammate: Player, target: Vector3): Vector3 {
    teammate.getPosition(target);
    target.y = 0;
    target
      .addScaledVector(this.team.attackingDirection, 7.5 + teammate.traits.speed * 5.5)
      .addScaledVector(teammate.facing, PLAYER.aiSpeed * GAMEPLAY.passLeadSeconds * 0.75);
    this.clampTargetToPitch(target);
    clampPositionToRoleZone(target, this.team, teammate.role);
    return target;
  }

  private findBestCallForPassSource(striker: Player): Player | undefined {
    let bestPlayer: Player | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;
    this.ball.getPosition(this.ballPosition);
    this.ballPosition.y = 0;
    const state = this.possession.getState();

    for (const teammate of this.team.players) {
      if (teammate === striker) {
        continue;
      }

      teammate.getPosition(this.playerPosition);
      this.playerPosition.y = 0;
      const distanceToBall = this.playerPosition.distanceTo(this.ballPosition);
      const canPass =
        state.owner === teammate ||
        (!state.owner && distanceToBall <= GAMEPLAY.possessionDistance * 1.25);

      if (!canPass) {
        continue;
      }

      striker.getPosition(this.targetPosition);
      this.targetPosition.y = 0;
      const distanceToStriker = this.playerPosition.distanceTo(this.targetPosition);
      const forwardProgress =
        (this.targetPosition.z - this.playerPosition.z) * this.team.attackingDirection.z;
      const laneScore = this.getPassingLaneScore(this.playerPosition, this.targetPosition);
      const ownerBonus = state.owner === teammate ? 8 : 0;
      const facingBonus = teammate.facing.dot(striker.facing) > -0.2 ? 0.7 : 0;
      const score =
        ownerBonus +
        facingBonus +
        forwardProgress * 0.24 -
        distanceToStriker * 0.055 +
        laneScore;

      if (score > bestScore) {
        bestScore = score;
        bestPlayer = teammate;
      }
    }

    return bestPlayer;
  }

  private setCallForPassMessage(message: string): void {
    this.callForPassMessage = message;
    this.callForPassTimer = 1.4;
  }

  private getPressureAmount(player: Player): number {
    player.getPosition(this.playerPosition);
    this.playerPosition.y = 0;
    let closestOpponentDistance = Number.POSITIVE_INFINITY;

    for (const opponent of this.opponentTeam.players) {
      opponent.getPosition(this.lanePosition);
      this.lanePosition.y = 0;
      closestOpponentDistance = Math.min(
        closestOpponentDistance,
        this.lanePosition.distanceTo(this.playerPosition),
      );
    }

    const pressureRange = GAMEPLAY.markedDistance - 1.1;
    return Math.max(
      0,
      Math.min(1, 1 - (closestOpponentDistance - 1.1) / pressureRange),
    );
  }

  private canUseBall(player: Player, range: number): boolean {
    if (this.possession.isPlayerInPossession(player)) {
      return true;
    }

    const state = this.possession.getState();
    if (state.owner && state.owner !== player) {
      return false;
    }

    player.getPosition(this.playerPosition);
    this.playerPosition.y = 0;
    this.ball.getPosition(this.ballPosition);
    this.ballPosition.y = 0;

    if (this.playerPosition.distanceTo(this.ballPosition) > range) {
      return false;
    }

    this.possession.forceOwner(player, this.team, 180, 'quick ball action');
    return true;
  }

  private getStamina(player: Player): number {
    return this.staminaByPlayer.get(player.id) ?? PLAYER.maxStamina;
  }

  private getVelocity(player: Player): Vector3 {
    let velocity = this.velocityByPlayer.get(player.id);
    if (!velocity) {
      velocity = new Vector3();
      this.velocityByPlayer.set(player.id, velocity);
    }
    return velocity;
  }

  private updateStamina(player: Player, sprinting: boolean, delta: number): void {
    const current = this.getStamina(player);
    const next = sprinting
      ? current - (PLAYER.staminaDrainPerSecond / player.staminaModifier) * delta
      : current + PLAYER.staminaRegenPerSecond * player.staminaModifier * delta;
    this.staminaByPlayer.set(player.id, Math.max(0, Math.min(PLAYER.maxStamina, next)));
  }

  private getPlayerYaw(player: Player): number {
    let yaw = this.yawByPlayer.get(player.id);
    if (yaw === undefined) {
      yaw = player.getFacingAngle();
      this.yawByPlayer.set(player.id, yaw);
    }
    return yaw;
  }

  private getMovementState(sprinting: boolean): 'idle' | 'walk' | 'run' | 'sprint' | 'turning' {
    if (this.currentSpeed < 0.08) {
      return this.isTurning ? 'turning' : 'idle';
    }

    if (sprinting) {
      return 'sprint';
    }

    return this.currentSpeed > PLAYER_MAX_SPEED * 0.64 ? 'run' : 'walk';
  }

  private clampTargetToPitch(target: Vector3): void {
    const maxX = PITCH.width / 2 - PLAYER.boundsPadding;
    const maxZ = PITCH.length / 2 - PLAYER.boundsPadding;
    target.x = Math.max(-maxX, Math.min(maxX, target.x));
    target.y = 0;
    target.z = Math.max(-maxZ, Math.min(maxZ, target.z));
  }
}

function directionToDegrees(direction: Vector3): number {
  return radiansToDegrees(Math.atan2(-direction.x, -direction.z));
}

function radiansToDegrees(radians: number): number {
  return normalizeDegrees((radians * 180) / Math.PI);
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeDegrees(degrees: number): number {
  let value = degrees;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}
