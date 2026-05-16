import type { MatchScore } from '../systems/MatchSystem';
import type { PersonalityArchetype, PlayerRole } from '../game/playerTypes';
import type { MatchStats } from '../manager/types';

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
  // Manager-mode enrichment (optional — basic HUD renders if missing).
  stats?: MatchStats;
  commentary?: string[];
  subsRemaining?: { home: number; away: number };
  speed?: 1 | 2 | 4;
  paused?: boolean;
}

export interface HudActionHandlers {
  onTogglePause?: () => void;
  onSetSpeed?: (multiplier: 1 | 2 | 4) => void;
  onOpenPanel?: (tab: 'tactics' | 'subs' | 'stats') => void;
}

export class Hud {
  readonly element: HTMLDivElement;
  readonly overlayElement: HTMLDivElement;
  private readonly mainElement: HTMLDivElement;
  private readonly hintElement: HTMLDivElement;
  private readonly debugElement: HTMLDivElement;
  private readonly scoreboardElement: HTMLDivElement;
  private readonly statsElement: HTMLDivElement;
  private readonly commentaryElement: HTMLDivElement;
  private readonly controlsElement: HTMLDivElement;
  private lastMainMarkup = '';
  private lastScoreboardMarkup = '';
  private lastStatsMarkup = '';
  private lastCommentaryMarkup = '';
  private lastControlsMarkup = '';
  private lastDebugMarkup = '';
  private handlers: HudActionHandlers = {};

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'hud hud--hidden';

    this.mainElement = document.createElement('div');
    this.mainElement.className = 'hud__panel';

    this.hintElement = document.createElement('div');
    this.hintElement.className = 'hud__panel hud__hint';
    this.hintElement.textContent = 'Space pause · 1/2/4 speed · F3 debug';

    this.debugElement = document.createElement('div');
    this.debugElement.className = 'hud__panel hud__debug';

    this.element.append(this.mainElement, this.hintElement, this.debugElement);
    parent.append(this.element);

    // Manager-mode rich overlay (separate root for grid layout).
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'mgr-match-overlay mgr-match-overlay--hidden';

    this.scoreboardElement = document.createElement('div');
    this.scoreboardElement.className = 'mgr-scoreboard';
    this.statsElement = document.createElement('div');
    this.statsElement.className = 'mgr-stats-rail';
    this.commentaryElement = document.createElement('div');
    this.commentaryElement.className = 'mgr-commentary';
    this.controlsElement = document.createElement('div');
    this.controlsElement.className = 'mgr-match-controls';

    this.overlayElement.append(
      this.scoreboardElement,
      this.statsElement,
      this.commentaryElement,
      this.controlsElement,
    );
    parent.append(this.overlayElement);

