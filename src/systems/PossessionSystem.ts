import { Vector3 } from 'three';
import { Ball } from '../entities/Ball';
import { Player } from '../entities/Player';
import type { Team } from '../entities/Team';
import {
  BALL_CLAIM_RANGE,
  GAMEPLAY,
  KEEPER_CLAIM_RANGE,
  LOOSE_BALL_RECLAIM_DELAY_MS,
  POSSESSION_LOCK_MS,
  STRONG_COLLISION_LOOSE_BALL_THRESHOLD,
} from '../game/constants';

export interface PossessionState {
  owner?: Player;
  team?: Team;
  distance: number;
  contested: boolean;
}

export interface PossessionDebugState {
  ownerLabel: string;
  lockSeconds: number;
  looseSeconds: number;
  lastTransitionReason: string;
  contested: boolean;
}

export class PossessionSystem {
  private readonly ballPosition = new Vector3();
  private readonly playerPosition = new Vector3();
  private readonly opponentPosition = new Vector3();
  private readonly state: PossessionState = {
    distance: Number.POSITIVE_INFINITY,
    contested: false,
  };
  private lockTimer = 0;
  private looseReclaimTimer = LOOSE_BALL_RECLAIM_DELAY_MS / 1000;
  private lastTransitionReason = 'kickoff';
  private lastTouchTeam?: Team;

  constructor(private readonly ball: Ball) {}

  update(teams: Team[], delta: number): void {
    this.lockTimer = Math.max(0, this.lockTimer - delta);
    this.looseReclaimTimer = Math.max(0, this.looseReclaimTimer - delta);
    this.ball.getPosition(this.ballPosition);
    this.ballPosition.y = 0;

    if (this.state.owner && this.state.team) {
      this.state.owner.getPosition(this.playerPosition);
      this.playerPosition.y = 0;
      const ownerDistance = this.playerPosition.distanceTo(this.ballPosition);
      const controlRange =
        GAMEPLAY.possessionDistance + GAMEPLAY.possessionHysteresisDistance;

      this.state.distance = ownerDistance;
      this.state.contested = this.isOwnerContested(teams, this.state.owner, this.state.team);

      if (
        this.lockTimer === 0 &&
        ownerDistance > GAMEPLAY.controlledTouchDistance &&
        this.ball.getSpeed() > STRONG_COLLISION_LOOSE_BALL_THRESHOLD
      ) {
        this.forceLoose('heavy touch lost', LOOSE_BALL_RECLAIM_DELAY_MS);
        return;
      }

      if (ownerDistance <= controlRange || this.lockTimer > 0) {
        return;
      }

      this.forceLoose('carrier lost control', LOOSE_BALL_RECLAIM_DELAY_MS);
    }

    const closest = this.findClosestClaimant(teams);
    this.state.distance = closest.distance;
    this.state.contested = closest.contested;

    if (
      !closest.player ||
      !closest.team ||
      this.looseReclaimTimer > 0 ||
      closest.distance > this.getClaimRange(closest.player)
    ) {
      return;
    }

    this.forceOwner(closest.player, closest.team, POSSESSION_LOCK_MS, 'loose ball claim');
  }

  forceLoose(reason: string, delayMs = LOOSE_BALL_RECLAIM_DELAY_MS): void {
    this.state.owner = undefined;
    this.state.team = undefined;
    this.state.contested = false;
    this.lockTimer = 0;
    this.looseReclaimTimer = Math.max(0, delayMs / 1000);
    this.lastTransitionReason = reason;
  }

  forceOwner(
    owner: Player,
    team: Team,
    lockMs = POSSESSION_LOCK_MS,
    reason = 'forced owner',
  ): void {
    this.ball.getPosition(this.ballPosition);
    this.ballPosition.y = 0;
    owner.getPosition(this.playerPosition);
    this.playerPosition.y = 0;
    this.state.owner = owner;
    this.state.team = team;
    this.lastTouchTeam = team;
    this.state.distance = this.playerPosition.distanceTo(this.ballPosition);
    this.state.contested = false;
    this.lockTimer = Math.max(0, lockMs / 1000);
    this.looseReclaimTimer = 0;
    this.lastTransitionReason = reason;
  }

  getState(): PossessionState {
    return this.state;
  }

  getLastTouchTeam(): Team | undefined {
    return this.state.team ?? this.lastTouchTeam;
  }

  getDebugState(): PossessionDebugState {
    return {
      ownerLabel: this.getOwnerLabel(),
      lockSeconds: this.lockTimer,
      looseSeconds: this.looseReclaimTimer,
      lastTransitionReason: this.lastTransitionReason,
      contested: this.state.contested,
    };
  }

  isPlayerInPossession(player: Player): boolean {
    return this.state.owner === player;
  }

  isTeamInPossession(team: Team): boolean {
    return this.state.team === team && !!this.state.owner;
  }

  isLooseClaimBlocked(): boolean {
    return !this.state.owner && this.looseReclaimTimer > 0;
  }

  getTeamName(): string {
    return this.state.team?.name ?? 'Loose';
  }

  getOwnerLabel(): string {
    if (!this.state.owner || !this.state.team) {
      return this.looseReclaimTimer > 0 ? 'Loose locked' : 'Loose';
    }

    const contested = this.state.contested ? ' pressured' : '';
    return `${this.state.team.name} #${this.state.owner.number}${contested}`;
  }

  private findClosestClaimant(teams: Team[]): {
    player?: Player;
    team?: Team;
    distance: number;
    contested: boolean;
  } {
    let closestPlayer: Player | undefined;
    let closestTeam: Team | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;
    let secondTeam: Team | undefined;
    let secondDistance = Number.POSITIVE_INFINITY;

    for (const team of teams) {
      for (const player of team.players) {
        player.getPosition(this.playerPosition);
        this.playerPosition.y = 0;
        const distance = this.playerPosition.distanceTo(this.ballPosition);

        if (distance < closestDistance) {
          secondDistance = closestDistance;
          secondTeam = closestTeam;
          closestDistance = distance;
          closestPlayer = player;
          closestTeam = team;
        } else if (distance < secondDistance) {
          secondDistance = distance;
          secondTeam = team;
        }
      }
    }

    const contested =
      closestDistance <= GAMEPLAY.contestedDistance &&
      secondDistance <= GAMEPLAY.contestedDistance + 0.55 &&
      (secondTeam !== closestTeam || Math.abs(secondDistance - closestDistance) < 0.55);

    return { player: closestPlayer, team: closestTeam, distance: closestDistance, contested };
  }

  private isOwnerContested(teams: Team[], owner: Player, ownerTeam: Team): boolean {
    owner.getPosition(this.playerPosition);
    this.playerPosition.y = 0;

    for (const team of teams) {
      if (team === ownerTeam) {
        continue;
      }

      for (const player of team.players) {
        player.getPosition(this.opponentPosition);
        this.opponentPosition.y = 0;
        if (this.opponentPosition.distanceTo(this.playerPosition) <= GAMEPLAY.contestedDistance) {
          return true;
        }
      }
    }

    return false;
  }

  private getClaimRange(player: Player): number {
    return player.role === 'goalkeeper' ? KEEPER_CLAIM_RANGE : BALL_CLAIM_RANGE;
  }
}
