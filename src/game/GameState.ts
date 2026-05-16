import type { Fixture } from '../tournament/TournamentState';
import type { FormationName, TeamStyle } from './playerTypes';
import type { MatchReport } from '../manager/types';

export type GameScreen =
  | 'home'
  | 'countrySelection'
  | 'managerHub'
  | 'inbox'
  | 'squad'
  | 'profile'
  | 'tactics'
  | 'formationPitch'
  | 'lineup'
  | 'fixtures'
  | 'standings'
  | 'bracket'
  | 'matchPreview'
  | 'scouting'
  | 'training'
  | 'matchPlaying'
  | 'postMatch'
  | 'champion'
  | 'settings'
  // Legacy aliases (still accepted by adapters in Game.ts):
  | 'groupStage'
  | 'pickTactics'
  | 'matchComplete';

export interface UserTactics {
  formation: FormationName;
  teamStyle: TeamStyle;
}

export interface LiveMatchState {
  fixture: Fixture;
  userIsHome: boolean;
  userTactics?: UserTactics;
  userLineup?: string[];
}

export interface MatchResultSummary {
  userTeamName: string;
  opponentTeamName: string;
  userScore: number;
  opponentScore: number;
  stage: string;
}

export interface GameState {
  screen: GameScreen;
  liveMatch?: LiveMatchState;
  lastMatchResult?: MatchResultSummary;
  /** Most recent finished match report — used by PostMatchScreen. */
  lastMatchReport?: MatchReport;
  /** Currently focused player id for PlayerProfile screen. */
  focusedPlayerId?: string;
  /** Currently focused fixture id for previews opened from bracket/fixtures. */
  focusedFixtureId?: string;
}

export function createInitialGameState(): GameState {
  return { screen: 'home' };
}
