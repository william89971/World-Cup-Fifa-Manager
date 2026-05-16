import { PerspectiveCamera, Vector3 } from 'three';
import { Ball } from '../entities/Ball';
import { Player } from '../entities/Player';
import { CAMERA } from '../game/constants';

export type CameraMode = 'follow' | 'broadcast';

// Broadcast camera preset — above and behind one byline, looking toward the pitch.
// Used in manager mode where the user is watching, not playing.
const BROADCAST_HEIGHT = 38;
const BROADCAST_BACK = 56;
const BROADCAST_BALL_DRIFT_X = 0.32;
const BROADCAST_BALL_DRIFT_Z = 0.18;
const BROADCAST_LOOK_LERP = 1.8;
const BROADCAST_POSITION_LERP = 1.4;

export class CameraSystem {
  private readonly desiredPosition = new Vector3();
  private readonly desiredTarget = new Vector3();
  private readonly currentTarget = new Vector3();
  private readonly playerPosition = new Vector3();
  private readonly ballPosition = new Vector3();
  private readonly smoothedForward = new Vector3(0, 0, -1);
  private readonly shakeOffset = new Vector3();
  private sensitivity = 1;
  private shakeTimer = 0;
  private shakeDuration = 0;
  private shakeIntensity = 0;
  public mode: CameraMode = 'broadcast';

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly getFollowPlayer: () => Player | null,
    sensitivity = 1,
    private readonly ball?: Ball,
  ) {
    this.setSensitivity(sensitivity);
    if (this.mode === 'broadcast') {
      this.setBroadcastTargets();
    } else {
      const player = this.getFollowPlayer();
      if (player) {
        player.getPosition(this.playerPosition);
        this.smoothedForward.copy(player.facing).normalize();
      }
      this.setThirdPersonTargets();
    }
    this.camera.position.copy(this.desiredPosition);
    this.currentTarget.copy(this.desiredTarget);
    this.camera.lookAt(this.currentTarget);
  }

  setSensitivity(sensitivity: number): void {
    this.sensitivity = Math.max(0.55, Math.min(1.6, sensitivity));
  }

  addShake(intensity: number, duration: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  update(delta: number): void {
    if (this.mode === 'broadcast') {
      this.setBroadcastTargets();
      const lookLerp = 1 - Math.exp(-BROADCAST_LOOK_LERP * delta);
      const posLerp = 1 - Math.exp(-BROADCAST_POSITION_LERP * delta);
      this.camera.position.lerp(this.desiredPosition, posLerp);
      this.applyShake(delta);
      this.currentTarget.lerp(this.desiredTarget, lookLerp);
      this.camera.lookAt(this.currentTarget);
      return;
    }

    const player = this.getFollowPlayer();
    if (!player) {
      return;
    }
    player.getPosition(this.playerPosition);

    const rotationLerp = 1 - Math.exp(-CAMERA.lookLerp * this.sensitivity * delta);
    this.smoothedForward.lerp(player.facing, rotationLerp);
    this.smoothedForward.y = 0;
    if (this.smoothedForward.lengthSq() < 0.0001) {
      this.smoothedForward.copy(player.facing);
    }
    this.smoothedForward.normalize();
    this.setThirdPersonTargets();

    const positionLerp = 1 - Math.exp(-CAMERA.followLerp * this.sensitivity * delta);

    this.camera.position.lerp(this.desiredPosition, positionLerp);
    this.applyShake(delta);
    this.currentTarget.lerp(this.desiredTarget, rotationLerp);
    this.camera.lookAt(this.currentTarget);
  }

  // Position camera high and behind the negative-Z byline so we see the entire pitch.
  // Drift the lookAt target toward the ball so the action stays roughly centred without
  // the camera itself moving much. Yields a "TV broadcast" feel for spectator/manager view.
  private setBroadcastTargets(): void {
    if (this.ball) {
      this.ball.getPosition(this.ballPosition);
    } else {
      this.ballPosition.set(0, 0, 0);
    }
    this.desiredPosition.set(
      this.ballPosition.x * BROADCAST_BALL_DRIFT_X,
      BROADCAST_HEIGHT,
      -BROADCAST_BACK + this.ballPosition.z * BROADCAST_BALL_DRIFT_Z,
    );
    this.desiredTarget.set(this.ballPosition.x * 0.6, 1.2, this.ballPosition.z * 0.5);
  }

  private setThirdPersonTargets(): void {
    this.desiredPosition
      .copy(this.playerPosition)
      .addScaledVector(this.smoothedForward, -CAMERA.offset.z);
    this.desiredPosition.y += CAMERA.offset.y;

    this.desiredTarget
      .copy(this.playerPosition)
      .addScaledVector(this.smoothedForward, Math.abs(CAMERA.lookAhead.z));
    this.desiredTarget.y += CAMERA.lookAhead.y;
  }

  private applyShake(delta: number): void {
    if (this.shakeTimer <= 0 || this.shakeDuration <= 0) {
      this.shakeOffset.set(0, 0, 0);
      return;
    }

    this.shakeTimer = Math.max(0, this.shakeTimer - delta);
    const t = this.shakeTimer / this.shakeDuration;
    const phase = performance.now() * 0.048;
    this.shakeOffset.set(
      Math.sin(phase * 1.7) * this.shakeIntensity * t,
      Math.cos(phase * 1.2) * this.shakeIntensity * 0.28 * t,
      Math.sin(phase * 0.9) * this.shakeIntensity * 0.32 * t,
    );
    this.camera.position.add(this.shakeOffset);

    if (this.shakeTimer === 0) {
      this.shakeIntensity = 0;
      this.shakeDuration = 0;
    }
  }
}
