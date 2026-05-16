import { TournamentState, type TournamentSaveData } from './TournamentState';

const SAVE_KEY = 'codex-futbol.world-5s-cup.save';
const SETTINGS_KEY = 'codex-futbol.world-5s-cup.settings';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface GameSettings {
  matchLengthSeconds: number;
  crowdEnabled: boolean;
  graphicsQuality: GraphicsQuality;
  cameraSensitivity: number;
  soundEnabled: boolean;
  mobileControlsOpacity: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  matchLengthSeconds: 180,
  crowdEnabled: true,
  graphicsQuality: 'medium',
  cameraSensitivity: 1,
  soundEnabled: true,
  mobileControlsOpacity: 0.82,
};

export function hasTournamentSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function saveTournament(tournament: TournamentState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(tournament.toSaveData()));
}

export function loadTournament(): TournamentState | undefined {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return undefined;

  try {
    const data = JSON.parse(raw) as TournamentSaveData;
    return TournamentState.fromSaveData(data);
  } catch (error) {
    console.warn('Failed to load World 5s Cup save.', error);
    return undefined;
  }
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
    console.warn('Failed to load World 5s Cup settings.', error);
    return DEFAULT_SETTINGS;
  }
}

export function resetSettings(): GameSettings {
  saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

function normalizeSettings(value: Partial<GameSettings>): GameSettings {
  const quality = value.graphicsQuality;
  return {
    matchLengthSeconds: clampNumber(value.matchLengthSeconds, 90, 300, DEFAULT_SETTINGS.matchLengthSeconds),
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
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}
