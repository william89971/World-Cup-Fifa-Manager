import type { Vector2 } from 'three';
import type { GameInput } from './GameInput';

export class CombinedInput implements GameInput {
  constructor(private readonly inputs: GameInput[]) {}

  getMovement(target: Vector2): Vector2 {
    target.set(0, 0);
    for (const input of this.inputs) {
      input.getMovement(target);
      if (target.lengthSq() > 0) {
        return target;
      }
    }
    return target;
  }

  isSprintDown(): boolean {
    return this.inputs.some((input) => input.isSprintDown());
  }

  isShootDown(): boolean {
    return this.inputs.some((input) => input.isShootDown());
  }

  wasPassPressed(): boolean {
    return this.inputs.some((input) => input.wasPassPressed());
  }

  wasThroughPassPressed(): boolean {
    return this.inputs.some((input) => input.wasThroughPassPressed());
  }

  wasShootReleased(): boolean {
    return this.inputs.some((input) => input.wasShootReleased());
  }

  wasCallForPassPressed(): boolean {
    return this.inputs.some((input) => input.wasCallForPassPressed());
  }

  wasSwitchPlayerPressed(): boolean {
    return this.inputs.some((input) => input.wasSwitchPlayerPressed());
  }

  wasTacklePressed(): boolean {
    return this.inputs.some((input) => input.wasTacklePressed());
  }

  wasPausePressed(): boolean {
    return this.inputs.some((input) => input.wasPausePressed());
  }

  wasRestartPressed(): boolean {
    return this.inputs.some((input) => input.wasRestartPressed());
  }

  wasDebugPressed(): boolean {
    return this.inputs.some((input) => input.wasDebugPressed());
  }

  endFrame(): void {
    for (const input of this.inputs) {
      input.endFrame();
    }
  }

  dispose(): void {
    for (const input of this.inputs) {
      input.dispose();
    }
  }
}
