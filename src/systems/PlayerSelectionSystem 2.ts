import { Player } from '../entities/Player';

export class PlayerSelectionSystem {
  private readonly controlledPlayer: Player;

  constructor(players: Player[]) {
    this.controlledPlayer =
      players.find((player) => player.role === 'striker') ?? players[players.length - 1];

    for (const player of players) {
      player.setControlled(player === this.controlledPlayer);
    }
  }

  getControlledPlayer(): Player {
    return this.controlledPlayer;
  }

  update(): void {
    // Striker-only control: Q calls for a pass instead of switching players.
  }
}
