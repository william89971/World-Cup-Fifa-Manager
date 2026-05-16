import { createKnockoutFixtures, createNextRoundFixtures, getNextRoundName, getRoundOf32Qualifiers, rankStandings, type KnockoutRoundName } from './bracket';
import { simulateMatch } from './simulation';
import {
  createTournamentTeamProfilesSave,
  ensureManagerDefaults,
  getTeamById,
  TOURNAMENT_TEAMS,
  type TournamentPlayerProfile,
  type TournamentTeam,
  type TournamentTeamProfileSave,
} from './teams';
import { validateTournamentSaveData } from './validation';
import type {
  ManagerTactics,
  LineupDraft,
  NewsItem,
  TrainingSession,
  MatchReport,
} from '../manager/types';
import { createDefaultTactics } from '../manager/types';

export type FixtureStage = 'Group' | KnockoutRoundName;
export type FixtureStatus = 'pending' | 'complete';

export interface Standing {
  teamId: string;
  played: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  tieSeed: number;
}

export interface Group {
  id: string;
  teamIds: string[];
  standings: Standing[];
}

export interface Fixture {
  id: string;
  stage: FixtureStage;
  groupId?: string;
  homeTeamId: string;
  awayTeamId: string;
  status: FixtureStatus;
  knockout: boolean;
  homeScore?: number;
  awayScore?: number;
  winnerTeamId?: string;
  decidedByPenalties?: boolean;
}

export interface TournamentSnapshot {
  selectedTeam: TournamentTeam;
  groups: Group[];
  fixtures: Fixture[];
  currentFixture?: Fixture;
  nextFixture?: Fixture;
  championTeamId?: string;
  userEliminated: boolean;
}

export interface ManagerSnapshot {
  team: TournamentTeam;
  stageLabel: string;
  nextFixture?: Fixture;
  opponent?: TournamentTeam;
  lastFiveResults: Array<'W' | 'D' | 'L'>;
  avgCondition: number;
  avgMorale: number;
  unreadNews: number;
  tactics: ManagerTactics;
  lineup: LineupDraft;
  qualified: boolean;
  eliminated: boolean;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface TournamentSaveData {
  selectedTeamId: string;
  groups: Group[];
  fixtures: Fixture[];
  championTeamId?: string;
  userEliminated: boolean;
  teamProfiles?: TournamentTeamProfileSave[];
  /** Schema version. Default 1 for legacy saves. */
  version?: number;
  /** Per-team lineup drafts (user typically). */
  lineups?: Record<string, LineupDraft>;
  /** Per-team manager tactics. */
  tactics?: Record<string, ManagerTactics>;
  /** Manager inbox / news feed (most recent first). */
  news?: NewsItem[];
  /** Recent training sessions (most recent first, capped). */
  trainingHistory?: TrainingSession[];
  /** Recent match reports (most recent first, capped). */
  matchHistory?: MatchReport[];
}

export const SAVE_VERSION = 2;
const MAX_HISTORY = 32;
const MAX_NEWS = 80;

export class TournamentState {
  readonly selectedTeamId: string;
  readonly groups: Group[];
  readonly fixtures: Fixture[];
  readonly teamProfiles: TournamentTeamProfileSave[];
  championTeamId?: string;
  userEliminated = false;
  // Manager-mode state — created with defaults if missing from save.
  lineups: Record<string, LineupDraft> = {};
  tactics: Record<string, ManagerTactics> = {};
  news: NewsItem[] = [];
  trainingHistory: TrainingSession[] = [];
  matchHistory: MatchReport[] = [];

