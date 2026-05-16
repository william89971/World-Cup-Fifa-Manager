import {
  FORMATION_NAMES,
  PLAYER_ROLES,
  TRAIT_KEYS,
  clampTrait,
  getTopTraits,
  type FormationName,
  type PersonalityArchetype,
  type PlayerRole,
  type PlayerTraits,
  type TeamStyle,
  type TopTrait,
} from '../game/playerTypes';
import { createBenchPlayers } from './benchGen';

export interface TeamRating {
  attack: number;
  defense: number;
  speed: number;
  stamina: number;
  overall: number;
}

export interface TeamColors {
  primary: number;
  secondary: number;
  accent: number;
}

export interface TournamentPlayerProfile {
  name: string;
  number: number;
  role: PlayerRole;
  personality: PersonalityArchetype;
  traits: PlayerTraits;
  topTraits: TopTrait[];
  styleSeed: number;
  /** Manager-mode condition 0..100, default 100. */
  condition?: number;
  /** Manager-mode morale 0..100, default 70. */
  morale?: number;
  /** Manager-mode form -5..+5, default 0. */
  form?: number;
  /** Manager-mode last-5 match ratings (0..10). */
  recentRatings?: number[];
  /** Manager-mode captain flag. */
  isCaptain?: boolean;
  /** Manager-mode notes (string). */
  notes?: string;
  /** Days remaining on the injury (manager-mode). */
  injuredDays?: number;
}

export interface TournamentTeam {
  id: string;
  name: string;
  code: string;
  colors: TeamColors;
  rating: TeamRating;
  teamStyle: TeamStyle;
  formationPreferences: FormationName[];
  flagSvg: string;
  /** The 11 starters (canonical role order). */
  players: TournamentPlayerProfile[];
  /** The 7 bench players, generated programmatically. */
  bench: TournamentPlayerProfile[];
}

export interface TournamentTeamProfileSave {
  teamId: string;
  teamStyle: TeamStyle;
  formationPreferences: FormationName[];
  players: TournamentPlayerProfile[];
  bench: TournamentPlayerProfile[];
}

interface TeamRow {
  name: string;
  code: string;
  colors: TeamColors;
  flagSvg: string;
  players: string[];
}

const C = {
  white: '#ffffff',
  black: '#111111',
  red: '#d62828',
  darkRed: '#b10f2e',
  blue: '#16468f',
  lightBlue: '#74acdf',
  navy: '#012169',
  green: '#00843d',
  darkGreen: '#006341',
  yellow: '#fcd116',
  gold: '#ffcd00',
  orange: '#ff8200',
  maroon: '#8a1538',
} as const;

const roleNumbers: Record<PlayerRole, number> = {
  goalkeeper: 1,
  leftBack: 3,
  centerBackLeft: 4,
  centerBackRight: 5,
  rightBack: 2,
  defensiveMid: 6,
  centralMid: 8,
  attackingMid: 10,
  leftWing: 11,
  rightWing: 7,
  striker: 9,
};

