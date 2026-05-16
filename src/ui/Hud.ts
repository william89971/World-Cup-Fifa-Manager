import type { MatchScore } from '../systems/MatchSystem';
import type { PersonalityArchetype, PlayerRole } from '../game/playerTypes';

export interface HudViewModel {
  score: MatchScore;
  elapsedSeconds: number;
  remainingSeconds: number;
  message: string;
  userTeamName: string;
  opponentTeamName: string;
  userColor: number;
  opponentColor: number;
  controlledPlayerNumber: number;
  controlledPlayerName: string;
  controlledPlayerRole: PlayerRole;
  controlledPlayerPersonality: PersonalityArchetype;
  controlledPlayerTraits: string;
  stamina: number;
  shotCharge: number;
  hasPossession: boolean;
  possessionLabel: string;
  possessionStatus: string;
  passTargetHint: string;
  restartLabel: string;
  restartSeconds: number;
  stageLabel: string;
  debugVisible: boolean;
  debugLines: string[];
}

export class Hud {
  readonly element: HTMLDivElement;
  private readonly mainElement: HTMLDivElement;
  private readonly hintElement: HTMLDivElement;
  private readonly debugElement: HTMLDivElement;
  private lastMainMarkup = '';
  private lastDebugMarkup = '';

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'hud hud--hidden';

    this.mainElement = document.createElement('div');
    this.mainElement.className = 'hud__panel';

    this.hintElement = document.createElement('div');
    this.hintElement.className = 'hud__panel hud__hint';
    // Manager mode: no player-input keybinds shown. Spectator hints only.
    this.hintElement.textContent = 'P pause · T restart · F3 debug';

    this.debugElement = document.createElement('div');
    this.debugElement.className = 'hud__panel hud__debug';

    this.element.append(this.mainElement, this.hintElement, this.debugElement);
    parent.append(this.element);
  }

  show(): void {
    this.element.classList.remove('hud--hidden');
  }

  hide(): void {
    this.element.classList.add('hud--hidden');
  }

  update(view: HudViewModel): void {
    // Manager mode HUD: scoreboard + clock + stage + possession label + event feed.
    // No controlled-player block, no stamina/shot meters, no per-action hints.
    const possessionLabel = view.possessionLabel || 'Loose ball';
    const mainMarkup = `
      <div class="hud__stage">${view.stageLabel}</div>
      <div class="hud__score">
        <span class="hud__team"><span class="hud__swatch" style="background:${colorToCss(view.userColor)}"></span>${view.userTeamName} ${view.score.blue}</span>
        <span>:</span>
        <span class="hud__team hud__team--red">${view.score.red} ${view.opponentTeamName}<span class="hud__swatch" style="background:${colorToCss(view.opponentColor)}"></span></span>
      </div>
      <div class="hud__timer">${this.formatTime(view.remainingSeconds)}</div>
      <div class="hud__possession">In possession: ${possessionLabel}</div>
      <div class="hud__message">${view.message}</div>
      ${view.restartLabel ? `<div class="hud__restart-overlay">${view.restartLabel}${view.restartSeconds > 0 ? ` ${Math.ceil(view.restartSeconds)}` : ''}</div>` : ''}
    `;

    if (mainMarkup !== this.lastMainMarkup) {
      this.mainElement.innerHTML = mainMarkup;
      this.lastMainMarkup = mainMarkup;
    }

    this.debugElement.classList.toggle('hud__debug--visible', view.debugVisible);
    const debugMarkup = view.debugVisible
      ? `<strong>Debug</strong>${view.debugLines.map((line) => `<span>${line}</span>`).join('')}`
      : '';
    if (debugMarkup !== this.lastDebugMarkup) {
      this.debugElement.innerHTML = debugMarkup;
      this.lastDebugMarkup = debugMarkup;
    }
  }

  private formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = Math.floor(totalSeconds % 60)
      .toString()
      .padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
}

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
