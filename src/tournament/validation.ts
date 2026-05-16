import { getRoundOf32Qualifiers } from './bracket';
import type { Fixture, Group, TournamentSaveData } from './TournamentState';
import { TOURNAMENT_TEAMS } from './teams';
import { FORMATION_NAMES, PLAYER_ROLES, TRAIT_KEYS, TEAM_STYLES } from '../game/playerTypes';

const TEAM_IDS = new Set(TOURNAMENT_TEAMS.map((team) => team.id));
const TEAM_CODES = new Set(TOURNAMENT_TEAMS.map((team) => team.code));
const GROUP_COUNT = 12;
const TEAMS_PER_GROUP = 4;
const GROUP_FIXTURES_PER_GROUP = 6;
const GROUP_FIXTURE_COUNT = GROUP_COUNT * GROUP_FIXTURES_PER_GROUP;

const KNOCKOUT_EXPECTED_COUNTS = new Map<string, number>([
  ['Round of 32', 16],
  ['Round of 16', 8],
  ['Quarter-finals', 4],
  ['Semi-finals', 2],
  ['Final', 1],
]);

export interface TournamentValidationResult {
  valid: boolean;
  issues: string[];
}

export function validateTournamentSaveData(
  data: Partial<TournamentSaveData>,
): TournamentValidationResult {
  const issues: string[] = [];

  if (!data.selectedTeamId || !TEAM_IDS.has(data.selectedTeamId)) {
    issues.push('Save has an unknown selected team.');
  }

  if (!Array.isArray(data.groups) || !Array.isArray(data.fixtures)) {
    issues.push('Save is missing groups or fixtures.');
    return { valid: false, issues };
  }

  validateGroups(data.groups, issues);
  validateFixtures(data.groups, data.fixtures, issues);
  validateChampion(data.fixtures, data.championTeamId, issues);

  return { valid: issues.length === 0, issues };
}

export function validateTournamentStructure(groups: Group[], fixtures: Fixture[]): TournamentValidationResult {
  const issues: string[] = [];
  validateTeams(issues);
  validateGroups(groups, issues);
  validateFixtures(groups, fixtures, issues);
  validateKnockoutProgression(fixtures, issues);
  validateChampion(fixtures, undefined, issues);
  return { valid: issues.length === 0, issues };
}

export function validateCompletedTournament(groups: Group[], fixtures: Fixture[], championTeamId?: string): TournamentValidationResult {
  const issues: string[] = [];
  validateTeams(issues);
  validateGroups(groups, issues);
  validateFixtures(groups, fixtures, issues);
  validateKnockoutProgression(fixtures, issues);
  validateChampion(fixtures, championTeamId, issues);

  for (const group of groups) {
    for (const standing of group.standings) {
      if (standing.played !== 3) {
        issues.push(`Group ${group.id} has ${standing.teamId} with ${standing.played} matches played.`);
      }
    }
  }

  const qualifiers = getRoundOf32Qualifiers(groups);
  if (new Set(qualifiers).size !== 32) {
    issues.push('Round of 32 qualification did not produce 32 unique teams.');
  }

  return { valid: issues.length === 0, issues };
}

function validateTeams(issues: string[]): void {
  if (TOURNAMENT_TEAMS.length !== 48) {
    issues.push(`Expected 48 teams, found ${TOURNAMENT_TEAMS.length}.`);
  }

  if (TEAM_IDS.size !== TOURNAMENT_TEAMS.length) {
    issues.push('Team IDs must be unique.');
  }

  if (TEAM_CODES.size !== TOURNAMENT_TEAMS.length) {
    issues.push('Team codes must be unique.');
  }

  for (const team of TOURNAMENT_TEAMS) {
    if (!TEAM_STYLES.includes(team.teamStyle)) {
      issues.push(`${team.name} has an invalid team style.`);
    }
    if (team.players.length !== 11) {
      issues.push(`${team.name} should have 11 players, found ${team.players.length}.`);
    }
    for (const formation of team.formationPreferences) {
      if (!FORMATION_NAMES.includes(formation)) {
        issues.push(`${team.name} has invalid formation preference ${formation}.`);
      }
    }
    for (const role of PLAYER_ROLES) {
      if (!team.players.some((player) => player.role === role)) {
        issues.push(`${team.name} is missing role ${role}.`);
      }
    }
    for (const player of team.players) {
      for (const trait of TRAIT_KEYS) {
        const value = player.traits[trait];
        if (typeof value !== 'number' || value < 0 || value > 1) {
          issues.push(`${team.name} #${player.number} has invalid trait ${trait}.`);
        }
      }
      if (player.topTraits.length !== 3) {
        issues.push(`${team.name} #${player.number} should expose top 3 traits.`);
      }
    }
  }
}