function ratingFor(index: number): TeamRating {
  const attack = 64 + ((index * 7) % 26);
  const defense = 62 + ((index * 11) % 27);
  const speed = 63 + ((index * 13) % 25);
  const stamina = 64 + ((index * 17) % 24);
  const overall = Math.round((attack + defense + speed + stamina) / 4);
  return { attack, defense, speed, stamina, overall };
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function roster(names: readonly string[]): string[] {
  return expandNames(names);
}

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function random01(seed: string): number {
  return hash(seed) / 0xffffffff;
}

function expandNames(names: readonly string[]): string[] {
  const expanded = [...names];
  const firstNames = names.map((name) => name.split(' ')[0] ?? name);
  const lastNames = names.map((name) => name.split(' ').slice(1).join(' ') || name);
  let index = 0;

  while (expanded.length < PLAYER_ROLES.length) {
    const first = firstNames[index % firstNames.length];
    const last = lastNames[(index * 2 + 1) % lastNames.length];
    const candidate = `${first} ${last}`;
    expanded.push(expanded.includes(candidate) ? `${first} ${lastNames[(index * 3 + 2) % lastNames.length]}` : candidate);
    index += 1;
  }

  return expanded.slice(0, PLAYER_ROLES.length);
}

function styleForTeam(index: number, rating: TeamRating): TeamStyle {
  if (rating.defense >= rating.attack + 8) return 'defensive';
  if (rating.speed >= rating.defense + 7) return 'counterAttack';
  if (rating.stamina >= 82 && rating.defense >= 74) return 'highPress';
  if (rating.attack >= 82 && rating.speed >= 74) return 'directAttack';
  if (rating.attack >= rating.defense + 6) return 'possession';
  return TEAM_STYLES_BY_INDEX[index % TEAM_STYLES_BY_INDEX.length];
}

const TEAM_STYLES_BY_INDEX: TeamStyle[] = [
  'balanced',
  'possession',
  'counterAttack',
  'highPress',
  'defensive',
  'directAttack',
];

function formationPreferencesForStyle(style: TeamStyle): FormationName[] {
  const preferences: Record<TeamStyle, FormationName[]> = {
    possession: ['4-3-3', '3-5-2', '4-4-2'],
    counterAttack: ['4-4-2', '4-3-3', '3-5-2'],
    highPress: ['4-3-3', '3-5-2', '4-4-2'],
    defensive: ['4-4-2', '3-5-2', '4-3-3'],
    balanced: ['4-3-3', '4-4-2', '3-5-2'],
    directAttack: ['4-4-2', '4-3-3', '3-5-2'],
  };
  return preferences[style].filter((formation) => FORMATION_NAMES.includes(formation));
}

function personalityForRole(role: PlayerRole, style: TeamStyle, seed: string): PersonalityArchetype {
  if (role === 'goalkeeper') return 'Goalkeeper';
  if (role === 'striker') return 'Striker';
  if (role === 'leftWing' || role === 'rightWing') {
    if (style === 'counterAttack') return 'Speedster';
    return random01(`${seed}:wing`) > 0.48 ? 'Dribbler' : 'Wildcard';
  }
  if (role === 'attackingMid') return random01(`${seed}:am`) > 0.42 ? 'Playmaker' : 'Dribbler';
  if (role === 'centralMid') return style === 'possession' ? 'Playmaker' : 'Captain';
  if (role === 'defensiveMid') return random01(`${seed}:dm`) > 0.45 ? 'Ball Winner' : 'Captain';
  if (role === 'leftBack' || role === 'rightBack') {
    return style === 'highPress' || style === 'counterAttack' ? 'Speedster' : 'Defender';
  }
  return random01(`${seed}:cb`) > 0.35 ? 'Defender' : 'Ball Winner';
}

function createTraits(
  role: PlayerRole,
  personality: PersonalityArchetype,
  style: TeamStyle,
  rating: TeamRating,
  seed: string,
): PlayerTraits {
  const traits = { ...PERSONALITY_TRAITS[personality] };
  addRoleModifiers(traits, role);
  addStyleModifiers(traits, style);
  addRatingModifiers(traits, rating);

  for (const key of TRAIT_KEYS) {
    const variance = (random01(`${seed}:${key}`) - 0.5) * 0.16;
    traits[key] = clampTrait(traits[key] + variance);
  }

  return traits;
}

const PERSONALITY_TRAITS: Record<PersonalityArchetype, PlayerTraits> = {
  Playmaker: {
    aggression: 0.42,
    discipline: 0.66,
    creativity: 0.86,
    teamwork: 0.84,
    shooting: 0.58,
    passing: 0.9,
    dribbling: 0.68,
    defending: 0.44,
    speed: 0.58,
    stamina: 0.64,
    positioning: 0.78,
    riskTaking: 0.62,
    composure: 0.76,
  },
  Striker: {
    aggression: 0.72,
    discipline: 0.56,
    creativity: 0.58,
    teamwork: 0.54,
    shooting: 0.9,
    passing: 0.54,
    dribbling: 0.68,
    defending: 0.28,
    speed: 0.72,
    stamina: 0.68,
    positioning: 0.88,
    riskTaking: 0.68,
    composure: 0.78,
  },
  Defender: {
    aggression: 0.58,
    discipline: 0.86,
    creativity: 0.34,
    teamwork: 0.72,
    shooting: 0.25,
    passing: 0.56,
    dribbling: 0.34,
    defending: 0.9,
    speed: 0.58,
    stamina: 0.72,
    positioning: 0.84,
    riskTaking: 0.28,
    composure: 0.82,
  },
  'Ball Winner': {
    aggression: 0.9,
    discipline: 0.66,
    creativity: 0.32,
    teamwork: 0.64,
    shooting: 0.34,
    passing: 0.52,
    dribbling: 0.42,
    defending: 0.84,
    speed: 0.68,
    stamina: 0.88,
    positioning: 0.74,
    riskTaking: 0.48,
    composure: 0.62,
  },
  Dribbler: {
    aggression: 0.58,
    discipline: 0.48,
    creativity: 0.86,
    teamwork: 0.58,
    shooting: 0.62,
    passing: 0.62,
    dribbling: 0.92,
    defending: 0.32,
    speed: 0.78,
    stamina: 0.68,
    positioning: 0.66,
    riskTaking: 0.82,
    composure: 0.68,
  },
  Speedster: {
    aggression: 0.62,
    discipline: 0.52,
    creativity: 0.62,
    teamwork: 0.56,
    shooting: 0.6,
    passing: 0.55,
    dribbling: 0.76,
    defending: 0.48,
    speed: 0.94,
    stamina: 0.86,
    positioning: 0.64,
    riskTaking: 0.76,
    composure: 0.58,
  },
  Captain: {
    aggression: 0.6,
    discipline: 0.88,
    creativity: 0.6,
    teamwork: 0.9,
    shooting: 0.54,
    passing: 0.72,
    dribbling: 0.56,
    defending: 0.68,
    speed: 0.6,
    stamina: 0.78,
    positioning: 0.84,
    riskTaking: 0.34,
    composure: 0.9,
  },
  Wildcard: {
    aggression: 0.66,
    discipline: 0.32,
    creativity: 0.92,
    teamwork: 0.46,
    shooting: 0.66,
    passing: 0.66,
    dribbling: 0.78,
    defending: 0.34,
    speed: 0.72,
    stamina: 0.62,
    positioning: 0.58,
    riskTaking: 0.94,
    composure: 0.54,
  },
  Goalkeeper: {
    aggression: 0.44,
    discipline: 0.82,
    creativity: 0.35,
    teamwork: 0.68,
    shooting: 0.12,
    passing: 0.58,
    dribbling: 0.18,
    defending: 0.92,
    speed: 0.52,
    stamina: 0.66,
    positioning: 0.94,
    riskTaking: 0.24,
    composure: 0.9,
  },
};

function addRoleModifiers(traits: PlayerTraits, role: PlayerRole): void {
  if (role === 'striker') {
    traits.shooting += 0.08;
    traits.positioning += 0.06;
  } else if (role === 'leftWing' || role === 'rightWing') {
    traits.speed += 0.08;
    traits.dribbling += 0.06;
  } else if (role === 'attackingMid' || role === 'centralMid') {
    traits.passing += 0.06;
    traits.teamwork += 0.04;
  } else if (role === 'defensiveMid') {
    traits.defending += 0.07;
    traits.stamina += 0.06;
  } else if (role === 'goalkeeper' || role.includes('Back')) {
    traits.defending += 0.06;
    traits.discipline += 0.05;
  }
}

function addStyleModifiers(traits: PlayerTraits, style: TeamStyle): void {
  if (style === 'possession') {
    traits.passing += 0.06;
    traits.teamwork += 0.05;
    traits.riskTaking -= 0.04;
  } else if (style === 'counterAttack') {
    traits.speed += 0.06;
    traits.riskTaking += 0.05;
    traits.positioning += 0.03;
  } else if (style === 'highPress') {
    traits.aggression += 0.08;
    traits.stamina += 0.05;
    traits.discipline -= 0.03;
  } else if (style === 'defensive') {
    traits.defending += 0.07;
    traits.discipline += 0.07;
    traits.riskTaking -= 0.06;
  } else if (style === 'directAttack') {
    traits.shooting += 0.05;
    traits.riskTaking += 0.06;
    traits.passing += 0.03;
  }
}

function addRatingModifiers(traits: PlayerTraits, rating: TeamRating): void {
  traits.shooting += (rating.attack - 74) / 220;
  traits.passing += (rating.attack - 74) / 260;
  traits.defending += (rating.defense - 74) / 220;
  traits.discipline += (rating.defense - 74) / 280;
  traits.speed += (rating.speed - 74) / 220;
  traits.stamina += (rating.stamina - 74) / 220;
}

function createTournamentRoster(
  names: readonly string[],
  teamName: string,
  style: TeamStyle,
  rating: TeamRating,
): TournamentPlayerProfile[] {
  return PLAYER_ROLES.map((role, index) => {
    const name = names[index] ?? `${teamName} Player ${index + 1}`;
    const styleSeed = hash(`${teamName}:${role}:${name}:${index}`);
    const personality = personalityForRole(role, style, `${teamName}:${role}:${index}`);
    const traits = createTraits(role, personality, style, rating, `${teamName}:${name}:${role}`);
    return {
      name,
      number: roleNumbers[role],
      role,
      personality,
      traits,
      topTraits: getTopTraits(traits),
      styleSeed,
    };
  });
}

function svg(body: string): string {
  return `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}

function rect(x: number, y: number, width: number, height: number, fill: string): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
}

function circle(cx: number, cy: number, radius: number, fill: string): string {
  return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}"/>`;
}

function polygon(points: string, fill: string): string {
  return `<polygon points="${points}" fill="${fill}"/>`;
}

function path(d: string, fill: string, extra = ''): string {
  return `<path d="${d}" fill="${fill}" ${extra}/>`;
}

function horizontal(colors: readonly string[], weights?: readonly number[]): string {
  const total = (weights ?? colors.map(() => 1)).reduce((sum, value) => sum + value, 0);
  let y = 0;
  const body = colors
    .map((color, index) => {
      const height = 40 * ((weights?.[index] ?? 1) / total);
      const block = rect(0, y, 60, height, color);
      y += height;
      return block;
    })
    .join('');
  return svg(body);
}

function vertical(colors: readonly string[], weights?: readonly number[]): string {
  const total = (weights ?? colors.map(() => 1)).reduce((sum, value) => sum + value, 0);
  let x = 0;
  const body = colors
    .map((color, index) => {
      const width = 60 * ((weights?.[index] ?? 1) / total);
      const block = rect(x, 0, width, 40, color);
      x += width;
      return block;
    })
    .join('');
  return svg(body);
}

function star(cx: number, cy: number, outer: number, fill: string, points = 5): string {
  const inner = outer * 0.42;
  const coords: string[] = [];
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / points;
    coords.push(`${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`);
  }
  return polygon(coords.join(' '), fill);
}

