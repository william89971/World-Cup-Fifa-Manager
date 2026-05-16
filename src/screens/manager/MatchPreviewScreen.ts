import { button } from '../../components/Button';
import { card } from '../../components/Card';
import { topBar } from '../../components/TopBar';
import { comparisonBar } from '../../components/Bar';
import { pill } from '../../components/Pill';
import { flag } from '../../components/Flag';
import { escapeHtml } from '../../components/colors';
import { TRAIT_KEYS } from '../../game/playerTypes';
import type { ScreenModule } from '../../app/ScreenRouter';
import type { TournamentState, Fixture } from '../../tournament/TournamentState';
import type { TournamentPlayerProfile, TournamentTeam } from '../../tournament/teams';

export interface MatchPreviewScreenProps {
  tournament: TournamentState;
  fixture: Fixture;
}

export interface MatchPreviewScreenHandlers {
  onBack: () => void;
  onWatchMatch: () => void;
  onSimulate: () => void;
  onOpenLineup: () => void;
  onOpenTactics: () => void;
  onOpenScouting: () => void;
}

function overall(p: TournamentPlayerProfile): number {
  let sum = 0;
  for (const k of TRAIT_KEYS) sum += p.traits[k];
  return Math.round((sum / TRAIT_KEYS.length) * 100);
}

function avg(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

function lineRatings(team: TournamentTeam) {
  const def = team.players.filter((p) => p.role === 'goalkeeper' || p.role.includes('Back'));
  const mid = team.players.filter((p) => p.role.includes('Mid'));
  const att = team.players.filter((p) => p.role === 'striker' || p.role.includes('Wing'));
  const gk = team.players.filter((p) => p.role === 'goalkeeper');
  return {
    attack: Math.round(avg(att.map(overall)) || 70),
    midfield: Math.round(avg(mid.map(overall)) || 70),
    defense: Math.round(avg(def.map(overall)) || 70),
    keeper: Math.round(avg(gk.map(overall)) || 70),
    overall: team.rating.overall,
  };
}

export function createMatchPreviewScreen(
  handlers: MatchPreviewScreenHandlers,
): ScreenModule<MatchPreviewScreenProps> {
  return {
    render(host, props) {
      const t = props.tournament;
      const userTeam = t.getTeam(t.selectedTeamId);
      const opponentId = props.fixture.homeTeamId === t.selectedTeamId
        ? props.fixture.awayTeamId
        : props.fixture.homeTeamId;
      const opponent = t.getTeam(opponentId);
      const userR = lineRatings(userTeam);
      const oppR = lineRatings(opponent);

      const userKey = [...userTeam.players].sort((a, b) => overall(b) - overall(a)).slice(0, 3);
      const oppKey = [...opponent.players].sort((a, b) => overall(b) - overall(a)).slice(0, 3);
      const tiredStarters = userTeam.players.filter((p) => (p.condition ?? 100) < 60);

      const diff = userR.overall - oppR.overall;
      const difficulty = diff > 5 ? 'Favourites' : diff < -5 ? 'Heavy underdogs' : Math.abs(diff) <= 2 ? 'Even' : diff > 0 ? 'Slight edge' : 'Slight underdog';
      const recommendation = diff > 4
        ? 'Press high, dominate the ball.'
        : diff < -4
        ? 'Sit deep and break on the counter.'
        : 'Stay disciplined; balanced approach.';

      host.innerHTML = `
        <div class="mgr-screen">
          <div class="mgr-container">
            ${topBar({
              eyebrow: props.fixture.stage,
              title: 'Match preview',
              subtitle: `${userTeam.name} vs ${opponent.name}`,
              backDataAction: 'back',
              actions: [
                { label: 'Watch match', dataAction: 'watch', variant: 'primary' },
                { label: 'Simulate', dataAction: 'sim' },
              ],
            })}
            <section class="mgr-card">
              <div class="mgr-row" style="justify-content:space-between;">
                <div class="mgr-row">${flag(userTeam, 'lg')}<div><h2 style="margin:0;">${escapeHtml(userTeam.name)}</h2><div class="mgr-muted">${pill({ label: 'OVR ' + userR.overall, tone: 'accent' })}</div></div></div>
                <div style="font-size:28px; font-weight:800;">VS</div>
                <div class="mgr-row"><div style="text-align:right;"><h2 style="margin:0;">${escapeHtml(opponent.name)}</h2><div class="mgr-muted">${pill({ label: 'OVR ' + oppR.overall, tone: 'accent' })}</div></div>${flag(opponent, 'lg')}</div>
              </div>
            </section>

            <section class="mgr-card">
              <h2 class="mgr-card__title">Team comparison</h2>
              ${comparisonBar(userR.attack, oppR.attack, 'Attack')}
              ${comparisonBar(userR.midfield, oppR.midfield, 'Midfield')}
              ${comparisonBar(userR.defense, oppR.defense, 'Defense')}
              ${comparisonBar(userR.keeper, oppR.keeper, 'Keeper')}
              ${comparisonBar(userR.overall, oppR.overall, 'Overall')}
            </section>

            <div class="mgr-grid">
              ${card({
                title: `${userTeam.name} key players`,
                body: userKey.map((p) => `<p>⭐ <strong>${escapeHtml(p.name)}</strong> <span class="mgr-muted">${escapeHtml(p.role)}</span> · OVR ${overall(p)}</p>`).join(''),
              })}
              ${card({
                title: `${opponent.name} key players`,
                body: oppKey.map((p) => `<p>⚠️ <strong>${escapeHtml(p.name)}</strong> <span class="mgr-muted">${escapeHtml(p.role)}</span> · OVR ${overall(p)}</p>`).join(''),
              })}
              ${card({
                title: 'Assistant recommendation',
                body: `<p><strong>${escapeHtml(difficulty)}.</strong></p><p>${escapeHtml(recommendation)}</p>`,
                accent: 'accent',
              })}
              ${tiredStarters.length > 0 ? card({
                title: 'Fatigue warnings',
                body: tiredStarters.map((p) => `<p>⚠️ ${escapeHtml(p.name)} (cond ${p.condition})</p>`).join(''),
                accent: 'warn',
              }) : ''}
            </div>

            <div class="mgr-row" style="justify-content:space-between;">
              <div class="mgr-row">
                ${button({ label: 'Edit lineup', dataAction: 'lineup' })}
                ${button({ label: 'Edit tactics', dataAction: 'tactics' })}
                ${button({ label: 'Scout opponent', dataAction: 'scout' })}
              </div>
              <div class="mgr-row">
                ${button({ label: 'Simulate instant result', dataAction: 'sim' })}
                ${button({ label: 'Watch match', dataAction: 'watch', variant: 'primary', size: 'lg' })}
              </div>
            </div>
          </div>
        </div>
      `;

      host.querySelector('[data-action="back"]')?.addEventListener('click', handlers.onBack);
      host.querySelectorAll('[data-action="watch"]').forEach((el) => el.addEventListener('click', handlers.onWatchMatch));
      host.querySelectorAll('[data-action="sim"]').forEach((el) => el.addEventListener('click', handlers.onSimulate));
      host.querySelector('[data-action="lineup"]')?.addEventListener('click', handlers.onOpenLineup);
      host.querySelector('[data-action="tactics"]')?.addEventListener('click', handlers.onOpenTactics);
      host.querySelector('[data-action="scout"]')?.addEventListener('click', handlers.onOpenScouting);
    },
  };
}
