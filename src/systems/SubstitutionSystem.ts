import { Vector3 } from 'three';
import type { Team } from '../entities/Team';
import type { TeamColor } from '../entities/Player';
import type { MatchEventBus } from './MatchEventBus';
import type { TeamAISystem } from './TeamAISystem';

const MAX_SUBS = 5;

export interface SubResult {
  ok: boolean;
  reason?: string;
}

/**
 * Mid-match substitutions. Validates the swap, removes the outgoing player from
 * the live team and adds the bench player. Notifies TeamAISystem so its per-player
 * brain Maps drop stale entries.
 *
 * NOTE: We do NOT physically remove/add Rapier rigidbodies — that's owned by
 * Player.dispose/createTeam in the current engine. For now we move the outgoing
 * player off-pitch and the incoming player onto the field at the same role slot.
 */
export class SubstitutionSystem {
  private subsUsed: Record<TeamColor, number> = { blue: 0, red: 0 };
  private scene?: { add: (g: unknown) => void; remove: (g: unknown) => void };

  constructor(
    private readonly blueTeam: Team,
    private readonly redTeam: Team,
    private readonly bus: MatchEventBus,
    private readonly teamAI: TeamAISystem,
    scene?: { add: (g: unknown) => void; remove: (g: unknown) => void },
  ) {
    this.scene = scene;
  }

  reset(): void {
    this.subsUsed = { blue: 0, red: 0 };
  }

  getSubsUsed(teamColor: TeamColor): number {
    return this.subsUsed[teamColor];
  }

  getSubsRemaining(teamColor: TeamColor): number {
    return Math.max(0, MAX_SUBS - this.subsUsed[teamColor]);
  }

  requestSub(teamColor: TeamColor, outId: string, inId: string, currentMinute: number): SubResult {
    const team = teamColor === 'blue' ? this.blueTeam : this.redTeam;
    if (this.subsUsed[teamColor] >= MAX_SUBS) {
      return { ok: false, reason: 'No subs remaining.' };
    }
    const outIdx = team.players.findIndex((p) => p.id === outId);
    if (outIdx < 0) return { ok: false, reason: 'Outgoing player is not on the field.' };
    const inIdx = team.bench?.findIndex((p) => p.id === inId) ?? -1;
    if (!team.bench || inIdx < 0) return { ok: false, reason: 'Incoming player is not on the bench.' };

    const outgoing = team.players[outIdx];
    const incoming = team.bench[inIdx];
    // Place incoming at the role slot's position so its formation home is correct.
    incoming.reset(outgoing.homePosition.clone(), team.attackingDirection.clone());
    incoming.homePosition.copy(outgoing.homePosition);
    if (this.scene) {
      try { this.scene.add(incoming.group); } catch { /* noop */ }
      try { this.scene.remove(outgoing.group); } catch { /* noop */ }
    }
    team.players[outIdx] = incoming;
    team.bench[inIdx] = outgoing;
    // Move outgoing player off-pitch behind dugout to keep him alive in the scene.
    outgoing.reset(new Vector3(-1000, 0, 0), team.attackingDirection.clone());

    // Clear stale AI state for the outgoing player so brains reinit cleanly.
    this.teamAI.notifyPlayerSwap(outgoing.id, incoming.id);

    this.subsUsed[teamColor] += 1;
    this.bus.emit({
      minute: currentMinute,
      type: 'sub',
      team: teamColor,
      detail: `${outgoing.displayName} → ${incoming.displayName}`,
    });
    return { ok: true };
  }
}