function sun(cx: number, cy: number, radius: number, fill: string): string {
  const rays: string[] = [];
  for (let index = 0; index < 16; index += 1) {
    const angle = (Math.PI * 2 * index) / 16;
    const x1 = cx + Math.cos(angle) * (radius + 1.3);
    const y1 = cy + Math.sin(angle) * (radius + 1.3);
    const x2 = cx + Math.cos(angle) * (radius + 4);
    const y2 = cy + Math.sin(angle) * (radius + 4);
    rays.push(`<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${fill}" stroke-width="1.1"/>`);
  }
  return `${rays.join('')}${circle(cx, cy, radius, fill)}`;
}

function cross(bg: string, crossColor: string, outline?: string): string {
  const outlineBody = outline
    ? `${rect(0, 14, 60, 12, outline)}${rect(24, 0, 12, 40, outline)}`
    : '';
  return svg(`${rect(0, 0, 60, 40, bg)}${outlineBody}${rect(0, 16, 60, 8, crossColor)}${rect(26, 0, 8, 40, crossColor)}`);
}

function nordic(bg: string, crossColor: string, outline?: string): string {
  const outlineBody = outline
    ? `${rect(0, 15, 60, 10, outline)}${rect(17, 0, 10, 40, outline)}`
    : '';
  return svg(`${rect(0, 0, 60, 40, bg)}${outlineBody}${rect(0, 17, 60, 6, crossColor)}${rect(19, 0, 6, 40, crossColor)}`);
}

function saltire(bg: string, stripe: string): string {
  return svg(`${rect(0, 0, 60, 40, bg)}<path d="M0 0 L8 0 L60 32 L60 40 L52 40 L0 8 Z M60 0 L60 8 L8 40 L0 40 L0 32 L52 0 Z" fill="${stripe}"/>`);
}

function unionCanton(x: number, y: number, scale: number): string {
  const w = 30 * scale;
  const h = 20 * scale;
  const sw = 4 * scale;
  const rw = 2 * scale;
  return `<g transform="translate(${x} ${y})"><rect width="${w}" height="${h}" fill="${C.navy}"/><path d="M0 0 L${sw} 0 L${w} ${h - sw} L${w} ${h} L${w - sw} ${h} L0 ${sw} Z M${w} 0 L${w} ${sw} L${sw} ${h} L0 ${h} L0 ${h - sw} L${w - sw} 0 Z" fill="${C.white}"/><path d="M0 0 L${rw} 0 L${w} ${h - rw} L${w} ${h} L${w - rw} ${h} L0 ${rw} Z M${w} 0 L${w} ${rw} L${rw} ${h} L0 ${h} L0 ${h - rw} L${w - rw} 0 Z" fill="#c8102e"/><rect x="${w / 2 - sw / 2}" width="${sw}" height="${h}" fill="${C.white}"/><rect y="${h / 2 - sw / 2}" width="${w}" height="${sw}" fill="${C.white}"/><rect x="${w / 2 - rw / 2}" width="${rw}" height="${h}" fill="#c8102e"/><rect y="${h / 2 - rw / 2}" width="${w}" height="${rw}" fill="#c8102e"/></g>`;
}

