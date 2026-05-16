import { button } from './Button';
import { flag } from './Flag';
import { pill } from './Pill';
import { escapeHtml } from './colors';
import type { Fixture, TournamentSnapshot } from '../tournament/TournamentState';
import { getTeamById, type TournamentTeam } from '../tournament/teams';

export interface NextMatchCardProps {
  snapshot: TournamentSnapshot;
  detailed?: boolean;
  showActions?: boolean;
  primaryActionLabel?: string;
}

export function nextMatchCard(props: NextMatchCardProps): string {
  const fixture = props.snapshot.currentFixture ?? props.snapshot.nextFixture;
  if (!fixture) {
    return `<section class="mgr-card mgr-card--accent">
      <h2 class="mgr-card__title">${props.snapshot.championTeamId ? 'Tournament complete' : 'No playable match queued'}</h2>
      <p class="mgr-muted">${props.snapshot.championTeamId ? 'A champion has been crowned.' : 'Simulate remaining fixtures to continue.'}</p>
      ${!props.snapshot.championTeamId && props.showActions !== false
        ? button({ label: 'Simulate remaining', dataAction: 'simulate-all', variant: 'primary' })
        : ''}
    </section>`;
  }
  const home = getTeamById(fixture.homeTeamId);
  const away = getTeamById(fixture.awayTeamId);
  const isUserFixture = isUser(fixture, props.snapshot.selectedTeam);
  const actionButtons = props.showActions === false ? '' : renderActions(fixture, isUserFixture, props);
  return `<section class="mgr-card mgr-card--accent next-match-card">
    <p class="mgr-topbar__eyebrow">${escapeHtml(stageLabel(fixture.stage))}</p>
    <div class="mgr-row" style="align-items:center; gap:16px;">
      ${renderMiniTeam(home)}
      <span class="mgr-strong" style="font-size:18px;">VS</span>
      ${renderMiniTeam(away)}
    </div>
    ${props.detailed ? `<div class="mgr-row">${pill({ label: `${home.code} OVR ${home.rating.overall}`, tone: 'accent' })}${pill({ label: `${away.code} OVR ${away.rating.overall}`, tone: 'accent' })}</div>` : ''}
    <div class="mgr-row">${actionButtons}</div>
  </section>`;
}

function isUser(fixture: Fixture, userTeam: TournamentTeam): boolean {
  return fixture.homeTeamId === userTeam.id || fixture.awayTeamId === userTeam.id;
}

function renderMiniTeam(team: TournamentTeam): string {
  return `<div class="mgr-row" style="gap:8px; align-items:center;">${flag(team, 'sm')}<span class="mgr-strong">${escapeHtml(team.name)}</span></div>`;
}

function stageLabel(stage: Fixture['stage']): string {
  if (stage === 'Group') return 'Group Stage';
  return stage;
}

function renderActions(fixture: Fixture, isUserFixture: boolean, props: NextMatchCardProps): string {
  if (!isUserFixture || props.snapshot.userEliminated) {
    return `${button({ label: 'Simulate Match', dataAction: 'simulate-next', variant: 'primary' })}${button({ label: 'Simulate remaining', dataAction: 'simulate-all' })}`;
  }
  return `${button({ label: props.primaryActionLabel ?? 'Match Preview', dataAction: 'open-preview', variant: 'primary' })}${button({ label: 'Simulate', dataAction: 'simulate-next' })}`;
}
