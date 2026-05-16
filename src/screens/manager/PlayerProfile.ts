import { button } from '../../components/Button';
import { bar } from '../../components/Bar';
import { pill } from '../../components/Pill';
import { topBar } from '../../components/TopBar';
import { escapeHtml, ratingBarClass } from '../../components/colors';
import { findPlayerByKey, playerKey } from '../../tournament/TournamentState';
import { formatRoleLabel, TRAIT_KEYS } from '../../game/playerTypes';
import type { ScreenModule } from '../../app/ScreenRouter';
import type { TournamentState } from '../../tournament/TournamentState';

export interface PlayerProfileProps {
  tournament: TournamentState;
  playerId: string;
}

export interface PlayerProfileHandlers {
  onBack: () => void;
  onSetCaptain: (playerId: string) => void;
  onSaveNotes: (playerId: string, notes: string) => void;
}

function radarSvg(values: number[]): string {
  const n = values.length;
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 28;
  const labels = ['Agg', 'Dis', 'Cre', 'Tea', 'Sht', 'Pas', 'Drb', 'Def', 'Spd', 'Sta', 'Pos', 'Rsk', 'Cmp'];
  const points = values
    .map((v, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const radius = r * Math.max(0.05, v);
      return `${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`;
    })
    .join(' ');
  // grid rings
  const rings = [0.25, 0.5, 0.75, 1].map((scale) => {
    const ring = values
      .map((_, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const radius = r * scale;
        return `${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`;
      })
      .join(' ');
    return `<polygon class="grid" points="${ring}"/>`;
  }).join('');
  const lines = values
    .map((_, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
    }).join('');
  const labelMarkup = values
    .map((_, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = cx + Math.cos(angle) * (r + 14);
      const y = cy + Math.sin(angle) * (r + 14);
      return `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}">${labels[i] ?? ''}</text>`;
    }).join('');
  return `<svg class="mgr-radar" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    ${rings}${lines}
    <polygon class="fill" points="${points}"/>
    ${labelMarkup}
  </svg>`;
}

function sparkline(values: number[]): string {
  if (values.length === 0) return '<span class="mgr-muted">No ratings yet</span>';
  const w = 200; const h = 32;
  const max = 10, min = 0;
  const pts = values
    .map((v, i) => `${((i / Math.max(1, values.length - 1)) * w).toFixed(1)},${((1 - (v - min) / (max - min)) * h).toFixed(1)}`)
    .join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <polyline fill="none" stroke="var(--accent-hi)" stroke-width="2" points="${pts}"/>
    ${values.map((v, i) => `<circle cx="${((i / Math.max(1, values.length - 1)) * w).toFixed(1)}" cy="${((1 - (v - min) / (max - min)) * h).toFixed(1)}" r="2.5" fill="${v >= 7 ? 'var(--success)' : v <= 5 ? 'var(--danger)' : 'var(--warn)'}"/>`).join('')}
  </svg>`;
}

export function createPlayerProfile(handlers: PlayerProfileHandlers): ScreenModule<PlayerProfileProps> {
  return {
    render(host, props) {
      const team = props.tournament.getTeam(props.tournament.selectedTeamId);
      const profile = findPlayerByKey(team, props.playerId);
      if (!profile) {
        host.innerHTML = `<div class="mgr-screen"><div class="mgr-container">${topBar({ eyebrow: 'Player', title: 'Player not found', backDataAction: 'back' })}<p>This player is no longer in your squad.</p></div></div>`;
        host.querySelector('[data-action="back"]')?.addEventListener('click', handlers.onBack);
        return;
      }
      const id = playerKey(team.id, profile);
      const lineup = props.tournament.selectedLineup;
      const isCaptain = lineup?.captainId === id;
      const traitsArr = TRAIT_KEYS.map((k) => profile.traits[k]);
      const cond = profile.condition ?? 100;
      const mor = profile.morale ?? 70;
      const form = profile.form ?? 0;
      const overall = Math.round((traitsArr.reduce((s, v) => s + v, 0) / traitsArr.length) * 100);

      const traitBars = TRAIT_KEYS.map((k) => {
        const v = profile.traits[k];
        const pct = Math.round(v * 100);
        return bar({ value: pct, label: k, showValue: true, colorClass: ratingBarClass(pct) });
      }).join('');

      host.innerHTML = `
        <div class="mgr-screen">
          <div class="mgr-container">
            ${topBar({
              eyebrow: `${team.name} squad`,
              title: `#${profile.number} ${profile.name}`,
              subtitle: `${formatRoleLabel(profile.role)} · ${profile.personality}${isCaptain ? ' · CAPTAIN' : ''}`,
              backDataAction: 'back',
              actions: [
                { label: isCaptain ? 'Captain ✓' : 'Set as captain', dataAction: 'set-captain' },
              ],
            })}

            <div class="mgr-grid">
              <section class="mgr-card">
                <h2 class="mgr-card__title">Overall</h2>
                <div class="mgr-row" style="align-items:center; gap:16px;">
                  <span class="mgr-pill mgr-pill--accent" style="font-size:24px; padding:8px 16px;">${overall}</span>
                  <div class="mgr-col" style="flex:1;">
                    ${bar({ value: cond, label: 'Condition', showValue: true, colorClass: ratingBarClass(cond) })}
                    ${bar({ value: mor, label: 'Morale', showValue: true, colorClass: ratingBarClass(mor) })}
                    <div class="mgr-bar-row">
                      <span class="mgr-bar-row__label">Form</span>
                      <span style="color:${form > 0 ? 'var(--success)' : form < 0 ? 'var(--danger)' : 'var(--text-dim)'}; font-weight:700;">${form > 0 ? '+' : ''}${form.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                <div class="mgr-row" style="margin-top:8px;">${pill({ label: profile.personality, tone: 'accent' })}${pill({ label: profile.role })}${profile.injuredDays ? pill({ label: `Injured ${profile.injuredDays}d`, tone: 'danger' }) : ''}</div>
              </section>
              <section class="mgr-card">
                <h2 class="mgr-card__title">Trait radar</h2>
                <div style="display:flex; justify-content:center;">${radarSvg(traitsArr)}</div>
              </section>
              <section class="mgr-card">
                <h2 class="mgr-card__title">Recent ratings</h2>
                <div style="display:flex; justify-content:center;">${sparkline(profile.recentRatings ?? [])}</div>
                <p class="mgr-muted" style="margin:8px 0 0;">Last ${(profile.recentRatings ?? []).length} matches</p>
              </section>
            </div>

            <section class="mgr-card">
              <h2 class="mgr-card__title">Attributes</h2>
              <div class="mgr-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
                ${traitBars}
              </div>
            </section>

            <section class="mgr-card">
              <h2 class="mgr-card__title">Notes</h2>
              <textarea class="mgr-textarea" data-action="notes" placeholder="Add a private scouting note...">${escapeHtml(profile.notes ?? '')}</textarea>
              <div class="mgr-row" style="justify-content:flex-end;">${button({ label: 'Save note', dataAction: 'save-note', variant: 'primary', size: 'sm' })}</div>
            </section>
          </div>
        </div>
      `;

      host.querySelector('[data-action="back"]')?.addEventListener('click', handlers.onBack);
      host.querySelector('[data-action="set-captain"]')?.addEventListener('click', () => handlers.onSetCaptain(id));
      const textarea = host.querySelector<HTMLTextAreaElement>('[data-action="notes"]');
      host.querySelector('[data-action="save-note"]')?.addEventListener('click', () => {
        if (textarea) handlers.onSaveNotes(id, textarea.value);
      });
    },
  };
}
