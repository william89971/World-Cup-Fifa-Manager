import { button } from '../../components/Button';
import { topBar } from '../../components/TopBar';
import { pill } from '../../components/Pill';
import { escapeHtml } from '../../components/colors';
import { formatRoleLabel } from '../../game/playerTypes';
import { findPlayerByKey, playerKey } from '../../tournament/TournamentState';
import type { ScreenModule } from '../../app/ScreenRouter';
import type { TournamentState, Fixture } from '../../tournament/TournamentState';
import type { LineupDraft } from '../../manager/types';

export interface LineupScreenProps {
  tournament: TournamentState;
  /** If present, "Confirm & continue" will go to MatchPreview for this fixture. */
  upcomingFixture?: Fixture;
}

export interface LineupScreenHandlers {
  onBack: () => void;
  onConfirm: (lineup: LineupDraft) => void;
  onOpenPitch: () => void;
}

export function createLineupScreen(handlers: LineupScreenHandlers): ScreenModule<LineupScreenProps> {
  return {
    render(host, props) {
      const tournament = props.tournament;
      const team = tournament.getTeam(tournament.selectedTeamId);
      const opponent = props.upcomingFixture
        ? tournament.getTeam(
            props.upcomingFixture.homeTeamId === team.id
              ? props.upcomingFixture.awayTeamId
              : props.upcomingFixture.homeTeamId,
          )
        : null;
      const draft: LineupDraft = JSON.parse(JSON.stringify(tournament.selectedLineup));

      function rerender(): void {
        const startingMarkup = draft.startingXI
          .map((id) => {
            const p = findPlayerByKey(team, id);
            if (!p) return '';
            const cond = p.condition ?? 100;
            const tone = cond < 60 ? 'warn' : undefined;
            return `<div class="mgr-row" style="padding:6px 0; border-bottom:1px solid var(--border);">
              <span class="mgr-pill mgr-pill--accent">#${p.number}</span>
              <strong>${escapeHtml(p.name)}</strong>
              <span class="mgr-muted">${escapeHtml(formatRoleLabel(p.role))}</span>
              <span class="mgr-spacer"></span>
              ${tone ? pill({ label: `Cond ${cond}`, tone: 'warn' }) : pill({ label: `Cond ${cond}` })}
              ${draft.captainId === id ? pill({ label: 'C', tone: 'accent', title: 'Captain' }) : ''}
            </div>`;
          })
          .join('');
        const benchMarkup = draft.bench
          .map((id) => {
            const p = findPlayerByKey(team, id);
            if (!p) return '';
            return `<div class="mgr-row" style="padding:6px 0;">
              <span class="mgr-pill">#${p.number}</span>
              <span>${escapeHtml(p.name)}</span>
              <span class="mgr-muted" style="margin-left:auto;">${escapeHtml(formatRoleLabel(p.role))}</span>
            </div>`;
          })
          .join('');
        const captainOptions = draft.startingXI
          .map((id) => {
            const p = findPlayerByKey(team, id);
            if (!p) return '';
            return `<option value="${id}" ${id === draft.captainId ? 'selected' : ''}>#${p.number} ${escapeHtml(p.name)}</option>`;
          })
          .join('');

        const expectedOpponent = opponent
          ? `<section class="mgr-card">
              <h2 class="mgr-card__title">Opposition expected XI · ${escapeHtml(opponent.name)}</h2>
              <p class="mgr-muted">Formation: ${opponent.formationPreferences[0] ?? '4-3-3'}</p>
              ${opponent.players.map((p) => `<div class="mgr-row" style="padding:4px 0;"><span class="mgr-pill">#${p.number}</span><span>${escapeHtml(p.name)}</span><span class="mgr-muted" style="margin-left:auto;">${escapeHtml(formatRoleLabel(p.role))}</span></div>`).join('')}
            </section>`
          : '';

        host.innerHTML = `
          <div class="mgr-screen">
            <div class="mgr-container">
              ${topBar({
                eyebrow: 'Manager Mode',
                title: `${team.name} — Lineup`,
                subtitle: 'Confirm starting XI, bench, and captain.',
                backDataAction: 'back',
                actions: [
                  { label: 'Pitch view', dataAction: 'open-pitch' },
                  { label: 'Confirm', dataAction: 'confirm', variant: 'primary' },
                ],
              })}
              <div class="mgr-grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
                <section class="mgr-card mgr-card--accent">
                  <h2 class="mgr-card__title">Starting XI (${draft.startingXI.length})</h2>
                  ${startingMarkup}
                </section>
                <section class="mgr-card">
                  <h2 class="mgr-card__title">Bench (${draft.bench.length})</h2>
                  ${benchMarkup || '<p class="mgr-muted">No bench.</p>'}
                </section>
                ${expectedOpponent}
              </div>
              <section class="mgr-card">
                <h2 class="mgr-card__title">Captain</h2>
                <select class="mgr-select" data-action="captain-select">${captainOptions}</select>
              </section>
              <div class="mgr-row" style="justify-content:flex-end;">${button({ label: 'Confirm & continue', dataAction: 'confirm', variant: 'primary', size: 'lg' })}</div>
            </div>
          </div>
        `;
        bind();
      }

      function bind(): void {
        host.querySelector('[data-action="back"]')?.addEventListener('click', handlers.onBack);
        host.querySelector('[data-action="open-pitch"]')?.addEventListener('click', handlers.onOpenPitch);
        host.querySelectorAll('[data-action="confirm"]').forEach((el) =>
          el.addEventListener('click', () => handlers.onConfirm(draft)),
        );
        host.querySelector<HTMLSelectElement>('[data-action="captain-select"]')?.addEventListener('change', (event) => {
          const value = (event.target as HTMLSelectElement).value;
          draft.captainId = value;
        });
      }

      rerender();
      void playerKey;
    },
  };
}
