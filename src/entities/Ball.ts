import RAPIER, { type RigidBody, type World } from '@dimforge/rapier3d-compat';
import {
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { BALL } from '../game/constants';

export class Ball {
  readonly mesh: Mesh;
  readonly rigidBody: RigidBody;
  private readonly material: MeshStandardMaterial;
  private readonly impulse = new Vector3();
  private readonly meshQuaternion = new Quaternion();

  constructor(world: World) {
    this.material = new MeshStandardMaterial({
      color: 0xf4f4ee,
      roughness: 0.72,
      metalness: 0,
      emissive: 0x101010,
      emissiveIntensity: 0.12,
    });
    this.mesh = new Mesh(new SphereGeometry(BALL.radius, 32, 18), this.material);
    this.mesh.castShadow = true;

    this.rigidBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(BALL.start.x, BALL.start.y, BALL.start.z)
        .setLinearDamping(BALL.linearDamping)
        .setAngularDamping(BALL.angularDamping),
    );

    const collider = RAPIER.ColliderDesc.ball(BALL.radius)
      .setDensity(BALL.density)
      .setFriction(BALL.friction)
      .setRestitution(BALL.restitution);
    world.createCollider(collider, this.rigidBody);

    this.syncMesh();
  }

  getPosition(target = new Vector3()): Vector3 {
    const translation = this.rigidBody.translation();
    return target.set(translation.x, translation.y, translation.z);
  }

  getSpeed(): number {
    const velocity = this.rigidBody.linvel();
    return Math.hypot(velocity.x, velocity.y, velocity.z);
  }

  getVelocity(target = new Vector3()): Vector3 {
    const velocity = this.rigidBody.linvel();
    return target.set(velocity.x, velocity.y, velocity.z);
  }

  setGlow(color: number, intensity: number): void {
    this.material.emissive.setHex(color);
    this.material.emissiveIntensity = intensity;
  }

  applyImpulse(direction: Vector3, power: number, lift = 0): void {
    this.applyImpulseCapped(direction, power, lift, BALL.maxSpeed);
  }

  applyImpulseCapped(
    direction: Vector3,
    power: number,
    lift = 0,
    maxSpeed: number = BALL.maxSpeed,
  ): void {
    this.impulse.copy(direction);
    this.impulse.y = 0;

    if (this.impulse.lengthSq() === 0) {
      this.impulse.set(0, 0, -1);
    }

    this.impulse.normalize().multiplyScalar(power);
    this.impulse.y = lift;

    this.rigidBody.applyImpulse(
      { x: this.impulse.x, y: this.impulse.y, z: this.impulse.z },
      true,
    );
    this.limitSpeed(maxSpeed);
  }

  limitSpeed(maxSpeed: number = BALL.maxSpeed): void {
    const velocity = this.rigidBody.linvel();
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);

    if (horizontalSpeed <= maxSpeed) {
      return;
    }

    const scale = maxSpeed / horizontalSpeed;
    this.rigidBody.setLinvel(
      {
        x: velocity.x * scale,
        y: Math.max(-maxSpeed * 0.45, Math.min(maxSpeed * 0.45, velocity.y)),
        z: velocity.z * scale,
      },
      true,
    );
  }

  stop(): void {
    this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  reset(position = BALL.start): void {
    this.rigidBody.setTranslation(
      { x: position.x, y: position.y, z: position.z },
      true,
    );
    this.stop();
    this.syncMesh();
  }

  syncMesh(): void {
    const translation = this.rigidBody.translation();
    const rotation = this.rigidBody.rotation();

    this.mesh.position.set(translation.x, translation.y, translation.z);
    this.mesh.quaternion.copy(
      this.meshQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w),
    );
  }
}
