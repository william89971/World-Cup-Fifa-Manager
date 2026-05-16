import { Vector3 } from 'three';

export const PITCH_LENGTH = 150;
export const PITCH_WIDTH = 95;
export const GOAL_WIDTH = 18;
export const GOAL_HEIGHT = 6.1;
export const PENALTY_AREA_SIZE = { width: 50, depth: 24 } as const;

export const POSSESSION_LOCK_MS = 900;
export const BALL_CLAIM_RANGE = 1.65;
export const KEEPER_CLAIM_RANGE = 2.4;
export const LOOSE_BALL_RECLAIM_DELAY_MS = 450;
export const TACKLE_RANGE = 2.0;
export const TACKLE_COOLDOWN_MS = 1200;
export const TACKLE_SUCCESS_CHANCE = 0.62;
export const STRONG_COLLISION_LOOSE_BALL_THRESHOLD = 3.4;

export const PLAYER_TURN_SPEED = 150;
export const PLAYER_ACCELERATION = 31;
export const PLAYER_DECELERATION = 25;
export const PLAYER_MAX_SPEED = 8.1;
export const PLAYER_SPRINT_SPEED = 12.1;
export const CAMERA_ROTATION_SMOOTHING = 8.5;
export const CAMERA_FOLLOW_SMOOTHING = 8;

export const PITCH = {
  width: PITCH_WIDTH,
  length: PITCH_LENGTH,
  lineWidth: 0.08,
  grassColor: 0x16733a,
  lineColor: 0xf4f8f2,
} as const;

export const GOAL = {
  width: GOAL_WIDTH,
  height: GOAL_HEIGHT,
  depth: 4.8,
  postThickness: 0.28,
} as const;

export const PLAYER = {
  radius: 0.42,
  height: 1.35,
  speed: PLAYER_MAX_SPEED,
  sprintSpeed: PLAYER_SPRINT_SPEED,
  acceleration: PLAYER_ACCELERATION,
  deceleration: PLAYER_DECELERATION,
  aiSpeed: 6.2,
  aiPressureSpeed: 8.4,
  maxStamina: 100,
  staminaDrainPerSecond: 22,
  staminaRegenPerSecond: 20,
  minimumSprintStamina: 8,
  turnSpeed: PLAYER_TURN_SPEED,
  boundsPadding: 1,
  blueStart: new Vector3(0, 0, 24),
  redStart: new Vector3(0, 0, -24),
} as const;

export const TEAM = {
  playerCount: 11,
  roles: [
    'goalkeeper',
    'leftBack',
    'centerBackLeft',
    'centerBackRight',
    'rightBack',
    'defensiveMid',
    'centralMid',
    'attackingMid',
    'leftWing',
    'rightWing',
    'striker',
  ],
} as const;

export const FORMATION = {
  blue: {
    goalkeeper: new Vector3(0, 0, 70),
    leftBack: new Vector3(-28, 0, 44),
    centerBackLeft: new Vector3(-10, 0, 48),
    centerBackRight: new Vector3(10, 0, 48),
    rightBack: new Vector3(28, 0, 44),
    defensiveMid: new Vector3(0, 0, 30),
    centralMid: new Vector3(-11, 0, 16),
    attackingMid: new Vector3(11, 0, 10),
    leftWing: new Vector3(-29, 0, -18),
    rightWing: new Vector3(29, 0, -18),
    striker: new Vector3(0, 0, -30),
  },
  red: {
    goalkeeper: new Vector3(0, 0, -70),
    leftBack: new Vector3(28, 0, -44),
    centerBackLeft: new Vector3(10, 0, -48),
    centerBackRight: new Vector3(-10, 0, -48),
    rightBack: new Vector3(-28, 0, -44),
    defensiveMid: new Vector3(0, 0, -30),
    centralMid: new Vector3(11, 0, -16),
    attackingMid: new Vector3(-11, 0, -10),
    leftWing: new Vector3(29, 0, 18),
    rightWing: new Vector3(-29, 0, 18),
    striker: new Vector3(0, 0, 30),
  },
} as const;

export const ROLE_ZONES = {
  goalkeeper: { minProgress: 0.0, maxProgress: 0.16, label: 'Keeper area' },
  leftBack: { minProgress: 0.05, maxProgress: 0.58, label: 'Fullback band' },
  centerBackLeft: { minProgress: 0.04, maxProgress: 0.5, label: 'Centre back band' },
  centerBackRight: { minProgress: 0.04, maxProgress: 0.5, label: 'Centre back band' },
  rightBack: { minProgress: 0.05, maxProgress: 0.58, label: 'Fullback band' },
  defensiveMid: { minProgress: 0.18, maxProgress: 0.66, label: 'Defensive mid band' },
  centralMid: { minProgress: 0.26, maxProgress: 0.78, label: 'Central mid band' },
  attackingMid: { minProgress: 0.32, maxProgress: 0.86, label: 'Attacking mid band' },
  leftWing: { minProgress: 0.38, maxProgress: 0.98, label: 'Left wing band' },
  rightWing: { minProgress: 0.38, maxProgress: 0.98, label: 'Right wing band' },
  striker: { minProgress: 0.43, maxProgress: 0.98, label: 'Forward band' },
} as const;

export const TRAIT_INFLUENCE = {
  decision: 0.42,
  movement: 0.28,
  accuracy: 0.22,
  stamina: 0.22,
  spacing: 0.24,
  randomness: 0.18,
} as const;

