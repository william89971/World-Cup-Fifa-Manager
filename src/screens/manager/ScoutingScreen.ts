import { button } from '../../components/Button';
import { card } from '../../components/Card';
import { topBar } from '../../components/TopBar';
import { pill } from '../../components/Pill';
import { flag } from '../../components/Flag';
import { escapeHtml } from '../../components/colors';
import { recommendAgainst } from '../../manager/scouting/recommend';
import type { ScreenModule } from '../../app/ScreenRouter';
import type { TournamentState } from '../../tournament/TournamentState';
import type { ManagerTactics } from '../../manager/types';

export interface ScoutingScreenProps {
  tournament: TournamentState;
}

export interface ScoutingScreenHandlers {
  onBack: () => void;
  onApplySuggested: (tactics: ManagerTactics) => void;
  onOpenLineup: () => void;
}

export function createScoutingScreen(
  handlers: ScoutingScreenHandlers,
): ScreenModule<ScoutingScreenProps> {
  return {
    render(host, props) {
      const tournament = props.tournament;
      const userTeam = tournament.getTeam(tournament.selectedTeamId);
      const fixture = tournament.getNextUserFixture();
      if (!fixture) {
        host.innerHTML = `<div class="mgr-screen"><div class="mgr-container">${topBar({ eyebrow: 'Scouting', title: 'No fixture to scout', backDataAction: 'back' })}<p class="mgr-muted">There is no upcoming fixture for your team.</p></div></div>`;
        host.querySelector('[data-action="back"]')?.addEventListener('click', handlers.onBack);
        return;
      }
      const opponentId = fixture.homeTeamId === userTeam.id ? fixture.awayTeamId : fixture.homeTeamId;
      const opponent = tournament.getTeam(opponentId);
      const analysis = recommendAgainst(opponent, userTeam);

      host.innerHTML = `
        <div class="mgr-screen">
          <div class="mgr-container">
            ${topBar({
              eyebrow: 'Scouting report',
              title: `Vs ${opponent.name}`,
              subtitle: `${fixture.stage} · ${analysis.formation} ${analysis.teamStyle}`,
              backDataAction: 'back',
              actions: [
                { label: 'Apply suggested tactics', dataAction: 'apply', variant: 'primary' },
                { label: 'Lineup', dataAction: 'lineup' },
              ],
            })}

            <section class="mgr-card mgr-card--accent">
              <div class="mgr-row" style="align-items:center; gap:16px;">
                ${flag(opponent, 'lg')}
                <div>
                  <h2 style="margin:0;">${escapeHtml(opponent.name)}</h2>
                  <div class="mgr-row" style="gap:6px;">
                    ${pill({ label: `OVR ${opponent.rating.overall}`, tone: 'accent' })}
                    ${pill({ label: analysis.formation })}
                    ${pill({ label: analysis.teamStyle })}
                  </div>
                </div>
              </div>
            </section>

            <div class="mgr-grid">
              ${card({
                title: 'Danger players',
                body: analysis.topThreats.map((t) => `<p>⚠️ <strong>${escapeHtml(t.name)}</strong> <span class="mgr-muted">${escapeHtml(t.role)}</span></p>`).join(''),
                accent: 'danger',
              })}
              ${card({
                title: 'Weak spots',
                body: analysis.weakSpots.map((w) => `<p>${w.line}: <strong>${Math.round(w.avg * 100)}</strong></p>`).join(''),
                accent: 'warn',
              })}
              ${card({
                title: 'Suggested approach',
                body: `<p>${escapeHtml(analysis.recommendation)}</p>${button({ label: 'Apply suggested tactics', dataAction: 'apply', variant: 'primary', block: true })}`,
                accent: 'success',
              })}
            </div>

            <section class="mgr-card">
              <h2 class="mgr-card__title">${escapeHtml(opponent.name)} probable XI</h2>
              ${opponent.players.map((p) => `<div class="mgr-row" style="padding:4px 0; border-bottom:1px solid var(--border);">
                ${pill({ label: '#' + p.number })}<strong>${escapeHtml(p.name)}</strong>
                <span class="mgr-muted">${escapeHtml(p.personality)}</span>
                <span class="mgr-spacer"></span>
                <span class="mgr-muted">${escapeHtml(p.role)}</span>
              </div>`).join('')}
            </section>
          </div>
        </div>
      `;

      host.querySelector('[data-action="back"]')?.addEventListener('click', handlers.onBack);
      host.querySelectorAll('[data-action="apply"]').forEach((el) =>
        el.addEventListener('click', () => handlers.onApplySuggested(analysis.suggestedTactics)),
      );
      host.querySelector('[data-action="lineup"]')?.addEventListener('click', handlers.onOpenLineup);
    },
  };
}
