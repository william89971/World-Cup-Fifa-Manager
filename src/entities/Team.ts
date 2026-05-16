import { Vector3 } from 'three';
import { PITCH, TEAM } from '../game/constants';
import type { FormationName, TeamStyle } from '../game/playerTypes';
import { createFormationPositions } from '../systems/FormationSystem';
import type { TournamentTeam, TournamentPlayerProfile } from '../tournament/teams';
import { Player, type PlayerRole, type TeamColor } from './Player';

export interface Team {
  color: TeamColor;
  name: string;
  tournamentTeam?: TournamentTeam;
  players: Player[];
  /** Bench players (alive Player rigs positioned off-pitch). */
  bench: Player[];
  formation: FormationName;
  teamStyle: TeamStyle;
  attackingDirection: Vector3;
  ownGoalZ: number;
  opponentGoalZ: number;
}

export interface CreateTeamOptions {
  formation?: FormationName;
  teamStyle?: TeamStyle;
  // Manager-mode override: explicit starting XI in canonical role order
  // (goalkeeper → leftBack → ... → striker). Missing roles fall back to the
  // tournamentTeam.players[index] default.
  lineupOverride?: TournamentPlayerProfile[];
  /** Bench profiles to instantiate as off-pitch Player rigs. */
  bench?: TournamentPlayerProfile[];
}

export function createTeam(
  color: TeamColor,
  tournamentTeam?: TournamentTeam,
  options: CreateTeamOptions = {},
): Team {
  const activeFormation: FormationName =
    options.formation ?? tournamentTeam?.formationPreferences[0] ?? '4-3-3';
  const activeStyle: TeamStyle = options.teamStyle ?? tournamentTeam?.teamStyle ?? 'balanced';
  const formation = createFormationPositions(color, activeFormation);

  // Build a role → profile map from the lineup override so we can pick the right
  // profile for each role even if the order is partial or shuffled.
  const overrideByRole = new Map<PlayerRole, TournamentPlayerProfile>();
  if (options.lineupOverride) {
    for (const profile of options.lineupOverride) {
      overrideByRole.set(profile.role, profile);
    }
  }

  const players = TEAM.roles.map((role, index) => {
    const playerRole = role as PlayerRole;
    const primaryColor = tournamentTeam?.colors.primary;
    const accentColor = tournamentTeam?.colors.accent;
    const overrideProfile = overrideByRole.get(playerRole);
    const profile = overrideProfile ?? tournamentTeam?.players[index];
    return new Player(
      color,
      formation[playerRole].clone(),
      `${color}-${index + 1}`,
      playerRole,
      profile?.number ?? index + 1,
      primaryColor,
      accentColor,
      profile?.name,
      profile?.styleSeed,
      profile?.personality,
      profile?.traits,
    );
  });

  // Bench: instantiate as Player rigs but position far off-pitch so they don't
  // interact with physics/AI until subbed in.
  const benchProfiles = options.bench ?? tournamentTeam?.bench ?? [];
  const bench = benchProfiles.map((profile, index) => {
    const offPitch = new Vector3(-1000, 0, color === 'blue' ? -10 - index * 1.2 : 10 + index * 1.2);
    return new Player(
      color,
      offPitch,
      `${color}-bench-${index + 1}`,
      profile.role as PlayerRole,
      profile.number ?? 12 + index,
      tournamentTeam?.colors.primary,
      tournamentTeam?.colors.accent,
      profile.name,
      profile.styleSeed,
      profile.personality,
      profile.traits,
    );
  });

  return {
    color,
    name: tournamentTeam?.name ?? (color === 'blue' ? 'Blue' : 'Red'),
    tournamentTeam,
    players,
    bench,
    formation: activeFormation,
    teamStyle: activeStyle,
    attackingDirection: color === 'blue' ? new Vector3(0, 0, -1) : new Vector3(0, 0, 1),
    ownGoalZ: color === 'blue' ? PITCH.length / 2 : -PITCH.length / 2,
    opponentGoalZ: color === 'blue' ? -PITCH.length / 2 : PITCH.length / 2,
  };
}