function wheel(cx: number, cy: number, radius: number, color: string): string {
  const spokes: string[] = [];
  for (let index = 0; index < 24; index += 1) {
    const angle = (Math.PI * 2 * index) / 24;
    spokes.push(`<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(angle) * radius).toFixed(2)}" y2="${(cy + Math.sin(angle) * radius).toFixed(2)}" stroke="${color}" stroke-width="0.45"/>`);
  }
  return `<g>${circle(cx, cy, radius, 'none').replace('/>', ` stroke="${color}" stroke-width="1" fill="none"/>`)}${spokes.join('')}${circle(cx, cy, 0.9, color)}</g>`;
}

function mapleLeaf(cx: number, cy: number, fill: string): string {
  return `<g transform="translate(${cx} ${cy}) scale(0.38)">${polygon('0,-22 4,-10 13,-16 10,-5 20,-4 10,3 15,13 4,9 3,22 -3,22 -4,9 -15,13 -10,3 -20,-4 -10,-5 -13,-16 -4,-10', fill)}</g>`;
}

function checker(cx: number, cy: number): string {
  const cells: string[] = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      cells.push(rect(cx + col * 2.2, cy + row * 2.2, 2.2, 2.2, (row + col) % 2 === 0 ? C.red : C.white));
    }
  }
  return `<g>${cells.join('')}</g>`;
}

function argentina(): string {
  return svg(`${rect(0, 0, 60, 13.33, C.lightBlue)}${rect(0, 13.33, 60, 13.34, C.white)}${rect(0, 26.67, 60, 13.33, C.lightBlue)}${sun(30, 20, 3.4, '#f6b40e')}`);
}

function australia(): string {
  return svg(`${rect(0, 0, 60, 40, C.navy)}${unionCanton(0, 0, 0.72)}${star(13, 31, 4, C.white, 7)}${star(43, 9, 2.2, C.white, 7)}${star(50, 17, 2.1, C.white, 7)}${star(40, 25, 2.1, C.white, 7)}${star(51, 31, 2.1, C.white, 7)}${star(46, 22, 1.2, C.white, 5)}`);
}

function brazil(): string {
  return svg(`${rect(0, 0, 60, 40, '#009b3a')}${polygon('30,5 54,20 30,35 6,20', '#ffdf00')}${circle(30, 20, 9, '#002776')}<path d="M20 18 C27 15 36 15 43 19" fill="none" stroke="${C.white}" stroke-width="2.2"/>`);
}

function china(): string {
  return svg(`${rect(0, 0, 60, 40, '#de2910')}${star(11, 10, 5.3, '#ffde00')}${star(22, 6, 1.7, '#ffde00')}${star(27, 11, 1.7, '#ffde00')}${star(27, 18, 1.7, '#ffde00')}${star(22, 23, 1.7, '#ffde00')}`);
}

function costaRica(): string {
  return horizontal(['#002b7f', C.white, '#ce1126', C.white, '#002b7f'], [1, 1, 2, 1, 1]);
}

function ecuador(): string {
  return svg(`${horizontal([C.yellow, '#034ea2', '#ed1c24'], [2, 1, 1]).replace(/^<svg[^>]*>|<\/svg>$/g, '')}${circle(30, 20, 3.2, '#7a4b20')}${star(30, 17.4, 1.5, C.yellow)}`);
}

function ghana(): string {
  return svg(`${horizontal(['#ce1126', '#fcd116', '#006b3f']).replace(/^<svg[^>]*>|<\/svg>$/g, '')}${star(30, 20, 4.4, C.black)}`);
}

function greece(): string {
  const stripes: string[] = [];
  for (let index = 0; index < 9; index += 1) {
    stripes.push(rect(0, index * (40 / 9), 60, 40 / 9, index % 2 === 0 ? '#0d5eaf' : C.white));
  }
  return svg(`${stripes.join('')}${rect(0, 0, 22, 22, '#0d5eaf')}${rect(0, 8.5, 22, 5, C.white)}${rect(8.5, 0, 5, 22, C.white)}`);
}

function india(): string {
  return svg(`${horizontal(['#ff9933', C.white, '#138808']).replace(/^<svg[^>]*>|<\/svg>$/g, '')}${wheel(30, 20, 4.2, '#000080')}`);
}

function japan(): string {
  return svg(`${rect(0, 0, 60, 40, C.white)}${circle(30, 20, 9, '#bc002d')}`);
}

function mexico(): string {
  return svg(`${vertical(['#006847', C.white, '#ce1126']).replace(/^<svg[^>]*>|<\/svg>$/g, '')}${circle(30, 20, 4.2, '#8c6f24')}${path('M27 21 C29 16 33 16 34 21 C32 19 29 19 27 21Z', '#2f7d32')}`);
}

function morocco(): string {
  return svg(`${rect(0, 0, 60, 40, '#c1272d')}<path d="M30 10 L33 19 L42 19 L34.8 24.2 L37.5 33 L30 27.5 L22.5 33 L25.2 24.2 L18 19 L27 19 Z" fill="none" stroke="#006233" stroke-width="2.2"/>`);
}

function newZealand(): string {
  return svg(`${rect(0, 0, 60, 40, '#00247d')}${unionCanton(0, 0, 0.72)}${star(43, 9, 2.8, C.white)}${star(43, 9, 2, '#cc142b')}${star(51, 17, 2.8, C.white)}${star(51, 17, 2, '#cc142b')}${star(40, 25, 2.8, C.white)}${star(40, 25, 2, '#cc142b')}${star(51, 31, 2.8, C.white)}${star(51, 31, 2, '#cc142b')}`);
}

