import { Vector3 } from 'three';
import type { Player, PlayerRole, PlayerTraits } from '../entities/Player';

export type AIPlayerState =
  | 'HoldShape'
  | 'PressBall'
  | 'SupportPass'
  | 'MakeRun'
  | 'MarkOpponent'
  | 'CoverSpace'
  | 'ReceivePass'
  | 'Dribble'
  | 'Pass'
  | 'Shoot'
  | 'Retreat'
  | 'Recover'
  | 'KeeperDefend'
  | 'KeeperChaseBall';

export interface AIIntent {
  label: string;
  score: number;
}

interface DecisionInput {
  state: AIPlayerState;
  intent: string;
  confidence: number;
  targetPosition: Vector3;
  targetPlayer?: Player;
  targetTeammate?: Player;
  decisionInterval?: number;
}

export class AIPlayerBrain {
  readonly playerId: string;
  readonly role: PlayerRole;
  readonly traits: PlayerTraits;
  readonly targetPosition = new Vector3();
  currentState: AIPlayerState = 'HoldShape';
  currentIntent = 'Hold shape';
  targetPlayer?: Player;
  targetTeammate?: Player;
  decisionCooldown = 0;
  reactionTime: number;
  confidence: number;
  stamina = 100;
  lastDecisionTime = 0;
  private decisionInterval: number;
  private readonly jitterSeed: number;

  constructor(readonly player: Player) {
    this.playerId = player.id;
    this.role = player.role;
    this.traits = player.traits;
    this.jitterSeed = hashString(player.id);
    this.reactionTime = this.calculateReactionTime();
    this.confidence = this.calculateBaseConfidence();
    this.decisionInterval = this.calculateDecisionInterval();
    this.decisionCooldown = this.decisionInterval * (0.35 + seededNoise(this.jitterSeed) * 0.7);
    this.targetPosition.copy(player.homePosition);
  }

  tick(delta: number, nowSeconds: number): void {
    this.decisionCooldown = Math.max(0, this.decisionCooldown - delta);
    this.lastDecisionTime = nowSeconds;
    this.updateStamina(delta);
  }

  shouldDecide(): boolean {
    return this.decisionCooldown <= 0;
  }

  commitDecision(input: DecisionInput, nowSeconds: number): void {
    this.currentState = input.state;
    this.currentIntent = input.intent;
    this.confidence = clamp(input.confidence, 0.05, 1);
    this.targetPosition.copy(input.targetPosition);
    this.targetPlayer = input.targetPlayer;
    this.targetTeammate = input.targetTeammate;
    this.reactionTime = this.calculateReactionTime();
    this.decisionInterval = input.decisionInterval ?? this.calculateDecisionInterval();
    this.decisionCooldown = this.decisionInterval + this.reactionTime * 0.35;
    this.lastDecisionTime = nowSeconds;
  }

  forceState(state: AIPlayerState, intent: string, targetPosition: Vector3, nowSeconds: number): void {
    this.currentState = state;
    this.currentIntent = intent;
    this.targetPosition.copy(targetPosition);
    this.lastDecisionTime = nowSeconds;
  }

  getTopTraitLabel(): string {
    const [topTrait] = Object.entries(this.traits).sort((a, b) => b[1] - a[1]);
    return topTrait ? `${topTrait[0]} ${Math.round(topTrait[1] * 100)}` : 'balanced 50';
  }

  getDebugLine(): string {
    return `${this.playerId} ${this.role}: ${this.currentState} | ${this.currentIntent} | ${this.getTopTraitLabel()} | target ${this.targetPosition.x.toFixed(0)},${this.targetPosition.z.toFixed(0)} | cd ${this.decisionCooldown.toFixed(2)}s | stamina ${Math.round(this.stamina)}`;
  }

  private updateStamina(delta: number): void {
    const highEffort =
      this.currentState === 'PressBall' ||
      this.currentState === 'MakeRun' ||
      this.currentState === 'Recover' ||
      this.currentState === 'Dribble';
    const staminaQuality = 0.72 + this.traits.stamina * 0.42;
    const drain = highEffort ? 9.2 / staminaQuality : 0;
    const regen = highEffort ? 0 : 5.4 * staminaQuality;
    this.stamina = clamp(this.stamina - drain * delta + regen * delta, 12, 100);
  }

  private calculateReactionTime(): number {
    const awareness =
      this.traits.composure * 0.42 +
      this.traits.positioning * 0.34 +
      this.traits.discipline * 0.16 +
      this.traits.teamwork * 0.08;
    const raw = 0.62 - awareness * 0.34 + seededNoise(this.jitterSeed + 17) * 0.1;
    return clamp(raw, 0.16, 0.72);
  }

  private calculateDecisionInterval(): number {
    const gameIq =
      this.traits.composure * 0.3 +
      this.traits.positioning * 0.3 +
      this.traits.teamwork * 0.2 +
      this.traits.discipline * 0.2;
    const roleBias = this.role === 'goalkeeper' ? -0.12 : this.role.includes('Mid') ? -0.04 : 0;
    const raw = 0.78 - gameIq * 0.28 + roleBias + seededNoise(this.jitterSeed + 31) * 0.16;
    return clamp(raw, 0.28, 0.95);
  }

  private calculateBaseConfidence(): number {
    return clamp(
      0.42 +
        this.traits.composure * 0.24 +
        this.traits.positioning * 0.14 +
        this.traits.discipline * 0.1,
      0.15,
      0.95,
    );
  }
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
