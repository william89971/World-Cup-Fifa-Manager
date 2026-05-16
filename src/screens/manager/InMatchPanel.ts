import { button } from '../../components/Button';
import { tabs } from '../../components/Tabs';
import { escapeHtml } from '../../components/colors';
import { mentalityLabel, type Mentality, type ManagerTactics, type MatchEvent, type MatchStats } from '../../manager/types';
import { TEAM_STYLES, type TeamStyle } from '../../game/playerTypes';

export type InMatchTab = 'tactics' | 'subs' | 'stats';

export interface InMatchSnapshot {
  open: boolean;
  tab: InMatchTab;
  tactics: ManagerTactics;
  subsRemaining: number;
  startingXI: Array<{ id: string; name: string; role: string; number: number }>;
  bench: Array<{ id: string; name: string; role: string; number: number }>;
  stats: MatchStats;
  events: MatchEvent[];
}

export interface InMatchHandlers {
  onClose: () => void;
  onSetTab: (tab: InMatchTab) => void;
  onApplyTactics: (tactics: ManagerTactics) => void;
  onConfirmSub: (outId: string, inId: string) => void;
}

export class InMatchPanel {
  readonly element: HTMLDivElement;
  private snapshot?: InMatchSnapshot;
  private draftTactics?: ManagerTactics;
  private selectedOutId: string | null = null;
  private selectedInId: string | null = null;

  constructor(parent: HTMLElement, private readonly handlers: InMatchHandlers) {
    this.element = document.createElement('div');
    this.element.className = 'mgr-in-match-panel';
    parent.append(this.element);
    this.element.addEventListener('click', this.handleClick);
  }

  open(snapshot: InMatchSnapshot): void {
    this.snapshot = snapshot;
    this.draftTactics = JSON.parse(JSON.stringify(snapshot.tactics));
    this.selectedOutId = null;
    this.selectedInId = null;
    this.element.classList.add('is-open');
    this.render();
  }

  close(): void {
    this.element.classList.remove('is-open');
  }

  isOpen(): boolean {
    return this.element.classList.contains('is-open');
  }

  setTab(tab: InMatchTab): void {
    if (!this.snapshot) return;
    this.snapshot = { ...this.snapshot, tab };
    this.render();
  }

  private render(): void {
    if (!this.snapshot) return;
    const snap = this.snapshot;
    const tactics = this.draftTactics ?? snap.tactics;
    const body =
      snap.tab === 'tactics'
        ? this.renderTactics(tactics)
        : snap.tab === 'subs'
        ? this.renderSubs(snap)
        : this.renderStats(snap);

    this.element.innerHTML = `
      <div class="mgr-row" style="justify-content:space-between; align-items:center;">
        <strong>In-match management</strong>
        ${button({ label: 'Resume', dataAction: 'close', variant: 'primary', size: 'sm' })}
      </div>
      ${tabs({
        items: [
          { id: 'tactics', label: 'Tactics' },
          { id: 'subs', label: `Subs (${snap.subsRemaining})` },
          { id: 'stats', label: 'Stats' },
        ],
        activeId: snap.tab,
        dataAction: 'tab',
      })}
      ${body}
    `;
  }

  private renderTactics(tactics: ManagerTactics): string {
    return `
      <section class="mgr-col">
        <div>
          <strong>Mentality</strong>
          <div class="mgr-row">
            ${([-2, -1, 0, 1, 2] as Mentality[]).map((m) => button({ label: mentalityLabel(m), dataAction: 'mentality', dataAttrs: { m: String(m) }, variant: tactics.mentality === m ? 'primary' : 'default', size: 'sm' })).join('')}
          </div>
        </div>
        <div>
          <strong>Style</strong>
          <div class="mgr-row" style="flex-wrap:wrap;">
            ${TEAM_STYLES.map((s) => button({ label: s, dataAction: 'style', dataAttrs: { s }, variant: tactics.teamStyle === s ? 'primary' : 'default', size: 'sm' })).join('')}
          </div>
        </div>
        ${(['pressing', 'lineHeight', 'tempo', 'width'] as const).map((key) => `
          <div>
            <div class="mgr-row" style="justify-content:space-between;">
              <strong>${key}</strong><span class="mgr-mono">${tactics.sliders[key]}</span>
            </div>
            <input class="mgr-slider" type="range" min="0" max="100" value="${tactics.sliders[key]}" data-action="slider" data-key="${key}" />
          </div>
        `).join('')}
        ${button({ label: 'Apply tactics', dataAction: 'apply', variant: 'primary', block: true })}
      </section>
    `;
  }