function portugal(): string {
  return svg(`${rect(0, 0, 24, 40, '#006600')}${rect(24, 0, 36, 40, '#ff0000')}${circle(24, 20, 5.5, '#ffcc00')}${circle(24, 20, 3.6, '#ffffff')}${rect(22, 16.5, 4, 7, '#003399')}`);
}

function qatar(): string {
  const teeth = Array.from({ length: 9 }, (_, index) => {
    const y = index * (40 / 9);
    return polygon(`16,${y.toFixed(2)} 25,${(y + 40 / 18).toFixed(2)} 16,${(y + 40 / 9).toFixed(2)}`, C.white);
  }).join('');
  return svg(`${rect(0, 0, 60, 40, C.maroon)}${rect(0, 0, 16, 40, C.white)}${teeth}`);
}

function saudiArabia(): string {
  return svg(`${rect(0, 0, 60, 40, '#006c35')}<g fill="${C.white}">${rect(14, 12, 32, 2.2, C.white)}${rect(18, 16, 24, 1.8, C.white)}${rect(21, 20, 18, 1.6, C.white)}</g><path d="M16 30 C28 33 39 33 48 29" fill="none" stroke="${C.white}" stroke-width="2.2"/><path d="M46 27 L51 29 L46 31 Z" fill="${C.white}"/>`);
}

function southAfrica(): string {
  return svg(`${rect(0, 0, 60, 40, '#002395')}${rect(0, 20, 60, 20, '#de3831')}${polygon('0,0 30,20 0,40', C.black)}<path d="M0 0 L34 20 L0 40" fill="none" stroke="${C.white}" stroke-width="13"/><path d="M0 0 L34 20 L0 40" fill="none" stroke="#ffb612" stroke-width="8"/><path d="M0 5 L27 20 L0 35" fill="none" stroke="#007a4d" stroke-width="10"/><path d="M27 20 L60 20" stroke="#007a4d" stroke-width="10"/>`);
}

function southKorea(): string {
  return svg(`${rect(0, 0, 60, 40, C.white)}<g transform="translate(30 20) rotate(-25)"><path d="M0 -7 A7 7 0 1 1 0 7 A3.5 3.5 0 1 0 0 0 A3.5 3.5 0 1 1 0 -7" fill="#c60c30"/><path d="M0 -7 A7 7 0 1 0 0 7 A3.5 3.5 0 1 1 0 0 A3.5 3.5 0 1 0 0 -7" fill="#003478"/></g><g stroke="${C.black}" stroke-width="1.5">${rect(10, 8, 9, 1.5, C.black)}${rect(10, 12, 9, 1.5, C.black)}${rect(10, 16, 9, 1.5, C.black)}${rect(41, 22, 9, 1.5, C.black)}${rect(41, 26, 9, 1.5, C.black)}${rect(41, 30, 9, 1.5, C.black)}</g>`);
}

function spain(): string {
  return svg(`${horizontal(['#aa151b', '#f1bf00', '#aa151b'], [1, 2, 1]).replace(/^<svg[^>]*>|<\/svg>$/g, '')}${rect(17, 17, 4, 7, '#c60b1e')}${circle(19, 16, 2.3, '#f1bf00')}`);
}

function switzerland(): string {
  return svg(`${rect(0, 0, 60, 40, '#d52b1e')}${rect(26, 8, 8, 24, C.white)}${rect(18, 16, 24, 8, C.white)}`);
}

function unitedStates(): string {
  const stripes = Array.from({ length: 13 }, (_, index) =>
    rect(0, index * (40 / 13), 60, 40 / 13, index % 2 === 0 ? '#b22234' : C.white),
  ).join('');
  const stars = Array.from({ length: 30 }, (_, index) => {
    const col = index % 6;
    const row = Math.floor(index / 6);
    return circle(3.5 + col * 3.8, 3.2 + row * 3.2, 0.55, C.white);
  }).join('');
  return svg(`${stripes}${rect(0, 0, 25, 21.6, '#3c3b6e')}${stars}`);
}

function uruguay(): string {
  const stripes = Array.from({ length: 9 }, (_, index) =>
    rect(0, index * (40 / 9), 60, 40 / 9, index % 2 === 0 ? C.white : '#0038a8'),
  ).join('');
  return svg(`${stripes}${rect(0, 0, 20, 20, C.white)}${sun(10, 10, 3.2, '#fcd116')}`);
}

function wales(): string {
  return svg(`${rect(0, 0, 60, 20, C.white)}${rect(0, 20, 60, 20, '#00a650')}<path d="M17 24 L25 15 L34 19 L42 15 L39 23 L47 27 L37 28 L34 34 L28 28 L18 31 Z" fill="#d30731"/>`);
}

