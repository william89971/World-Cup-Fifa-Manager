import { button } from '../../components/Button';
import { topBar } from '../../components/TopBar';
import { pill } from '../../components/Pill';
import { escapeHtml } from '../../components/colors';
import type { ScreenModule } from '../../app/ScreenRouter';
import type { Fixture, TournamentState } from '../../tournament/TournamentState';

export interface FixturesScreenProps {
  tournament: TournamentState;
  filter?: 'all' | 'mine' | 'group' | 'knockouts';
  status?: 'all' | 'results' | 'upcoming';
}

export interface FixturesScreenHandlers {
  onBack: () => void;
  onSetFilter: (filter: 'all' | 'mine' | 'group' | 'knockouts') => void;
  onSetStatus: (status: 'all' | 'results' | 'upcoming') => void;
}

export function createFixturesScreen(handlers: FixturesScreenHandlers): ScreenModule<FixturesScreenProps> {
  return {
    render(host, props) {
      const tournament = props.tournament;
      const userId = tournament.selectedTeamId;
      const filter = props.filter ?? 'all';
      const status = props.status ?? 'all';
      const myGroup = tournament.groups.find((g) => g.teamIds.includes(userId));

      let rows = tournament.fixtures;
      if (filter === 'mine') rows = rows.filter((f) => f.homeTeamId === userId || f.awayTeamId === userId);
      else if (filter === 'group') rows = rows.filter((f) => f.groupId && f.groupId === myGroup?.id);
      else if (filter === 'knockouts') rows = rows.filter((f) => f.knockout);
      if (status === 'results') rows = rows.filter((f) => f.status === 'complete');
      else if (status === 'upcoming') rows = rows.filter((f) => f.status === 'pending');

      host.innerHTML = `
        <div class="mgr-screen">
          <div class="mgr-container">
            ${topBar({ eyebrow: 'Manager Mode', title: 'Fixtures', backDataAction: 'back' })}
            <div class="mgr-row">
              <span class="mgr-muted">Filter:</span>
              ${(['all', 'mine', 'group', 'knockouts'] as const).map((f) =>
                button({ label: f, dataAction: 'filter', dataAttrs: { f }, variant: filter === f ? 'primary' : 'default', size: 'sm' }),
              ).join('')}
              <span class="mgr-spacer"></span>
              <span class="mgr-muted">Status:</span>
              ${(['all', 'results', 'upcoming'] as const).map((s) =>
                button({ label: s, dataAction: 'status', dataAttrs: { s }, variant: status === s ? 'primary' : 'default', size: 'sm' }),
              ).join('')}
            </div>
            <section class="mgr-card">
              ${rows.length === 0 ? '<p class="mgr-muted">No fixtures match this filter.</p>' : rows.map((f) => renderFixture(f, tournament, userId)).join('')}
            </section>
          </div>
        </div>
      `;

      host.querySelector('[data-action="back"]')?.addEventListener('click', handlers.onBack);
      host.querySelectorAll<HTMLElement>('[data-action="filter"]').forEach((el) =>
        el.addEventListener('click', () => handlers.onSetFilter((el.dataset.f ?? 'all') as 'all' | 'mine' | 'group' | 'knockouts')),
      );
      host.querySelectorAll<HTMLElement>('[data-action="status"]').forEach((el) =>
        el.addEventListener('click', () => handlers.onSetStatus((el.dataset.s ?? 'all') as 'all' | 'results' | 'upcoming')),
      );
    },
  };
}

function renderFixture(f: Fixture, t: TournamentState, userId: string): string {
  const home = t.getTeam(f.homeTeamId);
  const away = t.getTeam(f.awayTeamId);
  const isUser = f.homeTeamId === userId || f.awayTeamId === userId;
  const score =
    f.status === 'complete'
      ? `${f.homeScore} - ${f.awayScore}${f.decidedByPenalties ? ' (pens)' : ''}`
      : 'vs';
  return `<div class="mgr-row" style="padding:6px 0; border-bottom:1px solid var(--border); ${isUser ? 'background:rgba(45,125,255,0.10);' : ''}">
    <span class="mgr-muted" style="min-width:80px;">${escapeHtml(stageLabel(f))}</span>
    <strong style="text-align:right; flex:1;">${escapeHtml(home.name)}</strong>
    <span class="mgr-pill mgr-pill--accent" style="min-width:60px; justify-content:center;">${score}</span>
    <strong style="text-align:left; flex:1;">${escapeHtml(away.name)}</strong>
    ${f.status === 'complete' ? pill({ label: 'FT', tone: 'success' }) : pill({ label: 'next' })}
  </div>`;
}

function stageLabel(f: Fixture): string {
  if (f.stage === 'Group') return `Group ${f.groupId}`;
  return f.stage;
}
