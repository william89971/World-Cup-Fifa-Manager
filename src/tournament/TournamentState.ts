import { createKnockoutFixtures, createNextRoundFixtures, getNextRoundName, getRoundOf32Qualifiers, rankStandings, type KnockoutRoundName } from './bracket';
import { simulateMatch } from './simulation';
import {
  createTournamentTeamProfilesSave,
  getTeamById,
  TOURNAMENT_TEAMS,
  type TournamentTeam,
  type TournamentTeamProfileSave,
} from './teams';
import { validateTournamentSaveData } from './validation';

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

export interface TournamentSaveData {
  selectedTeamId: string;
  groups: Group[];
  fixtures: Fixture[];
  championTeamId?: string;
  userEliminated: boolean;
  teamProfiles?: TournamentTeamProfileSave[];
}

export class TournamentState {
  readonly selectedTeamId: string;
  readonly groups: Group[];
  readonly fixtures: Fixture[];
  readonly teamProfiles: TournamentTeamProfileSave[];
  championTeamId?: string;
  userEliminated = false;

  constructor(selectedTeamId: string, saveData?: TournamentSaveData) {
    this.selectedTeamId = selectedTeamId;
    this.groups = saveData?.groups ?? this.createGroups();
    this.fixtures = saveData?.fixtures ?? this.createGroupFixtures();
    this.teamProfiles = saveData?.teamProfiles ?? createTournamentTeamProfilesSave();
    this.championTeamId = saveData?.championTeamId;
    this.userEliminated = saveData?.userEliminated ?? false;
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
      selectedTeamId: this.selectedTeamId,
      groups: this.groups,
      fixtures: this.fixtures,
      championTeamId: this.championTeamId,
      userEliminated: this.userEliminated,
      teamProfiles: this.teamProfiles,
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
