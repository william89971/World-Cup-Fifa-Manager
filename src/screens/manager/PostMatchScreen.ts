import { button } from '../../components/Button';
import { card } from '../../components/Card';
import { topBar } from '../../components/TopBar';
import { pill } from '../../components/Pill';
import { comparisonBar } from '../../components/Bar';
import { table } from '../../components/Table';
import { flag } from '../../components/Flag';
import { escapeHtml } from '../../components/colors';
import type { ScreenModule } from '../../app/ScreenRouter';
import type { TournamentState } from '../../tournament/TournamentState';
import type { MatchReport, PlayerMatchRating } from '../../manager/types';

export interface PostMatchScreenProps {
  tournament: TournamentState;
  report: MatchReport;
}

export interface PostMatchScreenHandlers {
  onContinue: () => void;
  onOpenStandings: () => void;
  onOpenSquad: () => void;
}

export function createPostMatchScreen(
  handlers: PostMatchScreenHandlers,
): ScreenModule<PostMatchScreenProps> {
  return {
    render(host, props) {
      const r = props.report;
      const homeTeam = props.tournament.getTeam(r.homeTeamId);
      const awayTeam = props.tournament.getTeam(r.awayTeamId);
      const result =
        r.homeScore > r.awayScore
          ? `${homeTeam.name} wins`
          : r.awayScore > r.homeScore
          ? `${awayTeam.name} wins`
          : 'Draw';
      const motm: PlayerMatchRating | undefined = [...r.homeRatings, ...r.awayRatings].find((p) => p.isMotm);

      const homeRatingsRows = ratingRows(r.homeRatings);
      const awayRatingsRows = ratingRows(r.awayRatings);

      const scorersHome = r.homeRatings.filter((p) => p.goals > 0);
      const scorersAway = r.awayRatings.filter((p) => p.goals > 0);

      host.innerHTML = `
        <div class="mgr-screen">
          <div class="mgr-container">
            ${topBar({
              eyebrow: `${r.stage} · Full time`,
              title: result,
              subtitle: `${homeTeam.name} ${r.homeScore} - ${r.awayScore} ${awayTeam.name}`,
              backDataAction: 'continue',
              backLabel: 'Continue',
              actions: [
                { label: 'Squad', dataAction: 'squad' },
                { label: 'Standings', dataAction: 'standings' },
              ],
            })}

            <section class="mgr-card">
              <div class="mgr-row" style="justify-content:space-between; align-items:center;">
                <div class="mgr-row" style="gap:12px;">${flag(homeTeam)}<strong>${escapeHtml(homeTeam.name)}</strong></div>
                <div style="font-size:32px; font-weight:800;">${r.homeScore} - ${r.awayScore}</div>
                <div class="mgr-row" style="gap:12px;"><strong>${escapeHtml(awayTeam.name)}</strong>${flag(awayTeam)}</div>
              </div>
            </section>

            ${motm ? card({
              title: 'Player of the match',
              body: `<div class="mgr-row" style="align-items:center; gap:16px;">
                ${pill({ label: `${motm.rating.toFixed(1)}`, tone: 'success' })}
                <strong style="font-size:18px;">${escapeHtml(motm.playerName)}</strong>
                ${motm.goals > 0 ? pill({ label: `${motm.goals} goal${motm.goals > 1 ? 's' : ''}`, tone: 'accent' }) : ''}
              </div>`,
              accent: 'success',
            }) : ''}

            <section class="mgr-card">
              <h2 class="mgr-card__title">Match stats</h2>
              ${comparisonBar(r.stats.possessionPct, 100 - r.stats.possessionPct, 'Possession %')}
              ${comparisonBar(r.stats.shots.home, r.stats.shots.away, 'Shots')}
              ${comparisonBar(r.stats.shotsOnTarget.home, r.stats.shotsOnTarget.away, 'On target')}
              ${comparisonBar(r.stats.passes.home, r.stats.passes.away, 'Passes')}
              ${comparisonBar(r.stats.tackles.home, r.stats.tackles.away, 'Tackles')}
              ${comparisonBar(r.stats.fouls.home, r.stats.fouls.away, 'Fouls')}
              ${comparisonBar(r.stats.corners.home, r.stats.corners.away, 'Corners')}
              ${comparisonBar(r.stats.offsides.home, r.stats.offsides.away, 'Offsides')}
            </section>

            <section class="mgr-card">
              <h2 class="mgr-card__title">Scorers</h2>
              <div class="mgr-grid">
                <div>
                  <strong>${escapeHtml(homeTeam.name)}</strong>
                  ${scorersHome.length ? scorersHome.map((p) => `<p>⚽ ${escapeHtml(p.playerName)} ${p.goals > 1 ? '(' + p.goals + ')' : ''}</p>`).join('') : '<p class="mgr-muted">No goals.</p>'}
                </div>
                <div>
                  <strong>${escapeHtml(awayTeam.name)}</strong>
                  ${scorersAway.length ? scorersAway.map((p) => `<p>⚽ ${escapeHtml(p.playerName)} ${p.goals > 1 ? '(' + p.goals + ')' : ''}</p>`).join('') : '<p class="mgr-muted">No goals.</p>'}
                </div>
              </div>
            </section>

            <section class="mgr-card">
              <h2 class="mgr-card__title">${escapeHtml(homeTeam.name)} ratings</h2>
              ${table({ columns: [
                { key: 'name', label: 'Player' },
                { key: 'role', label: 'Role' },
                { key: 'rating', label: 'Rating', align: 'right' },
              ], rows: homeRatingsRows })}
            </section>

            <section class="mgr-card">
              <h2 class="mgr-card__title">${escapeHtml(awayTeam.name)} ratings</h2>
              ${table({ columns: [
                { key: 'name', label: 'Player' },
                { key: 'role', label: 'Role' },
                { key: 'rating', label: 'Rating', align: 'right' },
              ], rows: awayRatingsRows })}
            </section>

            <div class="mgr-row" style="justify-content:flex-end;">
              ${button({ label: 'Continue', dataAction: 'continue', variant: 'primary', size: 'lg' })}
            </div>
          </div>
        </div>
      `;

      host.querySelectorAll('[data-action="continue"]').forEach((el) => el.addEventListener('click', handlers.onContinue));
      host.querySelectorAll('[data-action="squad"]').forEach((el) => el.addEventListener('click', handlers.onOpenSquad));
      host.querySelectorAll('[data-action="standings"]').forEach((el) => el.addEventListener('click', handlers.onOpenStandings));
    },
  };
}

function ratingRows(ratings: PlayerMatchRating[]) {
  return [...ratings].sort((a, b) => b.rating - a.rating).map((r) => ({
    cells: {
      name: `${r.isMotm ? '⭐ ' : ''}<strong>${escapeHtmlSafe(r.playerName)}</strong>${r.goals ? ' <span class="mgr-pill mgr-pill--accent">' + r.goals + 'G</span>' : ''}`,
      role: '',
      rating: `<span style="color:${r.rating >= 7.5 ? 'var(--success)' : r.rating >= 6 ? 'var(--text)' : 'var(--danger)'}; font-weight:700;">${r.rating.toFixed(1)}</span>`,
    },
  }));
}

function escapeHtmlSafe(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
