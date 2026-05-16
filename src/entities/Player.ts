import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  Euler,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import { PITCH, PLAYER, PLAYER_TURN_SPEED } from '../game/constants';
import {
  createNeutralTraits,
  formatRoleLabel,
  getTopTraits,
  type PersonalityArchetype,
  type PlayerRole,
  type PlayerTraits,
  type TopTrait,
} from '../game/playerTypes';

export type TeamColor = 'blue' | 'red';
export type { PersonalityArchetype, PlayerRole, PlayerTraits, TopTrait };

export type PlayerMovementState = 'idle' | 'walk' | 'run' | 'sprint' | 'turning';

const PLAYER_COLORS: Record<TeamColor, number> = {
  blue: 0x2587ff,
  red: 0xf04b55,
};

const SKIN_TONES = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5f3824] as const;
const HAIR_COLORS = [0x1c120d, 0x3a2518, 0x60412a, 0xd3a45f, 0x141414] as const;

interface PlayerVisualParts {
  group: Group;
  torso: Mesh;
  leftLeg: Mesh;
  rightLeg: Mesh;
  leftBoot: Mesh;
  rightBoot: Mesh;
}

export class Player {
  readonly group: Group;
  readonly team: TeamColor;
  readonly id: string;
  readonly role: PlayerRole;
  readonly homePosition: Vector3;
  readonly number: number;
  readonly displayName: string;
  readonly personality: PersonalityArchetype;
  readonly traits: PlayerTraits;
  readonly topTraits: TopTrait[];
  readonly roleLabel: string;
  readonly staminaModifier: number;
  readonly facing = new Vector3(0, 0, -1);
  isControlled = false;
  movementState: PlayerMovementState = 'idle';
  private readonly body: Group;
  private readonly visual: PlayerVisualParts;
  private readonly selectionRing: Mesh;
  private readonly possessionRing: Mesh;
  private readonly moveDisplacement = new Vector3();
  private readonly facingTarget = new Vector3();
  private readonly targetEuler = new Euler(0, 0, 0, 'YXZ');
  private readonly targetQuaternion = new Quaternion();
  private animationTime = 0;

