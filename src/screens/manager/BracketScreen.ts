import { topBar } from '../../components/TopBar';
import { pill } from '../../components/Pill';
import { escapeHtml } from '../../components/colors';
import type { ScreenModule } from '../../app/ScreenRouter';
import type { Fixture, TournamentState } from '../../tournament/TournamentState';

export interface BracketScreenProps {
  tournament: TournamentState;
}

export interface BracketScreenHandlers {
  onBack: () => void;
}

const ROUNDS = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'] as const;

export function createBracketScreen(handlers: BracketScreenHandlers): ScreenModule<BracketScreenProps> {
  return {
    render(host, props) {
      const tournament = props.tournament;
      const userId = tournament.selectedTeamId;
      const knockoutFixtures = tournament.fixtures.filter((f) => f.knockout);

      host.innerHTML = `
        <div class="mgr-screen">
          <div class="mgr-container">
            ${topBar({ eyebrow: 'Manager Mode', title: 'Knockout bracket', backDataAction: 'back' })}
            ${knockoutFixtures.length === 0
              ? '<p class="mgr-muted">Complete the group stage to generate the Round of 32.</p>'
              : `<div class="mgr-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); align-items:start;">
                  ${ROUNDS.map((r) => renderRound(r, knockoutFixtures, tournament, userId)).join('')}
                </div>`}
            ${tournament.championTeamId ? renderChampion(tournament) : ''}
          </div>
        </div>
      `;
      host.querySelector('[data-action="back"]')?.addEventListener('click', handlers.onBack);
    },
  };
}

function renderRound(round: string, fixtures: Fixture[], tournament: TournamentState, userId: string): string {
  const roundFixtures = fixtures.filter((f) => f.stage === round);
  if (roundFixtures.length === 0) return '';
  return `<section class="mgr-card">
    <h2 class="mgr-card__title">${round}</h2>
    ${roundFixtures.map((f) => renderFixture(f, tournament, userId)).join('')}
  </section>`;
}

function renderFixture(f: Fixture, tournament: TournamentState, userId: string): string {
  const home = tournament.getTeam(f.homeTeamId);
  const away = tournament.getTeam(f.awayTeamId);
  const isUser = f.homeTeamId === userId || f.awayTeamId === userId;
  const score =
    f.status === 'complete'
      ? `${f.homeScore} - ${f.awayScore}${f.decidedByPenalties ? ' (p)' : ''}`
      : 'vs';
  return `<div class="mgr-card" style="padding:8px; margin-bottom:8px; border-left:3px solid ${isUser ? 'var(--accent)' : 'transparent'};">
    <div class="mgr-row" style="justify-content:space-between;">
      <strong>${escapeHtml(home.code)}</strong>
      <span class="mgr-mono">${score}</span>
      <strong>${escapeHtml(away.code)}</strong>
    </div>
    ${isUser ? pill({ label: 'YOU', tone: 'accent' }) : ''}
  </div>`;
}

function renderChampion(tournament: TournamentState): string {
  if (!tournament.championTeamId) return '';
  const team = tournament.getTeam(tournament.championTeamId);
  return `<section class="mgr-card mgr-card--success">
    <h2 class="mgr-card__title">🏆 Champion: ${escapeHtml(team.name)}</h2>
  </section>`;
}
