import { Vector3 } from 'three';
import type { PlayerRole } from '../entities/Player';
import type { Team } from '../entities/Team';
import { PITCH, PLAYER, ROLE_ZONES } from '../game/constants';

const tempPosition = new Vector3();

export function clampPositionToRoleZone(
  position: Vector3,
  team: Team,
  role: PlayerRole,
): Vector3 {
  const zone = ROLE_ZONES[role];
  const minZ = progressToZ(team, zone.minProgress);
  const maxZ = progressToZ(team, zone.maxProgress);
  const lowerZ = Math.min(minZ, maxZ);
  const upperZ = Math.max(minZ, maxZ);
  const maxX = PITCH.width / 2 - PLAYER.boundsPadding;

  position.x = Math.max(-maxX, Math.min(maxX, position.x));
  position.y = 0;
  position.z = Math.max(lowerZ, Math.min(upperZ, position.z));
  return position;
}

export function getRoleZoneDebugLabel(team: Team, role: PlayerRole): string {
  const zone = ROLE_ZONES[role];
  const minZ = progressToZ(team, zone.minProgress);
  const maxZ = progressToZ(team, zone.maxProgress);
  return `${zone.label}: z ${Math.min(minZ, maxZ).toFixed(1)} to ${Math.max(minZ, maxZ).toFixed(1)}`;
}

export function isInRoleZone(position: Vector3, team: Team, role: PlayerRole): boolean {
  tempPosition.copy(position);
  clampPositionToRoleZone(tempPosition, team, role);
  return tempPosition.distanceToSquared(position) < 0.0001;
}

function progressToZ(team: Team, progress: number): number {
  return team.ownGoalZ + (team.opponentGoalZ - team.ownGoalZ) * progress;
}
