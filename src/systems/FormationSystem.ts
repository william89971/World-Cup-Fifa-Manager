import { Vector3 } from 'three';
import { PITCH } from '../game/constants';
import type { FormationName, PlayerRole } from '../game/playerTypes';
import type { FixtureStage } from '../tournament/TournamentState';
import type { TournamentTeam } from '../tournament/teams';
import type { TeamColor } from '../entities/Player';

type FormationPoint = { x: number; progress: number };

const FORMATION_POINTS: Record<FormationName, Record<PlayerRole, FormationPoint>> = {
  '4-3-3': {
    goalkeeper: { x: 0, progress: 0.04 },
    leftBack: { x: -0.34, progress: 0.2 },
    centerBackLeft: { x: -0.12, progress: 0.18 },
    centerBackRight: { x: 0.12, progress: 0.18 },
    rightBack: { x: 0.34, progress: 0.2 },
    defensiveMid: { x: 0, progress: 0.31 },
    centralMid: { x: -0.13, progress: 0.4 },
    attackingMid: { x: 0.13, progress: 0.43 },
    leftWing: { x: -0.34, progress: 0.48 },
    rightWing: { x: 0.34, progress: 0.48 },
    striker: { x: 0, progress: 0.49 },
  },
  '4-4-2': {
    goalkeeper: { x: 0, progress: 0.04 },
    leftBack: { x: -0.34, progress: 0.2 },
    centerBackLeft: { x: -0.12, progress: 0.18 },
    centerBackRight: { x: 0.12, progress: 0.18 },
    rightBack: { x: 0.34, progress: 0.2 },
    defensiveMid: { x: -0.12, progress: 0.34 },
    centralMid: { x: 0.12, progress: 0.36 },
    attackingMid: { x: 0.1, progress: 0.46 },
    leftWing: { x: -0.34, progress: 0.42 },
    rightWing: { x: 0.34, progress: 0.42 },
    striker: { x: -0.08, progress: 0.49 },
  },
  '3-5-2': {
    goalkeeper: { x: 0, progress: 0.04 },
    leftBack: { x: -0.36, progress: 0.34 },
    centerBackLeft: { x: -0.2, progress: 0.18 },
    centerBackRight: { x: 0.2, progress: 0.18 },
    rightBack: { x: 0.36, progress: 0.34 },
    defensiveMid: { x: 0, progress: 0.26 },
    centralMid: { x: -0.08, progress: 0.39 },
    attackingMid: { x: 0.08, progress: 0.44 },
    leftWing: { x: -0.16, progress: 0.47 },
    rightWing: { x: 0.16, progress: 0.47 },
    striker: { x: 0, progress: 0.49 },
  },
  '4-2-3-1': {
    goalkeeper: { x: 0, progress: 0.04 },
    leftBack: { x: -0.34, progress: 0.22 },
    centerBackLeft: { x: -0.12, progress: 0.18 },
    centerBackRight: { x: 0.12, progress: 0.18 },
    rightBack: { x: 0.34, progress: 0.22 },
    defensiveMid: { x: -0.10, progress: 0.30 },
    centralMid: { x: 0.10, progress: 0.30 },
    attackingMid: { x: 0, progress: 0.42 },
    leftWing: { x: -0.30, progress: 0.46 },
    rightWing: { x: 0.30, progress: 0.46 },
    striker: { x: 0, progress: 0.50 },
  },
  '5-3-2': {
    goalkeeper: { x: 0, progress: 0.04 },
    leftBack: { x: -0.38, progress: 0.20 },
    centerBackLeft: { x: -0.16, progress: 0.16 },
    centerBackRight: { x: 0, progress: 0.16 },
    rightBack: { x: 0.38, progress: 0.20 },
    defensiveMid: { x: 0.16, progress: 0.16 },
    centralMid: { x: -0.16, progress: 0.36 },
    attackingMid: { x: 0.16, progress: 0.36 },
    leftWing: { x: 0, progress: 0.38 },
    rightWing: { x: -0.10, progress: 0.48 },
    striker: { x: 0.10, progress: 0.48 },
  },
};

export function selectFormation(
  team: TournamentTeam,
  opponent: TournamentTeam,
  stage: FixtureStage,
): FormationName {
  if (team.teamStyle === 'defensive' && opponent.rating.overall > team.rating.overall + 4) {
    return '4-4-2';
  }

  if (team.teamStyle === 'highPress' || team.teamStyle === 'possession') {
    return stage === 'Final' && opponent.rating.attack > team.rating.defense + 4
      ? '3-5-2'
      : '4-3-3';
  }

  if (team.teamStyle === 'counterAttack' || team.teamStyle === 'directAttack') {
    return opponent.rating.defense > team.rating.attack + 6 ? '4-3-3' : '4-4-2';
  }

  return team.formationPreferences[0] ?? '4-3-3';
}

export function createFormationPositions(
  color: TeamColor,
  formation: FormationName,
): Record<PlayerRole, Vector3> {
  const ownGoalZ = color === 'blue' ? PITCH.length / 2 : -PITCH.length / 2;
  const opponentGoalZ = color === 'blue' ? -PITCH.length / 2 : PITCH.length / 2;
  const width = PITCH.width * 0.82;
  const points = FORMATION_POINTS[formation];
  const positions = {} as Record<PlayerRole, Vector3>;

  for (const [role, point] of Object.entries(points) as [PlayerRole, FormationPoint][]) {
    positions[role] = new Vector3(
      point.x * width,
      0,
      ownGoalZ + (opponentGoalZ - ownGoalZ) * point.progress,
    );
  }

  return positions;
}