  constructor(selectedTeamId: string, saveData?: TournamentSaveData) {
    this.selectedTeamId = selectedTeamId;
    this.groups = saveData?.groups ?? this.createGroups();
    this.fixtures = saveData?.fixtures ?? this.createGroupFixtures();
    this.teamProfiles = saveData?.teamProfiles
      ? this.normalizeProfiles(saveData.teamProfiles)
      : createTournamentTeamProfilesSave();
    this.championTeamId = saveData?.championTeamId;
    this.userEliminated = saveData?.userEliminated ?? false;
    this.lineups = saveData?.lineups ?? {};
    this.tactics = saveData?.tactics ?? {};
    this.news = saveData?.news ?? [];
    this.trainingHistory = saveData?.trainingHistory ?? [];
    this.matchHistory = saveData?.matchHistory ?? [];
    this.ensureUserDefaults();
  }

  static fromSaveData(saveData: TournamentSaveData): TournamentState {
    const validation = validateTournamentSaveData(saveData);
    if (!validation.valid) {
      throw new Error(`Invalid tournament save: ${validation.issues.join(' ')}`);
    }

    return new TournamentState(saveData.selectedTeamId, saveData);
  }

  toSaveData(): TournamentSaveData {
    return {
      version: SAVE_VERSION,
      selectedTeamId: this.selectedTeamId,
      groups: this.groups,
      fixtures: this.fixtures,
      championTeamId: this.championTeamId,
      userEliminated: this.userEliminated,
      teamProfiles: this.teamProfiles,
      lineups: this.lineups,
      tactics: this.tactics,
      news: this.news,
      trainingHistory: this.trainingHistory,
      matchHistory: this.matchHistory,
    };
  }

  private normalizeProfiles(saved: TournamentTeamProfileSave[]): TournamentTeamProfileSave[] {
    return saved.map((profile) => ({
      ...profile,
      players: profile.players.map((p) => ensureManagerDefaults(p)),
      bench: (profile.bench ?? this.deriveBenchFor(profile.teamId, profile.players)).map((p) =>
        ensureManagerDefaults(p),
      ),
    }));
  }

  private deriveBenchFor(
    teamId: string,
    starters: TournamentPlayerProfile[],
  ): TournamentPlayerProfile[] {
    const base = TOURNAMENT_TEAMS.find((team) => team.id === teamId);
    if (base) return base.bench;
    // Fall back to a synthetic bench from starters (cheap clone) if the legacy save
    // pre-dates the bench expansion and the base team can't be resolved.
    return starters.slice(0, 7).map((p, index) => ({ ...p, number: 12 + index }));
  }

  private ensureUserDefaults(): void {
    const teamId = this.selectedTeamId;
    if (!this.lineups[teamId]) {
      this.lineups[teamId] = this.defaultLineupFor(teamId);
    }
    if (!this.tactics[teamId]) {
      const team = this.getTeam(teamId);
      this.tactics[teamId] = createDefaultTactics(
        team.formationPreferences[0] ?? '4-3-3',
        team.teamStyle,
      );
    }
  }

  private defaultLineupFor(teamId: string): LineupDraft {
    const team = this.getTeam(teamId);
    const startingXI = team.players.map((p) => playerKey(teamId, p));
    const bench = team.bench.map((p) => playerKey(teamId, p));
    const captain = team.players.find((p) => p.personality === 'Captain') ?? team.players[0];
    return {
      startingXI,
      bench,
      captainId: captain ? playerKey(teamId, captain) : '',
    };
  }

  get selectedTeam(): TournamentTeam {
    return this.getTeam(this.selectedTeamId);
  }

  getSnapshot(): TournamentSnapshot {
    return {
      selectedTeam: this.selectedTeam,
      groups: this.groups,
      fixtures: this.fixtures,
      currentFixture: this.getNextUserFixture(),
      nextFixture: this.getPendingFixture(),
      championTeamId: this.championTeamId,
      userEliminated: this.userEliminated,
    };
  }

  getTeam(teamId: string): TournamentTeam {
    const baseTeam = getTeamById(teamId);
    const savedProfile = this.teamProfiles.find((profile) => profile.teamId === teamId);
    if (!savedProfile) {
      return baseTeam;
    }

    return {
      ...baseTeam,
      teamStyle: savedProfile.teamStyle,
      formationPreferences: savedProfile.formationPreferences,
      players: savedProfile.players,
      bench: savedProfile.bench ?? baseTeam.bench,
    };
  }

