import { Vector3 } from 'three';
import type { Player } from '../entities/Player';
import type { Team } from '../entities/Team';
import { GAMEPLAY, PLAYER, PITCH } from '../game/constants';
import { clampPositionToRoleZone } from './RoleZones';

export interface PassTargetInfo {
  player: Player;
  targetPosition: Vector3;
  score: number;
  distance: number;
}

const ROLE_PASS_WEIGHT: Record<string, number> = {
  attackingMid: 1.2,
  centralMid: 0.9,
  defensiveMid: 0.5,
  leftWing: 1.1,
  rightWing: 1.1,
  striker: 1.35,
  leftBack: 0.2,
  rightBack: 0.2,
  centerBackLeft: -0.1,
  centerBackRight: -0.1,
};

export class PassingTargetSystem {
  private readonly playerPosition = new Vector3();
  private readonly teammatePosition = new Vector3();
  private readonly targetPosition = new Vector3();
  private readonly lanePosition = new Vector3();
  private readonly passStart = new Vector3();
  private readonly passEnd = new Vector3();
  private readonly passSegment = new Vector3();
  private readonly closestPoint = new Vector3();

  constructor(
    private readonly team: Team,
    private readonly opponentTeam: Team,
  ) {}

  selectNormalTarget(player: Player): PassTargetInfo | undefined {
    let bestTarget: PassTargetInfo | undefined;
    player.getPosition(this.playerPosition);
    this.playerPosition.y = 0;

    for (const teammate of this.team.players) {
      if (teammate === player || teammate.role === 'goalkeeper') {
        continue;
      }

      teammate.getPosition(this.teammatePosition);
      this.teammatePosition.y = 0;
      const distance = this.playerPosition.distanceTo(this.teammatePosition);
      if (distance < 2.5 || distance > 62) {
        continue;
      }

      this.targetPosition.copy(this.teammatePosition);
      const direction = this.targetPosition.clone().sub(this.playerPosition).normalize();
      const laneScore = this.getPassingLaneScore(this.playerPosition, this.targetPosition);
      const forwardScore = direction.dot(this.team.attackingDirection) * 0.9;
      const facingScore = direction.dot(player.facing) * 0.75;
      const markingPenalty = this.getMarkingPenalty(teammate);
      const roleScore = (ROLE_PASS_WEIGHT[teammate.role] ?? 0) * 0.45;
      const distanceScore = -distance * 0.32;
      const viableLanePenalty = laneScore < -2.6 ? laneScore * 0.75 : 0;
      const score =
        distanceScore +
        laneScore * 0.85 +
        forwardScore +
        facingScore +
        roleScore -
        markingPenalty * 0.82 +
        viableLanePenalty;

      if (!bestTarget || score > bestTarget.score) {
        bestTarget = {
          player: teammate,
          targetPosition: this.targetPosition.clone(),
          score,
          distance,
        };
      }
    }

    return bestTarget;
  }

  selectThroughTarget(player: Player): PassTargetInfo | undefined {
    let bestTarget: PassTargetInfo | undefined;
    player.getPosition(this.playerPosition);
    this.playerPosition.y = 0;

    for (const teammate of this.team.players) {
      if (teammate === player || teammate.role === 'goalkeeper') {
        continue;
      }

      const target = this.computeThroughTarget(teammate, new Vector3());
      const distance = this.playerPosition.distanceTo(target);
      if (distance < 6 || distance > 70) {
        continue;
      }

      const direction = target.clone().sub(this.playerPosition).normalize();
      const laneScore = this.getPassingLaneScore(this.playerPosition, target);
      const forwardProgress =
        (target.z - this.playerPosition.z) * this.team.attackingDirection.z;
      const widthScore = Math.min(2.2, Math.abs(target.x) / (PITCH.width * 0.18));
      const roleScore = ROLE_PASS_WEIGHT[teammate.role] ?? 0;
      const score =
        laneScore +
        forwardProgress * 0.11 +
        direction.dot(player.facing) * 1.2 +
        teammate.traits.speed * 1.2 +
        teammate.traits.positioning * 1.1 +
        widthScore +
        roleScore -
        distance * 0.055 -
        this.getMarkingPenalty(teammate) * 0.8;

      if (!bestTarget || score > bestTarget.score) {
        bestTarget = { player: teammate, targetPosition: target, score, distance };
      }
    }

    return bestTarget;
  }

  computeThroughTarget(teammate: Player, target: Vector3): Vector3 {
    teammate.getPosition(target);
    target.y = 0;
    target
      .addScaledVector(this.team.attackingDirection, 8.5 + teammate.traits.speed * 6.5)
      .addScaledVector(teammate.facing, PLAYER.aiSpeed * GAMEPLAY.passLeadSeconds * 0.9);
    this.clampTargetToPitch(target);
    clampPositionToRoleZone(target, this.team, teammate.role);
    return target;
  }

  getPassingLaneScore(start: Vector3, end: Vector3): number {
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
      closestOpponentDistance = Math.min(
        closestOpponentDistance,
        this.lanePosition.distanceTo(this.targetPosition),
      );
    }

    if (closestOpponentDistance >= GAMEPLAY.markedDistance) {
      return 0;
    }

    return (GAMEPLAY.markedDistance - closestOpponentDistance) * 0.75;
  }

  private clampTargetToPitch(target: Vector3): void {
    const maxX = PITCH.width / 2 - PLAYER.boundsPadding;
    const maxZ = PITCH.length / 2 - PLAYER.boundsPadding;
    target.x = Math.max(-maxX, Math.min(maxX, target.x));
    target.y = 0;
    target.z = Math.max(-maxZ, Math.min(maxZ, target.z));
  }
}
