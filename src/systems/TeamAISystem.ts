import { CanvasTexture, Sprite, SpriteMaterial, Vector3 } from 'three';
import { Ball } from '../entities/Ball';
import { Player, type PlayerRole } from '../entities/Player';
import type { Team } from '../entities/Team';
import { AI, GAMEPLAY, KEEPER, PENALTY_AREA_SIZE, PLAYER, PITCH, TRAIT_INFLUENCE } from '../game/constants';
import { soundHooks } from '../game/soundHooks';
import { AIPlayerBrain, type AIPlayerState } from './AIPlayerBrain';
import { getOffsideViolation } from './OffsideSystem';
import { PossessionSystem } from './PossessionSystem';
import { clampPositionToRoleZone } from './RoleZones';
import type { ManagerTactics } from '../manager/types';
import type { TeamColor } from '../entities/Player';

export type AIState = AIPlayerState;

interface TeamAssignments {
  presser?: Player;
  laneCover?: Player;
}

const LANE_BY_ROLE: Record<PlayerRole, number> = {
  goalkeeper: 0,
  leftBack: -1.06,
  centerBackLeft: -0.36,
  centerBackRight: 0.36,
  rightBack: 1.06,
  defensiveMid: 0,
  centralMid: -0.22,
  attackingMid: 0.22,
  leftWing: -1.22,
  rightWing: 1.22,
  striker: 0,
};

const DEFENSIVE_DEPTH_BY_ROLE: Record<PlayerRole, number> = {
  goalkeeper: 0.04,
  leftBack: 0.46,
  centerBackLeft: 0.58,
  centerBackRight: 0.58,
  rightBack: 0.46,
  defensiveMid: 0.42,
  centralMid: 0.33,
  attackingMid: 0.24,
  leftWing: 0.17,
  rightWing: 0.17,
  striker: 0.13,
};

export class TeamAISystem {
  private readonly ballPosition = new Vector3();
  private readonly playerPosition = new Vector3();
  private readonly target = new Vector3();
  private readonly opponentPosition = new Vector3();
  private readonly separation = new Vector3();
  private readonly goalDirection = new Vector3();
  private readonly keeperMin = new Vector3();
  private readonly keeperMax = new Vector3();
  private readonly cooldowns = new Map<string, number>();
  private readonly states = new Map<string, AIState>();
  private readonly brains = new Map<string, AIPlayerBrain>();
  private readonly debugLabels = new Map<string, Sprite>();
  private possessionTeamName = 'Loose';
  private matchTime = 0;
  private debugVisible = false;
  private debugLabelTimer = 0;

  // Manager-mode flag — when true, NO player is excluded from AI. The
  // getControlledPlayer callback still resolves a "focus" player for HUD/minimap
  // highlighting, but TeamAISystem treats them as just another AI agent.
  public managerMode = true;

  // Per-team tactic overrides applied by the manager. The existing decision
  // logic continues to use the team.teamStyle / formation as primary inputs;
  // these tactics layer numeric multipliers on top via getTacticMultiplier().
  private readonly tacticsByTeam = new Map<TeamColor, ManagerTactics>();

  constructor(
    private readonly ball: Ball,
    private readonly blueTeam: Team,
    private readonly redTeam: Team,
    private readonly getControlledPlayer: () => Player,
    private readonly possession: PossessionSystem,
    private readonly onOffside: (
      position: Vector3,
      message: string,
      restartTeamColor: 'blue' | 'red',
    ) => void = () => {},
  ) {}

  // Resolve the "user-controlled" player, but return null in manager mode so
  // every check that excludes the controlled player ends up excluding nobody.
  private resolveControlledPlayer(): Player | null {
    return this.managerMode ? null : this.resolveControlledPlayer();
  }

  update(delta: number): void {
    this.matchTime += delta;
    this.tickCooldowns(delta);
    this.ball.getPosition(this.ballPosition);
    this.ballPosition.y = 0;

    const possessionState = this.possession.getState();
    this.possessionTeamName = this.possession.getOwnerLabel();
    const likelyTeam = possessionState.team ?? this.getLikelyPossessionTeam();

    this.updateTeam(this.blueTeam, possessionState.team === this.blueTeam, likelyTeam, delta);
    this.updateTeam(this.redTeam, possessionState.team === this.redTeam, likelyTeam, delta);
    this.updateDebugLabels(delta);
  }

  setDebugVisible(isVisible: boolean): void {
    this.debugVisible = isVisible;
    if (!isVisible) {
      for (const label of this.debugLabels.values()) {
        label.visible = false;
      }
    }
  }

  getDebugLines(): string[] {
    return [...this.brains.values()]
      .filter((brain) => brain.player !== this.resolveControlledPlayer())
      .slice(0, 22)
      .map((brain) => brain.getDebugLine());
  }

  getStateCounts(): string[] {
    const counts = new Map<AIState, number>();
    for (const brain of this.brains.values()) {
      if (brain.player === this.resolveControlledPlayer()) {
        continue;
      }
      counts.set(brain.currentState, (counts.get(brain.currentState) ?? 0) + 1);
    }

    return [...counts.entries()].map(([state, count]) => `${state} ${count}`);
  }

  getPossessionTeamName(): string {
    return this.possessionTeamName;
  }

  /** Set the manager tactics for one team. Multipliers below are derived from
   *  these and applied to the existing AI decision math via getTacticMultiplier. */
  setTacticsFor(teamColor: TeamColor, tactics: ManagerTactics): void {
    this.tacticsByTeam.set(teamColor, tactics);
  }

  /** Read the current tactical override for a team, or undefined if none. */
  getTacticsFor(teamColor: TeamColor): ManagerTactics | undefined {
    return this.tacticsByTeam.get(teamColor);
  }

  /** Numeric multiplier applied to a known tactic dimension. Returns a value
   *  centered on 1.0; 0.7..1.3 typical range based on slider extremes. */
  getTacticMultiplier(team: Team, key: keyof ManagerTactics['sliders']): number {
    const tactics = this.tacticsByTeam.get(team.color);
    if (!tactics) return 1;
    const v = tactics.sliders[key];
    return 0.7 + (v / 100) * 0.6; // 0 → 0.7, 50 → 1.0, 100 → 1.3
  }

  /** Mentality multiplier: -2..+2 → 0.8..1.2 (higher = more aggressive). */
  getMentalityMultiplier(team: Team): number {
    const tactics = this.tacticsByTeam.get(team.color);
    if (!tactics) return 1;
    return 1 + tactics.mentality * 0.1;
  }

  /** Drop AI state for an outgoing player so the incoming one can re-init clean. */
  notifyPlayerSwap(outgoingId: string, _incomingId: string): void {
    this.cooldowns.delete(outgoingId);
    this.states.delete(outgoingId);
    this.brains.delete(outgoingId);
    const sprite = this.debugLabels.get(outgoingId);
    if (sprite) {
      sprite.visible = false;
      this.debugLabels.delete(outgoingId);
    }
  }