  constructor(
    team: TeamColor,
    startPosition: Vector3,
    id = `${team}-player`,
    role: PlayerRole = 'striker',
    number = 1,
    primaryColor = PLAYER_COLORS[team],
    accentColor = 0xffffff,
    displayName = `${team} ${number}`,
    styleSeed = number,
    personality: PersonalityArchetype = role === 'goalkeeper' ? 'Goalkeeper' : 'Captain',
    traits: PlayerTraits = createNeutralTraits(),
  ) {
    this.team = team;
    this.id = id;
    this.role = role;
    this.number = number;
    this.displayName = displayName;
    this.personality = personality;
    this.traits = traits;
    this.topTraits = getTopTraits(traits);
    this.roleLabel = formatRoleLabel(role);
    this.staminaModifier = 0.82 + traits.stamina * 0.36;
    this.homePosition = startPosition.clone();
    this.group = new Group();
    this.group.position.copy(startPosition);

    const visualPrimary = role === 'goalkeeper'
      ? team === 'blue'
        ? 0xf6d24a
        : 0x4fe0c4
      : primaryColor;
    const visualAccent = role === 'goalkeeper' ? 0x111111 : accentColor;
    this.visual = createFootballer(visualPrimary, visualAccent, styleSeed, role);
    this.body = this.visual.group;
    this.group.add(this.body);

    const numberLabel = createPlayerLabel(number, displayName, accentColor);
    // Body is visually scaled 1.6×; head world y ≈ 1.74 × 1.6 = 2.78. Place the label
    // above that with clearance, and bump sprite scale so it stays readable from the
    // broadcast camera distance.
    numberLabel.position.set(0, 3.35, 0);
    numberLabel.scale.set(1.6, 0.68, 1);
    this.group.add(numberLabel);

    this.selectionRing = new Mesh(
      new TorusGeometry(PLAYER.radius + 0.24, 0.035, 8, 32),
      new MeshStandardMaterial({
        color: 0xf6d66f,
        roughness: 0.42,
        emissive: 0x5a4200,
        emissiveIntensity: 0.32,
      }),
    );
    this.selectionRing.rotation.x = Math.PI / 2;
    this.selectionRing.position.y = 0.04;
    this.selectionRing.visible = false;
    this.group.add(this.selectionRing);

    this.possessionRing = new Mesh(
      new TorusGeometry(PLAYER.radius + 0.37, 0.026, 8, 36),
      new MeshStandardMaterial({
        color: 0x7df7ff,
        roughness: 0.35,
        emissive: 0x0e7780,
        emissiveIntensity: 0.26,
      }),
    );
    this.possessionRing.rotation.x = Math.PI / 2;
    this.possessionRing.position.y = 0.055;
    this.possessionRing.visible = false;
    this.group.add(this.possessionRing);

    const contactShadow = new Mesh(
      new CircleGeometry(PLAYER.radius + 0.34, 28),
      new MeshBasicMaterial({
        color: 0x061109,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.012;
    this.group.add(contactShadow);
    this.setFacingImmediate(this.facing);
  }

  getPosition(target = new Vector3()): Vector3 {
    return target.copy(this.group.position);
  }

  move(displacement: Vector3): void {
    this.group.position.add(displacement);
    this.clampToPitch();
  }

  moveTowards(target: Vector3, speed: number, delta: number, arriveRadius = 0.35): void {
    this.moveDisplacement.copy(target).sub(this.group.position);
    this.moveDisplacement.y = 0;
    const distance = this.moveDisplacement.length();

    if (distance <= arriveRadius) {
      this.setMovementState('idle');
      return;
    }

    const step = Math.min(distance, speed * delta);
    this.moveDisplacement.normalize();
    this.rotateToward(this.moveDisplacement, delta, PLAYER_TURN_SPEED * 0.82);
    this.setMovementState(speed > PLAYER.speed ? 'run' : 'walk');
    this.move(this.moveDisplacement.multiplyScalar(step));
  }

  reset(position: Vector3, facing = new Vector3(0, 0, -1)): void {
    this.group.position.copy(position);
    this.setFacingImmediate(facing);
    this.setMovementState('idle');
  }

  setControlled(isControlled: boolean): void {
    // Manager mode: no controlled-player highlight. Rings stay invisible.
    this.isControlled = isControlled;
    this.selectionRing.visible = false;
    this.possessionRing.visible = false;
  }

  rotateToward(direction: Vector3, delta: number, turnSpeed = PLAYER_TURN_SPEED): boolean {
    this.facingTarget.copy(direction);
    this.facingTarget.y = 0;

    if (this.facingTarget.lengthSq() < 0.0001) {
      return false;
    }

    this.facingTarget.normalize();
    this.targetQuaternion.setFromEuler(
      this.targetEuler.set(0, directionToYaw(this.facingTarget), 0),
    );
    this.group.quaternion.rotateTowards(
      this.targetQuaternion,
      degreesToRadians(turnSpeed) * delta,
    );
    this.syncFacingFromQuaternion();
    return this.group.quaternion.angleTo(this.targetQuaternion) > 0.015;
  }

  // Controlled-player yaw is authoritative in PlayerControlSystem. Positive yaw
  // means turning right; applying -yaw to Three's Y rotation keeps that gameplay
  // convention while preserving the model's forward axis.
  setYaw(yawRadians: number): void {
    this.group.quaternion.setFromEuler(this.targetEuler.set(0, -yawRadians, 0));
    this.syncFacingFromQuaternion();
  }

  setFacingImmediate(direction: Vector3): void {
    this.facingTarget.copy(direction);
    this.facingTarget.y = 0;

    if (this.facingTarget.lengthSq() < 0.0001) {
      this.facingTarget.set(0, 0, -1);
    }

    this.facingTarget.normalize();
    this.group.quaternion.setFromEuler(
      this.targetEuler.set(0, directionToYaw(this.facingTarget), 0),
    );
    this.syncFacingFromQuaternion();
  }

  setMovementState(state: PlayerMovementState): void {
    this.movementState = state;
  }

  updateVisual(delta: number, hasPossession: boolean): void {
    // Manager mode: indicator rings stay hidden, no visual highlight for ball-carrier.
    this.possessionRing.visible = false;
    this.selectionRing.visible = false;

    const speedScale = this.getAnimationSpeedScale();
    if (speedScale <= 0) {
      this.relaxLimb(this.visual.leftLeg, delta);
      this.relaxLimb(this.visual.rightLeg, delta);
      this.relaxBoot(this.visual.leftBoot, delta);
      this.relaxBoot(this.visual.rightBoot, delta);
      this.visual.torso.rotation.x += (0 - this.visual.torso.rotation.x) * Math.min(1, delta * 8);
      return;
    }

    this.animationTime += delta * speedScale;
    const swing = Math.sin(this.animationTime) * 0.44;
    const bootLift = Math.max(0, Math.sin(this.animationTime)) * 0.06;
    const oppositeBootLift = Math.max(0, -Math.sin(this.animationTime)) * 0.06;
    this.visual.leftLeg.rotation.x = swing;
    this.visual.rightLeg.rotation.x = -swing;
    this.visual.leftBoot.rotation.x = swing * 0.45;
    this.visual.rightBoot.rotation.x = -swing * 0.45;
    this.visual.leftBoot.position.y = 0.04 + bootLift;
    this.visual.rightBoot.position.y = 0.04 + oppositeBootLift;
    this.visual.torso.rotation.x =
      this.movementState === 'sprint' ? -0.08 : this.movementState === 'run' ? -0.045 : -0.02;
  }

  getFacingAngle(): number {
    return directionToControllerYaw(this.facing);
  }

  getTopTraitsLabel(): string {
    return this.topTraits
      .map((trait) => `${trait.key} ${Math.round(trait.value * 100)}`)
      .join(', ');
  }

  private clampToPitch(): void {
    const maxX = PITCH.width / 2 - PLAYER.boundsPadding;
    const maxZ = PITCH.length / 2 - PLAYER.boundsPadding;
    this.group.position.x = Math.max(-maxX, Math.min(maxX, this.group.position.x));
    this.group.position.y = 0;
    this.group.position.z = Math.max(-maxZ, Math.min(maxZ, this.group.position.z));
  }

  private syncFacingFromQuaternion(): void {
    this.facing.set(0, 0, -1).applyQuaternion(this.group.quaternion);
    this.facing.y = 0;
    if (this.facing.lengthSq() < 0.0001) {
      this.facing.set(0, 0, -1);
    } else {
      this.facing.normalize();
    }
  }

  private getAnimationSpeedScale(): number {
    if (this.movementState === 'sprint') return 12;
    if (this.movementState === 'run') return 9;
    if (this.movementState === 'walk') return 6;
    if (this.movementState === 'turning') return 3.2;
    return 0;
  }

  private relaxLimb(limb: Mesh, delta: number): void {
    limb.rotation.x += (0 - limb.rotation.x) * Math.min(1, delta * 8);
  }

  private relaxBoot(boot: Mesh, delta: number): void {
    boot.rotation.x += (0 - boot.rotation.x) * Math.min(1, delta * 8);
    boot.position.y += (0.04 - boot.position.y) * Math.min(1, delta * 8);
  }
}

function directionToYaw(direction: Vector3): number {
  return Math.atan2(-direction.x, -direction.z);
}

function directionToControllerYaw(direction: Vector3): number {
  return Math.atan2(direction.x, -direction.z);
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Visual-only scale for player models. Physics radius/height stay in constants;
// only the rig appears bigger so players read clearly at broadcast camera distance.
const PLAYER_VISUAL_SCALE = 1.6;

function createFootballer(
  primaryColor: number,
  accentColor: number,
  styleSeed: number,
  role: PlayerRole,
): PlayerVisualParts {
  const group = new Group();
  const skin = SKIN_TONES[styleSeed % SKIN_TONES.length];
  const hair = HAIR_COLORS[Math.floor(styleSeed / 7) % HAIR_COLORS.length];
  const jersey = new MeshStandardMaterial({
    color: primaryColor,
    roughness: role === 'goalkeeper' ? 0.48 : 0.58,
  });
  const accent = new MeshStandardMaterial({ color: accentColor, roughness: 0.62 });
  const skinMaterial = new MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const hairMaterial = new MeshStandardMaterial({ color: hair, roughness: 0.82 });
  const bootMaterial = new MeshStandardMaterial({ color: 0x101010, roughness: 0.62 });

  const torso = new Mesh(
    new CylinderGeometry(
      role === 'goalkeeper' ? 0.38 : 0.34,
      role === 'goalkeeper' ? 0.46 : 0.42,
      role === 'goalkeeper' ? 0.9 : 0.82,
      12,
    ),
    jersey,
  );
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);

  const stripe = new Mesh(new BoxGeometry(0.12, 0.84, 0.04), accent);
  stripe.position.set(0, 1.12, -0.36);
  stripe.castShadow = true;
  group.add(stripe);

  const shorts = new Mesh(new BoxGeometry(0.72, 0.28, 0.42), accent);
  shorts.position.y = 0.62;
  shorts.castShadow = true;
  group.add(shorts);

  const head = new Mesh(new SphereGeometry(0.25, 16, 12), skinMaterial);
  head.position.y = 1.74;
  head.castShadow = true;
  group.add(head);

  const hairCap = new Mesh(new SphereGeometry(0.255, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMaterial);
  hairCap.position.y = 1.82;
  hairCap.castShadow = true;
  group.add(hairCap);

  const leftArm = createLimb(0.08, 0.58, skinMaterial);
  leftArm.position.set(-0.43, 1.1, 0);
  leftArm.rotation.z = -0.18;
  group.add(leftArm);

  const rightArm = createLimb(0.08, 0.58, skinMaterial);
  rightArm.position.set(0.43, 1.1, 0);
  rightArm.rotation.z = 0.18;
  group.add(rightArm);

  const leftLeg = createLimb(0.09, 0.62, skinMaterial);
  leftLeg.position.set(-0.18, 0.28, 0);
  group.add(leftLeg);

  const rightLeg = createLimb(0.09, 0.62, skinMaterial);
  rightLeg.position.set(0.18, 0.28, 0);
  group.add(rightLeg);

  const leftBoot = new Mesh(new BoxGeometry(0.22, 0.08, 0.34), bootMaterial);
  leftBoot.position.set(-0.18, 0.04, -0.05);
  leftBoot.castShadow = true;
  group.add(leftBoot);

  const rightBoot = leftBoot.clone();
  rightBoot.position.x = 0.18;
  group.add(rightBoot);

  group.scale.setScalar(PLAYER_VISUAL_SCALE);
  return { group, torso, leftLeg, rightLeg, leftBoot, rightBoot };
}

function createLimb(radius: number, height: number, material: MeshStandardMaterial): Mesh {
  const limb = new Mesh(new CylinderGeometry(radius, radius * 0.9, height, 10), material);
  limb.castShadow = true;
  return limb;
}

function createPlayerLabel(number: number, name: string, color: number): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create player label.');
  }

  context.fillStyle = 'rgba(4, 13, 9, 0.72)';
  context.fillRect(18, 10, 220, 76);
  context.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
  context.lineWidth = 5;
  context.strokeRect(18, 10, 220, 76);
  context.fillStyle = '#ffffff';
  context.font = '800 34px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`#${number}`, 128, 32);
  context.font = '700 22px system-ui, sans-serif';
  context.fillText(shortName(name), 128, 63);

  const texture = new CanvasTexture(canvas);
  const material = new SpriteMaterial({ map: texture, transparent: true });
  return new Sprite(material);
}

function shortName(name: string): string {
  if (name.length <= 18) {
    return name;
  }

  const parts = name.split(' ');
  const last = parts[parts.length - 1] ?? name;
  return `${parts[0]?.[0] ?? ''}. ${last}`.slice(0, 18);
}
