import { Vector3 } from 'three';
import { Ball } from '../entities/Ball';
import { Goal } from '../entities/Goal';
import type { Team } from '../entities/Team';
import { BALL, GOAL, MATCH, PENALTY_AREA_SIZE, PITCH, RESTARTS } from '../game/constants';
import { soundHooks } from '../game/soundHooks';
import { clampPositionToRoleZone } from './RoleZones';
import type { MatchEvent } from '../manager/types';
import type { MatchEventBus } from './MatchEventBus';

export interface MatchScore {
  blue: number;
  red: number;
}

export interface MatchResult {
  blueScore: number;
  redScore: number;
}

export interface MatchViewState {
  score: MatchScore;
  elapsedSeconds: number;
  remainingSeconds: number;
  message: string;
  paused: boolean;
  finished: boolean;
  resetting: boolean;
  restart: {
    active: boolean;
    label: string;
    secondsRemaining: number;
  };
}

export class MatchSystem {
  private readonly score: MatchScore = { blue: 0, red: 0 };
  private elapsedSeconds = 0;
  private resetCooldown: number = MATCH.goalCountdownSeconds;
  private goalFreezeCooldown = 0;
  private pendingKickoffReset = false;
  private message = 'Kickoff';
  private paused = false;
  private finished = false;
  // Match-speed multiplier applied to clock + AI delta (1x, 2x, 4x).
  private speedMultiplier: 1 | 2 | 4 = 1;
  // Halftime fires once when elapsedSeconds crosses durationSeconds/2.
  private halftimeFired = false;
  // Optional MatchEventBus for emitting goal/corner/offside/sub/etc. for stats + commentary.
  private bus?: MatchEventBus;

  constructor(
    private readonly ball: Ball,
    private readonly blueTeam: Team,
    private readonly redTeam: Team,
    private readonly goals: Goal[],
    private readonly onComplete: (result: MatchResult) => void,
    private readonly durationSeconds: number = MATCH.durationSeconds,
    private readonly onKickoffReset: () => void = () => {},
    private readonly getLastTouchTeam: () => 'blue' | 'red' | undefined = () => undefined,
  ) {
    this.resetKickoff();
  }

  attachEventBus(bus: MatchEventBus): void {
    this.bus = bus;
    this.emit({ minute: 0, type: 'kickoff', team: 'neutral' });
  }

  getCurrentMinute(): number {
    // Map elapsed seconds onto a 0..90 match minute scale for readability.
    return Math.min(90, Math.max(0, Math.round((this.elapsedSeconds / this.durationSeconds) * 90)));
  }

  setSpeed(multiplier: 1 | 2 | 4): void {
    this.speedMultiplier = multiplier;
  }

  getSpeed(): 1 | 2 | 4 {
    return this.speedMultiplier;
  }

  private emit(event: MatchEvent): void {
    if (this.bus) this.bus.emit(event);
  }

  get isResetting(): boolean {
    return (
      this.resetCooldown > 0 ||
      this.goalFreezeCooldown > 0 ||
      this.paused ||
      this.finished
    );
  }

  getViewState(): MatchViewState {
    const countdownMessage =
      this.resetCooldown > 0 && this.message
        ? `${this.message} ${Math.ceil(this.resetCooldown)}`
        : this.message;

    return {
      score: { ...this.score },
      elapsedSeconds: this.elapsedSeconds,
      remainingSeconds: Math.max(0, this.durationSeconds - this.elapsedSeconds),
      message: countdownMessage,
      paused: this.paused,
      finished: this.finished,
      resetting: this.resetCooldown > 0 || this.goalFreezeCooldown > 0,
      restart: {
        active: this.resetCooldown > 0 || this.goalFreezeCooldown > 0,
        label: this.message,
        secondsRemaining: Math.max(this.resetCooldown, this.goalFreezeCooldown),
      },
    };
  }

