import { button } from '../../components/Button';
import { topBar } from '../../components/TopBar';
import { pill } from '../../components/Pill';
import { pitch, type PitchDot } from '../../components/Pitch';
import { escapeHtml, colorToCss } from '../../components/colors';
import { formatRoleLabel, type PlayerRole } from '../../game/playerTypes';
import { playerKey, findPlayerByKey } from '../../tournament/TournamentState';
import type { ScreenModule } from '../../app/ScreenRouter';
import type { TournamentState } from '../../tournament/TournamentState';
import type { LineupDraft } from '../../manager/types';

const ROLE_X: Record<PlayerRole, number> = {
  goalkeeper: 0.5,
  leftBack: 0.10,
  centerBackLeft: 0.35,
  centerBackRight: 0.65,
  rightBack: 0.90,
  defensiveMid: 0.50,
  centralMid: 0.30,
  attackingMid: 0.70,
  leftWing: 0.10,
  rightWing: 0.90,
  striker: 0.50,
};
const ROLE_Y: Record<PlayerRole, number> = {
  goalkeeper: 0.05,
  leftBack: 0.22,
  centerBackLeft: 0.18,
  centerBackRight: 0.18,
  rightBack: 0.22,
  defensiveMid: 0.36,
  centralMid: 0.45,
  attackingMid: 0.62,
  leftWing: 0.62,
  rightWing: 0.62,
  striker: 0.85,
};

export interface FormationPitchProps {
  tournament: TournamentState;
}

export interface FormationPitchHandlers {
  onBack: () => void;
  onSaveLineup: (lineup: LineupDraft) => void;
}

export function createFormationPitchScreen(
  handlers: FormationPitchHandlers,
): ScreenModule<FormationPitchProps> {
  return {
    render(host, props) {
      const tournament = props.tournament;
      const team = tournament.getTeam(tournament.selectedTeamId);
      const draft: LineupDraft = JSON.parse(JSON.stringify(tournament.selectedLineup));
      let selectedId: string | null = null;

      function rerender(): void {
        const teamColor = colorToCss(team.colors.primary);
        const dots: PitchDot[] = draft.startingXI.map((id) => {
          const p = findPlayerByKey(team, id);
          if (!p) return null;
          return {
            x: ROLE_X[p.role],
            y: ROLE_Y[p.role],
            label: `${p.name.split(' ').slice(-1)[0]}`,
            num: String(p.number),
            teamColorHex: teamColor,
            selected: id === selectedId,
            dataAttrs: { id },
          } as PitchDot;
        }).filter((d): d is PitchDot => d !== null);

        const benchList = draft.bench
          .map((id) => {
            const p = findPlayerByKey(team, id);
            if (!p) return '';
            return `<button type="button" class="mgr-btn mgr-btn--block" data-action="bench-pick" data-id="${id}" style="justify-content:flex-start; text-transform:none; letter-spacing:0;">
              <span class="mgr-pill">#${p.number}</span>
              <strong>${escapeHtml(p.name)}</strong>
              <span class="mgr-muted" style="margin-left:auto;">${escapeHtml(formatRoleLabel(p.role))}</span>
            </button>`;
          }).join('');

        const selectedProfile = selectedId ? findPlayerByKey(team, selectedId) : null;
        const drawer = selectedProfile
          ? `<section class="mgr-card mgr-card--accent">
              <h2 class="mgr-card__title">${escapeHtml(selectedProfile.name)} · ${escapeHtml(formatRoleLabel(selectedProfile.role))}</h2>
              <div class="mgr-row">${pill({ label: '#' + selectedProfile.number, tone: 'accent' })}${pill({ label: selectedProfile.personality })}</div>
              <p class="mgr-muted">Tap another starter to swap, or pick from the bench below.</p>
              <div class="mgr-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">${benchList || '<span class="mgr-muted">No bench available.</span>'}</div>
            </section>`
          : `<section class="mgr-card"><p class="mgr-muted">Tap a player on the pitch to select.</p></section>`;

        host.innerHTML = `
          <div class="mgr-screen">
            <div class="mgr-container">
              ${topBar({
                eyebrow: 'Manager Mode',
                title: `${team.name} — Formation`,
                subtitle: `Formation: ${tournament.selectedTactics.formation} · 11 starters on the pitch, 7 on the bench`,
                backDataAction: 'back',
                actions: [{ label: 'Save lineup', dataAction: 'save', variant: 'primary' }],
              })}
              <div class="mgr-grid" style="grid-template-columns: minmax(320px, 1fr) minmax(280px, 1fr);">
                <section class="mgr-card">
                  <h2 class="mgr-card__title">Pitch</h2>
                  ${pitch({ dots, dataAction: 'pick-dot' })}
                </section>
                ${drawer}
              </div>
              <div class="mgr-row" style="justify-content:flex-end;">${button({ label: 'Save lineup', dataAction: 'save', variant: 'primary', size: 'lg' })}</div>
            </div>
          </div>
        `;
        bind();
      }

      function bind(): void {
        host.querySelector('[data-action="back"]')?.addEventListener('click', handlers.onBack);
        host.querySelectorAll('[data-action="save"]').forEach((el) =>
          el.addEventListener('click', () => handlers.onSaveLineup(draft)),
        );
        host.querySelectorAll<HTMLElement>('[data-action="pick-dot"]').forEach((el) => {
          el.addEventListener('click', () => {
            const id = el.dataset.id;
            if (!id) return;
            if (selectedId === id) {
              selectedId = null;
            } else if (selectedId && draft.startingXI.includes(selectedId)) {
              // swap two starters
              const aIdx = draft.startingXI.indexOf(selectedId);
              const bIdx = draft.startingXI.indexOf(id);
              if (aIdx !== -1 && bIdx !== -1) {
                const tmp = draft.startingXI[aIdx];
                draft.startingXI[aIdx] = draft.startingXI[bIdx];
                draft.startingXI[bIdx] = tmp;
              }
              selectedId = null;
            } else {
              selectedId = id;
            }
            rerender();
          });
        });
        host.querySelectorAll<HTMLElement>('[data-action="bench-pick"]').forEach((el) => {
          el.addEventListener('click', () => {
            const benchId = el.dataset.id;
            if (!benchId || !selectedId) return;
            const xiIdx = draft.startingXI.indexOf(selectedId);
            const benchIdx = draft.bench.indexOf(benchId);
            if (xiIdx === -1 || benchIdx === -1) return;
            draft.startingXI[xiIdx] = benchId;
            draft.bench[benchIdx] = selectedId;
            selectedId = null;
            rerender();
          });
        });
      }

      rerender();
      void playerKey; // ensure import kept (used by other modules)
    },
  };
}
