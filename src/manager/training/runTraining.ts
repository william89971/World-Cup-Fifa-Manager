import type { TournamentState } from '../../tournament/TournamentState';
import type { TrainingFocus, TrainingIntensity, TrainingSession, TrainingDelta } from '../types';
import { TRAIT_KEYS, type TraitKey } from '../../game/playerTypes';
import { playerKey } from '../../tournament/TournamentState';

const INTENSITY_FACTOR: Record<TrainingIntensity, number> = { low: 0.5, medium: 1, high: 1.5 };

const FOCUS_TRAITS: Record<TrainingFocus, TraitKey[]> = {
  fitness: ['stamina'],
  passing: ['passing', 'teamwork'],
  shooting: ['shooting', 'composure'],
  defense: ['defending', 'positioning'],
  tactics: ['positioning', 'discipline'],
  setPieces: ['shooting', 'passing'],
  recovery: [],
};

const CONDITION_DELTA: Record<TrainingFocus, number> = {
  fitness: -3, // burns condition
  passing: -1,
  shooting: -1,
  defense: -1,
  tactics: 0,
  setPieces: -1,
  recovery: 8,
};

export function runTrainingSession(
  state: TournamentState,
  args: {
    focus: TrainingFocus;
    intensity: TrainingIntensity;
    playerIds?: string[];
  },
): TrainingSession {
  const team = state.getTeam(state.selectedTeamId);
  const squad = [...team.players, ...team.bench];
  const factor = INTENSITY_FACTOR[args.intensity];
  const deltas: TrainingDelta[] = [];
  const traitGain = 0.05 * factor;
  const condGain = CONDITION_DELTA[args.focus] * factor;

  // For setPieces, only top-3 shooting take part as nominated takers.
  const subset =
    args.focus === 'setPieces'
      ? [...squad].sort((a, b) => (b.traits.shooting ?? 0) - (a.traits.shooting ?? 0)).slice(0, 3)
      : args.playerIds
      ? squad.filter((p) => args.playerIds!.includes(playerKey(team.id, p)))
      : squad;

  for (const profile of subset) {
    const id = playerKey(team.id, profile);
    // Condition change.
    profile.condition = Math.max(0, Math.min(100, (profile.condition ?? 100) + condGain));
    if (condGain !== 0) deltas.push({ playerId: id, conditionDelta: condGain });
    // Trait gains.
    for (const trait of FOCUS_TRAITS[args.focus]) {
      const old = profile.traits[trait];
      const next = Math.min(1, old + traitGain * 0.04); // cap at 1.0; small gains
      const realDelta = next - old;
      if (realDelta > 0) {
        profile.traits[trait] = next;
        deltas.push({ playerId: id, trait, traitDelta: realDelta });
      }
    }
  }

  const note = describeSession(args.focus, args.intensity, subset.length);
  const session: TrainingSession = {
    dateMs: Date.now(),
    focus: args.focus,
    intensity: args.intensity,
    deltas,
    note,
  };
  state.pushTraining(session);
  return session;
}

function describeSession(focus: TrainingFocus, intensity: TrainingIntensity, count: number): string {
  const intLabel = intensity === 'low' ? 'light' : intensity === 'medium' ? 'measured' : 'tough';
  const focusLabel: Record<TrainingFocus, string> = {
    fitness: 'fitness work',
    passing: 'passing drills',
    shooting: 'shooting practice',
    defense: 'defensive shape',
    tactics: 'tactical instruction',
    setPieces: 'set-piece routines',
    recovery: 'recovery session',
  };
  return `A ${intLabel} ${focusLabel[focus]} with ${count} player${count === 1 ? '' : 's'}.`;
}

void TRAIT_KEYS;
