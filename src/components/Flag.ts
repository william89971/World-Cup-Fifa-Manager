import type { TournamentTeam } from '../tournament/teams';

export function flag(team: TournamentTeam, size: 'sm' | 'md' | 'lg' = 'md'): string {
  return `<span class="mgr-flag mgr-flag--${size}" aria-hidden="true">${team.flagSvg}</span>`;
}
