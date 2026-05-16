import { Vector3 } from 'three';
import type { Player } from '../entities/Player';
import type { Team } from '../entities/Team';
import { OFFSIDE } from '../game/constants';

const receiverPosition = new Vector3();
const defenderPosition = new Vector3();

export interface OffsideViolation {
  receiver: Player;
  restartPosition: Vector3;
  reason: string;
}

export function getOffsideViolation(
  attackingTeam: Team,
  defendingTeam: Team,
  passer: Player,
  receiver: Player,
  ballPosition: Vector3,
): OffsideViolation | undefined {
  if (!OFFSIDE.enabled || passer === receiver || receiver.role === 'goalkeeper') {
    return undefined;
  }

  receiver.getPosition(receiverPosition);
  receiverPosition.y = 0;
  const forwardPassDistance =
    (receiverPosition.z - ballPosition.z) * attackingTeam.attackingDirection.z;
  if (forwardPassDistance < OFFSIDE.minForwardPassDistance) {
    return undefined;
  }

  const progress =
    (receiverPosition.z - attackingTeam.ownGoalZ) /
    (attackingTeam.opponentGoalZ - attackingTeam.ownGoalZ);
  if (progress < OFFSIDE.attackingHalfProgress) {
    return undefined;
  }

  const secondLastDefenderLine = getSecondLastDefenderLine(defendingTeam, attackingTeam);
  const receiverGoalSide =
    (receiverPosition.z - secondLastDefenderLine) * attackingTeam.attackingDirection.z;
  const ballGoalSide = (receiverPosition.z - ballPosition.z) * attackingTeam.attackingDirection.z;

  if (receiverGoalSide <= OFFSIDE.tolerance || ballGoalSide <= OFFSIDE.tolerance) {
    return undefined;
  }

  return {
    receiver,
    restartPosition: receiverPosition.clone(),
    reason: `${receiver.displayName} offside`,
  };
}

function getSecondLastDefenderLine(defendingTeam: Team, attackingTeam: Team): number {
  const defenderZ = defendingTeam.players
    .map((player) => {
      player.getPosition(defenderPosition);
      return defenderPosition.z;
    })
    .sort((a, b) => {
      const aProgress = (a - attackingTeam.ownGoalZ) * attackingTeam.attackingDirection.z;
      const bProgress = (b - attackingTeam.ownGoalZ) * attackingTeam.attackingDirection.z;
      return bProgress - aProgress;
    });

  return defenderZ[1] ?? defenderZ[0] ?? defendingTeam.ownGoalZ;
}
