export const PLAYER_ROLES = [
  'goalkeeper',
  'leftBack',
  'centerBackLeft',
  'centerBackRight',
  'rightBack',
  'defensiveMid',
  'centralMid',
  'attackingMid',
  'leftWing',
  'rightWing',
  'striker',
] as const;

export type PlayerRole = (typeof PLAYER_ROLES)[number];

export const PERSONALITY_ARCHETYPES = [
  'Playmaker',
  'Striker',
  'Defender',
  'Ball Winner',
  'Dribbler',
  'Speedster',
  'Captain',
  'Wildcard',
  'Goalkeeper',
] as const;

export type PersonalityArchetype = (typeof PERSONALITY_ARCHETYPES)[number];

export const TEAM_STYLES = [
  'possession',
  'counterAttack',
  'highPress',
  'defensive',
  'balanced',
  'directAttack',
] as const;

export type TeamStyle = (typeof TEAM_STYLES)[number];

export const FORMATION_NAMES = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2'] as const;

export type FormationName = (typeof FORMATION_NAMES)[number];

export const TRAIT_KEYS = [
  'aggression',
  'discipline',
  'creativity',
  'teamwork',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'speed',
  'stamina',
  'positioning',
  'riskTaking',
  'composure',
] as const;

export type TraitKey = (typeof TRAIT_KEYS)[number];

export type PlayerTraits = Record<TraitKey, number>;

export interface TopTrait {
  key: TraitKey;
  value: number;
}

export function clampTrait(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.5));
}

export function getTopTraits(traits: PlayerTraits, count = 3): TopTrait[] {
  return TRAIT_KEYS.map((key) => ({ key, value: traits[key] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, count);
}

export function formatRoleLabel(role: PlayerRole): string {
  const labels: Record<PlayerRole, string> = {
    goalkeeper: 'Goalkeeper',
    leftBack: 'Left back',
    centerBackLeft: 'Centre back',
    centerBackRight: 'Centre back',
    rightBack: 'Right back',
    defensiveMid: 'Defensive mid',
    centralMid: 'Central mid',
    attackingMid: 'Attacking mid',
    leftWing: 'Left wing',
    rightWing: 'Right wing',
    striker: 'Striker',
  };
  return labels[role];
}

export function createNeutralTraits(): PlayerTraits {
  return Object.fromEntries(TRAIT_KEYS.map((key) => [key, 0.5])) as PlayerTraits;
}
