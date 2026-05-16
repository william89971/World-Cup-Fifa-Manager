import { topBar } from '../../components/TopBar';
import { pill } from '../../components/Pill';
import { escapeHtml } from '../../components/colors';
import type { ScreenModule } from '../../app/ScreenRouter';
import type { Group, TournamentState } from '../../tournament/TournamentState';

export interface StandingsScreenProps {
  tournament: TournamentState;
}

export interface StandingsScreenHandlers {
  onBack: () => void;
}

export function createStandingsScreen(
  handlers: StandingsScreenHandlers,
): ScreenModule<StandingsScreenProps> {
  return {
    render(host, props) {
      const tournament = props.tournament;
      const userId = tournament.selectedTeamId;

      host.innerHTML = `
        <div class="mgr-screen">
          <div class="mgr-container">
            ${topBar({ eyebrow: 'Manager Mode', title: 'Standings', backDataAction: 'back' })}
            <div class="mgr-grid">
              ${tournament.groups.map((g) => renderGroup(g, tournament, userId)).join('')}
            </div>
            <section class="mgr-card">
              <h2 class="mgr-card__title">Best third-place (top 8 qualify)</h2>
              ${renderBestThird(tournament, userId)}
            </section>
          </div>
        </div>
      `;
      host.querySelector('[data-action="back"]')?.addEventListener('click', handlers.onBack);
    },
  };
}

function renderGroup(group: Group, tournament: TournamentState, userId: string): string {
  const ranked = tournament.getRankedStandings(group);
  return `<section class="mgr-card">
    <h2 class="mgr-card__title">Group ${group.id}</h2>
    <table class="mgr-table">
      <thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
      <tbody>
        ${ranked.map((standing, idx) => {
          const team = tournament.getTeam(standing.teamId);
          const tone = idx < 2 ? 'is-success' : idx === 2 ? 'is-warn' : 'is-danger';
          const userClass = standing.teamId === userId ? ' is-user' : '';
          return `<tr class="${tone}${userClass}">
            <td>${escapeHtml(team.name)}${standing.teamId === userId ? ' ' + pill({ label: 'YOU', tone: 'accent' }) : ''}</td>
            <td>${standing.played}</td>
            <td>${standing.wins}</td>
            <td>${standing.draws}</td>
            <td>${standing.losses}</td>
            <td>${standing.goalDifference}</td>
            <td><strong>${standing.points}</strong></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </section>`;
}

function renderBestThird(tournament: TournamentState, userId: string): string {
  const thirds = tournament.getBestThirdPlaceStandings();
  return `<table class="mgr-table">
    <thead><tr><th>#</th><th>Team</th><th>Pts</th><th>GD</th><th>GF</th></tr></thead>
    <tbody>
      ${thirds.map((s, idx) => {
        const team = tournament.getTeam(s.teamId);
        const tone = idx < 8 ? 'is-success' : 'is-danger';
        const userClass = s.teamId === userId ? ' is-user' : '';
        return `<tr class="${tone}${userClass}"><td>${idx + 1}</td><td>${escapeHtml(team.name)}</td><td>${s.points}</td><td>${s.goalDifference}</td><td>${s.goalsFor}</td></tr>`;
      }).join('')}
    </tbody>
  </table>`;
}
