import type { GameInput } from '../controls/GameInput';
import type { Ball } from '../entities/Ball';
import { Player } from '../entities/Player';
import type { Team } from '../entities/Team';
import { Vector3 } from 'three';

export class PlayerSelectionSystem {
  private controlledIndex: number;
  private readonly ballPosition = new Vector3();
  private readonly playerPosition = new Vector3();

  constructor(
    private readonly players: Player[],
    private readonly input: GameInput,
    private readonly ball: Ball,
    private readonly team: Team,
  ) {
    this.controlledIndex = Math.max(
      0,
      players.findIndex((player) => player.role === 'striker'),
    );
    this.applyControlledPlayer();
  }

  getControlledPlayer(): Player {
    return this.players[this.controlledIndex] ?? this.players[0];
  }

  update(): void {
    if (this.input.wasSwitchPlayerPressed()) {
      this.controlledIndex = this.findSmartSwitchIndex();
      this.applyControlledPlayer();
    }
  }

  getControlledIndex(): number {
    return this.controlledIndex;
  }

  private findSmartSwitchIndex(): number {
    const currentPlayer = this.getControlledPlayer();
    this.ball.getPosition(this.ballPosition);
    this.ballPosition.y = 0;
    let bestIndex = this.controlledIndex;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = 0; index < this.players.length; index += 1) {
      const player = this.players[index];
      player.getPosition(this.playerPosition);
      this.playerPosition.y = 0;
      const distance = this.playerPosition.distanceTo(this.ballPosition);
      const ballAhead =
        (this.ballPosition.z - this.playerPosition.z) * this.team.attackingDirection.z;
      const playerAheadOfBall =
        (this.playerPosition.z - this.ballPosition.z) * this.team.attackingDirection.z;
      const rolePenalty = player.role === 'goalkeeper' ? 18 : 0;
      const currentPenalty = player === currentPlayer ? 4 : 0;
      const behindPenalty = ballAhead < -8 ? 5 : 0;
      const overrunPenalty = playerAheadOfBall > 22 ? 4 : 0;
      const reachBonus = player.traits.speed * -3.4;
      const score =
        distance +
        rolePenalty +
        currentPenalty +
        behindPenalty +
        overrunPenalty +
        reachBonus;

      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    return bestIndex;
  }

  private applyControlledPlayer(): void {
    const controlledPlayer = this.getControlledPlayer();
    for (const player of this.players) {
      player.setControlled(player === controlledPlayer);
    }
  }
}