  private renderSubs(snap: InMatchSnapshot): string {
    const outId = this.selectedOutId;
    const inId = this.selectedInId;
    const startersHtml = snap.startingXI
      .map((p) => `<button type="button" class="mgr-btn ${p.id === outId ? 'mgr-btn--primary' : ''} mgr-btn--block" data-action="pick-out" data-id="${p.id}" style="justify-content:flex-start; text-transform:none; letter-spacing:0;">
        <span class="mgr-pill">#${p.number}</span><span>${escapeHtml(p.name)}</span><span class="mgr-muted" style="margin-left:auto;">${escapeHtml(p.role)}</span>
      </button>`).join('');
    const benchHtml = snap.bench.length
      ? snap.bench
          .map((p) => `<button type="button" class="mgr-btn ${p.id === inId ? 'mgr-btn--primary' : ''} mgr-btn--block" data-action="pick-in" data-id="${p.id}" style="justify-content:flex-start; text-transform:none; letter-spacing:0;">
            <span class="mgr-pill">#${p.number}</span><span>${escapeHtml(p.name)}</span><span class="mgr-muted" style="margin-left:auto;">${escapeHtml(p.role)}</span>
          </button>`).join('')
      : '<p class="mgr-muted">No bench available.</p>';

    const canConfirm = !!(outId && inId && snap.subsRemaining > 0);

    return `
      <section class="mgr-col">
        <p class="mgr-muted">Subs remaining: <strong>${snap.subsRemaining}</strong>. Pick an outgoing starter, then a bench replacement.</p>
        <strong>On the field</strong>
        ${startersHtml}
        <strong style="margin-top:8px;">Bench</strong>
        ${benchHtml}
        ${button({ label: canConfirm ? 'Confirm substitution' : 'Pick out + in first', dataAction: 'confirm-sub', variant: canConfirm ? 'primary' : 'default', block: true, disabled: !canConfirm })}
      </section>
    `;
  }

  private renderStats(snap: InMatchSnapshot): string {
    const s = snap.stats;
    return `
      <section class="mgr-col">
        <h3>Stats (you / opponent)</h3>
        <div class="mgr-stat-row"><span>${s.possessionPct}%</span><div class="mgr-bar mgr-bar--accent"><span style="width:${s.possessionPct}%"></span></div><span>${100 - s.possessionPct}%</span></div>
        <ul style="list-style:none; padding:0; margin:0;">
          ${row('Shots', s.shots.home, s.shots.away)}
          ${row('On target', s.shotsOnTarget.home, s.shotsOnTarget.away)}
          ${row('Passes', s.passes.home, s.passes.away)}
          ${row('Pass %', s.passAccuracy.home, s.passAccuracy.away)}
          ${row('Tackles', s.tackles.home, s.tackles.away)}
          ${row('Fouls', s.fouls.home, s.fouls.away)}
          ${row('Corners', s.corners.home, s.corners.away)}
          ${row('Offsides', s.offsides.home, s.offsides.away)}
          ${row('Yellow', s.yellows.home, s.yellows.away)}
          ${row('Red', s.reds.home, s.reds.away)}
        </ul>
        <h3>Recent events</h3>
        <ol style="list-style:none; padding:0; margin:0; font-size:13px;">
          ${snap.events.slice(0, 20).map((e) => `<li class="mgr-muted">${e.minute}' ${escapeHtml(e.type)}${e.detail ? ' · ' + escapeHtml(e.detail) : ''}</li>`).join('')}
        </ol>
      </section>
    `;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-action]') : null;
    if (!target) return;
    const action = target.dataset.action;
    if (!action) return;
    if (action === 'close') this.handlers.onClose();
    else if (action === 'tab' && target.dataset.tab) this.handlers.onSetTab(target.dataset.tab as InMatchTab);
    else if (action === 'mentality' && this.draftTactics) {
      this.draftTactics.mentality = Number(target.dataset.m) as Mentality;
      this.render();
    } else if (action === 'style' && target.dataset.s && this.draftTactics) {
      this.draftTactics.teamStyle = target.dataset.s as TeamStyle;
      this.render();
    } else if (action === 'slider' && this.draftTactics) {
      const input = target as HTMLInputElement;
      const key = input.dataset.key as keyof ManagerTactics['sliders'];
      this.draftTactics.sliders[key] = Number(input.value);
      // Update display in-place without re-rendering the whole panel.
      const display = input.parentElement?.querySelector('.mgr-mono');
      if (display) display.textContent = String(this.draftTactics.sliders[key]);
    } else if (action === 'apply' && this.draftTactics) {
      this.handlers.onApplyTactics(this.draftTactics);
    } else if (action === 'pick-out' && target.dataset.id) {
      this.selectedOutId = this.selectedOutId === target.dataset.id ? null : target.dataset.id;
      this.render();
    } else if (action === 'pick-in' && target.dataset.id) {
      this.selectedInId = this.selectedInId === target.dataset.id ? null : target.dataset.id;
      this.render();
    } else if (action === 'confirm-sub' && this.selectedOutId && this.selectedInId) {
      this.handlers.onConfirmSub(this.selectedOutId, this.selectedInId);
      this.selectedOutId = null;
      this.selectedInId = null;
      // The Game will refresh the panel after applying the sub.
    }
  };
}

function row(label: string, a: number, b: number): string {
  return `<li class="mgr-row" style="justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border);">
    <strong>${a}</strong><span class="mgr-muted">${label}</span><strong>${b}</strong>
  </li>`;
}