export const FORMATION_TUNING = {
  defensiveLineDepth: 0.31,
  midfieldSupportDepth: 0.53,
  forwardDepth: 0.78,
  widthMultiplier: 0.72,
} as const;

export const OFFSIDE = {
  enabled: true,
  minForwardPassDistance: 6,
  attackingHalfProgress: 0.5,
  tolerance: 0.015,
} as const;

export const RESTARTS = {
  throwInDelay: 0.9,
  cornerDelay: 1.05,
  goalKickDelay: 1.05,
  offsideDelay: 1.0,
  sidelineInset: 1.1,
  cornerInset: 1.4,
} as const;

export const KEEPER = {
  claimRange: KEEPER_CLAIM_RANGE,
  clearPower: 12,
  clearMaxSpeed: 21,
  trackSpeed: 7.1,
  areaPadding: 1.2,
  colliderHalfExtents: new Vector3(0.82, 1.22, 0.42),
} as const;

export const BALL = {
  radius: 0.34,
  start: new Vector3(0, 1.2, 0),
  linearDamping: 2.28,
  angularDamping: 1.38,
  friction: 2.1,
  restitution: 0.16,
  density: 0.9,
  maxSpeed: 34,
} as const;

export const GAMEPLAY = {
  possessionDistance: 2.1,
  possessionHysteresisDistance: 0.55,
  possessionCooldown: POSSESSION_LOCK_MS / 1000,
  contestedDistance: 1.35,
  controlledTouchDistance: 1.35,
  dribbleIdealDistance: 1.02,
  dribbleNudgePower: 0.66,
  dribblePullPower: 0.4,
  dribbleSprintMultiplier: 1.5,
  dribbleCooldown: 0.07,
  shotPower: 20,
  maxShotPower: 43,
  shotChargeRate: 1.05,
  quickShotCharge: 0.2,
  shotLift: 0.5,
  maxShotLift: 4.8,
  shotInaccuracy: 0.09,
  pressureInaccuracy: 0.13,
  maxShotSpeed: 34,
  minPassPower: 16,
  passPower: 21,
  maxPassPower: 39,
  maxPassSpeed: 36,
  passLift: 0.08,
  passLeadSeconds: 0.5,
  calledPassMinPower: 23,
  calledPassMaxPower: 45,
  calledPassMaxSpeed: 40,
  markedDistance: 3.6,
  possessionLockMs: POSSESSION_LOCK_MS,
  ballClaimRange: BALL_CLAIM_RANGE,
  looseBallReclaimDelayMs: LOOSE_BALL_RECLAIM_DELAY_MS,
  tackleRange: TACKLE_RANGE,
  tackleCooldownMs: TACKLE_COOLDOWN_MS,
  tackleSuccessChance: TACKLE_SUCCESS_CHANCE,
  strongCollisionLooseBallThreshold: STRONG_COLLISION_LOOSE_BALL_THRESHOLD,
} as const;

export const AI = {
  pressureDistance: 24,
  supportLaneSpacing: 16,
  supportForwardOffset: 20,
  defensiveGoalOffset: 12,
  homeReturnSpeed: 5,
  arriveRadius: 0.45,
  ballActionCooldown: 0.95,
  tapPower: 2.25,
  passPower: 24,
  shotPower: 23,
  shotLift: 1.05,
  maxBallSpeed: 26,
  separationRadius: 5.2,
  separationStrength: 1.7,
  pressureReleaseDistance: 27,
  laneCoverDistance: 16,
  passUnderPressureDistance: 5.2,
  shootDistance: 32,
} as const;

export const CAMERA = {
  offset: new Vector3(0, 20, 38),
  lookAhead: new Vector3(0, 1.2, -9),
  firstPersonEyeHeight: 1.62,
  firstPersonForwardOffset: 0.48,
  firstPersonLookDistance: 13,
  firstPersonLookDown: 0.62,
  firstPersonPositionLerp: 18,
  firstPersonLookLerp: 16,
  followLerp: CAMERA_FOLLOW_SMOOTHING,
  lookLerp: CAMERA_ROTATION_SMOOTHING,
  switchPositionLerp: 4.2,
  switchLookLerp: 5.5,
  ballLookWeight: 0.34,
  maxBallDistance: 58,
  fov: 66,
} as const;

export const PHYSICS = {
  gravity: new Vector3(0, -9.81, 0),
  fixedStep: 1 / 60,
  maxSubSteps: 5,
} as const;

export const MATCH = {
  resetCooldown: 1.15,
  goalFreezeSeconds: 0.85,
  goalCountdownSeconds: 3,
  durationSeconds: 180,
  outOfBoundsPadding: 2.6,
} as const;

export const READABILITY = {
  hardShotPower: 30,
  hardShotSpeed: 21,
  shotShakeIntensity: 0.42,
  shotShakeDuration: 0.18,
  shotTrailDuration: 0.42,
  shotTrailMinSpeed: 18,
  keeperBlockDistance: 3.4,
  keeperBlockSpeedDrop: 0.58,
  passHintHeight: 0.1,
  passHintOpacity: 0.52,
  possessorIndicatorHeight: 2.65,
  controlledIndicatorHeight: 2.25,
} as const;

export const MINIMAP = {
  width: 188,
  height: 128,
  updateInterval: 1 / 12,
  padding: 9,
} as const;