    this.overlayElement.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-action]') : null;
      if (!target) return;
      const action = target.dataset.action;
      if (action === 'pause') this.handlers.onTogglePause?.();
      else if (action === 'speed' && target.dataset.value) {
        this.handlers.onSetSpeed?.(Number(target.dataset.value) as 1 | 2 | 4);
      } else if (action === 'panel' && target.dataset.tab) {
        this.handlers.onOpenPanel?.(target.dataset.tab as 'tactics' | 'subs' | 'stats');
      }
    });
  }

  bindActions(handlers: HudActionHandlers): void {
    this.handlers = handlers;
  }

  show(): void {
    this.element.classList.remove('hud--hidden');
    this.overlayElement.classList.remove('mgr-match-overlay--hidden');
  }

  hide(): void {
    this.element.classList.add('hud--hidden');
    this.overlayElement.classList.add('mgr-match-overlay--hidden');
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

    this.renderOverlay(view);
  }

  private renderOverlay(view: HudViewModel): void {
    const speed = view.speed ?? 1;
    const paused = !!view.paused;
    const scoreboardMarkup = `
      <div class="mgr-scoreboard__stage">${view.stageLabel}</div>
      <div class="mgr-scoreboard__team">
        <span class="mgr-scoreboard__swatch" style="background:${colorToCss(view.userColor)}"></span>
        ${view.userTeamName}
      </div>
      <div class="mgr-scoreboard__score">${view.score.blue}-${view.score.red}</div>
      <div class="mgr-scoreboard__team">
        ${view.opponentTeamName}
        <span class="mgr-scoreboard__swatch" style="background:${colorToCss(view.opponentColor)}"></span>
      </div>
      <div class="mgr-scoreboard__clock">${this.formatTime(view.remainingSeconds)}</div>
      <div class="mgr-scoreboard__speed">
        <button class="mgr-btn mgr-btn--sm ${paused ? 'mgr-btn--primary' : ''}" data-action="pause">${paused ? '▶' : '⏸'}</button>
        <button class="mgr-btn mgr-btn--sm ${speed === 1 ? 'mgr-btn--primary' : ''}" data-action="speed" data-value="1">1×</button>
        <button class="mgr-btn mgr-btn--sm ${speed === 2 ? 'mgr-btn--primary' : ''}" data-action="speed" data-value="2">2×</button>
        <button class="mgr-btn mgr-btn--sm ${speed === 4 ? 'mgr-btn--primary' : ''}" data-action="speed" data-value="4">4×</button>
      </div>
    `;
    if (scoreboardMarkup !== this.lastScoreboardMarkup) {
      this.scoreboardElement.innerHTML = scoreboardMarkup;
      this.lastScoreboardMarkup = scoreboardMarkup;
    }

    const stats = view.stats;
    const statsMarkup = stats
      ? `
        <strong style="text-align:center; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-dim);">Match stats</strong>
        <div class="mgr-stat-row"><span>${stats.possessionPct}%</span><div class="mgr-bar mgr-bar--accent"><span style="width:${stats.possessionPct}%"></span></div><span>${100 - stats.possessionPct}%</span></div>
        <div class="mgr-stat-row__label">Possession</div>
        ${statRow('Shots', stats.shots.home, stats.shots.away)}
        ${statRow('On target', stats.shotsOnTarget.home, stats.shotsOnTarget.away)}
        ${statRow('Passes', stats.passes.home, stats.passes.away)}
        ${statRow('Pass %', stats.passAccuracy.home, stats.passAccuracy.away)}
        ${statRow('Tackles', stats.tackles.home, stats.tackles.away)}
        ${statRow('Fouls', stats.fouls.home, stats.fouls.away)}
        ${statRow('Corners', stats.corners.home, stats.corners.away)}
        ${statRow('Offsides', stats.offsides.home, stats.offsides.away)}
        ${statRow('Yellow', stats.yellows.home, stats.yellows.away)}
        ${statRow('Red', stats.reds.home, stats.reds.away)}
        ${view.subsRemaining ? `<div class="mgr-stat-row"><span>${view.subsRemaining.home}</span><div class="mgr-stat-row__label">Subs left</div><span>${view.subsRemaining.away}</span></div>` : ''}
      `
      : `<p class="mgr-muted">Match stats unavailable.</p>`;
    if (statsMarkup !== this.lastStatsMarkup) {
      this.statsElement.innerHTML = statsMarkup;
      this.lastStatsMarkup = statsMarkup;
    }

    const commentary = view.commentary ?? [];
    const commentaryMarkup = commentary.length
      ? commentary.map((line) => `<p>${escapeHtml(line)}</p>`).join('')
      : '<p class="mgr-muted">Awaiting kick-off...</p>';
    if (commentaryMarkup !== this.lastCommentaryMarkup) {
      this.commentaryElement.innerHTML = commentaryMarkup;
      this.lastCommentaryMarkup = commentaryMarkup;
    }

    const controlsMarkup = `
      <button class="mgr-btn" data-action="panel" data-tab="tactics">Tactics</button>
      <button class="mgr-btn" data-action="panel" data-tab="subs">Subs ${view.subsRemaining ? `(${view.subsRemaining.home})` : ''}</button>
      <button class="mgr-btn" data-action="panel" data-tab="stats">Full stats</button>
    `;
    if (controlsMarkup !== this.lastControlsMarkup) {
      this.controlsElement.innerHTML = controlsMarkup;
      this.lastControlsMarkup = controlsMarkup;
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

function statRow(label: string, home: number, away: number): string {
  return `<div class="mgr-stat-row">
    <span>${home}</span>
    <div class="mgr-stat-row__label">${label}</div>
    <span>${away}</span>
  </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
