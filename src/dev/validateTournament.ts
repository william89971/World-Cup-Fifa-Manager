import { TournamentState } from '../tournament/TournamentState';
import {
  validateCompletedTournament,
  validateTournamentSaveData,
  validateTournamentStructure,
} from '../tournament/validation';
import { TOURNAMENT_TEAMS } from '../tournament/teams';

export function runTournamentValidation(): string[] {
  const issues: string[] = [];
  const tournament = new TournamentState(TOURNAMENT_TEAMS[0].id);

  issues.push(
    ...validateTournamentStructure(tournament.groups, tournament.fixtures).issues,
  );

  tournament.simulateAllRemaining();
  issues.push(
    ...validateCompletedTournament(
      tournament.groups,
      tournament.fixtures,
      tournament.championTeamId,
    ).issues,
  );

  const saveValidation = validateTournamentSaveData(tournament.toSaveData());
  issues.push(...saveValidation.issues);

  return issues;
}