  /** Get all 18 squad members for a team (starters + bench). */
  getSquad(teamId: string): TournamentPlayerProfile[] {
    const team = this.getTeam(teamId);
    return [...team.players, ...team.bench];
  }

  get selectedTactics(): ManagerTactics {
    return this.tactics[this.selectedTeamId];
  }

  get selectedLineup(): LineupDraft {
    return this.lineups[this.selectedTeamId];
  }

  setTactics(teamId: string, tactics: ManagerTactics): void {
    this.tactics[teamId] = tactics;
  }

  setLineup(teamId: string, lineup: LineupDraft): void {
    this.lineups[teamId] = lineup;
  }

  pushNews(item: NewsItem): void {
    this.news.unshift(item);
    if (this.news.length > MAX_NEWS) this.news.length = MAX_NEWS;
  }

  markAllNewsRead(): void {
    for (const n of this.news) n.read = true;
  }

  markNewsRead(id: string): void {
    const found = this.news.find((n) => n.id === id);
    if (found) found.read = true;
  }

  pushTraining(session: TrainingSession): void {
    this.trainingHistory.unshift(session);
    if (this.trainingHistory.length > MAX_HISTORY) this.trainingHistory.length = MAX_HISTORY;
  }

  pushMatchReport(report: MatchReport): void {
    this.matchHistory.unshift(report);
    if (this.matchHistory.length > MAX_HISTORY) this.matchHistory.length = MAX_HISTORY;
  }

  getManagerSnapshot(): ManagerSnapshot {
    const team = this.getTeam(this.selectedTeamId);
    const nextFixture = this.getNextUserFixture();
    const opponent = nextFixture
      ? this.getTeam(nextFixture.homeTeamId === this.selectedTeamId ? nextFixture.awayTeamId : nextFixture.homeTeamId)
      : undefined;
    const userResults: Array<'W' | 'D' | 'L'> = [];
    let wins = 0, draws = 0, losses = 0;
    for (const fixture of this.fixtures) {
      if (fixture.status !== 'complete') continue;
      if (fixture.homeTeamId !== this.selectedTeamId && fixture.awayTeamId !== this.selectedTeamId) continue;
      const isHome = fixture.homeTeamId === this.selectedTeamId;
      const us = (isHome ? fixture.homeScore : fixture.awayScore) ?? 0;
      const them = (isHome ? fixture.awayScore : fixture.homeScore) ?? 0;
      if (us > them) { wins += 1; userResults.push('W'); }
      else if (us < them) { losses += 1; userResults.push('L'); }
      else { draws += 1; userResults.push('D'); }
    }
    const squad = this.getSquad(this.selectedTeamId);
    const avgCondition = average(squad.map((p) => p.condition ?? 100));
    const avgMorale = average(squad.map((p) => p.morale ?? 70));
    const unreadNews = this.news.filter((n) => !n.read).length;
    const matchesPlayed = wins + draws + losses;
    const groupForUser = this.groups.find((g) => g.teamIds.includes(this.selectedTeamId));
    const standing = groupForUser?.standings.find((s) => s.teamId === this.selectedTeamId);
    const stageLabel = nextFixture
      ? nextFixture.stage === 'Group'
        ? `Group ${groupForUser?.id ?? ''}`.trim()
        : nextFixture.stage
      : this.championTeamId
      ? this.championTeamId === this.selectedTeamId
        ? 'Champion'
        : 'Tournament complete'
      : 'Idle';
    return {
      team,
      stageLabel,
      nextFixture,
      opponent,
      lastFiveResults: userResults.slice(-5),
      avgCondition,
      avgMorale,
      unreadNews,
      tactics: this.selectedTactics,
      lineup: this.selectedLineup,
      qualified: (standing?.points ?? 0) >= 6,
      eliminated: this.userEliminated,
      matchesPlayed,
      wins,
      draws,
      losses,
    };
  }

