import type { Vector2 } from 'three';

export interface GameInput {
  getMovement(target: Vector2): Vector2;
  isSprintDown(): boolean;
  isShootDown(): boolean;
  wasPassPressed(): boolean;
  wasThroughPassPressed(): boolean;
  wasShootReleased(): boolean;
  wasCallForPassPressed(): boolean;
  wasSwitchPlayerPressed(): boolean;
  wasTacklePressed(): boolean;
  wasPausePressed(): boolean;
  wasRestartPressed(): boolean;
  wasDebugPressed(): boolean;
  endFrame(): void;
  dispose(): void;
}
