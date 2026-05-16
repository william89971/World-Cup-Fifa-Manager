import type { TournamentTeam, TournamentPlayerProfile } from '../../tournament/teams';
import type { ManagerTactics, TacticSliders } from '../types';
import { createDefaultTactics } from '../types';
import { TRAIT_KEYS } from '../../game/playerTypes';

export interface ScoutAnalysis {
  formation: string;
  teamStyle: string;
  topThreats: Array<{ name: string; role: string; score: number }>;
  weakSpots: Array<{ line: 'DEF' | 'MID' | 'ATT'; avg: number }>;
  recommendation: string;
  suggestedTactics: ManagerTactics;
}

const STYLE_COUNTER: Record<string, { style: string; sliders: Partial<TacticSliders> }> = {
  possession: { style: 'highPress', sliders: { pressing: 80, tackling: 70 } },
  counterAttack: { style: 'possession', sliders: { pressing: 65, lineHeight: 70, tempo: 60 } },
  highPress: { style: 'directAttack', sliders: { directness: 75, tempo: 70 } },
  defensive: { style: 'directAttack', sliders: { directness: 70, risk: 65 } },
  balanced: { style: 'balanced', sliders: {} },
  directAttack: { style: 'defensive', sliders: { lineHeight: 30, pressing: 40, tackling: 65 } },
};

function avgTrait(players: TournamentPlayerProfile[]): number {
  let sum = 0;
  let count = 0;
  for (const p of players) {
    for (const k of TRAIT_KEYS) {
      sum += p.traits[k];
      count += 1;
    }
  }
  return count ? sum / count : 0.5;
}

export function recommendAgainst(opponent: TournamentTeam, userTeam: TournamentTeam): ScoutAnalysis {
  const formation = opponent.formationPreferences[0] ?? '4-3-3';
  const style = opponent.teamStyle;
  const threats = [...opponent.players]
    .map((p) => ({
      name: p.name,
      role: p.role,
      score: p.traits.shooting + p.traits.speed + p.traits.dribbling,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const def = opponent.players.filter((p) => p.role === 'goalkeeper' || p.role.includes('Back'));
  const mid = opponent.players.filter((p) => p.role.includes('Mid'));
  const att = opponent.players.filter((p) => p.role === 'striker' || p.role.includes('Wing'));
  const weakSpots = (
    [
      { line: 'DEF', avg: avgTrait(def) },
      { line: 'MID', avg: avgTrait(mid) },
      { line: 'ATT', avg: avgTrait(att) },
    ] as Array<{ line: 'DEF' | 'MID' | 'ATT'; avg: number }>
  ).sort((a, b) => a.avg - b.avg);

  const counter = STYLE_COUNTER[style] ?? STYLE_COUNTER.balanced;
  const baseTactics = createDefaultTactics(userTeam.formationPreferences[0] ?? '4-3-3', userTeam.teamStyle);
  const suggested: ManagerTactics = {
    ...baseTactics,
    teamStyle: counter.style as ManagerTactics['teamStyle'],
    sliders: { ...baseTactics.sliders, ...counter.sliders },
  };
  const recommendation = `${opponent.name} play ${formation} ${style}. Counter with ${suggested.teamStyle}: target their ${weakSpots[0].line} line. Watch ${threats[0]?.name ?? 'their forwards'}.`;

  return {
    formation,
    teamStyle: style,
    topThreats: threats,
    weakSpots,
    recommendation,
    suggestedTactics: suggested,
  };
}