  getNextUserFixture(): Fixture | undefined {
    return this.fixtures.find(
      (fixture) =>
        fixture.status === 'pending' &&
        (fixture.homeTeamId === this.selectedTeamId || fixture.awayTeamId === this.selectedTeamId),
    );
  }

  getPendingFixture(): Fixture | undefined {
    return this.fixtures.find((fixture) => fixture.status === 'pending');
  }

  getBestThirdPlaceStandings(): Standing[] {
    const thirdPlaced: Standing[] = [];

    for (const group of this.groups) {
      const ranked = this.getRankedStandings(group);
      if (ranked[2]) {
        thirdPlaced.push(ranked[2]);
      }
    }

    return rankStandings(thirdPlaced);
  }

  isFixtureUserTeam(fixture: Fixture): boolean {
    return this.fixtureInvolvesUser(fixture);
  }

  simulateUntilUserMatchOrComplete(): void {
    let fixture = this.getPendingFixture();

    while (fixture) {
      const involvesUser =
        fixture.homeTeamId === this.selectedTeamId || fixture.awayTeamId === this.selectedTeamId;

      if (involvesUser && !this.userEliminated) {
        break;
      }

      this.simulateFixture(fixture);
      fixture = this.getPendingFixture();
    }
  }

  simulateAllRemaining(): void {
    let fixture = this.getPendingFixture();

    while (fixture) {
      this.simulateFixture(fixture);
      fixture = this.getPendingFixture();
    }
  }

  simulateNextPendingFixture(): Fixture | undefined {
    const fixture = this.getPendingFixture();
    if (!fixture) return undefined;

    this.simulateFixture(fixture);
    return fixture;
  }

  recordUserFixture(fixtureId: string, homeScore: number, awayScore: number): void {
    const fixture = this.fixtures.find((candidate) => candidate.id === fixtureId);

    if (!fixture) {
      throw new Error(`Unknown fixture: ${fixtureId}`);
    }

    let winnerTeamId =
      homeScore > awayScore ? fixture.homeTeamId : awayScore > homeScore ? fixture.awayTeamId : undefined;

    if (fixture.knockout && !winnerTeamId) {
      const selectedIsHome = fixture.homeTeamId === this.selectedTeamId;
      winnerTeamId = selectedIsHome ? fixture.homeTeamId : fixture.awayTeamId;
      if (selectedIsHome) {
        homeScore += 1;
      } else {
        awayScore += 1;
      }
      fixture.decidedByPenalties = true;
    }

    this.completeFixture(fixture, homeScore, awayScore, winnerTeamId);
  }

  private simulateFixture(fixture: Fixture): void {
    const result = simulateMatch(
      this.getTeam(fixture.homeTeamId),
      this.getTeam(fixture.awayTeamId),
      fixture.id,
      fixture.knockout,
    );
    this.completeFixture(
      fixture,
      result.homeScore,
      result.awayScore,
      result.winnerId,
      result.decidedByPenalties,
    );
  }

  private completeFixture(
    fixture: Fixture,
    homeScore: number,
    awayScore: number,
    winnerTeamId?: string,
    decidedByPenalties = fixture.decidedByPenalties ?? false,
  ): void {
    fixture.status = 'complete';
    fixture.homeScore = homeScore;
    fixture.awayScore = awayScore;
    fixture.winnerTeamId = winnerTeamId;
    fixture.decidedByPenalties = decidedByPenalties;

    if (fixture.groupId) {
      this.applyGroupResult(fixture);
    }

    if (fixture.knockout && winnerTeamId !== this.selectedTeamId && this.fixtureInvolvesUser(fixture)) {
      this.userEliminated = true;
    }

    this.advanceIfRoundComplete(fixture.stage);
  }