  update(delta: number): void {
    if (this.paused || this.finished) {
      return;
    }

    // Apply speed multiplier to the match clock and timers (not physics).
    const scaledDelta = delta * this.speedMultiplier;

    if (this.goalFreezeCooldown > 0) {
      this.goalFreezeCooldown = Math.max(0, this.goalFreezeCooldown - scaledDelta);
      if (this.goalFreezeCooldown === 0 && this.pendingKickoffReset) {
        this.resetKickoff();
        this.resetCooldown = MATCH.goalCountdownSeconds;
        this.message = 'Kickoff';
        this.pendingKickoffReset = false;
        this.emit({ minute: this.getCurrentMinute(), type: 'kickoff', team: 'neutral' });
      }
      return;
    }

    if (this.resetCooldown > 0) {
      this.resetCooldown = Math.max(0, this.resetCooldown - scaledDelta);
      if (this.resetCooldown === 0) {
        this.message = '';
      }
      return;
    }

    this.elapsedSeconds += scaledDelta;

    // Halftime trigger (fires once at 50% elapsed).
    if (!this.halftimeFired && this.elapsedSeconds >= this.durationSeconds / 2) {
      this.halftimeFired = true;
      this.emit({ minute: 45, type: 'half', team: 'neutral' });
    }

    if (this.isBallOutOfBounds()) {
      this.restartFromOutOfBounds();
      return;
    }

    for (const goal of this.goals) {
      if (goal.containsBall(this.ball)) {
        this.registerGoal(goal.scoringTeam);
        break;
      }
    }

    if (this.elapsedSeconds >= this.durationSeconds) {
      this.finishMatch();
    }
  }

  togglePause(): void {
    if (this.finished) {
      return;
    }

    this.paused = !this.paused;
    this.message = this.paused ? 'Paused' : '';
  }

  restart(): void {
    this.score.blue = 0;
    this.score.red = 0;
    this.elapsedSeconds = 0;
    this.finished = false;
    this.paused = false;
    this.message = 'Kickoff';
    this.resetCooldown = MATCH.goalCountdownSeconds;
    this.goalFreezeCooldown = 0;
    this.pendingKickoffReset = false;
    this.resetKickoff();
  }

  restartForOffside(
    position: Vector3,
    message = 'Offside',
    restartTeamColor: 'blue' | 'red' = 'red',
  ): void {
    this.message = message;
    this.resetCooldown = RESTARTS.offsideDelay;
    this.ball.reset(this.clampRestartPosition(position));
    this.positionRestartPlayers(
      position,
      restartTeamColor === 'blue' ? this.blueTeam : this.redTeam,
    );
    this.onKickoffReset();
    soundHooks.onWhistle();
    // The team that benefits from the restart is the restartTeamColor; the offside
    // was committed by the OTHER team.
    this.emit({
      minute: this.getCurrentMinute(),
      type: 'offside',
      team: restartTeamColor === 'blue' ? 'red' : 'blue',
    });
  }

  private registerGoal(team: 'blue' | 'red'): void {
    this.score[team] += 1;
    this.message = `${team === 'blue' ? this.blueTeam.name : this.redTeam.name} goal`;
    this.goalFreezeCooldown = MATCH.goalFreezeSeconds;
    this.resetCooldown = 0;
    this.pendingKickoffReset = true;
    this.ball.stop();
    soundHooks.onGoal();
    this.emit({
      minute: this.getCurrentMinute(),
      type: 'goal',
      team,
      detail: `${this.score.blue}-${this.score.red}`,
    });
  }

  private resetKickoff(): void {
    this.ball.reset(BALL.start);
    this.resetTeam(this.blueTeam);
    this.resetTeam(this.redTeam);
    this.onKickoffReset();
    soundHooks.onWhistle();
  }

  private resetTeam(team: Team): void {
    for (const player of team.players) {
      player.reset(player.homePosition, team.attackingDirection.clone());
    }
  }

  private isBallOutOfBounds(): boolean {
    const position = this.ball.getPosition(new Vector3());
    return (
      Math.abs(position.x) > PITCH.width / 2 + MATCH.outOfBoundsPadding ||
      Math.abs(position.z) > PITCH.length / 2 + MATCH.outOfBoundsPadding ||
      position.y < -4
    );
  }

