import type { FormationName, TeamStyle, TraitKey } from '../game/playerTypes';

/** -2 = very defensive, -1 defensive, 0 balanced, +1 attacking, +2 all-out attack. */
export type Mentality = -2 | -1 | 0 | 1 | 2;

export interface TacticSliders {
  pressing: number;
  lineHeight: number;
  tempo: number;
  width: number;
  directness: number;
  risk: number;
  buildUp: number;
  tackling: number;
}

export interface ManagerTactics {
  formation: FormationName;
  teamStyle: TeamStyle;
  mentality: Mentality;
  sliders: TacticSliders;
}

export interface LineupDraft {
  startingXI: string[]; // player ids in canonical role order
  bench: string[];
  captainId: string;
}

export type MatchEventType =
  | 'kickoff'
  | 'goal'
  | 'shot'
  | 'save'
  | 'foul'
  | 'card'
  | 'sub'
  | 'corner'
  | 'offside'
  | 'half'
  | 'full'
  | 'tactic';

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  team: 'blue' | 'red' | 'neutral';
  playerId?: string;
  detail?: string;
  cardType?: 'yellow' | 'red';
}

export interface MatchStats {
  possessionPct: number; // 0-100, blue team possession
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  passes: { home: number; away: number };
  passAccuracy: { home: number; away: number };
  tackles: { home: number; away: number };
  fouls: { home: number; away: number };
  corners: { home: number; away: number };
  offsides: { home: number; away: number };
  yellows: { home: number; away: number };
  reds: { home: number; away: number };
}

export interface PlayerMatchRating {
  playerId: string;
  playerName: string;
  rating: number;
  goals: number;
  assists: number;
  tackles: number;
  passes: number;
  isMotm: boolean;
}

export interface MatchReport {
  fixtureId: string;
  dateMs: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  stage: string;
  stats: MatchStats;
  events: MatchEvent[];
  homeRatings: PlayerMatchRating[];
  awayRatings: PlayerMatchRating[];
  motmPlayerId?: string;
  motmTeamId?: string;
}

export type NewsKind = 'match' | 'training' | 'injury' | 'form' | 'tournament' | 'tactic' | 'scout';

export interface NewsItem {
  id: string;
  dateMs: number;
  kind: NewsKind;
  title: string;
  body: string;
  read: boolean;
  relatedFixtureId?: string;
  relatedPlayerId?: string;
}

export type TrainingFocus =
  | 'fitness'
  | 'passing'
  | 'shooting'
  | 'defense'
  | 'tactics'
  | 'setPieces'
  | 'recovery';

export type TrainingIntensity = 'low' | 'medium' | 'high';

export interface TrainingDelta {
  playerId: string;
  trait?: TraitKey;
  traitDelta?: number;
  conditionDelta?: number;
}

export interface TrainingSession {
  dateMs: number;
  focus: TrainingFocus;
  intensity: TrainingIntensity;
  deltas: TrainingDelta[];
  note: string;
}

export const DEFAULT_SLIDERS: TacticSliders = {
  pressing: 60,
  lineHeight: 55,
  tempo: 55,
  width: 50,
  directness: 50,
  risk: 50,
  buildUp: 50,
  tackling: 55,
};

export function createDefaultTactics(formation: FormationName, teamStyle: TeamStyle): ManagerTactics {
  return {
    formation,
    teamStyle,
    mentality: 0,
    sliders: { ...DEFAULT_SLIDERS },
  };
}

export function mentalityLabel(mentality: Mentality): string {
  return (
    {
      [-2]: 'Very defensive',
      [-1]: 'Defensive',
      [0]: 'Balanced',
      [1]: 'Attacking',
      [2]: 'All-out attack',
    } as Record<Mentality, string>
  )[mentality];
}
