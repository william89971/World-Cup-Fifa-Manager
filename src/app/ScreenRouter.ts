import type { GameScreen } from '../game/GameState';

export interface ScreenModule<P = unknown> {
  /**
   * Render the screen into the provided host element. Replace innerHTML wholesale.
   * The host element is reused across screens.
   */
  render(host: HTMLElement, props: P): void;
  /**
   * Optional cleanup hook fired before the next screen renders.
   */
  dispose?(): void;
}

export class ScreenRouter {
  readonly host: HTMLDivElement;
  private modules = new Map<GameScreen, ScreenModule<unknown>>();
  private currentScreen?: GameScreen;
  private currentModule?: ScreenModule<unknown>;

  constructor(parent: HTMLElement) {
    this.host = document.createElement('div');
    this.host.className = 'mgr-router';
    parent.append(this.host);
  }

  register<P>(screen: GameScreen, module: ScreenModule<P>): void {
    this.modules.set(screen, module as ScreenModule<unknown>);
  }

  has(screen: GameScreen): boolean {
    return this.modules.has(screen);
  }

  show<P>(screen: GameScreen, props?: P): boolean {
    const module = this.modules.get(screen);
    if (!module) return false;
    if (this.currentModule && this.currentModule !== module && this.currentModule.dispose) {
      this.currentModule.dispose();
    }
    this.host.style.display = 'block';
    module.render(this.host, props);
    this.currentScreen = screen;
    this.currentModule = module;
    return true;
  }

  hide(): void {
    if (this.currentModule?.dispose) this.currentModule.dispose();
    this.currentModule = undefined;
    this.currentScreen = undefined;
    this.host.innerHTML = '';
    this.host.style.display = 'none';
  }

  getCurrentScreen(): GameScreen | undefined {
    return this.currentScreen;
  }
}
