import { PLAYER_ROLES, TRAIT_KEYS, getTopTraits, clampTrait, type PersonalityArchetype, type PlayerRole, type PlayerTraits } from '../game/playerTypes';
import type { TournamentPlayerProfile } from './teams';

/** 7 bench slots — 1 GK, 2 DEF, 2 MID, 2 ATT. */
const BENCH_ROLES: PlayerRole[] = [
  'goalkeeper',
  'centerBackLeft',
  'centerBackRight',
  'defensiveMid',
  'centralMid',
  'leftWing',
  'striker',
];

const PERSONALITY_BY_ROLE: Record<PlayerRole, PersonalityArchetype> = {
  goalkeeper: 'Goalkeeper',
  leftBack: 'Defender',
  centerBackLeft: 'Defender',
  centerBackRight: 'Defender',
  rightBack: 'Defender',
  defensiveMid: 'Ball Winner',
  centralMid: 'Captain',
  attackingMid: 'Playmaker',
  leftWing: 'Dribbler',
  rightWing: 'Dribbler',
  striker: 'Striker',
};

const BENCH_NUMBERS = [12, 13, 14, 15, 16, 17, 18];

const SUPPLEMENTAL_NAMES = [
  'Alex Kim', 'Marco Vela', 'Yusuf Adel', 'Hiro Tanaka', 'Petar Novak', 'Joao Lima',
  'Liam Ross', 'Eli Stone', 'Kai Reno', 'Diego Cruz', 'Sami Reed', 'Theo Vance',
  'Noah Frost', 'Owen Cole', 'Aaron Pike', 'Bram Voss', 'Kenji Aoki', 'Felix Ruiz',
];

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function averageTraitsAtRoles(starters: TournamentPlayerProfile[], roles: PlayerRole[]): PlayerTraits {
  const matches = starters.filter((p) => roles.includes(p.role));
  if (matches.length === 0) return averageAllTraits(starters);
  const sums: Record<string, number> = {};
  for (const key of TRAIT_KEYS) sums[key] = 0;
  for (const p of matches) {
    for (const key of TRAIT_KEYS) sums[key] += p.traits[key];
  }
  const traits = {} as PlayerTraits;
  for (const key of TRAIT_KEYS) traits[key] = sums[key] / matches.length;
  return traits;
}

function averageAllTraits(starters: TournamentPlayerProfile[]): PlayerTraits {
  const traits = {} as PlayerTraits;
  for (const key of TRAIT_KEYS) {
    let sum = 0;
    for (const p of starters) sum += p.traits[key];
    traits[key] = starters.length ? sum / starters.length : 0.5;
  }
  return traits;
}

function rolesForBand(role: PlayerRole): PlayerRole[] {
  if (role === 'goalkeeper') return ['goalkeeper'];
  if (role.includes('Back')) return ['leftBack', 'centerBackLeft', 'centerBackRight', 'rightBack'];
  if (role.includes('Mid')) return ['defensiveMid', 'centralMid', 'attackingMid'];
  return ['leftWing', 'rightWing', 'striker', 'attackingMid'];
}

export function createBenchPlayers(
  teamName: string,
  teamId: string,
  starters: TournamentPlayerProfile[],
): TournamentPlayerProfile[] {
  const teamSeed = hash(teamId);
  const rand = seededRandom(teamSeed);
  const bench: TournamentPlayerProfile[] = [];
  const usedNames = new Set(starters.map((s) => s.name));

  BENCH_ROLES.forEach((role, index) => {
    const baseTraits = averageTraitsAtRoles(starters, rolesForBand(role));
    const traits = {} as PlayerTraits;
    for (const key of TRAIT_KEYS) {
      const jitter = (rand() - 0.5) * 0.16; // ±0.08
      traits[key] = clampTrait(baseTraits[key] + jitter);
    }
    // Bench players are slightly weaker on average to keep starters distinct.
    traits.stamina = clampTrait(traits.stamina - 0.04);
    traits.composure = clampTrait(traits.composure - 0.05);

    let name = SUPPLEMENTAL_NAMES[(teamSeed + index) % SUPPLEMENTAL_NAMES.length];
    let attempt = 0;
    while (usedNames.has(name) && attempt < SUPPLEMENTAL_NAMES.length) {
      attempt += 1;
      name = SUPPLEMENTAL_NAMES[(teamSeed + index + attempt) % SUPPLEMENTAL_NAMES.length];
    }
    usedNames.add(name);

    bench.push({
      name,
      number: BENCH_NUMBERS[index] ?? 12 + index,
      role,
      personality: PERSONALITY_BY_ROLE[role],
      traits,
      topTraits: getTopTraits(traits),
      styleSeed: hash(`${teamId}:bench:${role}:${index}`),
      condition: 100,
      morale: 70,
      form: 0,
      recentRatings: [],
    });
    void teamName; // teamName param kept for potential future name generation
  });
  return bench;
}
