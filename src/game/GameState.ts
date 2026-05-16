import type { Fixture } from '../tournament/TournamentState';
import type { FormationName, TeamStyle } from './playerTypes';

export type GameScreen =
  | 'home'
  | 'countrySelection'
  | 'groupStage'
  | 'matchPreview'
  | 'pickTactics'
  | 'squad'
  | 'bracket'
  | 'settings'
  | 'matchPlaying'
  | 'matchComplete'
  | 'champion';

export interface UserTactics {
  formation: FormationName;
  teamStyle: TeamStyle;
}

export interface LiveMatchState {
  fixture: Fixture;
  userIsHome: boolean;
  userTactics?: UserTactics;
  userLineup?: string[]; // player IDs in starting-XI order
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
}

export function createInitialGameState(): GameState {
  return { screen: 'home' };
}
