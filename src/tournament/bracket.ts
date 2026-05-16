import type { Fixture, Group, Standing } from './TournamentState';

const ROUND_NAMES = [
  'Round of 32',
  'Round of 16',
  'Quarter-finals',
  'Semi-finals',
  'Final',
] as const;

export type KnockoutRoundName = (typeof ROUND_NAMES)[number];

export function getNextRoundName(roundName: KnockoutRoundName): KnockoutRoundName | undefined {
  const index = ROUND_NAMES.indexOf(roundName);
  return ROUND_NAMES[index + 1];
}

export function rankStandings(standings: Standing[]): Standing[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.tieSeed - b.tieSeed;
  });
}

export function getRoundOf32Qualifiers(groups: Group[]): string[] {
  const automatic: Standing[] = [];
  const thirdPlaced: Standing[] = [];

  for (const group of groups) {
    const ranked = rankStandings(group.standings);
    automatic.push(ranked[0], ranked[1]);
    thirdPlaced.push(ranked[2]);
  }

  const bestThird = rankStandings(thirdPlaced).slice(0, 8);
  return rankStandings([...automatic, ...bestThird]).map((standing) => standing.teamId);
}

export function createKnockoutFixtures(
  teamIds: string[],
  roundName: KnockoutRoundName,
): Fixture[] {
  const fixtures: Fixture[] = [];
  const total = teamIds.length;

  for (let index = 0; index < total / 2; index += 1) {
    fixtures.push({
      id: `${roundName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`,
      stage: roundName,
      homeTeamId: teamIds[index],
      awayTeamId: teamIds[total - 1 - index],
      status: 'pending',
      knockout: true,
    });
  }

  return fixtures;
}

export function createNextRoundFixtures(
  previousRound: Fixture[],
  roundName: KnockoutRoundName,
): Fixture[] {
  return createKnockoutFixtures(
    previousRound.map((fixture) => {
      if (!fixture.winnerTeamId) {
        throw new Error(`Cannot create ${roundName}; missing winner for ${fixture.id}`);
      }
      return fixture.winnerTeamId;
    }),
    roundName,
  );
}
