import { Vector3 } from 'three';
import type { GameInput } from '../controls/GameInput';
import { Ball } from '../entities/Ball';
import { Player } from '../entities/Player';
import type { Team } from '../entities/Team';
import {
  GAMEPLAY,
  LOOSE_BALL_RECLAIM_DELAY_MS,
  PLAYER,
  TACKLE_COOLDOWN_MS,
  TACKLE_RANGE,
  TACKLE_SUCCESS_CHANCE,
} from '../game/constants';
import { soundHooks } from '../game/soundHooks';
import { PossessionSystem } from './PossessionSystem';

export interface TackleDebugState {
  lastResult: string;
  controlledCooldownSeconds: number;
}

export class TackleSystem {
  private readonly tacklerPosition = new Vector3();
  private readonly ownerPosition = new Vector3();
  private readonly ballPosition = new Vector3();
  private readonly tackleDirection = new Vector3();
  private readonly cooldowns = new Map<string, number>();
  private readonly previousPositions = new Map<string, Vector3>();
  private lastResult = 'none';

  constructor(
    private readonly input: GameInput,
    private readonly ball: Ball,
    private readonly possession: PossessionSystem,
    private readonly getControlledPlayer: () => Player,
  ) {}

  update(teams: Team[], delta: number): void {
    this.tickCooldowns(delta);
    const state = this.possession.getState();

    if (this.input.wasTacklePressed()) {
      this.tryControlledTackle(teams, state.owner, state.team);
    }

    this.tryAITackles(teams, state.owner, state.team, delta);
    this.capturePreviousPositions(teams);
  }

  getDebugState(): TackleDebugState {
    return {
      lastResult: this.lastResult,
      controlledCooldownSeconds: this.cooldowns.get(this.getControlledPlayer().id) ?? 0,
    };
  }

  getDebugLines(): string[] {
    const debug = this.getDebugState();
    return [
      `Tackle cooldown: ${debug.controlledCooldownSeconds.toFixed(2)}s`,
      `Last tackle: ${debug.lastResult}`,
    ];
  }

  private tryControlledTackle(
    teams: Team[],
    owner?: Player,
    ownerTeam?: Team,
  ): void {
    const tackler = this.getControlledPlayer();
    const tacklerTeam = teams.find((team) => team.players.includes(tackler));
    if (!tacklerTeam || !owner || !ownerTeam || ownerTeam === tacklerTeam) {
      this.lastResult = 'No tackle target';
      return;
    }

    this.attemptTackle(tackler, tacklerTeam, owner, ownerTeam, true);
  }

  private tryAITackles(
    teams: Team[],
    owner: Player | undefined,
    ownerTeam: Team | undefined,
    delta: number,
  ): void {
    if (!owner || !ownerTeam) {
      return;
    }

    for (const team of teams) {
      if (team === ownerTeam) {
        continue;
      }

      for (const tackler of team.players) {
        if (tackler === this.getControlledPlayer()) {
          continue;
        }

        if (!this.shouldAIAttempt(tackler, delta)) {
          continue;
        }

        this.attemptTackle(tackler, team, owner, ownerTeam, false);
      }
    }
  }

  private shouldAIAttempt(tackler: Player, delta: number): boolean {
    if ((this.cooldowns.get(tackler.id) ?? 0) > 0) {
      return false;
    }

    const attemptRate =
      0.12 +
      tackler.traits.aggression * 0.72 +
      tackler.traits.defending * 0.28 -
      tackler.traits.discipline * (this.isDefensiveRole(tackler) ? 0.08 : 0.22);

    if (!this.isDefensiveRole(tackler) && Math.random() > delta * attemptRate) {
      return false;
    }

    if (this.isDefensiveRole(tackler) && Math.random() > delta * (attemptRate + 0.18)) {
      return false;
    }

    return true;
  }