  private restartFromOutOfBounds(): void {
    const position = this.ball.getPosition(new Vector3());
    const lastTouchTeam = this.getLastTouchTeam();
    const halfWidth = PITCH.width / 2;
    const halfLength = PITCH.length / 2;

    if (Math.abs(position.x) > halfWidth + MATCH.outOfBoundsPadding) {
      const throwTeam = lastTouchTeam === 'blue' ? 'red' : 'blue';
      const restart = new Vector3(
        Math.sign(position.x || 1) * (halfWidth - RESTARTS.sidelineInset),
        BALL.start.y,
        clamp(position.z, -halfLength + RESTARTS.cornerInset, halfLength - RESTARTS.cornerInset),
      );
      this.message = `${throwTeam === 'blue' ? this.blueTeam.name : this.redTeam.name} throw-in`;
      this.resetCooldown = RESTARTS.throwInDelay;
      this.ball.reset(restart);
      this.positionRestartPlayers(restart, throwTeam === 'blue' ? this.blueTeam : this.redTeam);
      this.onKickoffReset();
      soundHooks.onWhistle();
      return;
    }

    const crossedNorth = position.z < -halfLength - MATCH.outOfBoundsPadding;
    const attackingTeam = crossedNorth ? 'blue' : 'red';
    const defendingTeam = crossedNorth ? 'red' : 'blue';
    const defendingTouchedLast = lastTouchTeam === defendingTeam;

    if (defendingTouchedLast) {
      const restart = new Vector3(
        Math.sign(position.x || 1) * (halfWidth - RESTARTS.cornerInset),
        BALL.start.y,
        crossedNorth ? -halfLength + RESTARTS.cornerInset : halfLength - RESTARTS.cornerInset,
      );
      this.message = `${attackingTeam === 'blue' ? this.blueTeam.name : this.redTeam.name} corner`;
      this.resetCooldown = RESTARTS.cornerDelay;
      this.ball.reset(restart);
      this.positionRestartPlayers(restart, attackingTeam === 'blue' ? this.blueTeam : this.redTeam);
      this.emit({
        minute: this.getCurrentMinute(),
        type: 'corner',
        team: attackingTeam,
      });
    } else {
      const keeperTeam = defendingTeam === 'blue' ? this.blueTeam : this.redTeam;
      const restart = new Vector3(
        clamp(position.x * 0.18, -GOAL.width / 2, GOAL.width / 2),
        BALL.start.y,
        keeperTeam.ownGoalZ + keeperTeam.attackingDirection.z * (PENALTY_AREA_SIZE.depth * 0.42),
      );
      this.message = `${keeperTeam.name} goal kick`;
      this.resetCooldown = RESTARTS.goalKickDelay;
      this.ball.reset(restart);
      this.positionRestartPlayers(restart, keeperTeam);
    }

    this.onKickoffReset();
    soundHooks.onWhistle();
  }

  private clampRestartPosition(position: Vector3): Vector3 {
    return new Vector3(
      clamp(position.x, -PITCH.width / 2 + RESTARTS.sidelineInset, PITCH.width / 2 - RESTARTS.sidelineInset),
      BALL.start.y,
      clamp(position.z, -PITCH.length / 2 + RESTARTS.cornerInset, PITCH.length / 2 - RESTARTS.cornerInset),
    );
  }

  private positionRestartPlayers(restart: Vector3, restartTeam: Team): void {
    const supportOffsets = [
      new Vector3(-3.2, 0, -restartTeam.attackingDirection.z * 2.6),
      new Vector3(3.2, 0, -restartTeam.attackingDirection.z * 2.6),
      new Vector3(0, 0, -restartTeam.attackingDirection.z * 5.2),
    ];
    const candidates = restartTeam.players
      .filter((player) => player.role !== 'goalkeeper')
      .sort(
        (a, b) =>
          a.group.position.distanceToSquared(restart) -
          b.group.position.distanceToSquared(restart),
      )
      .slice(0, supportOffsets.length);

    for (const [index, player] of candidates.entries()) {
      const target = restart.clone().add(supportOffsets[index]);
      clampPositionToRoleZone(target, restartTeam, player.role);
      player.reset(target, restartTeam.attackingDirection.clone());
    }
  }

  private finishMatch(): void {
    this.finished = true;
    this.message = 'Full time';
    soundHooks.fullTime();
    this.emit({
      minute: 90,
      type: 'full',
      team: 'neutral',
      detail: `${this.score.blue}-${this.score.red}`,
    });
    this.onComplete({ blueScore: this.score.blue, redScore: this.score.red });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
