import { TournamentState, type TournamentSaveData, SAVE_VERSION } from './TournamentState';

const SAVE_KEY = 'codex-futbol.world-5s-cup.save';
const SETTINGS_KEY = 'codex-futbol.world-5s-cup.settings';

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type SimDetail = 'full' | 'instant';

export interface GameSettings {
  matchLengthSeconds: number;
  crowdEnabled: boolean;
  graphicsQuality: GraphicsQuality;
  cameraSensitivity: number;
  soundEnabled: boolean;
  mobileControlsOpacity: number;
  difficulty: Difficulty;
  simDetail: SimDetail;
  defaultMatchSpeed: 1 | 2 | 4;
  debugMode: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  matchLengthSeconds: 180,
  crowdEnabled: true,
  graphicsQuality: 'medium',
  cameraSensitivity: 1,
  soundEnabled: true,
  mobileControlsOpacity: 0.82,
  difficulty: 'normal',
  simDetail: 'full',
  defaultMatchSpeed: 1,
  debugMode: false,
};

export const AUTOSAVE_EVENT = 'manager:autosave';

export function hasTournamentSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function saveTournament(tournament: TournamentState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(tournament.toSaveData()));
  try {
    window.dispatchEvent(new CustomEvent(AUTOSAVE_EVENT));
  } catch {
    // Ignore in non-DOM contexts (e.g. validation script).
  }
}

export function loadTournament(): TournamentState | undefined {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as Partial<TournamentSaveData> & Record<string, unknown>;
    const migrated = migrateSave(parsed);
    return TournamentState.fromSaveData(migrated);
  } catch (error) {
    console.warn('Failed to load tournament save.', error);
    return undefined;
  }
}

/** Migrate v1 saves (no version field) to current SAVE_VERSION. Adds defaults
 *  for new fields (lineups, tactics, news, trainingHistory, matchHistory) and
 *  ensures per-player condition/morale/form are present. */
export function migrateSave(raw: Partial<TournamentSaveData> & Record<string, unknown>): TournamentSaveData {
  const version = typeof raw.version === 'number' ? raw.version : 1;
  const data: TournamentSaveData = {
    version: SAVE_VERSION,
    selectedTeamId: raw.selectedTeamId as string,
    groups: (raw.groups ?? []) as TournamentSaveData['groups'],
    fixtures: (raw.fixtures ?? []) as TournamentSaveData['fixtures'],
    championTeamId: raw.championTeamId as string | undefined,
    userEliminated: Boolean(raw.userEliminated),
    teamProfiles: raw.teamProfiles as TournamentSaveData['teamProfiles'],
    lineups: (raw.lineups ?? {}) as TournamentSaveData['lineups'],
    tactics: (raw.tactics ?? {}) as TournamentSaveData['tactics'],
    news: (raw.news ?? []) as TournamentSaveData['news'],
    trainingHistory: (raw.trainingHistory ?? []) as TournamentSaveData['trainingHistory'],
    matchHistory: (raw.matchHistory ?? []) as TournamentSaveData['matchHistory'],
  };
  if (version < 2) {
    // No-op: defaults above are exactly the v2 schema additions. The TournamentState
    // constructor + normalizeProfiles fills in any per-player gaps (condition,
    // morale, form, bench).
  }
  return data;
}

export function clearTournamentSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function saveSettings(settings: GameSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
}

export function loadSettings(): GameSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;

  try {
    return normalizeSettings(JSON.parse(raw) as Partial<GameSettings>);
  } catch (error) {
    console.warn('Failed to load settings.', error);
    return DEFAULT_SETTINGS;
  }
}

export function resetSettings(): GameSettings {
  saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

function normalizeSettings(value: Partial<GameSettings>): GameSettings {
  const quality = value.graphicsQuality;
  const difficulty = value.difficulty;
  const simDetail = value.simDetail;
  const speed = value.defaultMatchSpeed;
  return {
    matchLengthSeconds: clampNumber(value.matchLengthSeconds, 90, 600, DEFAULT_SETTINGS.matchLengthSeconds),
    crowdEnabled: typeof value.crowdEnabled === 'boolean' ? value.crowdEnabled : DEFAULT_SETTINGS.crowdEnabled,
    graphicsQuality:
      quality === 'low' || quality === 'medium' || quality === 'high'
        ? quality
        : DEFAULT_SETTINGS.graphicsQuality,
    cameraSensitivity: clampNumber(value.cameraSensitivity, 0.55, 1.6, DEFAULT_SETTINGS.cameraSensitivity),
    soundEnabled: typeof value.soundEnabled === 'boolean' ? value.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
    mobileControlsOpacity: clampNumber(
      value.mobileControlsOpacity,
      0.45,
      1,
      DEFAULT_SETTINGS.mobileControlsOpacity,
    ),
    difficulty: difficulty === 'easy' || difficulty === 'normal' || difficulty === 'hard' ? difficulty : DEFAULT_SETTINGS.difficulty,
    simDetail: simDetail === 'full' || simDetail === 'instant' ? simDetail : DEFAULT_SETTINGS.simDetail,
    defaultMatchSpeed: speed === 1 || speed === 2 || speed === 4 ? speed : DEFAULT_SETTINGS.defaultMatchSpeed,
    debugMode: typeof value.debugMode === 'boolean' ? value.debugMode : DEFAULT_SETTINGS.debugMode,
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}
