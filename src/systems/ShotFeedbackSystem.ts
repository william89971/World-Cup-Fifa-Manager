import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import type { Ball } from '../entities/Ball';
import type { Team } from '../entities/Team';
import { READABILITY } from '../game/constants';

export interface ShotEvent {
  power: number;
  charge: number;
  position: Vector3;
}

interface Flash {
  mesh: Mesh;
  ttl: number;
  duration: number;
}

export class ShotFeedbackSystem {
  private readonly trailGeometry = new BufferGeometry();
  private readonly trailPositions = new Float32Array(30 * 3);
  private readonly trail: Line;
  private readonly ballPosition = new Vector3();
  private readonly ballVelocity = new Vector3();
  private readonly previousVelocity = new Vector3();
  private readonly keeperPosition = new Vector3();
  private readonly flashes: Flash[] = [];
  private readonly samples: Vector3[] = [];
  private activeShotTimer = 0;
  private activeShotPreviousSpeed = 0;
  private message = '';
  private messageTimer = 0;

  constructor(
    private readonly scene: Scene,
    private readonly ball: Ball,
    private readonly triggerShake: (intensity: number, duration: number) => void,
  ) {
    this.trailGeometry.setAttribute('position', new BufferAttribute(this.trailPositions, 3));
    this.trail = new Line(
      this.trailGeometry,
      new LineBasicMaterial({
        color: 0xf6d66f,
        transparent: true,
        opacity: 0,
      }),
    );
    this.scene.add(this.trail);
  }

  recordShot(event: ShotEvent): void {
    if (event.power < READABILITY.hardShotPower) {
      return;
    }

    this.activeShotTimer = READABILITY.shotTrailDuration;
    this.activeShotPreviousSpeed = 0;
    this.samples.length = 0;
    this.samples.push(event.position.clone());
    this.triggerShake(
      READABILITY.shotShakeIntensity * Math.max(0.35, event.charge),
      READABILITY.shotShakeDuration,
    );
    this.addFlash(event.position, 0.18, 0.24);
  }

  update(delta: number, teams: Team[]): void {
    this.messageTimer = Math.max(0, this.messageTimer - delta);
    if (this.messageTimer === 0) {
      this.message = '';
    }

    this.ball.getPosition(this.ballPosition);
    this.ball.getVelocity(this.ballVelocity);
    const speed = Math.hypot(this.ballVelocity.x, this.ballVelocity.z);

    if (this.activeShotTimer > 0) {
      this.activeShotTimer = Math.max(0, this.activeShotTimer - delta);
      this.samples.unshift(this.ballPosition.clone());
      this.samples.length = Math.min(this.samples.length, 10);
      this.detectKeeperBlock(teams, speed);
      this.updateTrail(speed);
    } else {
      this.samples.length = 0;
      this.setTrailOpacity(0);
    }

    this.previousVelocity.copy(this.ballVelocity);
    this.activeShotPreviousSpeed = speed;
    this.updateFlashes(delta);
  }

  getMessage(): string {
    return this.message;
  }

  private detectKeeperBlock(teams: Team[], speed: number): void {
    if (this.activeShotPreviousSpeed < READABILITY.hardShotSpeed) {
      return;
    }

    const speedDrop =
      speed < this.activeShotPreviousSpeed * READABILITY.keeperBlockSpeedDrop;
    const directionChanged =
      this.previousVelocity.lengthSq() > 0.001 &&
      this.ballVelocity.lengthSq() > 0.001 &&
      this.previousVelocity.normalize().dot(this.ballVelocity.clone().normalize()) < 0.35;

    if (!speedDrop && !directionChanged) {
      return;
    }

    for (const team of teams) {
      const keeper = team.players.find((player) => player.role === 'goalkeeper');
      if (!keeper) continue;
      keeper.getPosition(this.keeperPosition);
      this.keeperPosition.y = 0;
      const ballXZ = this.ballPosition.clone();
      ballXZ.y = 0;

      if (this.keeperPosition.distanceTo(ballXZ) <= READABILITY.keeperBlockDistance) {
        this.message = 'Saved!';
        this.messageTimer = 1.15;
        this.addFlash(this.ballPosition, 0.12, 0.2);
        this.activeShotTimer = 0;
        return;
      }
    }
  }

  private updateTrail(speed: number): void {
    const count = Math.min(this.samples.length, this.trailPositions.length / 3);
    for (let index = 0; index < this.trailPositions.length / 3; index += 1) {
      const sample = this.samples[Math.min(index, count - 1)] ?? this.ballPosition;
      this.trailPositions[index * 3] = sample.x;
      this.trailPositions[index * 3 + 1] = sample.y;
      this.trailPositions[index * 3 + 2] = sample.z;
    }
    this.trailGeometry.attributes.position.needsUpdate = true;
    const speedT = Math.max(0, Math.min(1, (speed - READABILITY.shotTrailMinSpeed) / 10));
    this.setTrailOpacity(0.58 * speedT * (this.activeShotTimer / READABILITY.shotTrailDuration));
  }

  private setTrailOpacity(opacity: number): void {
    (this.trail.material as LineBasicMaterial).opacity = opacity;
  }

  private addFlash(position: Vector3, radius: number, duration: number): void {
    const mesh = new Mesh(
      new SphereGeometry(radius, 12, 8),
      new MeshBasicMaterial({
        color: 0xf6d66f,
        transparent: true,
        opacity: 0.62,
      }),
    );
    mesh.position.copy(position);
    this.scene.add(mesh);
    this.flashes.push({ mesh, ttl: duration, duration });
  }

  private updateFlashes(delta: number): void {
    for (let index = this.flashes.length - 1; index >= 0; index -= 1) {
      const flash = this.flashes[index];
      flash.ttl -= delta;
      const progress = Math.max(0, flash.ttl / flash.duration);
      flash.mesh.scale.setScalar(1 + (1 - progress) * 2.4);
      (flash.mesh.material as MeshBasicMaterial).opacity = 0.62 * progress;
      if (flash.ttl <= 0) {
        this.scene.remove(flash.mesh);
        this.flashes.splice(index, 1);
      }
    }
  }
}
