import { button } from '../../components/Button';
import { card } from '../../components/Card';
import { bar } from '../../components/Bar';
import { flag } from '../../components/Flag';
import { pill, formPill } from '../../components/Pill';
import { nextMatchCard } from '../../components/NextMatchCard';
import { topBar } from '../../components/TopBar';
import { mentalityLabel } from '../../manager/types';
import type { ScreenModule } from '../../app/ScreenRouter';
import type { TournamentState } from '../../tournament/TournamentState';
import { escapeHtml } from '../../components/colors';

export interface ManagerHubProps {
  tournament: TournamentState;
}

export interface ManagerHubHandlers {
  onBack: () => void;
  onContinue: () => void;
  onSimulateNext: () => void;
  onNavigate: (target: 'squad' | 'tactics' | 'lineup' | 'pitch' | 'training' | 'scouting' | 'fixtures' | 'standings' | 'bracket' | 'inbox' | 'settings') => void;
  onSaveAndQuit: () => void;
}

export function createManagerHub(handlers: ManagerHubHandlers): ScreenModule<ManagerHubProps> {
  return {
    render(host, props) {
      const snap = props.tournament.getManagerSnapshot();
      const team = snap.team;
      const formHtml = snap.lastFiveResults.length
        ? snap.lastFiveResults.map(formPill).join(' ')
        : `<span class="mgr-muted">No matches played yet</span>`;
      const news = props.tournament.news.slice(0, 3);
      const newsList = news.length
        ? news
            .map(
              (item) =>
                `<div class="mgr-card" style="padding:8px 12px; cursor:pointer;" data-action="open-inbox">
                  <div class="mgr-row" style="justify-content:space-between;">
                    <strong>${escapeHtml(item.title)}</strong>${item.read ? '' : pill({ label: 'NEW', tone: 'accent' })}
                  </div>
                  <p class="mgr-muted" style="margin:4px 0 0;">${escapeHtml(item.body)}</p>
                </div>`,
            )
            .join('')
        : `<p class="mgr-muted">No new messages yet. Play a match or run training to generate news.</p>`;

      host.innerHTML = `
        <div class="mgr-screen">
          <div class="mgr-container">
            ${topBar({
              eyebrow: snap.stageLabel,
              title: `${team.name} — Manager Hub`,
              subtitle: snap.eliminated ? 'Your team has been eliminated.' : 'Select an action below.',
              backDataAction: 'home',
              backLabel: 'Main menu',
              actions: [
                { label: 'Save & quit', dataAction: 'save-quit' },
                { label: 'Settings', dataAction: 'open-settings' },
              ],
            })}
            <section class="mgr-row" style="align-items:center; gap:16px;">
              ${flag(team, 'lg')}
              <div>
                <h2 style="margin:0;">${escapeHtml(team.name)}</h2>
                <div class="mgr-row" style="gap:8px;">
                  ${pill({ label: `OVR ${team.rating.overall}`, tone: 'accent' })}
                  ${pill({ label: `${snap.wins}W ${snap.draws}D ${snap.losses}L` })}
                  ${pill({ label: snap.tactics.formation, tone: 'accent' })}
                  ${pill({ label: mentalityLabel(snap.tactics.mentality) })}
                </div>
                <div class="mgr-row" style="gap:6px; margin-top:8px;">${formHtml}</div>
              </div>
            </section>

            ${nextMatchCard({ snapshot: props.tournament.getSnapshot() })}

            <div class="mgr-grid">
              ${card({
                title: 'Squad condition',
                body: `${bar({ value: snap.avgCondition, label: 'Avg condition', showValue: true, colorClass: 'auto' })}${bar({ value: snap.avgMorale, label: 'Avg morale', showValue: true, colorClass: 'auto' })}`,
                accent: snap.avgCondition < 65 ? 'warn' : 'default',
              })}
              ${card({
                title: 'Tactical setup',
                body: `
                  <div class="mgr-row" style="gap:6px;">${pill({ label: snap.tactics.formation, tone: 'accent' })}${pill({ label: snap.tactics.teamStyle })}${pill({ label: mentalityLabel(snap.tactics.mentality) })}</div>
                  <p class="mgr-muted" style="margin:8px 0 0;">${snap.tactics.sliders.pressing > 65 ? 'High press.' : snap.tactics.sliders.pressing < 35 ? 'Low block.' : 'Balanced press.'} ${snap.tactics.sliders.tempo > 65 ? 'Quick tempo.' : snap.tactics.sliders.tempo < 35 ? 'Patient tempo.' : 'Steady tempo.'}</p>
                `,
              })}
              ${card({
                title: 'Inbox',
                body: newsList,
                accent: snap.unreadNews > 0 ? 'accent' : 'default',
              })}
            </div>

            <section class="mgr-card">
              <h2 class="mgr-card__title">Quick actions</h2>
              <div class="mgr-grid">
                ${button({ label: 'Squad', dataAction: 'nav-squad', block: true })}
                ${button({ label: 'Tactics', dataAction: 'nav-tactics', block: true })}
                ${button({ label: 'Lineup', dataAction: 'nav-lineup', block: true })}
                ${button({ label: 'Pitch view', dataAction: 'nav-pitch', block: true })}
                ${button({ label: 'Training', dataAction: 'nav-training', block: true })}
                ${button({ label: 'Scouting', dataAction: 'nav-scouting', block: true })}
                ${button({ label: 'Fixtures', dataAction: 'nav-fixtures', block: true })}
                ${button({ label: 'Standings', dataAction: 'nav-standings', block: true })}
                ${button({ label: 'Bracket', dataAction: 'nav-bracket', block: true })}
              </div>
            </section>

            <section class="mgr-row" style="justify-content:flex-end;">
              ${snap.nextFixture && !snap.eliminated ? button({ label: 'Continue to next match', dataAction: 'continue', variant: 'primary', size: 'lg' }) : ''}
              ${snap.nextFixture ? button({ label: 'Simulate next', dataAction: 'simulate-next' }) : ''}
            </section>
          </div>
        </div>
      `;

      host.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
        el.addEventListener('click', () => {
          const action = el.dataset.action;
          if (!action) return;
          console.log('[hub] action=' + action);
          if (action === 'home') handlers.onBack();
          else if (action === 'save-quit') handlers.onSaveAndQuit();
          else if (action === 'open-settings') handlers.onNavigate('settings');
          else if (action === 'continue') handlers.onContinue();
          else if (action === 'simulate-next') handlers.onSimulateNext();
          else if (action === 'simulate-all') handlers.onSimulateNext();
          else if (action === 'open-preview') handlers.onContinue();
          else if (action === 'open-inbox') handlers.onNavigate('inbox');
          else if (action.startsWith('nav-')) {
            handlers.onNavigate(action.slice(4) as Parameters<ManagerHubHandlers['onNavigate']>[0]);
          }
        });
      });
    },
  };
}
