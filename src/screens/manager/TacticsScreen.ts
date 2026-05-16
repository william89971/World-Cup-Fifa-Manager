import { button } from '../../components/Button';
import { topBar } from '../../components/TopBar';
import { pill } from '../../components/Pill';
import { escapeHtml } from '../../components/colors';
import { mentalityLabel, type ManagerTactics, type Mentality, type TacticSliders } from '../../manager/types';
import { FORMATION_NAMES, TEAM_STYLES, type FormationName, type TeamStyle } from '../../game/playerTypes';
import type { ScreenModule } from '../../app/ScreenRouter';
import type { TournamentState } from '../../tournament/TournamentState';

export interface TacticsScreenProps {
  tournament: TournamentState;
}

export interface TacticsScreenHandlers {
  onBack: () => void;
  onSave: (tactics: ManagerTactics) => void;
  onOpenPitch: () => void;
}

const SLIDER_KEYS: Array<keyof TacticSliders> = ['pressing', 'lineHeight', 'tempo', 'width', 'directness', 'risk', 'buildUp', 'tackling'];

const SLIDER_LABELS: Record<keyof TacticSliders, string> = {
  pressing: 'Pressing intensity',
  lineHeight: 'Defensive line height',
  tempo: 'Tempo',
  width: 'Attacking width',
  directness: 'Passing directness',
  risk: 'Risk level',
  buildUp: 'Build-up speed',
  tackling: 'Tackling aggression',
};

const TEAM_STYLE_BLURB: Record<TeamStyle, string> = {
  possession: 'Keep the ball, drag opponents out of shape.',
  counterAttack: 'Sit deeper, hit on the break.',
  highPress: 'Win the ball high. High stamina drain.',
  defensive: 'Compact low block.',
  balanced: 'No emphasis — uses the squad as-is.',
  directAttack: 'Vertical, get it forward fast.',
};

function summarize(t: ManagerTactics): string {
  const bits: string[] = [];
  bits.push(`${t.formation} · ${formatStyle(t.teamStyle)} · ${mentalityLabel(t.mentality)}.`);
  bits.push(t.sliders.pressing > 65 ? 'High press up the pitch.' : t.sliders.pressing < 35 ? 'Sit off, no press.' : 'Balanced press.');
  bits.push(t.sliders.lineHeight > 65 ? 'High defensive line.' : t.sliders.lineHeight < 35 ? 'Deep defensive block.' : 'Moderate line.');
  bits.push(t.sliders.tempo > 65 ? 'Quick tempo.' : t.sliders.tempo < 35 ? 'Patient.' : 'Steady tempo.');
  bits.push(t.sliders.directness > 65 ? 'Direct passing.' : t.sliders.directness < 35 ? 'Short and patient build-up.' : 'Mix of short and long.');
  bits.push(t.sliders.risk > 65 ? 'High risk.' : t.sliders.risk < 35 ? 'Safety first.' : 'Balanced risk.');
  bits.push(t.sliders.width > 65 ? 'Stretch wide.' : t.sliders.width < 35 ? 'Compact narrow shape.' : 'Average width.');
  return bits.join(' ');
}