const TEAM_ROWS: TeamRow[] = [
  { name: 'Argentina', code: 'ARG', colors: { primary: 0x74acdf, secondary: 0xffffff, accent: 0xf6b40e }, flagSvg: argentina(), players: roster(['Mateo Rivas', 'Tomas Vidal', 'Nico Soria', 'Bruno Vega', 'Luca Ferrey']) },
  { name: 'Australia', code: 'AUS', colors: { primary: 0x0b3d91, secondary: 0xf2d04f, accent: 0xffffff }, flagSvg: australia(), players: roster(['Jack Miller', 'Lachlan Reed', 'Owen Burke', 'Tyson Ward', 'Cooper Hayes']) },
  { name: 'Austria', code: 'AUT', colors: { primary: 0xd81e05, secondary: 0xffffff, accent: 0x202020 }, flagSvg: horizontal(['#ed2939', C.white, '#ed2939']), players: roster(['Lukas Gruber', 'Felix Bauer', 'Jonas Adler', 'Marco Leitner', 'Simon Hofer']) },
  { name: 'Belgium', code: 'BEL', colors: { primary: 0xfdda24, secondary: 0xef3340, accent: 0x111111 }, flagSvg: vertical([C.black, '#fdda24', '#ef3340']), players: roster(['Noah Verlaine', 'Milan Peeters', 'Remy Voss', 'Jules Martens', 'Arno De Smet']) },
  { name: 'Brazil', code: 'BRA', colors: { primary: 0x009b3a, secondary: 0xffdf00, accent: 0x002776 }, flagSvg: brazil(), players: roster(['Caio Mendes', 'Rafa Duarte', 'Theo Nunes', 'Breno Costa', 'Luan Ribeiro']) },
  { name: 'Cameroon', code: 'CMR', colors: { primary: 0x007a5e, secondary: 0xce1126, accent: 0xfcd116 }, flagSvg: svg(`${vertical(['#007a5e', '#ce1126', '#fcd116']).replace(/^<svg[^>]*>|<\/svg>$/g, '')}${star(30, 20, 4, '#fcd116')}`), players: roster(['Andre Mbeka', 'Joel Tambo', 'Eric Nguema', 'Samuel Bissa', 'Kevin Fotso']) },
  { name: 'Canada', code: 'CAN', colors: { primary: 0xff0000, secondary: 0xffffff, accent: 0x1d1d1d }, flagSvg: svg(`${rect(0, 0, 15, 40, '#ff0000')}${rect(15, 0, 30, 40, C.white)}${rect(45, 0, 15, 40, '#ff0000')}${mapleLeaf(30, 20, '#ff0000')}`), players: roster(['Ethan Fraser', 'Noah Mercer', 'Caleb Brooks', 'Mason Reid', 'Logan Hart']) },
  { name: 'Chile', code: 'CHI', colors: { primary: 0xd52b1e, secondary: 0x0039a6, accent: 0xffffff }, flagSvg: svg(`${rect(0, 0, 60, 20, C.white)}${rect(0, 20, 60, 20, '#d52b1e')}${rect(0, 0, 20, 20, '#0039a6')}${star(10, 10, 4, C.white)}`), players: roster(['Diego Araya', 'Tomas Rojas', 'Pablo Lagos', 'Felipe Moya', 'Matias Soto']) },
  { name: 'China', code: 'CHN', colors: { primary: 0xde2910, secondary: 0xffde00, accent: 0xffffff }, flagSvg: china(), players: roster(['Wei Chen', 'Jun Liang', 'Bo Zhang', 'Kai Lin', 'Ming Zhao']) },
  { name: 'Colombia', code: 'COL', colors: { primary: 0xfcd116, secondary: 0x003893, accent: 0xce1126 }, flagSvg: horizontal(['#fcd116', '#003893', '#ce1126'], [2, 1, 1]), players: roster(['Mateo Vargas', 'Santi Mora', 'Julian Pardo', 'Nico Rangel', 'Andres Carden']) },
  { name: 'Costa Rica', code: 'CRC', colors: { primary: 0xce1126, secondary: 0x002b7f, accent: 0xffffff }, flagSvg: costaRica(), players: roster(['Marco Solis', 'Daniel Mora', 'Adrian Vega', 'Jose Urena', 'Luis Arce']) },
  { name: 'Croatia', code: 'CRO', colors: { primary: 0xff0000, secondary: 0xffffff, accent: 0x171796 }, flagSvg: svg(`${horizontal(['#ff0000', C.white, '#171796']).replace(/^<svg[^>]*>|<\/svg>$/g, '')}${checker(24.5, 14.5)}`), players: roster(['Luka Baric', 'Ivan Kovac', 'Marko Vuk', 'Niko Radel', 'Ante Peric']) },
  { name: 'Denmark', code: 'DEN', colors: { primary: 0xc60c30, secondary: 0xffffff, accent: 0x202020 }, flagSvg: nordic('#c60c30', C.white), players: roster(['Mikkel Holm', 'Jonas Vester', 'Emil Lund', 'Kasper Soren', 'Magnus Niel']) },
  { name: 'Ecuador', code: 'ECU', colors: { primary: 0xffdd00, secondary: 0x034ea2, accent: 0xed1c24 }, flagSvg: ecuador(), players: roster(['Diego Ibarra', 'Mateo Cueva', 'Luis Zamora', 'Nico Vera', 'Jhon Rivas']) },
  { name: 'Egypt', code: 'EGY', colors: { primary: 0xce1126, secondary: 0xffffff, accent: 0x111111 }, flagSvg: svg(`${horizontal(['#ce1126', C.white, C.black]).replace(/^<svg[^>]*>|<\/svg>$/g, '')}${path('M27 20 L30 15 L33 20 L31 25 L29 25 Z', '#c09300')}`), players: roster(['Omar Nasser', 'Karim Fathi', 'Yusuf Salem', 'Hassan Adel', 'Tarek Mansour']) },
  { name: 'England', code: 'ENG', colors: { primary: 0xffffff, secondary: 0xce1124, accent: 0x1d3557 }, flagSvg: cross(C.white, '#ce1124'), players: roster(['Harry Lawson', 'Oliver Trent', 'Ben Archer', 'Callum Pike', 'Alfie Moore']) },
  { name: 'France', code: 'FRA', colors: { primary: 0x002654, secondary: 0xffffff, accent: 0xed2939 }, flagSvg: vertical(['#002654', C.white, '#ed2939']), players: roster(['Hugo Morel', 'Theo Garnier', 'Lucas Perrin', 'Nolan Caron', 'Enzo Laurent']) },
  { name: 'Germany', code: 'GER', colors: { primary: 0x000000, secondary: 0xdd0000, accent: 0xffce00 }, flagSvg: horizontal([C.black, '#dd0000', '#ffce00']), players: roster(['Jonas Keller', 'Felix Braun', 'Leon Hartz', 'Mats Vogel', 'Timo Brandt']) },
  { name: 'Ghana', code: 'GHA', colors: { primary: 0xce1126, secondary: 0xfcd116, accent: 0x006b3f }, flagSvg: ghana(), players: roster(['Kwame Mensa', 'Kofi Adu', 'Yaw Boateng', 'Kojo Asare', 'Nana Osei']) },
  { name: 'Greece', code: 'GRE', colors: { primary: 0x0d5eaf, secondary: 0xffffff, accent: 0x202020 }, flagSvg: greece(), players: roster(['Nikos Stavro', 'Giorgos Laskas', 'Petros Manis', 'Dimos Varel', 'Alexis Rigas']) },
  { name: 'Iceland', code: 'ISL', colors: { primary: 0x02529c, secondary: 0xffffff, accent: 0xdc1e35 }, flagSvg: nordic('#02529c', '#dc1e35', C.white), players: roster(['Aron Hallur', 'Einar Frost', 'Bjarni Vikar', 'Leifur Orri', 'Kari Sigur']) },
  { name: 'India', code: 'IND', colors: { primary: 0xff9933, secondary: 0xffffff, accent: 0x138808 }, flagSvg: india(), players: roster(['Arjun Rao', 'Vikram Sen', 'Rohan Mehta', 'Dev Nair', 'Kabir Das']) },
  { name: 'Ireland', code: 'IRL', colors: { primary: 0x169b62, secondary: 0xffffff, accent: 0xff883e }, flagSvg: vertical(['#169b62', C.white, '#ff883e']), players: roster(['Sean Doyle', 'Cian Brady', 'Finn Keane', 'Ronan Walsh', 'Eoin Byrne']) },
  { name: 'Italy', code: 'ITA', colors: { primary: 0x009246, secondary: 0xffffff, accent: 0xce2b37 }, flagSvg: vertical(['#009246', C.white, '#ce2b37']), players: roster(['Luca Marino', 'Marco Rinaldi', 'Enzo Ferri', 'Nico Serra', 'Dario Conti']) },
  { name: 'Japan', code: 'JPN', colors: { primary: 0xffffff, secondary: 0xbc002d, accent: 0x111111 }, flagSvg: japan(), players: roster(['Haruto Sato', 'Ren Takeda', 'Kaito Mori', 'Yuto Arai', 'Sora Kubo']) },
  { name: 'Mexico', code: 'MEX', colors: { primary: 0x006847, secondary: 0xffffff, accent: 0xce1126 }, flagSvg: mexico(), players: roster(['Mateo Luna', 'Diego Navarro', 'Emilio Cruz', 'Javi Robles', 'Santi Flores']) },
  { name: 'Morocco', code: 'MAR', colors: { primary: 0xc1272d, secondary: 0x006233, accent: 0xffffff }, flagSvg: morocco(), players: roster(['Youssef Amrani', 'Ilyas Rami', 'Hamza Bennis', 'Omar Saidi', 'Nadir El Fassi']) },
  { name: 'Netherlands', code: 'NED', colors: { primary: 0xae1c28, secondary: 0xffffff, accent: 0x21468b }, flagSvg: horizontal(['#ae1c28', C.white, '#21468b']), players: roster(['Daan Vermeer', 'Milan Bos', 'Jens Dekker', 'Thijs Van Daal', 'Rik Smit']) },
  { name: 'New Zealand', code: 'NZL', colors: { primary: 0x00247d, secondary: 0xcc142b, accent: 0xffffff }, flagSvg: newZealand(), players: roster(['Noah Rangi', 'Liam Fraser', 'Arlo Kea', 'Tane Reid', 'Finn Cooper']) },
  { name: 'Nigeria', code: 'NGA', colors: { primary: 0x008751, secondary: 0xffffff, accent: 0x202020 }, flagSvg: vertical(['#008751', C.white, '#008751']), players: roster(['Tunde Okoro', 'Chidi Eze', 'Kele Obi', 'Dayo Musa', 'Ikenna Bello']) },
  { name: 'Norway', code: 'NOR', colors: { primary: 0xba0c2f, secondary: 0xffffff, accent: 0x00205b }, flagSvg: nordic('#ba0c2f', '#00205b', C.white), players: roster(['Sander Holm', 'Emil Berg', 'Mats Vik', 'Oskar Dahl', 'Henrik Sol']) },
  { name: 'Paraguay', code: 'PAR', colors: { primary: 0xd52b1e, secondary: 0xffffff, accent: 0x0038a8 }, flagSvg: svg(`${horizontal(['#d52b1e', C.white, '#0038a8']).replace(/^<svg[^>]*>|<\/svg>$/g, '')}${circle(30, 20, 3.5, '#f6d04d')}`), players: roster(['Diego Benitez', 'Luis Cabral', 'Hugo Duarte', 'Ramon Ayala', 'Tomas Rojas']) },
  { name: 'Peru', code: 'PER', colors: { primary: 0xd91023, secondary: 0xffffff, accent: 0x202020 }, flagSvg: vertical(['#d91023', C.white, '#d91023']), players: roster(['Piero Ruiz', 'Mateo Salas', 'Renzo Prado', 'Luis Caro', 'Nico Pared']) },
  { name: 'Poland', code: 'POL', colors: { primary: 0xffffff, secondary: 0xdc143c, accent: 0x202020 }, flagSvg: horizontal([C.white, '#dc143c']), players: roster(['Jakub Nowak', 'Marek Ziel', 'Kamil Woz', 'Adam Lis', 'Piotr Mazur']) },
  { name: 'Portugal', code: 'POR', colors: { primary: 0x006600, secondary: 0xff0000, accent: 0xffcc00 }, flagSvg: portugal(), players: roster(['Tiago Rocha', 'Andre Vale', 'Ruben Matos', 'Nuno Leal', 'Diogo Sousa']) },
  { name: 'Qatar', code: 'QAT', colors: { primary: 0x8a1538, secondary: 0xffffff, accent: 0x202020 }, flagSvg: qatar(), players: roster(['Khalid Noor', 'Fahad Salem', 'Omar Jassim', 'Nasser Rami', 'Yasin Faris']) },
  { name: 'Saudi Arabia', code: 'KSA', colors: { primary: 0x006c35, secondary: 0xffffff, accent: 0x202020 }, flagSvg: saudiArabia(), players: roster(['Faisal Harbi', 'Saad Nouri', 'Majed Saleh', 'Yasir Fahim', 'Hamad Rashid']) },
  { name: 'Scotland', code: 'SCO', colors: { primary: 0x005eb8, secondary: 0xffffff, accent: 0x202020 }, flagSvg: saltire('#005eb8', C.white), players: roster(['Callum Kerr', 'Fraser Boyd', 'Ross MacLeod', 'Ewan Grant', 'Logan Fraser']) },
  { name: 'Senegal', code: 'SEN', colors: { primary: 0x00853f, secondary: 0xfdef42, accent: 0xe31b23 }, flagSvg: svg(`${vertical(['#00853f', '#fdef42', '#e31b23']).replace(/^<svg[^>]*>|<\/svg>$/g, '')}${star(30, 20, 4, '#00853f')}`), players: roster(['Moussa Diop', 'Idrissa Sarr', 'Pape Ndiaye', 'Cheikh Ba', 'Lamine Fall']) },
  { name: 'Serbia', code: 'SRB', colors: { primary: 0xc6363c, secondary: 0x0c4076, accent: 0xffffff }, flagSvg: svg(`${horizontal(['#c6363c', '#0c4076', C.white]).replace(/^<svg[^>]*>|<\/svg>$/g, '')}${circle(20, 20, 4.5, '#f1c232')}${rect(18, 16, 4, 8, '#c6363c')}`), players: roster(['Milan Jovic', 'Luka Petrov', 'Nikola Vasic', 'Stefan Ilic', 'Marko Radan']) },
  { name: 'South Africa', code: 'RSA', colors: { primary: 0x007a4d, secondary: 0xffb612, accent: 0x002395 }, flagSvg: southAfrica(), players: roster(['Sipho Dlamini', 'Thabo Khum', 'Lebo Moko', 'Keenan Jacobs', 'Mandla Ndlovu']) },
  { name: 'South Korea', code: 'KOR', colors: { primary: 0xffffff, secondary: 0xc60c30, accent: 0x003478 }, flagSvg: southKorea(), players: roster(['Min Jae Han', 'Jiho Park', 'Seojun Kim', 'Taeyang Lee', 'Hyun Woo Choi']) },
  { name: 'Spain', code: 'ESP', colors: { primary: 0xaa151b, secondary: 0xf1bf00, accent: 0x202020 }, flagSvg: spain(), players: roster(['Pablo Serrano', 'Iker Molina', 'Hugo Varela', 'Dani Torres', 'Sergio Alarcon']) },
  { name: 'Sweden', code: 'SWE', colors: { primary: 0x006aa7, secondary: 0xfecc00, accent: 0xffffff }, flagSvg: nordic('#006aa7', '#fecc00'), players: roster(['Noel Berg', 'Elias Lind', 'Axel Soder', 'Viktor Nyberg', 'Hugo Dahl']) },
  { name: 'Switzerland', code: 'SUI', colors: { primary: 0xd52b1e, secondary: 0xffffff, accent: 0x202020 }, flagSvg: switzerland(), players: roster(['Luca Meier', 'Noah Keller', 'Nico Frei', 'Jonas Baum', 'Marco Suter']) },
  { name: 'United States', code: 'USA', colors: { primary: 0x3c3b6e, secondary: 0xb22234, accent: 0xffffff }, flagSvg: unitedStates(), players: roster(['Tyler Brooks', 'Mason Carter', 'Evan Cole', 'Jordan Price', 'Logan Hayes']) },
  { name: 'Uruguay', code: 'URU', colors: { primary: 0x0038a8, secondary: 0xffffff, accent: 0xfcd116 }, flagSvg: uruguay(), players: roster(['Facu Silva', 'Mateo Rivero', 'Bruno Paz', 'Nico Lemos', 'Dario Soria']) },
  { name: 'Wales', code: 'WAL', colors: { primary: 0xd30731, secondary: 0x00a650, accent: 0xffffff }, flagSvg: wales(), players: roster(['Dylan Price', 'Rhys Morgan', 'Owen Ellis', 'Evan Lloyd', 'Cai Bowen']) },
];