  private updateDebugLabels(delta: number): void {
    if (!this.debugVisible) {
      return;
    }

    this.debugLabelTimer -= delta;
    const shouldRefresh = this.debugLabelTimer <= 0;
    if (shouldRefresh) {
      this.debugLabelTimer = 0.22;
    }

    const controlledPlayer = this.resolveControlledPlayer();
    for (const brain of this.brains.values()) {
      const label = this.getDebugLabel(brain.player);
      const isAiPlayer = brain.player !== controlledPlayer;
      label.visible = isAiPlayer;

      if (isAiPlayer && shouldRefresh) {
        this.paintDebugLabel(label, brain);
      }
    }
  }

  private getDebugLabel(player: Player): Sprite {
    let label = this.debugLabels.get(player.id);
    if (label) {
      return label;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 92;
    const texture = new CanvasTexture(canvas);
    const material = new SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    label = new Sprite(material);
    label.position.set(0, 3.45, 0);
    label.scale.set(4.8, 1.35, 1);
    label.visible = false;
    player.group.add(label);
    this.debugLabels.set(player.id, label);
    return label;
  }

  private paintDebugLabel(label: Sprite, brain: AIPlayerBrain): void {
    const material = label.material as SpriteMaterial;
    const texture = material.map as CanvasTexture | null;
    const canvas = texture?.image as HTMLCanvasElement | undefined;
    const context = canvas?.getContext('2d');
    if (!texture || !canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(4, 10, 12, 0.68)';
    roundRect(context, 8, 8, canvas.width - 16, canvas.height - 16, 12);
    context.fill();
    context.fillStyle = '#f5fff8';
    context.font = '700 20px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText(`${brain.role} · ${brain.currentState}`, canvas.width / 2, 34);
    context.font = '500 16px system-ui, sans-serif';
    context.fillText(`${brain.currentIntent}`, canvas.width / 2, 56);
    context.fillStyle = '#9fe6b8';
    context.fillText(`${brain.getTopTraitLabel()} · cd ${brain.decisionCooldown.toFixed(1)}s`, canvas.width / 2, 77);
    texture.needsUpdate = true;
  }

  private updateTeam(
    team: Team,
    hasPossession: boolean,
    likelyTeam: Team,
    delta: number,
  ): void {
    const controlledPlayer = this.resolveControlledPlayer();
    const goalkeeper = team.players.find((player) => player.role === 'goalkeeper');
    if (goalkeeper) {
      const keeperBrain = this.getBrain(goalkeeper);
      keeperBrain.tick(delta, this.matchTime);
      this.updateGoalkeeper(goalkeeper, team, keeperBrain, delta);
    }

    const aiPlayers = team.players.filter(
      (player) => player !== controlledPlayer && player.role !== 'goalkeeper',
    );

    if (aiPlayers.length === 0) {
      return;
    }

    const assignments = hasPossession
      ? {}
      : this.getDefensiveAssignments(team, aiPlayers, likelyTeam === team);

    for (const player of aiPlayers) {
      const brain = this.getBrain(player);
      brain.tick(delta, this.matchTime);

      if (brain.shouldDecide()) {
        this.decideForPlayer(player, team, brain, {
          hasPossession,
          isLikelyLooseBallTeam: likelyTeam === team,
          assignments,
        });
      }

      this.applyBrain(player, team, brain, delta);
    }
  }

  private getBrain(player: Player): AIPlayerBrain {
    let brain = this.brains.get(player.id);
    if (!brain) {
      brain = new AIPlayerBrain(player);
      this.brains.set(player.id, brain);
    }
    return brain;
  }

  private getDefensiveAssignments(
    team: Team,
    aiPlayers: Player[],
    isLooseBallTeam: boolean,
  ): TeamAssignments {
    const sortedByBall = [...aiPlayers].sort(
      (a, b) => this.getPressureSelectionScore(a, team) - this.getPressureSelectionScore(b, team),
    );
    const presser = sortedByBall[0];
    const laneCover = sortedByBall[1];

    if (!presser) {
      return {};
    }

    const pressureDistance =
      AI.pressureDistance *
      (isLooseBallTeam ? 1.08 : 0.86 + presser.traits.aggression * 0.25 + this.getStyleAggression(team));
    if (!isLooseBallTeam && this.getDistanceToBallSquared(presser) > pressureDistance * pressureDistance) {
      return { laneCover };
    }

    return { presser, laneCover };
  }

  private decideForPlayer(
    player: Player,
    team: Team,
    brain: AIPlayerBrain,
    context: {
      hasPossession: boolean;
      isLikelyLooseBallTeam: boolean;
      assignments: TeamAssignments;
    },
  ): void {
    if (this.possession.getState().owner === player && this.isInPossessionRange(player)) {
      this.decideCarrier(player, team, brain);
      return;
    }

    if (context.hasPossession) {
      this.decideAttackingSupport(player, team, brain);
      return;
    }

    this.decideDefendingPlayer(player, team, brain, context.assignments, context.isLikelyLooseBallTeam);
  }

  private decideCarrier(player: Player, team: Team, brain: AIPlayerBrain): void {
    const opponentTeam = this.getOpponentTeam(team);
    const pressureDistance = this.getClosestOpponentDistance(player, opponentTeam);
    const distanceToGoal = Math.abs(team.opponentGoalZ - this.ballPosition.z);
    const goalT = Math.max(0, 1 - distanceToGoal / AI.shootDistance);
    const pressureT = Math.max(0, Math.min(1, 1 - (pressureDistance - 1.6) / AI.passUnderPressureDistance));
    const passTarget = this.findBestForwardTeammate(player, team);
    const styleShoot = team.teamStyle === 'directAttack' ? 0.34 : team.teamStyle === 'counterAttack' ? 0.2 : team.teamStyle === 'possession' ? -0.12 : 0;
    const stylePass = team.teamStyle === 'possession' ? 0.36 : team.teamStyle === 'balanced' ? 0.08 : team.teamStyle === 'directAttack' ? -0.06 : 0;
    const random = this.getDecisionNoise(player);

    const shootScore =
      goalT * 2.15 +
      player.traits.shooting * 1.15 +
      player.traits.positioning * 0.54 +
      player.traits.riskTaking * 0.34 +
      styleShoot -
      pressureT * (0.35 - player.traits.composure * 0.2) +
      random;
    const passScore =
      (passTarget ? 0.42 : -0.7) +
      pressureT * 1.18 +
      player.traits.passing * 0.95 +
      player.traits.teamwork * 0.88 +
      player.traits.creativity * 0.42 +
      stylePass +
      random * 0.4;
    const dribbleScore =
      player.traits.dribbling * 1.08 +
      player.traits.speed * 0.52 +
      player.traits.riskTaking * 0.34 +
      (brain.stamina / 100) * 0.28 -
      pressureT * (0.72 - player.traits.composure * 0.34);

    if (shootScore >= passScore && shootScore >= dribbleScore && this.shouldShoot(team, player)) {
      this.goalDirection.set(0, 0, team.opponentGoalZ).sub(this.ballPosition);
      this.goalDirection.y = 0;
      this.clampTargetForPlayer(player, team, this.goalDirection.add(this.ballPosition));
      brain.commitDecision(
        {
          state: 'Shoot',
          intent: `Shoot ${shootScore.toFixed(1)}`,
          confidence: shootScore / 4,
          targetPosition: this.goalDirection,
        },
        this.matchTime,
      );
      this.setState(player, brain.currentState);
      return;
    }

    if (passScore >= dribbleScore && passTarget) {
      passTarget.getPosition(this.target);
      this.clampTargetForPlayer(player, team, this.target);
      brain.commitDecision(
        {
          state: 'Pass',
          intent: `Pass to #${passTarget.number}`,
          confidence: passScore / 4,
          targetPosition: this.target,
          targetTeammate: passTarget,
        },
        this.matchTime,
      );
      this.setState(player, brain.currentState);
      return;
    }

    this.goalDirection.set(0, 0, team.opponentGoalZ).sub(this.ballPosition);
    this.goalDirection.y = 0;
    if (this.goalDirection.lengthSq() > 0.0001) {
      this.goalDirection.normalize();
    } else {
      this.goalDirection.copy(team.attackingDirection);
    }
    this.target.copy(this.ballPosition).addScaledVector(this.goalDirection, 7 + player.traits.dribbling * 4);
    this.clampTargetForPlayer(player, team, this.target);
    brain.commitDecision(
      {
        state: 'Dribble',
        intent: `Carry ${dribbleScore.toFixed(1)}`,
        confidence: dribbleScore / 3,
        targetPosition: this.target,
      },
      this.matchTime,
    );
    this.setState(player, brain.currentState);
  }

  private decideAttackingSupport(player: Player, team: Team, brain: AIPlayerBrain): void {
    const distanceToBall = Math.sqrt(this.getDistanceToBallSquared(player));
    const ballProgress = this.getProgressFromOwnGoal(team, this.ballPosition);
    const isWide = player.role === 'leftWing' || player.role === 'rightWing' || player.role === 'leftBack' || player.role === 'rightBack';
    const random = this.getDecisionNoise(player);
    const supportScore =
      player.traits.teamwork * 1.12 +
      player.traits.passing * 0.62 +
      player.traits.positioning * 0.72 +
      (player.role.includes('Mid') ? 0.5 : 0) +
      (team.teamStyle === 'possession' ? 0.36 : 0) -
      Math.abs(distanceToBall - 24) * 0.018 +
      random;
    const runScore =
      (this.isForwardRole(player) ? 0.72 : 0) +
      (isWide ? 0.26 : 0) +
      player.traits.speed * 0.78 +
      player.traits.positioning * 0.56 +
      player.traits.riskTaking * 0.42 +
      (team.teamStyle === 'counterAttack' || team.teamStyle === 'directAttack' ? 0.42 : 0) +
      ballProgress * 0.46 +
      random * 0.8;
    const holdScore =
      player.traits.discipline * 0.9 +
      player.traits.positioning * 0.42 +
      (this.isDefensiveRole(player) ? 0.62 : 0) +
      Math.max(0, distanceToBall - 34) * 0.018;
    const recoverScore =
      this.getDistanceToHome(player) * 0.025 +
      player.traits.discipline * 0.36 +
      (this.isDefensiveRole(player) ? 0.34 : 0);

    if (runScore > supportScore && runScore > holdScore && runScore > recoverScore) {
      this.getRunTarget(player, team, this.target);
      brain.commitDecision(
        {
          state: 'MakeRun',
          intent: `Run channel ${runScore.toFixed(1)}`,
          confidence: runScore / 4,
          targetPosition: this.target,
        },
        this.matchTime,
      );
    } else if (supportScore > holdScore && supportScore > recoverScore) {
      this.getSupportTarget(player, team, this.target);
      brain.commitDecision(
        {
          state: 'SupportPass',
          intent: `Show for pass ${supportScore.toFixed(1)}`,
          confidence: supportScore / 4,
          targetPosition: this.target,
        },
        this.matchTime,
      );
    } else if (recoverScore > holdScore) {
      this.getHoldShapeTarget(player, team, this.target, 0.18);
      brain.commitDecision(
        {
          state: 'Recover',
          intent: `Recover shape ${recoverScore.toFixed(1)}`,
          confidence: recoverScore / 4,
          targetPosition: this.target,
        },
        this.matchTime,
      );
    } else {
      this.getHoldShapeTarget(player, team, this.target, 0.1);
      brain.commitDecision(
        {
          state: 'HoldShape',
          intent: `Hold lane ${holdScore.toFixed(1)}`,
          confidence: holdScore / 4,
          targetPosition: this.target,
        },
        this.matchTime,
      );
    }
    this.setState(player, brain.currentState);
  }

  private decideDefendingPlayer(
    player: Player,
    team: Team,
    brain: AIPlayerBrain,
    assignments: TeamAssignments,
    isLooseBallTeam: boolean,
  ): void {
    const opponentTeam = this.getOpponentTeam(team);
    const distanceToBall = Math.sqrt(this.getDistanceToBallSquared(player));
    const ballBehind = this.isBallBehindPlayer(player, team);
    const isPresser = assignments.presser === player;
    const isLaneCover = assignments.laneCover === player;
    const random = this.getDecisionNoise(player);

    const pressScore =
      (isPresser ? 2.25 : -1.15) +
      (isLooseBallTeam ? 0.42 : 0) +
      player.traits.aggression * 0.95 +
      player.traits.speed * 0.52 +
      (1 - player.traits.discipline) * 0.38 +
      this.getStyleAggression(team) * 1.4 -
      distanceToBall * 0.018 +
      random;
    const coverScore =
      (isLaneCover ? 1.35 : 0) +
      player.traits.defending * 0.82 +
      player.traits.positioning * 0.74 +
      player.traits.discipline * 0.56 +
      (this.isDefensiveRole(player) ? 0.34 : 0);
    const markTarget = this.findMarkTarget(player, team, opponentTeam);
    const markScore =
      (markTarget ? 0.45 : -0.35) +
      player.traits.defending * 0.62 +
      player.traits.positioning * 0.54 +
      player.traits.aggression * 0.18 +
      (player.role.includes('Back') ? 0.28 : 0);
    const retreatScore =
      (ballBehind ? 1.3 : 0) +
      player.traits.discipline * 0.82 +
      player.traits.defending * 0.52 +
      (this.isDefensiveRole(player) ? 0.36 : 0);
    const holdScore =
      player.traits.discipline * 0.9 +
      player.traits.positioning * 0.62 +
      (team.teamStyle === 'defensive' ? 0.38 : 0) +
      (this.isForwardRole(player) ? -0.22 : 0);

    if (pressScore > coverScore && pressScore > markScore && pressScore > retreatScore && pressScore > holdScore) {
      brain.commitDecision(
        {
          state: 'PressBall',
          intent: isLooseBallTeam ? `Win loose ball ${pressScore.toFixed(1)}` : `Press carrier ${pressScore.toFixed(1)}`,
          confidence: pressScore / 4,
          targetPosition: this.ballPosition,
        },
        this.matchTime,
      );
    } else if (retreatScore > coverScore && retreatScore > markScore && retreatScore > holdScore) {
      this.getRetreatTarget(player, team, this.target);
      brain.commitDecision(
        {
          state: 'Retreat',
          intent: `Get goal-side ${retreatScore.toFixed(1)}`,
          confidence: retreatScore / 4,
          targetPosition: this.target,
        },
        this.matchTime,
      );
    } else if (coverScore > markScore && coverScore > holdScore) {
      this.getCoverTarget(player, team, this.target);
      brain.commitDecision(
        {
          state: 'CoverSpace',
          intent: `Cover lane ${coverScore.toFixed(1)}`,
          confidence: coverScore / 4,
          targetPosition: this.target,
        },
        this.matchTime,
      );
    } else if (markTarget && markScore > holdScore) {
      this.getMarkTargetPosition(markTarget, team, this.target);
      brain.commitDecision(
        {
          state: 'MarkOpponent',
          intent: `Mark #${markTarget.number}`,
          confidence: markScore / 4,
          targetPosition: this.target,
          targetPlayer: markTarget,
        },
        this.matchTime,
      );
    } else {
      this.getHoldShapeTarget(player, team, this.target, 0.22);
      brain.commitDecision(
        {
          state: 'HoldShape',
          intent: `Stay compact ${holdScore.toFixed(1)}`,
          confidence: holdScore / 4,
          targetPosition: this.target,
        },
        this.matchTime,
      );
    }
    this.setState(player, brain.currentState);
  }

  private applyBrain(player: Player, team: Team, brain: AIPlayerBrain, delta: number): void {
    if (this.possession.getState().owner === player && this.isInPossessionRange(player)) {
      if (brain.currentState === 'Shoot') {
        this.aiTouchBall(player, team, 'Shoot');
      } else if (brain.currentState === 'Pass') {
        this.aiTouchBall(player, team, 'Pass');
      } else {
        this.updateBrainDribble(player, team, brain, delta);
      }
      return;
    }

    if (brain.currentState === 'PressBall') {
      brain.targetPosition.copy(this.ballPosition);
    } else if (brain.currentState === 'MarkOpponent' && brain.targetPlayer) {
      this.getMarkTargetPosition(brain.targetPlayer, team, brain.targetPosition);
    }

    this.target.copy(brain.targetPosition);
    this.applySeparationToTarget(player, team, this.target);
    this.clampTargetForPlayer(player, team, this.target);
    brain.targetPosition.copy(this.target);

    const speed = this.getBrainMoveSpeed(player, brain);
    this.movePlayerToward(player, this.target, speed, delta);

    if (brain.currentState === 'PressBall' && this.isInPossessionRange(player)) {
      this.aiTouchBall(player, team);
    }
  }

  private updateBrainDribble(
    player: Player,
    team: Team,
    brain: AIPlayerBrain,
    delta: number,
  ): void {
    this.goalDirection.set(0, 0, team.opponentGoalZ).sub(this.ballPosition);
    this.goalDirection.y = 0;
    if (this.goalDirection.lengthSq() > 0.0001) {
      this.goalDirection.normalize();
    } else {
      this.goalDirection.copy(team.attackingDirection);
    }
    this.target.copy(this.ballPosition).addScaledVector(this.goalDirection, 4.8);
    this.clampTargetForPlayer(player, team, this.target);
    brain.targetPosition.copy(this.target);
    this.movePlayerToward(player, this.target, this.getBrainMoveSpeed(player, brain), delta);

    const remainingCooldown = this.cooldowns.get(player.id) ?? 0;
    if (remainingCooldown === 0) {
      const dribblePower = AI.tapPower * (0.74 + player.traits.dribbling * 0.48 + brain.confidence * 0.08);
      this.ball.applyImpulseCapped(this.goalDirection, dribblePower, 0, AI.maxBallSpeed);
      this.cooldowns.set(player.id, AI.ballActionCooldown * 0.55);
    }
  }

  private getSupportTarget(player: Player, team: Team, target: Vector3): void {
    const supportDepth =
      this.isDefensiveRole(player) ? 0.32 : player.role === 'attackingMid' ? 0.78 : 0.58;
    const laneAnchor = this.getRoleLaneAnchor(player);
    const weakSideHold =
      Math.sign(laneAnchor || 1) !== Math.sign(this.ballPosition.x || laneAnchor || 1)
        ? 1.12
        : 0.94;
    target.set(
      laneAnchor * weakSideHold + this.ballPosition.x * 0.2,
      0,
      this.ballPosition.z +
        team.attackingDirection.z *
          (AI.supportForwardOffset * supportDepth + this.getRoleDepthOffset(player) * 0.35),
    );
    this.applySeparationToTarget(player, team, target);
    this.clampTargetForPlayer(player, team, target);
  }

  private getRunTarget(player: Player, team: Team, target: Vector3): void {
    const laneAnchor = this.getRoleLaneAnchor(player);
    const runDistance =
      AI.supportForwardOffset *
      (0.9 + player.traits.speed * 0.28 + player.traits.riskTaking * 0.18);
    target.set(
      laneAnchor * 1.08 + this.ballPosition.x * 0.12,
      0,
      this.ballPosition.z +
        team.attackingDirection.z *
          (runDistance + Math.max(0, this.getRoleDepthOffset(player))),
    );
    this.applySeparationToTarget(player, team, target);
    this.clampTargetForPlayer(player, team, target);
  }

  private getHoldShapeTarget(
    player: Player,
    team: Team,
    target: Vector3,
    ballInfluence: number,
  ): void {
    const laneAnchor = this.getRoleLaneAnchor(player);
    target.copy(player.homePosition);
    target.x = laneAnchor * (1 - ballInfluence * 0.72) + this.ballPosition.x * ballInfluence * 0.42;
    const depthInfluence = this.isForwardRole(player) ? ballInfluence * 0.7 : ballInfluence * 0.45;
    target.z =
      player.homePosition.z * (1 - depthInfluence) +
      this.ballPosition.z * depthInfluence +
      team.attackingDirection.z * this.getRoleDepthOffset(player) * 0.28;
    if (team.teamStyle === 'defensive' && !this.isForwardRole(player)) {
      target.z += (team.ownGoalZ - target.z) * 0.08;
    }
    this.applySeparationToTarget(player, team, target);
    this.clampTargetForPlayer(player, team, target);
  }

  private getCoverTarget(player: Player, team: Team, target: Vector3): void {
    const side = Math.sign(this.ballPosition.x || LANE_BY_ROLE[player.role] || 1);
    const compactness = team.teamStyle === 'defensive' ? 0.24 : 0.32;
    const laneAnchor = this.getRoleLaneAnchor(player);
    target.x =
      laneAnchor * 0.7 +
      this.ballPosition.x * 0.22 -
      side * AI.laneCoverDistance * compactness * 0.28;
    target.z =
      this.ballPosition.z +
      (team.ownGoalZ - this.ballPosition.z) * DEFENSIVE_DEPTH_BY_ROLE[player.role] +
      team.attackingDirection.z * this.getRoleDepthOffset(player) * 0.18;
    target.y = 0;
    this.applySeparationToTarget(player, team, target);
    this.clampTargetForPlayer(player, team, target);
  }

  private getRetreatTarget(player: Player, team: Team, target: Vector3): void {
    target.copy(player.homePosition);
    target.x = this.getRoleLaneAnchor(player) * 0.8 + this.ballPosition.x * 0.16;
    target.z =
      this.ballPosition.z +
      (team.ownGoalZ - this.ballPosition.z) * 0.42 +
      team.attackingDirection.z * this.getRoleDepthOffset(player) * 0.16;
    this.applySeparationToTarget(player, team, target);
    this.clampTargetForPlayer(player, team, target);
  }

  private getRoleLaneAnchor(player: Player): number {
    const variation = this.getPlayerVariation(player) * 2.4;
    switch (player.role) {
      case 'leftBack':
        return -PITCH.width * 0.34 + variation;
      case 'rightBack':
        return PITCH.width * 0.34 + variation;
      case 'centerBackLeft':
        return -PITCH.width * 0.12 + variation * 0.55;
      case 'centerBackRight':
        return PITCH.width * 0.12 + variation * 0.55;
      case 'defensiveMid':
        return variation * 0.7;
      case 'centralMid':
        return -PITCH.width * 0.09 + variation;
      case 'attackingMid':
        return PITCH.width * 0.09 + variation;
      case 'leftWing':
        return -PITCH.width * 0.36 + variation * 0.65;
      case 'rightWing':
        return PITCH.width * 0.36 + variation * 0.65;
      case 'striker':
        return variation * 1.6;
      case 'goalkeeper':
      default:
        return player.homePosition.x;
    }
  }

  private getRoleDepthOffset(player: Player): number {
    const variation = this.getPlayerVariation(player);
    switch (player.role) {
      case 'centerBackLeft':
        return -1.2 + variation * 0.6;
      case 'centerBackRight':
        return 1.2 + variation * 0.6;
      case 'defensiveMid':
        return -1.8 + variation;
      case 'centralMid':
        return 1.6 + variation;
      case 'attackingMid':
        return 2.4 + variation;
      case 'leftWing':
      case 'rightWing':
        return 3.4 + variation;
      case 'striker':
        return 4.8 + variation * 1.4;
      default:
        return variation;
    }
  }

  private getPlayerVariation(player: Player): number {
    let hash = 0;
    for (let index = 0; index < player.id.length; index += 1) {
      hash = (hash * 31 + player.id.charCodeAt(index)) | 0;
    }
    const normalized = ((Math.abs(hash) % 1000) / 1000) * 2 - 1;
    return normalized;
  }

  private findMarkTarget(player: Player, team: Team, opponentTeam: Team): Player | undefined {
    let bestTarget: Player | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;
    const ballProgress = this.getProgressFromOwnGoal(team, this.ballPosition);

    for (const opponent of opponentTeam.players) {
      if (opponent.role === 'goalkeeper') {
        continue;
      }

      opponent.getPosition(this.opponentPosition);
      this.opponentPosition.y = 0;
      const opponentProgress = this.getProgressFromOwnGoal(team, this.opponentPosition);
      const distanceToBall = this.opponentPosition.distanceTo(this.ballPosition);
      const threat =
        opponentProgress * 1.25 +
        (opponent.role === 'striker' || opponent.role.includes('Wing') ? 0.42 : 0) +
        Math.max(0, 24 - distanceToBall) * 0.025 -
        Math.abs(opponentProgress - ballProgress) * 0.24;

      if (threat > bestScore) {
        bestScore = threat;
        bestTarget = opponent;
      }
    }

    return bestTarget;
  }

  private getMarkTargetPosition(markTarget: Player, team: Team, target: Vector3): void {
    markTarget.getPosition(target);
    target.y = 0;
    target.z += (team.ownGoalZ - target.z) * 0.14;
    target.x += Math.sign(target.x || 1) * 1.4;
    this.clampTargetToPitch(target);
  }

  private getBrainMoveSpeed(player: Player, brain: AIPlayerBrain): number {
    const effortMultiplier =
      brain.currentState === 'PressBall' || brain.currentState === 'MakeRun' || brain.currentState === 'Dribble'
        ? 1.18
        : brain.currentState === 'Retreat' || brain.currentState === 'Recover'
          ? 1.05
          : 0.9;
    const staminaPenalty = brain.stamina < 30 ? 0.82 + brain.stamina / 160 : 1;
    const stateBase =
      brain.currentState === 'PressBall'
        ? PLAYER.aiPressureSpeed
        : brain.currentState === 'Recover' || brain.currentState === 'Retreat'
          ? AI.homeReturnSpeed
          : PLAYER.aiSpeed;
    return this.getPlayerAISpeed(player, stateBase) * effortMultiplier * staminaPenalty;
  }

  private getDistanceToHome(player: Player): number {
    player.getPosition(this.playerPosition);
    this.playerPosition.y = 0;
    return this.playerPosition.distanceTo(player.homePosition);
  }

  private getProgressFromOwnGoal(team: Team, position: Vector3): number {
    const total = team.opponentGoalZ - team.ownGoalZ;
    if (Math.abs(total) < 0.001) {
      return 0.5;
    }
    return clamp((position.z - team.ownGoalZ) / total, 0, 1);
  }

  private isBallBehindPlayer(player: Player, team: Team): boolean {
    player.getPosition(this.playerPosition);
    this.playerPosition.y = 0;
    return this.getProgressFromOwnGoal(team, this.ballPosition) < this.getProgressFromOwnGoal(team, this.playerPosition) - 0.08;
  }

  private getDecisionNoise(player: Player): number {
    const personalityNoise =
      (player.traits.creativity + player.traits.riskTaking) *
      TRAIT_INFLUENCE.randomness;
    return (Math.random() - 0.5) * personalityNoise;
  }

  private updateAttackingTeam(team: Team, aiPlayers: Player[], delta: number): void {
    const possessionOwner = this.possession.getState().owner;
    const carrier = possessionOwner ?? this.findClosestPlayer(team.players);

    for (const player of aiPlayers) {
      if (player === carrier && this.isInPossessionRange(player)) {
        this.updateAICarrier(player, team, delta);
        continue;
      }

      this.setState(player, player.role === 'striker' ? 'ReceivePass' : 'SupportPass');
      this.target.copy(player.homePosition);
      const nearGoal =
        Math.abs(team.opponentGoalZ - this.ballPosition.z) < PITCH.length * 0.34;
      const teamworkBoost = 0.8 + player.traits.teamwork * 0.32 + player.traits.positioning * 0.22;
      const supportOffset =
        AI.supportForwardOffset *
        teamworkBoost *
        (nearGoal && this.isForwardRole(player) ? 1.36 : 1);
      this.target.x =
        this.ballPosition.x * 0.72 +
        LANE_BY_ROLE[player.role] * AI.supportLaneSpacing;
      this.target.z =
        this.ballPosition.z + team.attackingDirection.z * supportOffset;

      if (this.isDefensiveRole(player)) {
        this.target.z =
          this.ballPosition.z + team.attackingDirection.z * AI.supportForwardOffset * 0.35;
      }

      this.applySeparationToTarget(player, team, this.target);
      this.clampTargetForPlayer(player, team, this.target);
      this.movePlayerToward(
        player,
        this.target,
        this.getPlayerAISpeed(player, PLAYER.aiSpeed),
        delta,
      );
    }
  }

  private updateDefendingTeam(
    team: Team,
    aiPlayers: Player[],
    isLooseBallTeam: boolean,
    delta: number,
  ): void {
    const sortedByBall = [...aiPlayers].sort(
      (a, b) => this.getPressureSelectionScore(a, team) - this.getPressureSelectionScore(b, team),
    );
    const pressurePlayer = sortedByBall[0];
    const laneCoverPlayer = sortedByBall[1];

    for (const player of aiPlayers) {
      if (player === pressurePlayer) {
        this.setState(player, 'PressBall');
        const pressureDistance =
          AI.pressureDistance *
          (0.78 + player.traits.aggression * 0.45 + this.getStyleAggression(team));
        if (!isLooseBallTeam && this.getDistanceToBallSquared(player) > pressureDistance * pressureDistance) {
          this.setState(player, 'HoldShape');
          this.target.copy(player.homePosition);
          this.applySeparationToTarget(player, team, this.target);
          this.clampTargetForPlayer(player, team, this.target);
          this.movePlayerToward(player, this.target, this.getPlayerAISpeed(player, AI.homeReturnSpeed), delta);
          continue;
        }
        const pressureSpeed = this.getPlayerAISpeed(
          player,
          isLooseBallTeam ? PLAYER.aiPressureSpeed : PLAYER.aiSpeed,
        );
        this.movePlayerToward(player, this.ballPosition, pressureSpeed, delta);

        if (this.isInPossessionRange(player)) {
          this.aiTouchBall(player, team);
        }

        continue;
      }

      if (player === laneCoverPlayer) {
        this.setState(player, 'MarkOpponent');
        this.target.x =
          this.ballPosition.x * 0.5 -
          Math.sign(this.ballPosition.x || LANE_BY_ROLE[player.role]) *
            AI.laneCoverDistance *
            0.32;
        this.target.z =
          this.ballPosition.z + (team.ownGoalZ - this.ballPosition.z) * 0.3;
        this.applySeparationToTarget(player, team, this.target);
        this.clampTargetForPlayer(player, team, this.target);
        this.movePlayerToward(player, this.target, this.getPlayerAISpeed(player, PLAYER.aiSpeed), delta);
        continue;
      }

      const depth = DEFENSIVE_DEPTH_BY_ROLE[player.role];
      this.setState(player, 'HoldShape');
      this.target.copy(player.homePosition);
      this.target.x = player.homePosition.x * 0.58 + this.ballPosition.x * 0.42;
      this.target.z = this.ballPosition.z + (team.ownGoalZ - this.ballPosition.z) * depth;
      this.applySeparationToTarget(player, team, this.target);
      this.clampTargetForPlayer(player, team, this.target);
      this.movePlayerToward(
        player,
        this.target,
        this.getPlayerAISpeed(player, AI.homeReturnSpeed * (0.86 + player.traits.discipline * 0.22)),
        delta,
      );
    }
  }

  private updateGoalkeeper(
    player: Player,
    team: Team,
    brain: AIPlayerBrain,
    delta: number,
  ): void {
    const owner = this.possession.getState().owner;
    this.getKeeperArea(team, this.keeperMin, this.keeperMax);
    player.getPosition(this.playerPosition);
    this.playerPosition.y = 0;
    const distanceToBall = this.playerPosition.distanceTo(this.ballPosition);
    const ballInKeeperArea = this.isPointInsideArea(this.ballPosition, this.keeperMin, this.keeperMax);

    this.target.copy(player.homePosition);
    this.target.x = clamp(
      this.ballPosition.x,
      this.keeperMin.x + KEEPER.areaPadding,
      this.keeperMax.x - KEEPER.areaPadding,
    );
    this.target.z = clamp(
      ballInKeeperArea || distanceToBall < KEEPER.claimRange
        ? this.ballPosition.z
        : team.ownGoalZ + team.attackingDirection.z * 5.6,
      this.keeperMin.z + KEEPER.areaPadding,
      this.keeperMax.z - KEEPER.areaPadding,
    );

    const state: AIState =
      ballInKeeperArea || distanceToBall < KEEPER.claimRange
        ? 'KeeperChaseBall'
        : 'KeeperDefend';
    this.setState(player, state);
    brain.forceState(
      state,
      state === 'KeeperChaseBall' ? 'Claim loose ball' : 'Guard goal mouth',
      this.target,
      this.matchTime,
    );
    player.moveTowards(this.target, KEEPER.trackSpeed, delta, AI.arriveRadius);

    if (owner === player && distanceToBall <= KEEPER.claimRange) {
      const remainingCooldown = this.cooldowns.get(player.id) ?? 0;
      if (remainingCooldown === 0) {
        this.goalDirection.copy(team.attackingDirection);
        this.goalDirection.x = -this.ballPosition.x * 0.045;
        this.goalDirection.normalize();
        this.ball.applyImpulseCapped(
          this.goalDirection,
          KEEPER.clearPower,
          0.18,
          KEEPER.clearMaxSpeed,
        );
        soundHooks.onKick();
        this.possession.forceLoose(`${player.displayName} clear`, 300);
        this.cooldowns.set(player.id, AI.ballActionCooldown);
      }
    }
  }

  private updateAICarrier(player: Player, team: Team, delta: number): void {
    const opponentTeam = this.getOpponentTeam(team);
    const pressure = this.getClosestOpponentDistance(player, opponentTeam);
    const remainingCooldown = this.cooldowns.get(player.id) ?? 0;
    const action = this.pickCarrierAction(player, team, pressure);

    if (remainingCooldown === 0 && action === 'Shoot') {
      this.setState(player, 'Shoot');
      this.aiTouchBall(player, team, 'Shoot');
    } else if (remainingCooldown === 0 && action === 'Pass') {
      this.setState(player, 'ReceivePass');
      this.aiTouchBall(player, team, 'Pass');
    } else {
      this.setState(player, 'Dribble');
      this.goalDirection.set(0, 0, team.opponentGoalZ).sub(this.ballPosition);
      this.goalDirection.y = 0;
      if (this.goalDirection.lengthSq() > 0.0001) {
        this.goalDirection.normalize();
      } else {
        this.goalDirection.copy(team.attackingDirection);
      }
      this.target.copy(this.ballPosition).addScaledVector(this.goalDirection, 2);
      this.clampTargetForPlayer(player, team, this.target);
      this.movePlayerToward(player, this.target, this.getPlayerAISpeed(player, PLAYER.aiSpeed), delta);

      if (remainingCooldown === 0) {
        const dribblePower = AI.tapPower * (0.72 + player.traits.dribbling * 0.5);
        this.ball.applyImpulseCapped(this.goalDirection, dribblePower, 0, AI.maxBallSpeed);
        this.cooldowns.set(player.id, AI.ballActionCooldown * 0.55);
      }
    }
  }

  private aiTouchBall(player: Player, team: Team, preferredAction?: 'Shoot' | 'Pass' | 'Dribble'): void {
    const remainingCooldown = this.cooldowns.get(player.id) ?? 0;

    if (remainingCooldown > 0) {
      return;
    }

    this.goalDirection.set(0, 0, team.opponentGoalZ).sub(this.ballPosition);
    this.goalDirection.y = 0;
    if (this.goalDirection.lengthSq() > 0.0001) {
      this.goalDirection.normalize();
    } else {
      this.goalDirection.copy(team.attackingDirection);
    }

    const shouldShoot = preferredAction === 'Shoot' || (!preferredAction && this.shouldShoot(team, player));
    const shouldPass = preferredAction === 'Pass';

    if (shouldShoot) {
      this.setState(player, 'Shoot');
      const shotPower =
        AI.shotPower * (0.84 + player.traits.shooting * 0.32 + player.traits.riskTaking * 0.12);
      const shotLift = AI.shotLift * (0.72 + player.traits.shooting * 0.36);
      this.ball.applyImpulseCapped(
        this.goalDirection,
        shotPower,
        shotLift,
        GAMEPLAY.maxShotSpeed,
      );
      this.possession.forceLoose(`${player.displayName} shot`, 220);
      soundHooks.onKick();
    } else {
      const passTarget = this.findBestForwardTeammate(player, team);
      if (passTarget || shouldPass) {
        if (!passTarget) {
          this.ball.applyImpulseCapped(
            this.goalDirection,
            AI.passPower * (0.92 + player.traits.passing * 0.22),
            GAMEPLAY.passLift * 0.45,
            GAMEPLAY.maxPassSpeed,
          );
          this.possession.forceLoose(`${player.displayName} forward pass`, 180);
          soundHooks.onPass();
          this.cooldowns.set(player.id, AI.ballActionCooldown);
          return;
        }
        passTarget.getPosition(this.target);
        this.target
          .addScaledVector(passTarget.facing, this.getPlayerAISpeed(passTarget, PLAYER.aiSpeed) * GAMEPLAY.passLeadSeconds)
          .addScaledVector(team.attackingDirection, player.traits.creativity * 2.2)
          .sub(this.ballPosition);
        const offside = getOffsideViolation(
          team,
          this.getOpponentTeam(team),
          player,
          passTarget,
          this.ballPosition,
        );
        if (offside) {
          this.onOffside(offside.restartPosition, offside.reason, this.getOpponentTeam(team).color);
          this.cooldowns.set(player.id, AI.ballActionCooldown);
          return;
        }
        const passDistance = Math.min(62, Math.max(8, this.target.length()));
        const passT = (passDistance - 8) / 54;
        const passPower =
          (AI.passPower +
            (GAMEPLAY.maxPassPower - AI.passPower) * Math.pow(passT, 0.86)) *
          (0.98 + player.traits.passing * 0.2 + player.traits.teamwork * 0.08);
        this.ball.applyImpulseCapped(
          this.target,
          passPower,
          GAMEPLAY.passLift * 0.55,
          GAMEPLAY.maxPassSpeed,
        );
        this.possession.forceLoose(`${player.displayName} pass`, 180);
        soundHooks.onPass();
      } else {
        const dribblePower = AI.tapPower * (0.72 + player.traits.dribbling * 0.5);
        this.ball.applyImpulseCapped(this.goalDirection, dribblePower, 0, AI.maxBallSpeed);
      }
    }

    this.cooldowns.set(player.id, AI.ballActionCooldown);
  }

  private shouldShoot(team: Team, player?: Player): boolean {
    const distanceToGoal = Math.abs(team.opponentGoalZ - this.ballPosition.z);
    if (!player) {
      return distanceToGoal < AI.shootDistance;
    }

    const threshold =
      AI.shootDistance *
      (0.72 + player.traits.shooting * 0.34 + player.traits.riskTaking * 0.18);
    return distanceToGoal < threshold;
  }

  private pickCarrierAction(
    player: Player,
    team: Team,
    pressureDistance: number,
  ): 'Shoot' | 'Pass' | 'Dribble' {
    const distanceToGoal = Math.abs(team.opponentGoalZ - this.ballPosition.z);
    const goalT = Math.max(0, 1 - distanceToGoal / AI.shootDistance);
    const pressureT = Math.max(
      0,
      Math.min(1, 1 - (pressureDistance - 1.6) / AI.passUnderPressureDistance),
    );
    const style = team.teamStyle;
    const stylePass =
      style === 'possession' ? 0.42 : style === 'balanced' ? 0.1 : style === 'directAttack' ? -0.08 : 0;
    const styleShoot =
      style === 'directAttack' ? 0.44 : style === 'counterAttack' ? 0.24 : style === 'possession' ? -0.12 : 0;
    const styleDribble =
      style === 'counterAttack' ? 0.24 : style === 'highPress' ? 0.1 : style === 'defensive' ? -0.12 : 0;
    const randomness =
      (player.traits.creativity + player.traits.riskTaking) *
      TRAIT_INFLUENCE.randomness *
      (Math.random() - 0.5);

    const shootScore =
      goalT * 2.3 +
      player.traits.shooting * 1.2 +
      player.traits.positioning * 0.62 +
      player.traits.riskTaking * 0.5 +
      styleShoot -
      pressureT * (0.42 - player.traits.composure * 0.24) +
      randomness;
    const passScore =
      pressureT * 1.35 +
      player.traits.passing * 1.02 +
      player.traits.teamwork * 0.95 +
      player.traits.creativity * 0.44 +
      stylePass -
      goalT * 0.15;
    const dribbleScore =
      player.traits.dribbling * 1.08 +
      player.traits.speed * 0.58 +
      player.traits.riskTaking * 0.38 +
      styleDribble -
      pressureT * (0.7 - player.traits.composure * 0.32);

    if (shootScore >= passScore && shootScore >= dribbleScore && this.shouldShoot(team, player)) {
      return 'Shoot';
    }

    if (passScore >= dribbleScore && this.findBestForwardTeammate(player, team)) {
      return 'Pass';
    }

    return 'Dribble';
  }

  private getPressureSelectionScore(player: Player, team: Team): number {
    const distanceScore = this.getDistanceToBallSquared(player);
    const aggressionBonus = player.traits.aggression * 96 + this.getStyleAggression(team) * 130;
    const disciplinePenalty = player.traits.discipline * (this.isDefensiveRole(player) ? 18 : 42);
    const speedBonus = player.traits.speed * 36;
    return distanceScore - aggressionBonus - speedBonus + disciplinePenalty;
  }

  private getStyleAggression(team: Team): number {
    if (team.teamStyle === 'highPress') return 0.28;
    if (team.teamStyle === 'counterAttack') return 0.12;
    if (team.teamStyle === 'defensive') return -0.16;
    if (team.teamStyle === 'possession') return -0.04;
    return 0;
  }

  private getPlayerAISpeed(player: Player, baseSpeed: number): number {
    return baseSpeed * (0.78 + player.traits.speed * 0.34 + player.traits.stamina * 0.1);
  }

  private isDefensiveRole(player: Player): boolean {
    return (
      player.role === 'leftBack' ||
      player.role === 'centerBackLeft' ||
      player.role === 'centerBackRight' ||
      player.role === 'rightBack' ||
      player.role === 'defensiveMid'
    );
  }

  private isForwardRole(player: Player): boolean {
    return player.role === 'striker' || player.role === 'leftWing' || player.role === 'rightWing';
  }

  private setState(player: Player, state: AIState): void {
    this.states.set(player.id, state);
  }

  private findBestForwardTeammate(player: Player, team: Team): Player | undefined {
    const opponentTeam = this.getOpponentTeam(team);
    let bestPlayer: Player | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const teammate of team.players) {
      if (
        teammate === player ||
        teammate.role === 'goalkeeper'
      ) {
        continue;
      }

      teammate.getPosition(this.playerPosition);
      this.playerPosition.y = 0;
      const forwardProgress =
        (this.playerPosition.z - this.ballPosition.z) * team.attackingDirection.z;
      const distance = this.playerPosition.distanceTo(this.ballPosition);

      if (distance < 4 || distance > 58) {
        continue;
      }

      const marking = this.getClosestOpponentDistance(teammate, opponentTeam);
      const centrality = -Math.abs(this.playerPosition.x) * 0.1;
      const openScore = Math.min(3, marking * 0.45);
      const distanceScore = -Math.abs(distance - 18) * 0.06;
      const traitScore =
        teammate.traits.positioning * 0.8 +
        teammate.traits.speed * 0.32 +
        player.traits.passing * 0.55 +
        player.traits.creativity * Math.max(0, forwardProgress) * 0.05;
      const score =
        forwardProgress * (0.38 + player.traits.riskTaking * 0.2) +
        centrality +
        openScore +
        distanceScore +
        traitScore;

      if (score > bestScore) {
        bestScore = score;
        bestPlayer = teammate;
      }
    }

    return bestPlayer;
  }

  private getLikelyPossessionTeam(): Team {
    const blueDistance = this.getClosestDistanceSquared(this.blueTeam.players);
    const redDistance = this.getClosestDistanceSquared(this.redTeam.players);
    return blueDistance <= redDistance ? this.blueTeam : this.redTeam;
  }

  private getOpponentTeam(team: Team): Team {
    return team === this.blueTeam ? this.redTeam : this.blueTeam;
  }

  private findClosestPlayer(players: Player[]): Player {
    let closestPlayer = players[0];
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const player of players) {
      const distance = this.getDistanceToBallSquared(player);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPlayer = player;
      }
    }