function validateGroups(groups: Group[], issues: string[]): void {
  if (groups.length !== GROUP_COUNT) {
    issues.push(`Expected ${GROUP_COUNT} groups, found ${groups.length}.`);
  }

  const seenTeamIds = new Set<string>();
  for (const group of groups) {
    if (group.teamIds.length !== TEAMS_PER_GROUP) {
      issues.push(`Group ${group.id} does not have ${TEAMS_PER_GROUP} teams.`);
    }

    if (group.standings.length !== group.teamIds.length) {
      issues.push(`Group ${group.id} standings do not match team count.`);
    }

    for (const teamId of group.teamIds) {
      if (!TEAM_IDS.has(teamId)) {
        issues.push(`Group ${group.id} contains unknown team ${teamId}.`);
      }
      if (seenTeamIds.has(teamId)) {
        issues.push(`Team ${teamId} appears in more than one group.`);
      }
      seenTeamIds.add(teamId);
    }
  }

  if (seenTeamIds.size !== TOURNAMENT_TEAMS.length) {
    issues.push('Groups do not contain every tournament team exactly once.');
  }
}

function validateFixtures(groups: Group[], fixtures: Fixture[], issues: string[]): void {
  const groupFixtures = fixtures.filter((fixture) => fixture.stage === 'Group');
  if (groupFixtures.length !== GROUP_FIXTURE_COUNT) {
    issues.push(`Expected ${GROUP_FIXTURE_COUNT} group fixtures, found ${groupFixtures.length}.`);
  }

  for (const group of groups) {
    const fixturesForGroup = groupFixtures.filter((fixture) => fixture.groupId === group.id);
    if (fixturesForGroup.length !== GROUP_FIXTURES_PER_GROUP) {
      issues.push(`Group ${group.id} has ${fixturesForGroup.length} fixtures.`);
    }

    for (const teamId of group.teamIds) {
      const appearances = fixturesForGroup.filter(
        (fixture) => fixture.homeTeamId === teamId || fixture.awayTeamId === teamId,
      ).length;
      if (appearances !== 3) {
        issues.push(`Team ${teamId} has ${appearances} group fixtures.`);
      }
    }
  }

  for (const fixture of fixtures) {
    if (!TEAM_IDS.has(fixture.homeTeamId) || !TEAM_IDS.has(fixture.awayTeamId)) {
      issues.push(`Fixture ${fixture.id} references an unknown team.`);
    }

    if (fixture.homeTeamId === fixture.awayTeamId) {
      issues.push(`Fixture ${fixture.id} has the same home and away team.`);
    }

    if (
      fixture.knockout &&
      fixture.status === 'complete' &&
      fixture.homeScore === fixture.awayScore
    ) {
      issues.push(`Knockout fixture ${fixture.id} ended level.`);
    }
  }
}

function validateKnockoutProgression(fixtures: Fixture[], issues: string[]): void {
  for (const [stage, expectedCount] of KNOCKOUT_EXPECTED_COUNTS) {
    const roundFixtures = fixtures.filter((fixture) => fixture.stage === stage);
    if (roundFixtures.length > 0 && roundFixtures.length !== expectedCount) {
      issues.push(`${stage} has ${roundFixtures.length} fixtures; expected ${expectedCount}.`);
    }
  }
}

function validateChampion(
  fixtures: Fixture[],
  championTeamId: string | undefined,
  issues: string[],
): void {
  if (championTeamId && !TEAM_IDS.has(championTeamId)) {
    issues.push('Champion team is unknown.');
  }

  const final = fixtures.find((fixture) => fixture.stage === 'Final');
  if (championTeamId && final?.status === 'complete' && championTeamId !== final.winnerTeamId) {
    issues.push('Champion does not match Final winner.');
  }
}