function formatStyle(style: TeamStyle): string {
  return style.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

export function createTacticsScreen(handlers: TacticsScreenHandlers): ScreenModule<TacticsScreenProps> {
  return {
    render(host, props) {
      const team = props.tournament.getTeam(props.tournament.selectedTeamId);
      // Local draft state mutated by re-renders.
      const draft: ManagerTactics = JSON.parse(JSON.stringify(props.tournament.selectedTactics));

      function rerender(): void {
        host.innerHTML = `
          <div class="mgr-screen">
            <div class="mgr-container">
              ${topBar({
                eyebrow: 'Manager Mode',
                title: `${team.name} — Tactics`,
                subtitle: summarize(draft),
                backDataAction: 'back',
                actions: [
                  { label: 'Pitch view', dataAction: 'open-pitch' },
                  { label: 'Save tactics', dataAction: 'save', variant: 'primary' },
                ],
              })}

              <section class="mgr-card">
                <h2 class="mgr-card__title">Formation</h2>
                <div class="mgr-row">
                  ${FORMATION_NAMES.map((f) => button({ label: f, dataAction: 'set-formation', dataAttrs: { f }, variant: draft.formation === f ? 'primary' : 'default', size: 'sm' })).join('')}
                </div>
              </section>

              <section class="mgr-card">
                <h2 class="mgr-card__title">Team style</h2>
                <div class="mgr-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                  ${TEAM_STYLES.map((s) => `<button type="button" class="mgr-btn ${draft.teamStyle === s ? 'mgr-btn--primary' : ''}" data-action="set-style" data-s="${s}" style="height:auto; padding:12px; flex-direction:column; gap:6px; text-transform:none; letter-spacing:0;">
                    <strong>${formatStyle(s)}</strong>
                    <span style="font-weight:400; opacity:0.85; font-size:11px; text-transform:none;">${escapeHtml(TEAM_STYLE_BLURB[s])}</span>
                  </button>`).join('')}
                </div>
              </section>

              <section class="mgr-card">
                <h2 class="mgr-card__title">Mentality</h2>
                <div class="mgr-row">
                  ${([-2, -1, 0, 1, 2] as Mentality[]).map((m) => button({ label: mentalityLabel(m), dataAction: 'set-mentality', dataAttrs: { m: String(m) }, variant: draft.mentality === m ? 'primary' : 'default', size: 'sm' })).join('')}
                </div>
              </section>

              <section class="mgr-card">
                <h2 class="mgr-card__title">Tactical sliders</h2>
                <div class="mgr-grid">
                  ${SLIDER_KEYS.map((key) => `
                    <div class="mgr-col">
                      <div class="mgr-row" style="justify-content:space-between;">
                        <strong>${SLIDER_LABELS[key]}</strong>
                        <span class="mgr-mono">${draft.sliders[key]}</span>
                      </div>
                      <input class="mgr-slider" type="range" min="0" max="100" value="${draft.sliders[key]}" data-action="slider" data-key="${key}" />
                    </div>
                  `).join('')}
                </div>
              </section>

              <section class="mgr-card">
                <h2 class="mgr-card__title">Tactical summary</h2>
                <p>${escapeHtml(summarize(draft))}</p>
                <div class="mgr-row" style="margin-top:8px;">
                  ${pill({ label: draft.formation, tone: 'accent' })}
                  ${pill({ label: formatStyle(draft.teamStyle) })}
                  ${pill({ label: mentalityLabel(draft.mentality) })}
                </div>
              </section>

              <div class="mgr-row" style="justify-content:flex-end;">
                ${button({ label: 'Save tactics', dataAction: 'save', variant: 'primary', size: 'lg' })}
              </div>
            </div>
          </div>
        `;
        bind();
      }

      function bind(): void {
        host.querySelector('[data-action="back"]')?.addEventListener('click', handlers.onBack);
        host.querySelector('[data-action="open-pitch"]')?.addEventListener('click', handlers.onOpenPitch);
        host.querySelectorAll('[data-action="set-formation"]').forEach((el) => {
          el.addEventListener('click', () => {
            const f = (el as HTMLElement).dataset.f;
            if (f) { draft.formation = f as FormationName; rerender(); }
          });
        });
        host.querySelectorAll('[data-action="set-style"]').forEach((el) => {
          el.addEventListener('click', () => {
            const s = (el as HTMLElement).dataset.s;
            if (s) { draft.teamStyle = s as TeamStyle; rerender(); }
          });
        });
        host.querySelectorAll('[data-action="set-mentality"]').forEach((el) => {
          el.addEventListener('click', () => {
            const m = Number((el as HTMLElement).dataset.m) as Mentality;
            draft.mentality = m;
            rerender();
          });
        });
        host.querySelectorAll<HTMLInputElement>('[data-action="slider"]').forEach((el) => {
          el.addEventListener('input', () => {
            const key = el.dataset.key as keyof TacticSliders;
            draft.sliders[key] = Number(el.value);
            // Update display without full rerender (keeps focus on slider).
            const row = el.closest('.mgr-col');
            const value = row?.querySelector<HTMLSpanElement>('.mgr-mono');
            if (value) value.textContent = String(draft.sliders[key]);
          });
        });
        host.querySelectorAll('[data-action="save"]').forEach((el) => {
          el.addEventListener('click', () => handlers.onSave(draft));
        });
      }

      rerender();
    },
  };
}