    return closestPlayer;
  }

  private getClosestDistanceSquared(players: Player[]): number {
    return this.getDistanceToBallSquared(this.findClosestPlayer(players));
  }

  private getDistanceToBallSquared(player: Player): number {
    player.getPosition(this.playerPosition);
    this.playerPosition.y = 0;
    return this.playerPosition.distanceToSquared(this.ballPosition);
  }

  private getClosestOpponentDistance(player: Player, opponentTeam: Team): number {
    player.getPosition(this.playerPosition);
    this.playerPosition.y = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const opponent of opponentTeam.players) {
      opponent.getPosition(this.opponentPosition);
      this.opponentPosition.y = 0;
      closestDistance = Math.min(
        closestDistance,
        this.opponentPosition.distanceTo(this.playerPosition),
      );
    }

    return closestDistance;
  }

  private isInPossessionRange(player: Player): boolean {
    player.getPosition(this.playerPosition);
    this.playerPosition.y = 0;
    return this.playerPosition.distanceTo(this.ballPosition) <= GAMEPLAY.possessionDistance;
  }

  private movePlayerToward(
    player: Player,
    target: Vector3,
    speed: number,
    delta: number,
  ): void {
    player.moveTowards(target, speed, delta, AI.arriveRadius);
    const team = player.team === 'blue' ? this.blueTeam : this.redTeam;
    clampPositionToRoleZone(player.group.position, team, player.role);
  }

  private applySeparationToTarget(player: Player, team: Team, target: Vector3): void {
    for (const teammate of team.players) {
      if (teammate === player) {
        continue;
      }

      teammate.getPosition(this.opponentPosition);
      this.opponentPosition.y = 0;
      const distance = target.distanceTo(this.opponentPosition);

      if (distance >= AI.separationRadius) {
        continue;
      }

      this.separation.copy(target).sub(this.opponentPosition);
      this.separation.y = 0;
      if (this.separation.lengthSq() < 0.001) {
        this.separation.set(LANE_BY_ROLE[player.role] || 0.5, 0, 0.5);
      }
      const spacingMultiplier =
        0.72 +
        player.traits.positioning * 0.42 +
        player.traits.discipline * 0.2 +
        (team.teamStyle === 'defensive' ? -0.1 : 0);
      this.separation
        .normalize()
        .multiplyScalar((AI.separationRadius - distance) * AI.separationStrength * spacingMultiplier);
      target.add(this.separation);
    }
  }

  private tickCooldowns(delta: number): void {
    for (const [playerId, cooldown] of this.cooldowns) {
      const nextCooldown = Math.max(0, cooldown - delta);
      if (nextCooldown === 0) {
        this.cooldowns.delete(playerId);
      } else {
        this.cooldowns.set(playerId, nextCooldown);
      }
    }
  }

  private clampTargetToPitch(target: Vector3): void {
    const maxX = PITCH.width / 2 - PLAYER.boundsPadding;
    const maxZ = PITCH.length / 2 - PLAYER.boundsPadding;
    target.x = Math.max(-maxX, Math.min(maxX, target.x));
    target.y = 0;
    target.z = Math.max(-maxZ, Math.min(maxZ, target.z));
  }

  private clampTargetForPlayer(player: Player, team: Team, target: Vector3): void {
    this.clampTargetToPitch(target);
    clampPositionToRoleZone(target, team, player.role);
  }

  private getKeeperArea(team: Team, min: Vector3, max: Vector3): void {
    const zA = team.ownGoalZ;
    const zB = team.ownGoalZ + team.attackingDirection.z * PENALTY_AREA_SIZE.depth;
    min.set(-PENALTY_AREA_SIZE.width / 2, 0, Math.min(zA, zB));
    max.set(PENALTY_AREA_SIZE.width / 2, 0, Math.max(zA, zB));
  }

  private isPointInsideArea(point: Vector3, min: Vector3, max: Vector3): boolean {
    return point.x >= min.x && point.x <= max.x && point.z >= min.z && point.z <= max.z;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
