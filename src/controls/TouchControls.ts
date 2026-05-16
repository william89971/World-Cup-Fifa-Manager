import { Vector2 } from 'three';
import type { GameInput } from './GameInput';

type TouchAction = 'sprint' | 'pass' | 'shoot' | 'call' | 'switch' | 'tackle' | 'pause';

export class TouchControls implements GameInput {
  readonly element: HTMLDivElement;
  private readonly movement = new Vector2();
  private readonly pressedThisFrame = new Set<TouchAction>();
  private readonly releasedThisFrame = new Set<TouchAction>();
  private readonly heldActions = new Set<TouchAction>();
  private readonly actionByPointerId = new Map<number, TouchAction>();
  private readonly joystick: HTMLDivElement;
  private readonly joystickKnob: HTMLSpanElement;
  private activeJoystickPointerId?: number;
  private joystickCenterX = 0;
  private joystickCenterY = 0;
  private visible = false;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'mobile-controls';
    this.element.innerHTML = `
      <div class="mobile-joystick" data-touch-joystick aria-label="Move joystick">
        <span></span>
      </div>
      <div class="mobile-actions">
        <button type="button" data-touch-action="pause">Menu</button>
        <button type="button" data-touch-action="switch">Switch</button>
        <button type="button" data-touch-action="call">Call</button>
        <button type="button" data-touch-action="tackle">Tackle</button>
        <button type="button" data-touch-action="sprint">Sprint</button>
        <button type="button" data-touch-action="pass">Pass</button>
        <button type="button" data-touch-action="shoot" class="mobile-action--primary">Shoot</button>
      </div>
    `;

    const joystick = this.element.querySelector<HTMLDivElement>('[data-touch-joystick]');
    const joystickKnob = joystick?.querySelector<HTMLSpanElement>('span');
    if (!joystick || !joystickKnob) {
      throw new Error('Unable to create touch controls.');
    }

    this.joystick = joystick;
    this.joystickKnob = joystickKnob;
    this.joystick.addEventListener('pointerdown', this.handleJoystickPointerDown);
    this.joystick.addEventListener('pointermove', this.handleJoystickPointerMove);
    this.joystick.addEventListener('pointerup', this.handleJoystickPointerUp);
    this.joystick.addEventListener('pointercancel', this.handleJoystickPointerUp);
    this.element.addEventListener('pointerdown', this.handleActionPointerDown);
    this.element.addEventListener('pointerup', this.handleActionPointerUp);
    this.element.addEventListener('pointercancel', this.handleActionPointerUp);
    this.element.addEventListener('contextmenu', this.preventDefault);
    parent.append(this.element);
  }

  static shouldAutoShow(): boolean {
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth <= 860
    );
  }

  getMovement(target: Vector2): Vector2 {
    return target.copy(this.movement);
  }

  isSprintDown(): boolean {
    return this.heldActions.has('sprint');
  }

  isShootDown(): boolean {
    return this.heldActions.has('shoot');
  }

  wasPassPressed(): boolean {
    return this.pressedThisFrame.has('pass');
  }

  wasThroughPassPressed(): boolean {
    return false;
  }

  wasShootReleased(): boolean {
    return this.releasedThisFrame.has('shoot');
  }

  wasCallForPassPressed(): boolean {
    return this.pressedThisFrame.has('call');
  }

  wasSwitchPlayerPressed(): boolean {
    return this.pressedThisFrame.has('switch');
  }

  wasTacklePressed(): boolean {
    return this.pressedThisFrame.has('tackle');
  }

  wasPausePressed(): boolean {
    return this.pressedThisFrame.has('pause');
  }

  wasRestartPressed(): boolean {
    return false;
  }

  wasDebugPressed(): boolean {
    return false;
  }

  endFrame(): void {
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.element.classList.toggle('mobile-controls--visible', visible);
    if (!visible) {
      this.clearTouchState();
    }
  }

  setOpacity(opacity: number): void {
    this.element.style.setProperty('--mobile-controls-opacity', String(opacity));
  }

  dispose(): void {
    this.joystick.removeEventListener('pointerdown', this.handleJoystickPointerDown);
    this.joystick.removeEventListener('pointermove', this.handleJoystickPointerMove);
    this.joystick.removeEventListener('pointerup', this.handleJoystickPointerUp);
    this.joystick.removeEventListener('pointercancel', this.handleJoystickPointerUp);
    this.element.removeEventListener('pointerdown', this.handleActionPointerDown);
    this.element.removeEventListener('pointerup', this.handleActionPointerUp);
    this.element.removeEventListener('pointercancel', this.handleActionPointerUp);
    this.element.removeEventListener('contextmenu', this.preventDefault);
    this.element.remove();
  }

  private readonly handleJoystickPointerDown = (event: PointerEvent): void => {
    if (!this.visible || this.activeJoystickPointerId !== undefined) return;

    event.preventDefault();
    this.activeJoystickPointerId = event.pointerId;
    this.joystick.setPointerCapture(event.pointerId);
    const rect = this.joystick.getBoundingClientRect();
    this.joystickCenterX = rect.left + rect.width / 2;
    this.joystickCenterY = rect.top + rect.height / 2;
    this.updateJoystick(event.clientX, event.clientY);
  };

  private readonly handleJoystickPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activeJoystickPointerId) return;
    event.preventDefault();
    this.updateJoystick(event.clientX, event.clientY);
  };

  private readonly handleJoystickPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activeJoystickPointerId) return;
    event.preventDefault();
    this.activeJoystickPointerId = undefined;
    this.movement.set(0, 0);
    this.joystickKnob.style.transform = 'translate3d(0, 0, 0)';
  };

  private readonly handleActionPointerDown = (event: PointerEvent): void => {
    const action = this.getAction(event);
    if (!action) return;

    event.preventDefault();
    this.actionByPointerId.set(event.pointerId, action);
    if (event.target instanceof HTMLElement) {
      event.target.setPointerCapture?.(event.pointerId);
    }
    this.heldActions.add(action);
    if (action !== 'sprint' && action !== 'shoot') {
      this.pressedThisFrame.add(action);
    }
  };

  private readonly handleActionPointerUp = (event: PointerEvent): void => {
    const action = this.actionByPointerId.get(event.pointerId) ?? this.getAction(event);
    if (!action) return;

    event.preventDefault();
    this.actionByPointerId.delete(event.pointerId);
    this.heldActions.delete(action);
    if (action === 'shoot') {
      this.releasedThisFrame.add(action);
    }
  };

  private updateJoystick(clientX: number, clientY: number): void {
    const radius = Math.max(1, this.joystick.clientWidth * 0.36);
    const rawX = clientX - this.joystickCenterX;
    const rawY = clientY - this.joystickCenterY;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > radius ? radius / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;

    this.movement.set(x / radius, y / radius);
    this.joystickKnob.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  private getAction(event: PointerEvent): TouchAction | undefined {
    const target =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>('[data-touch-action]')
        : null;
    return target?.dataset.touchAction as TouchAction | undefined;
  }

  private clearTouchState(): void {
    this.movement.set(0, 0);
    this.heldActions.clear();
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
    this.actionByPointerId.clear();
    this.activeJoystickPointerId = undefined;
    this.joystickKnob.style.transform = 'translate3d(0, 0, 0)';
  }

  private readonly preventDefault = (event: Event): void => {
    event.preventDefault();
  };
}