  private applyGroupResult(fixture: Fixture): void {
    if (fixture.homeScore === undefined || fixture.awayScore === undefined || !fixture.groupId) {
      return;
    }

    const group = this.groups.find((candidate) => candidate.id === fixture.groupId);
    if (!group) return;

    const home = group.standings.find((standing) => standing.teamId === fixture.homeTeamId);
    const away = group.standings.find((standing) => standing.teamId === fixture.awayTeamId);
    if (!home || !away) return;

    home.played += 1;
    away.played += 1;
    home.goalsFor += fixture.homeScore;
    home.goalsAgainst += fixture.awayScore;
    away.goalsFor += fixture.awayScore;
    away.goalsAgainst += fixture.homeScore;
    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;

    if (fixture.homeScore > fixture.awayScore) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (fixture.awayScore > fixture.homeScore) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  private advanceIfRoundComplete(stage: FixtureStage): void {
    if (stage === 'Group') {
      const groupFixturesDone = this.fixtures
        .filter((fixture) => fixture.stage === 'Group')
        .every((fixture) => fixture.status === 'complete');

      // The Round of 32 is generated exactly once after all 72 group fixtures finish.
      if (groupFixturesDone && !this.fixtures.some((fixture) => fixture.stage === 'Round of 32')) {
        this.fixtures.push(...createKnockoutFixtures(getRoundOf32Qualifiers(this.groups), 'Round of 32'));
      }
      return;
    }

    const roundFixtures = this.fixtures.filter((fixture) => fixture.stage === stage);
    const roundComplete = roundFixtures.every((fixture) => fixture.status === 'complete');

    if (!roundComplete) return;

    if (stage === 'Final') {
      this.championTeamId = roundFixtures[0].winnerTeamId;
      return;
    }

    const nextRound = getNextRoundName(stage);
    // Each knockout round owns its own pending fixtures; creating a round twice would duplicate the bracket.
    if (nextRound && !this.fixtures.some((fixture) => fixture.stage === nextRound)) {
      this.fixtures.push(...createNextRoundFixtures(roundFixtures, nextRound));
    }
  }

  private createGroups(): Group[] {
    const groups: Group[] = [];

    for (let groupIndex = 0; groupIndex < 12; groupIndex += 1) {
      const teamIds = TOURNAMENT_TEAMS.slice(groupIndex * 4, groupIndex * 4 + 4).map(
        (team) => team.id,
      );
      groups.push({
        id: String.fromCharCode(65 + groupIndex),
        teamIds,
        standings: teamIds.map((teamId, index) => ({
          teamId,
          played: 0,
          points: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          tieSeed: groupIndex * 4 + index,
        })),
      });
    }

    return groups;
  }

  private createGroupFixtures(): Fixture[] {
    const fixtures: Fixture[] = [];
    const pairings = [
      [0, 1],
      [2, 3],
      [0, 2],
      [1, 3],
      [0, 3],
      [1, 2],
    ] as const;

    for (const group of this.groups) {
      pairings.forEach(([homeIndex, awayIndex], index) => {
        fixtures.push({
          id: `group-${group.id}-${index + 1}`,
          stage: 'Group',
          groupId: group.id,
          homeTeamId: group.teamIds[homeIndex],
          awayTeamId: group.teamIds[awayIndex],
          status: 'pending',
          knockout: false,
        });
      });
    }

    return fixtures;
  }

  private fixtureInvolvesUser(fixture: Fixture): boolean {
    return fixture.homeTeamId === this.selectedTeamId || fixture.awayTeamId === this.selectedTeamId;
  }

  getRankedStandings(group: Group): Standing[] {
    return rankStandings(group.standings);
  }
}

export function playerKey(teamId: string, profile: TournamentPlayerProfile): string {
  return `${teamId}:${profile.role}:${profile.number}`;
}

export function findPlayerByKey(
  team: TournamentTeam,
  key: string,
): TournamentPlayerProfile | undefined {
  const all = [...team.players, ...team.bench];
  return all.find((p) => playerKey(team.id, p) === key);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}
