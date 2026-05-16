import { button } from '../../components/Button';
import { card } from '../../components/Card';
import { topBar } from '../../components/TopBar';
import { pill } from '../../components/Pill';
import { escapeHtml } from '../../components/colors';
import type { ScreenModule } from '../../app/ScreenRouter';
import type { TournamentState } from '../../tournament/TournamentState';
import type { TrainingFocus, TrainingIntensity } from '../../manager/types';

export interface TrainingScreenProps {
  tournament: TournamentState;
}

export interface TrainingScreenHandlers {
  onBack: () => void;
  onRunTraining: (focus: TrainingFocus, intensity: TrainingIntensity) => void;
}

const FOCUSES: Array<{ focus: TrainingFocus; label: string; blurb: string }> = [
  { focus: 'fitness', label: 'Fitness', blurb: 'Stamina up. Burns condition.' },
  { focus: 'passing', label: 'Passing', blurb: 'Passing + teamwork. Light fatigue.' },
  { focus: 'shooting', label: 'Shooting', blurb: 'Shooting + composure.' },
  { focus: 'defense', label: 'Defense', blurb: 'Defending + positioning.' },
  { focus: 'tactics', label: 'Tactics', blurb: 'Positioning + discipline.' },
  { focus: 'setPieces', label: 'Set pieces', blurb: 'Designated takers only.' },
  { focus: 'recovery', label: 'Recovery', blurb: 'Condition + restored. No trait change.' },
];

export function createTrainingScreen(
  handlers: TrainingScreenHandlers,
): ScreenModule<TrainingScreenProps> {
  return {
    render(host, props) {
      let selectedFocus: TrainingFocus = 'fitness';
      let selectedIntensity: TrainingIntensity = 'medium';

      function rerender(): void {
        const history = props.tournament.trainingHistory.slice(0, 10);
        host.innerHTML = `
          <div class="mgr-screen">
            <div class="mgr-container">
              ${topBar({
                eyebrow: 'Manager Mode',
                title: 'Training',
                subtitle: 'Pick a focus and intensity. Effects apply immediately.',
                backDataAction: 'back',
              })}

              <section class="mgr-card">
                <h2 class="mgr-card__title">Focus</h2>
                <div class="mgr-grid">
                  ${FOCUSES.map((f) => `<button type="button" class="mgr-btn ${selectedFocus === f.focus ? 'mgr-btn--primary' : ''}" data-action="focus" data-f="${f.focus}" style="flex-direction:column; height:auto; padding:12px; gap:6px; text-transform:none; letter-spacing:0;">
                    <strong>${escapeHtml(f.label)}</strong>
                    <span class="mgr-muted" style="font-weight:400; font-size:11px;">${escapeHtml(f.blurb)}</span>
                  </button>`).join('')}
                </div>
              </section>

              <section class="mgr-card">
                <h2 class="mgr-card__title">Intensity</h2>
                <div class="mgr-row">
                  ${(['low', 'medium', 'high'] as TrainingIntensity[]).map((i) =>
                    button({ label: i, dataAction: 'intensity', dataAttrs: { i }, variant: selectedIntensity === i ? 'primary' : 'default' }),
                  ).join('')}
                </div>
              </section>

              <section class="mgr-card">
                <h2 class="mgr-card__title">Apply</h2>
                <p class="mgr-muted">${describe(selectedFocus, selectedIntensity)}</p>
                ${button({ label: 'Run training session', dataAction: 'run', variant: 'primary', size: 'lg', block: true })}
              </section>

              <section class="mgr-card">
                <h2 class="mgr-card__title">Recent training (${history.length})</h2>
                ${history.length === 0 ? '<p class="mgr-muted">No sessions yet.</p>' : history.map((s) => `<div class="mgr-row" style="padding:6px 0; border-bottom:1px solid var(--border); justify-content:space-between;">
                  <span>${pill({ label: s.focus, tone: 'accent' })} ${pill({ label: s.intensity })}</span>
                  <span class="mgr-muted">${escapeHtml(s.note)}</span>
                </div>`).join('')}
              </section>
            </div>
          </div>
        `;
        bind();
      }

      function bind(): void {
        host.querySelector('[data-action="back"]')?.addEventListener('click', handlers.onBack);
        host.querySelectorAll<HTMLElement>('[data-action="focus"]').forEach((el) =>
          el.addEventListener('click', () => {
            selectedFocus = (el.dataset.f ?? 'fitness') as TrainingFocus;
            rerender();
          }),
        );
        host.querySelectorAll<HTMLElement>('[data-action="intensity"]').forEach((el) =>
          el.addEventListener('click', () => {
            selectedIntensity = (el.dataset.i ?? 'medium') as TrainingIntensity;
            rerender();
          }),
        );
        host.querySelector('[data-action="run"]')?.addEventListener('click', () => {
          console.log(`[training] run focus=${selectedFocus} intensity=${selectedIntensity}`);
          handlers.onRunTraining(selectedFocus, selectedIntensity);
          rerender();
        });
      }

      rerender();
    },
  };
}

function describe(focus: TrainingFocus, intensity: TrainingIntensity): string {
  const intLabel = intensity === 'low' ? 'light' : intensity === 'medium' ? 'moderate' : 'tough';
  return `A ${intLabel} ${focus} session. Expect small trait gains and a condition shift.`;
}
