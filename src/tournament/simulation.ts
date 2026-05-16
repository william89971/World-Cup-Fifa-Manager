import type { TournamentTeam } from './teams';

export interface SimulatedScore {
  homeScore: number;
  awayScore: number;
  winnerId?: string;
  decidedByPenalties?: boolean;
}

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function random01(seed: string): number {
  return (hash(seed) % 10000) / 10000;
}

function expectedGoals(team: TournamentTeam, opponent: TournamentTeam, seed: string): number {
  const attackEdge = team.rating.attack - opponent.rating.defense;
  const paceEdge = team.rating.speed - opponent.rating.stamina;
  const overallEdge = team.rating.overall - opponent.rating.overall;
  const base = 1.15 + attackEdge * 0.026 + paceEdge * 0.011 + overallEdge * 0.013;
  const noise = (random01(seed) - 0.5) * 1.15;
  return Math.max(0.1, base + noise);
}

function goalsFromExpected(expected: number, seed: string): number {
  const roll = random01(seed);
  const adjusted = expected + (roll - 0.5) * 1.35;
  return Math.max(0, Math.min(6, Math.round(adjusted)));
}

export function simulateMatch(
  home: TournamentTeam,
  away: TournamentTeam,
  fixtureId: string,
  knockout = false,
): SimulatedScore {
  let homeScore = goalsFromExpected(
    expectedGoals(home, away, `${fixtureId}:home:xg`),
    `${fixtureId}:home:goals`,
  );
  let awayScore = goalsFromExpected(
    expectedGoals(away, home, `${fixtureId}:away:xg`),
    `${fixtureId}:away:goals`,
  );

  if (!knockout || homeScore !== awayScore) {
    return {
      homeScore,
      awayScore,
      winnerId: homeScore > awayScore ? home.id : awayScore > homeScore ? away.id : undefined,
    };
  }

  const homePenaltyEdge = home.rating.overall + random01(`${fixtureId}:pens:home`) * 20;
  const awayPenaltyEdge = away.rating.overall + random01(`${fixtureId}:pens:away`) * 20;
  const winnerId = homePenaltyEdge >= awayPenaltyEdge ? home.id : away.id;

  if (winnerId === home.id) {
    homeScore += 1;
  } else {
    awayScore += 1;
  }

  return { homeScore, awayScore, winnerId, decidedByPenalties: true };
}