  private attemptTackle(
    tackler: Player,
    tacklerTeam: Team,
    owner: Player,
    ownerTeam: Team,
    manual: boolean,
  ): void {
    if (ownerTeam === tacklerTeam || owner === tackler) {
      return;
    }

    if ((this.cooldowns.get(tackler.id) ?? 0) > 0) {
      if (manual) {
        this.lastResult = 'Tackle cooling down';
      }
      return;
    }

    tackler.getPosition(this.tacklerPosition);
    owner.getPosition(this.ownerPosition);
    this.ball.getPosition(this.ballPosition);
    this.tacklerPosition.y = 0;
    this.ownerPosition.y = 0;
    this.ballPosition.y = 0;

    const distanceToOwner = this.tacklerPosition.distanceTo(this.ownerPosition);
    const distanceToBall = this.tacklerPosition.distanceTo(this.ballPosition);
    const tackleDistance = Math.min(distanceToOwner, distanceToBall);
    if (tackleDistance > TACKLE_RANGE) {
      if (manual) {
        this.lastResult = 'Too far to tackle';
      }
      return;
    }

    this.tackleDirection.copy(this.ownerPosition).sub(this.tacklerPosition);
    if (this.tackleDirection.lengthSq() < 0.001) {
      this.tackleDirection.copy(this.ballPosition).sub(this.tacklerPosition);
    }
    this.tackleDirection.y = 0;
    this.tackleDirection.normalize();

    const facingDot = tackler.facing.dot(this.tackleDirection);
    if (facingDot < 0.1) {
      if (manual) {
        this.lastResult = 'Not facing tackle';
      }
      return;
    }

    const tacklerSpeed = this.getEstimatedSpeed(tackler);
    const distanceBonus = Math.max(0, (TACKLE_RANGE - tackleDistance) / TACKLE_RANGE) * 0.18;
    const facingBonus = Math.max(0, facingDot) * 0.16;
    const speedBonus = Math.min(0.12, tacklerSpeed / PLAYER.sprintSpeed * 0.12);
    const roleBonus = this.isDefensiveRole(tackler) ? 0.08 : 0;
    const traitBonus =
      tackler.traits.defending * 0.14 +
      tackler.traits.aggression * 0.08 +
      tackler.traits.composure * 0.06 -
      tackler.traits.riskTaking * 0.04;
    const chance = Math.max(
      0.12,
      Math.min(
        0.92,
        TACKLE_SUCCESS_CHANCE +
          distanceBonus +
          facingBonus +
          speedBonus +
          roleBonus +
          traitBonus -
          0.2,
      ),
    );
    const success = Math.random() < chance;
    this.cooldowns.set(tackler.id, TACKLE_COOLDOWN_MS / 1000);

    if (!success) {
      this.lastResult = `${tackler.displayName} missed (${Math.round(chance * 100)}%)`;
      return;
    }

    this.tackleDirection.copy(tackler.facing);
    this.ball.applyImpulseCapped(
      this.tackleDirection,
      GAMEPLAY.minPassPower * 0.42,
      0.04,
      GAMEPLAY.maxPassSpeed * 0.45,
    );
    this.possession.forceLoose(
      `tackle by ${tackler.displayName}`,
      LOOSE_BALL_RECLAIM_DELAY_MS,
    );
    soundHooks.onTackle();
    this.lastResult = `${tackler.displayName} won tackle`;
  }

  private getEstimatedSpeed(player: Player): number {
    const previous = this.previousPositions.get(player.id);
    if (!previous) {
      return 0;
    }

    player.getPosition(this.tacklerPosition);
    this.tacklerPosition.y = 0;
    return this.tacklerPosition.distanceTo(previous) * 60;
  }

  private capturePreviousPositions(teams: Team[]): void {
    for (const team of teams) {
      for (const player of team.players) {
        let position = this.previousPositions.get(player.id);
        if (!position) {
          position = new Vector3();
          this.previousPositions.set(player.id, position);
        }
        player.getPosition(position);
        position.y = 0;
      }
    }
  }

  private tickCooldowns(delta: number): void {
    for (const [playerId, cooldown] of this.cooldowns) {
      const nextCooldown = Math.max(0, cooldown - delta);
      if (nextCooldown === 0) {
        this.cooldowns.delete(playerId);
      } else {
        this.cooldowns.set(playerId, nextCooldown);
      }
    }
  }

  private isDefensiveRole(player: Player): boolean {
    return (
      player.role === 'goalkeeper' ||
      player.role === 'leftBack' ||
      player.role === 'centerBackLeft' ||
      player.role === 'centerBackRight' ||
      player.role === 'rightBack' ||
      player.role === 'defensiveMid' ||
      player.role === 'centralMid'
    );
  }
}
