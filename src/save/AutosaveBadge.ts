import { AUTOSAVE_EVENT } from '../tournament/storage';

export class AutosaveBadge {
  readonly element: HTMLDivElement;
  private hideTimer = 0;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'mgr-autosave';
    this.element.textContent = 'Saved';
    parent.append(this.element);
    window.addEventListener(AUTOSAVE_EVENT, this.handleEvent as EventListener);
  }

  dispose(): void {
    window.removeEventListener(AUTOSAVE_EVENT, this.handleEvent as EventListener);
    this.element.remove();
  }

  private readonly handleEvent = (): void => {
    this.element.classList.add('is-visible');
    window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => {
      this.element.classList.remove('is-visible');
    }, 1600);
  };
}
