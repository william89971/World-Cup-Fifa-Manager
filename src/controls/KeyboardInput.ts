import type { Vector2 } from 'three';
import type { GameInput } from './GameInput';

export class KeyboardInput implements GameInput {
  private readonly heldKeys = new Set<string>();
  private readonly pressedThisFrame = new Set<string>();
  private readonly releasedThisFrame = new Set<string>();

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clear);
  }

  isDown(code: string): boolean {
    return this.heldKeys.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  wasReleased(code: string): boolean {
    return this.releasedThisFrame.has(code);
  }

  getMovement(target: Vector2): Vector2 {
    target.set(0, 0);
    if (this.isDown('KeyW')) target.y -= 1;
    if (this.isDown('KeyS')) target.y += 1;
    if (this.isDown('KeyA')) target.x -= 1;
    if (this.isDown('KeyD')) target.x += 1;
    return target;
  }

  isSprintDown(): boolean {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight');
  }

  isShootDown(): boolean {
    return this.isDown('Space');
  }

  wasPassPressed(): boolean {
    return this.wasPressed('KeyE');
  }

  wasThroughPassPressed(): boolean {
    return this.wasPressed('KeyR');
  }

  wasShootReleased(): boolean {
    return this.wasReleased('Space');
  }

  wasCallForPassPressed(): boolean {
    return this.wasPressed('KeyQ');
  }

  wasSwitchPlayerPressed(): boolean {
    return this.wasPressed('Tab');
  }

  wasTacklePressed(): boolean {
    return this.wasPressed('KeyF');
  }

  wasPausePressed(): boolean {
    return this.wasPressed('KeyP');
  }

  wasRestartPressed(): boolean {
    return this.wasPressed('KeyT');
  }

  wasDebugPressed(): boolean {
    return this.wasPressed('F3');
  }

  endFrame(): void {
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clear);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (
      [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ShiftLeft',
        'ShiftRight',
        'Space',
        'KeyE',
        'KeyQ',
        'Tab',
        'KeyF',
        'KeyP',
        'KeyR',
        'KeyT',
        'F3',
      ].includes(event.code)
    ) {
      event.preventDefault();
    }

    if (!this.heldKeys.has(event.code)) {
      this.pressedThisFrame.add(event.code);
    }

    this.heldKeys.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.heldKeys.delete(event.code);
    this.releasedThisFrame.add(event.code);
  };

  private readonly clear = (): void => {
    this.heldKeys.clear();
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
  };
}