export const TOURNAMENT_TEAMS: TournamentTeam[] = TEAM_ROWS.map((team, index) => {
  const rating = ratingFor(index);
  const teamStyle = styleForTeam(index, rating);
  const id = slug(team.name);
  const players = createTournamentRoster(team.players, team.name, teamStyle, rating).map((p) =>
    ensureManagerDefaults(p),
  );
  const bench = createBenchPlayers(team.name, id, players);
  return {
    id,
    name: team.name,
    code: team.code,
    colors: team.colors,
    flagSvg: team.flagSvg,
    rating,
    teamStyle,
    formationPreferences: formationPreferencesForStyle(teamStyle),
    players,
    bench,
  };
});

export function createTournamentTeamProfilesSave(): TournamentTeamProfileSave[] {
  return TOURNAMENT_TEAMS.map((team) => ({
    teamId: team.id,
    teamStyle: team.teamStyle,
    formationPreferences: team.formationPreferences,
    players: team.players,
    bench: team.bench,
  }));
}

/** Apply manager-mode defaults (condition/morale/form) to a profile. */
export function ensureManagerDefaults(profile: TournamentPlayerProfile): TournamentPlayerProfile {
  return {
    ...profile,
    condition: profile.condition ?? 100,
    morale: profile.morale ?? 70,
    form: profile.form ?? 0,
    recentRatings: profile.recentRatings ?? [],
  };
}

/** Unique-per-tournament player id, used as map keys for ratings and ownership. */
export function playerProfileId(teamId: string, profile: TournamentPlayerProfile): string {
  return `${teamId}:${profile.role}:${profile.number}`;
}

export function getTeamById(teamId: string): TournamentTeam {
  const team = TOURNAMENT_TEAMS.find((candidate) => candidate.id === teamId);

  if (!team) {
    throw new Error(`Unknown tournament team: ${teamId}`);
  }

  return team;
}
